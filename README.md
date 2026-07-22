# Label Barcode Scanner (라벨 바코드 조회 앱)

This application is a responsive web application designed to scan barcodes and look up associated product information (code number, product name, draft image) from an uploaded Excel file (`data.xlsx`).

## Features

- **Mobile View**: Dedicated layout for mobile devices featuring direct camera capture and gallery selection. Barcodes are detected directly within the browser using the native BarcodeDetector API, with a fallback to ZXing.
- **PC View**: Dedicated layout for desktop environments supporting USB Barcode Scanners (keyboard input) and manual text entry. Supports "시안보기" (Draft View) linking to external web URLs or internal UNC network paths.
- **Admin Mode**: Secure PC-only interface for uploading new `data.xlsx` files. The app parses the Excel file, validates required columns, and updates the active dataset seamlessly without dropping existing data on validation failure.

## Note on UNC Path Security

Due to modern browser security policies (especially in Chromium-based browsers), opening local file URIs (`file:///...`) or UNC paths from an `http://` or `https://` origin is generally blocked for security reasons. 

When clicking **"시안보기"** for a UNC path (e.g., `\\192.168.0.1\share\file.png`):
- The app generates a properly formatted `file://///...` link.
- Clicking the link might be silently blocked by the browser. 
- **Workaround**: Users may need to install a browser extension that allows local file links (e.g., "Enable local file links" extension) or manually copy and paste the path into their Windows file explorer.

## Execution & Deployment

### Local Development

1. Ensure packages are installed:
   ```bash
   npm install
   ```
2. Run the development server (Full-stack Express + Vite):
   ```bash
   npm run dev
   ```

### Firebase Persistence

By default, without Firebase configuration, the application runs using an **in-memory database** for instant previewing. Any uploaded data will be lost when the server restarts.

To enable persistent Cloud Firestore storage:
1. Ensure your Firebase project has Firestore enabled.
2. Generate a Service Account Key (JSON) from the Firebase Console (Project Settings > Service accounts).
3. Set the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable with the raw JSON string:
   ```env
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
   ```
4. Restart the server. The application will automatically detect the key and switch to Firestore persistence.

### Production Deployment

To build for production (Cloud Run, Render, etc.):
```bash
npm run build
npm run start
```
