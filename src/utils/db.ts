import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { ProductRecord, ProductDataMetadata } from '../types';
import * as xlsx from 'xlsx';
import { normalizeBarcode } from './barcode';

const REQUIRED_COLUMNS = ["바코드", "코드번호", "제품명", "링크"];

export const dbService = {
  async getMetadata(): Promise<ProductDataMetadata | null> {
    try {
      const docRef = doc(db, 'systemMetadata', 'productData');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as ProductDataMetadata;
      }
      return null;
    } catch (e) {
      console.error('getMetadata error:', e);
      return null;
    }
  },

  async searchProducts(barcode: string): Promise<ProductRecord[]> {
    try {
      const meta = await this.getMetadata();
      if (!meta || !meta.activeVersion) return [];

      const itemsRef = collection(db, `productVersions/${meta.activeVersion}/items`);
      const q = query(itemsRef, where("barcode", "==", barcode));
      const snapshot = await getDocs(q);

      const matches = snapshot.docs.map(doc => doc.data() as ProductRecord);
      
      matches.sort((a, b) => {
        if (a.codeNumber === b.codeNumber) {
          return a.productName.localeCompare(b.productName);
        }
        return a.codeNumber.localeCompare(b.codeNumber);
      });
      
      return matches;
    } catch (e) {
      console.error('searchProducts error:', e);
      return [];
    }
  },

  async updateData(file: File): Promise<{ success: boolean; message: string; errors?: string[] }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(arrayBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames.includes('barcode12') 
        ? 'barcode12' 
        : workbook.SheetNames[0];
        
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });
      
      if (!data || data.length === 0) {
        return { success: false, message: '유효 데이터 행이 한 개도 없습니다.' };
      }

      const firstRow = data[0];
      const missingColumns = REQUIRED_COLUMNS.filter(col => !(col in firstRow));
      
      if (missingColumns.length > 0) {
        return { 
          success: false, 
          message: `필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}` 
        };
      }

      const validRecords: ProductRecord[] = [];
      const errors: string[] = [];
      const versionId = `v_${Date.now()}`;
      const timestamp = new Date().toISOString();

      data.forEach((row, index) => {
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
            id: `${barcode}_${index}`,
            barcode,
            codeNumber: codeNumber || '번호 없음',
            productName,
            link: String(row['링크'] ?? '').trim(),
            country: row['국가'] ? String(row['국가']).trim() : undefined,
            liquorType: row['주종'] ? String(row['주종']).trim() : undefined,
            dataVersion: versionId,
            createdAt: timestamp
          });
        }
      });

      if (errors.length > 0) {
        return { 
          success: false, 
          message: '데이터 검증에 실패했습니다. 기존 데이터는 유지됩니다.',
          errors: errors.slice(0, 10)
        };
      }

      if (validRecords.length === 0) {
        return { success: false, message: '유효 데이터 행이 한 개도 없습니다.' };
      }

      // We need to batch write these items to Firestore
      const previousMeta = await this.getMetadata();
      const previousVersion = previousMeta?.activeVersion;

      // Max 500 writes per batch in Firestore. Let's do batch writes.
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      for (let i = 0; i < validRecords.length; i++) {
        const record = validRecords[i];
        const docRef = doc(db, `productVersions/${versionId}/items`, record.id);
        currentBatch.set(docRef, record);
        operationCount++;

        if (operationCount === 490) { // Safety margin
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      }

      // Metadata update
      const metaRef = doc(db, 'systemMetadata', 'productData');
      currentBatch.set(metaRef, {
        activeVersion: versionId,
        originalFileName: file.name,
        totalRows: validRecords.length,
        updatedAt: timestamp
      });
      batches.push(currentBatch.commit());

      await Promise.all(batches);

      // Clean up previous version asynchronously to not block the UI response
      if (previousVersion && previousVersion !== versionId) {
        this.deleteVersion(previousVersion).catch(err => {
          console.error('Failed to cleanup previous version:', err);
        });
      }

      return {
        success: true,
        message: `데이터 업데이트가 완료되었습니다. 총 ${validRecords.length}건이 적용되었습니다.`
      };

    } catch (e) {
      console.error('updateData error:', e);
      return { success: false, message: '파일 처리 중 오류가 발생했습니다.' };
    }
  },

  async deleteVersion(versionId: string) {
    try {
      const itemsRef = collection(db, `productVersions/${versionId}/items`);
      const snapshot = await getDocs(itemsRef);
      
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      snapshot.docs.forEach(docSnap => {
        currentBatch.delete(docSnap.ref);
        operationCount++;
        
        if (operationCount === 490) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });
      
      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
      console.log(`Deleted version: ${versionId}`);
    } catch (e) {
      console.error('deleteVersion error:', e);
    }
  },

  async seedDataIfEmpty() {
    try {
      const meta = await this.getMetadata();
      if (meta && meta.activeVersion) {
        return; // Already seeded
      }
      
      // Attempt to fetch data.xlsx from public folder
      const res = await fetch('/data.xlsx');
      if (!res.ok) return; // Ignore if not available
      
      const blob = await res.blob();
      const file = new File([blob], 'data.xlsx');
      
      await this.updateData(file);
      console.log('Seeded initial data from /data.xlsx to Firestore');
    } catch (e) {
      console.error('Auto-seed failed', e);
    }
  }
};
