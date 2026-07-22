# Label Barcode Scanner (라벨 바코드 조회 앱)

This application is a responsive web application designed to scan barcodes and look up associated product information (code number, product name, draft image) from an uploaded Excel file (`data.xlsx`).

## 🚀 Vercel / GitHub Pages Deploy Fix (100% Client-Side SPA)

기존의 Express 백엔드 서버 방식은 Vercel이나 GitHub Pages 같은 정적 호스팅 환경에서 동작하지 않아 네트워크 오류가 발생했습니다.
이를 해결하고 데이터가 영구적으로 유지되도록 하기 위해, **서버 없이 클라이언트에서 직접 Firebase Firestore 데이터베이스를 활용하는 100% SPA(Single Page Application)** 구조로 변경했습니다.

이제 Vercel에 배포해도 네트워크 오류 없이 정상적으로 엑셀 파일 업로드, 파싱, 그리고 바코드 검색 기능이 완벽하게 동작하며, 새로고침을 하거나 다른 환경에서 접속해도 Firebase에 데이터가 안전하게 유지됩니다.

## Features

- **Mobile View**: Dedicated layout for mobile devices featuring direct camera capture and gallery selection. Barcodes are detected directly within the browser using the native BarcodeDetector API, with a fallback to ZXing.
- **PC View**: Dedicated layout for desktop environments supporting USB Barcode Scanners (keyboard input) and manual text entry. Supports "시안보기" (Draft View) linking to external web URLs or internal UNC network paths. 
- **Admin Mode**: Secure interface for uploading new `data.xlsx` files. The app parses the Excel file entirely in the browser and saves it directly to Firebase Firestore.
- **Persistent Storage**: Uploaded Excel data is saved securely in the cloud via **Firebase Firestore**, meaning data is retained across sessions and page reloads, and previous versions of data are automatically cleaned up when a new file is uploaded.

## Note on UNC Path Security

Due to modern browser security policies (especially in Chromium-based browsers), opening local file URIs (`file:///...`) or UNC paths from an `http://` or `https://` origin is generally blocked for security reasons. 

When clicking **"시안보기"** for a UNC path (e.g., `\\192.168.0.1\share\file.png`):
- The app generates a properly formatted `file://///...` link and also provides a **Copy Link** button next to it.
- Clicking the link might be silently blocked by the browser. 
- **Workaround**: Click the **Copy** button to copy the UNC path, and paste it manually into your Windows file explorer.

## Execution & Deployment

### Local Development

1. Ensure packages are installed:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```

### Admin Password Configuration

To change the default admin password (`1234`), set the `VITE_ADMIN_PASSWORD` environment variable in a `.env` file at the root of the project:

```env
VITE_ADMIN_PASSWORD=your_secure_password
```

### Production Deployment (Vercel)

1. Connect your GitHub repository to Vercel.
2. Vercel will automatically detect it as a Vite project.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Deploy! No further configuration is needed.
