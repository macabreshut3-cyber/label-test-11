import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as xlsx from 'xlsx';
import jwt from 'jsonwebtoken';
import { getFirestore, Firestore, Query } from 'firebase-admin/firestore';
import { cert } from 'firebase-admin/app';
import { initializeApp } from 'firebase-admin/app';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { ProductRecord, ProductDataMetadata } from './src/types';
import { normalizeBarcode } from './src/utils/barcode';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Database Configuration ---
let db: Firestore | null = null;
let useFirestore = false;

// Fallback In-Memory DB (Used when Firebase credentials are not provided)
let inMemoryMetadata: ProductDataMetadata = {
  activeVersion: 'v0',
  originalFileName: 'none',
  totalRows: 0,
  updatedAt: new Date().toISOString()
};
let inMemoryProducts: ProductRecord[] = [];

// Initialize Firebase Admin if Service Account is provided
const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (serviceAccountRaw) {
  try {
    const serviceAccount = JSON.parse(serviceAccountRaw);
    initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore();
    useFirestore = true;
    console.log('Firebase Admin initialized. Using Firestore.');
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Falling back to in-memory store.', err);
  }
} else {
  console.log('No FIREBASE_SERVICE_ACCOUNT_KEY provided. Using in-memory store for preview.');
}

// Multer setup for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() });

const REQUIRED_COLUMNS = ["바코드", "코드번호", "제품명", "링크"];
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_key_fallback';

// --- API Endpoints ---

// 1. Fetch products by barcode
app.get('/api/products/by-barcode/:barcode', async (req, res) => {
  const barcode = normalizeBarcode(req.params.barcode);
  
  if (!barcode) {
    return res.status(400).json({ success: false, message: '바코드가 제공되지 않았습니다.' });
  }

  try {
    let items: ProductRecord[] = [];
    
    if (useFirestore && db) {
      // Fetch metadata to know the active version
      const metaDoc = await db.collection('systemMetadata').doc('productData').get();
      if (!metaDoc.exists) {
        return res.json({ success: true, barcode, count: 0, items: [] });
      }
      
      const activeVersion = metaDoc.data()?.activeVersion;
      if (!activeVersion) {
        return res.json({ success: true, barcode, count: 0, items: [] });
      }

      // Query active version
      const snapshot = await db.collection(`productVersions/${activeVersion}/items`)
        .where('barcode', '==', barcode)
        .get();
        
      items = snapshot.docs.map(doc => doc.data() as ProductRecord);
    } else {
      // Fallback in-memory
      items = inMemoryProducts.filter(p => p.barcode === barcode);
    }

    // Default Sorting: 코드번호 ASC, 제품명 ASC
    items.sort((a, b) => {
      if (a.codeNumber === b.codeNumber) {
        return a.productName.localeCompare(b.productName);
      }
      return a.codeNumber.localeCompare(b.codeNumber);
    });

    res.json({
      success: true,
      barcode,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('Error fetching barcode:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 2. Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '30m' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: '관리자 비밀번호가 올바르지 않습니다.' });
  }
});

// Middleware to verify Admin JWT
const verifyAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: '토큰이 만료되었거나 유효하지 않습니다.' });
  }
};

