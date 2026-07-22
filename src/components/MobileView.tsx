import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Monitor } from 'lucide-react';
import { ProductRecord } from '../types';
import { BrowserMultiFormatReader } from '@zxing/library';

interface MobileViewProps {
  onSearch: (barcode: string) => void;
  products: ProductRecord[];
  isLoading: boolean;
  error: string | null;
  onSwitchToPc: () => void;
}

export default function MobileView({ onSearch, products, isLoading, error, onSwitchToPc }: MobileViewProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalError(null);

    try {
      // 1. Try Native BarcodeDetector (Chrome/Android)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf']
          });
          const bitmap = await createImageBitmap(file);
          const barcodes = await detector.detect(bitmap);
          if (barcodes.length > 0) {
            onSearch(barcodes[0].rawValue);
            return;
          }
        } catch (err) {
          console.warn('Native BarcodeDetector failed', err);
        }
      }

      // 2. Fallback to ZXing
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // iOS / High-Res Photo Fix: Downscale via Canvas
      const MAX_DIMENSION = 1200;
      let width = img.width;
      let height = img.height;

      let decodeTarget = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedImage = new Image();
          resizedImage.src = canvas.toDataURL('image/jpeg', 0.9);
          await new Promise((resolve, reject) => {
            resizedImage.onload = resolve;
            resizedImage.onerror = reject;
          });
          decodeTarget = resizedImage;
        }
      }

      const result = await reader.decodeFromImageElement(decodeTarget);
      URL.revokeObjectURL(url);
      
      onSearch(result.getText());

    } catch (err) {
      console.error('Barcode reading failed:', err);
      setLocalError('이미지에서 바코드를 인식하지 못했습니다. 바코드가 선명하게 보이도록 다시 촬영해 주세요.');
    } finally {
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-4 space-y-6">
      
      {/* Hidden file inputs */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="grid grid-cols-2 gap-4 w-full">
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isLoading}
          className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <Camera className="w-10 h-10 text-gray-700 mb-3" />
          <span className="text-gray-900 font-medium">사진 촬영</span>
        </button>

        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={isLoading}
          className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <ImageIcon className="w-10 h-10 text-gray-700 mb-3" />
          <span className="text-gray-900 font-medium">갤러리에서 선택</span>
        </button>
      </div>
      
      <button
        onClick={onSwitchToPc}
        className="flex items-center justify-center w-full p-4 mt-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
      >
        <Monitor className="w-5 h-5 mr-2 text-gray-600" />
        PC 화면으로 전환하기
      </button>

      {(error || localError) && (
        <div className="w-full p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm text-center">
          {localError || error}
        </div>
      )}

      {isLoading && (
        <div className="w-full p-4 text-center text-gray-500 animate-pulse">
          제품 정보를 조회하고 있습니다.
        </div>
      )}

      {products.length > 0 && !isLoading && (
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">코드번호</th>
                <th className="px-4 py-3 font-semibold text-gray-700">제품명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-gray-900">{product.codeNumber}</td>
                  <td className="px-4 py-4 text-gray-900">{product.productName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