// 3. Upload Data (Admin)
app.post('/api/admin/upload-data', verifyAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '파일이 제공되지 않았습니다.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.includes('barcode12') 
      ? 'barcode12' 
      : workbook.SheetNames[0];
      
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });
    
    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: '유효 데이터 행이 한 개도 없습니다.' });
    }

    // Validate headers on the first row
    const firstRow = data[0];
    const missingColumns = REQUIRED_COLUMNS.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}` 
      });
    }

    // Validate and map rows
    const validRecords: Omit<ProductRecord, 'id' | 'dataVersion' | 'createdAt'>[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      // Skip completely empty rows
      if (Object.values(row).every(v => v === '')) return;

      const barcodeRaw = row['바코드'];
      const codeNumber = String(row['코드번호'] ?? '').trim();
      const productName = String(row['제품명'] ?? '').trim();
      
      const barcode = normalizeBarcode(barcodeRaw);
      
      if (!barcode) {
        errors.push(`행 ${index + 2}: 바코드가 빈 값입니다.`);
      }
      if (!productName) {
        errors.push(`행 ${index + 2}: 제품명이 빈 값입니다.`);
      }
      
      if (barcode && productName) {
        validRecords.push({
          barcode,
          codeNumber: codeNumber || '번호 없음',
          productName,
          link: String(row['링크'] ?? '').trim(),
          country: row['국가'] ? String(row['국가']).trim() : undefined,
          liquorType: row['주종'] ? String(row['주종']).trim() : undefined,
        });
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '데이터 검증에 실패했습니다. 기존 데이터는 유지됩니다.',
        errors: errors.slice(0, 10) // Only send first 10 errors to avoid huge payload
      });
    }

    if (validRecords.length === 0) {
      return res.status(400).json({ success: false, message: '유효 데이터 행이 한 개도 없습니다.' });
    }

    const versionId = `v_${Date.now()}`;
    const timestamp = new Date().toISOString();

    if (useFirestore && db) {
      const batch = db.batch();
      
      // Write to new version subcollection
      validRecords.forEach((record, idx) => {
        const id = `${record.barcode}_${idx}`;
        const docRef = db!.collection(`productVersions/${versionId}/items`).doc(id);
        batch.set(docRef, {
          ...record,
          id,
          dataVersion: versionId,
          createdAt: timestamp
        });
      });

      // Update metadata
      const metaRef = db.collection('systemMetadata').doc('productData');
      const metaDoc = await metaRef.get();
      const previousVersion = metaDoc.exists ? metaDoc.data()?.activeVersion : null;

      batch.set(metaRef, {
        activeVersion: versionId,
        originalFileName: req.file.originalname,
        totalRows: validRecords.length,
        updatedAt: timestamp
      });

      // Commit the new version
      await batch.commit();

      // Fire and forget deleting the old version (simplification for this example)
      if (previousVersion && previousVersion !== versionId) {
        deleteCollection(db, `productVersions/${previousVersion}/items`, 500).catch(console.error);
      }
    } else {
      // Update In-Memory Store
      inMemoryProducts = validRecords.map((r, i) => ({
        ...r,
        id: `${r.barcode}_${i}`,
        dataVersion: versionId,
        createdAt: timestamp
      }));
      inMemoryMetadata = {
        activeVersion: versionId,
        originalFileName: req.file.originalname,
        totalRows: validRecords.length,
        updatedAt: timestamp
      };
    }

    res.json({
      success: true,
      message: `데이터 업데이트가 완료되었습니다. 총 ${validRecords.length}건이 적용되었습니다.`
    });

  } catch (error) {
    console.error('Upload parsing error:', error);
    res.status(500).json({ success: false, message: '파일 처리 중 오류가 발생했습니다.' });
  }
});

// Utility to delete a collection in Firestore
async function deleteCollection(db: Firestore, collectionPath: string, batchSize: number) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise<void>((resolve, reject) => {
    deleteQueryBatch(db, query as unknown as Query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db: Firestore, query: Query, resolve: () => void) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}


async function seedDataIfEmpty() {
  try {
    const dataPath = path.join(process.cwd(), 'data.xlsx');
    if (!fs.existsSync(dataPath)) {
      console.log('No data.xlsx found in root. Skipping auto-seed.');
      return;
    }

    // Check if we already have data
    if (useFirestore && db) {
      const metaDoc = await db.collection('systemMetadata').doc('productData').get();
      if (metaDoc.exists && metaDoc.data()?.activeVersion) {
        console.log('Firestore already seeded. Skipping auto-seed.');
        return;
      }
    } else {
      if (inMemoryMetadata.totalRows > 0) {
        console.log('In-memory store already seeded. Skipping auto-seed.');
        return;
      }
    }

    console.log('Seeding initial data from data.xlsx...');
    const fileBuffer = fs.readFileSync(dataPath);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.includes('barcode12') 
      ? 'barcode12' 
      : workbook.SheetNames[0];
      
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });
    
    if (!data || data.length === 0) {
      console.log('Auto-seed failed: No valid data found in data.xlsx');
      return;
    }

    const firstRow = data[0];
    const missingColumns = REQUIRED_COLUMNS.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      console.log(`Auto-seed failed: Missing required columns: ${missingColumns.join(', ')}`);
      return;
    }

    const validRecords: Omit<ProductRecord, 'id' | 'dataVersion' | 'createdAt'>[] = [];

    data.forEach((row, index) => {
      if (Object.values(row).every(v => v === '')) return;

      const barcodeRaw = row['바코드'];
      const codeNumber = String(row['코드번호'] ?? '').trim();
      const productName = String(row['제품명'] ?? '').trim();
      const barcode = normalizeBarcode(barcodeRaw);
      
      if (barcode && productName) {
        validRecords.push({
          barcode,
          codeNumber: codeNumber || '번호 없음',
          productName,
          link: String(row['링크'] ?? '').trim(),
          country: row['국가'] ? String(row['국가']).trim() : undefined,
          liquorType: row['주종'] ? String(row['주종']).trim() : undefined,
        });
      }
    });

    if (validRecords.length === 0) {
      console.log('Auto-seed failed: No valid records to insert.');
      return;
    }

    const versionId = `v_${Date.now()}`;
    const timestamp = new Date().toISOString();

    if (useFirestore && db) {
      // For large files, we might need multiple batches (firestore limit is 500 ops per batch)
      const batches = [];
      let currentBatch = db.batch();
      let opCount = 0;

      validRecords.forEach((record, idx) => {
        const id = `${record.barcode}_${idx}`;
        const docRef = db!.collection(`productVersions/${versionId}/items`).doc(id);
        currentBatch.set(docRef, {
          ...record,
          id,
          dataVersion: versionId,
          createdAt: timestamp
        });
        opCount++;

        if (opCount === 490) { // Safety margin
          batches.push(currentBatch.commit());
          currentBatch = db.batch();
          opCount = 0;
        }
      });
      
      const metaRef = db.collection('systemMetadata').doc('productData');
      currentBatch.set(metaRef, {
        activeVersion: versionId,
        originalFileName: 'data.xlsx (Auto-seeded)',
        totalRows: validRecords.length,
        updatedAt: timestamp
      });
      batches.push(currentBatch.commit());

      await Promise.all(batches);
      console.log(`Firestore seeded successfully with ${validRecords.length} records.`);
    } else {
      inMemoryProducts = validRecords.map((r, i) => ({
        ...r,
        id: `${r.barcode}_${i}`,
        dataVersion: versionId,
        createdAt: timestamp
      }));
      inMemoryMetadata = {
        activeVersion: versionId,
        originalFileName: 'data.xlsx (Auto-seeded)',
        totalRows: validRecords.length,
        updatedAt: timestamp
      };
      console.log(`In-memory store seeded successfully with ${validRecords.length} records.`);
    }

  } catch (error) {
    console.error('Failed to auto-seed data.xlsx:', error);
  }
}

// --- Vite Dev Middleware & Static Serving ---
async function startServer() {
  await seedDataIfEmpty();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
