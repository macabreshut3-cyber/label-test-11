import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Monitor } from 'lucide-react';
import { ProductRecord } from '../types';
import { BrowserMultiFormatReader, DecodeHintType } from '@zxing/library';

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

    const url = URL.createObjectURL(file);
    const img = new Image();

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      // 1. Try Native BarcodeDetector (Chrome/Android/iOS 17+)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf']
          });
          const barcodes = await detector.detect(img);
          if (barcodes.length > 0) {
            onSearch(barcodes[0].rawValue);
            return;
          }
        } catch (err) {
          console.warn('Native BarcodeDetector failed', err);
        }
      }

      // 2. Fallback to ZXing
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      
      // Try 2.1: Original Image
      try {
        const result = await reader.decodeFromImageElement(img);
        onSearch(result.getText());
        return;
      } catch (err) {
        console.warn('ZXing original image failed, trying resized/processed...', err);
      }

      // Try 2.2: iOS / High-Res Photo Fix: Downscale via Canvas
      const MAX_DIMENSION = 1200;
      let width = img.width;
      let height = img.height;

      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas not supported');
        
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const resizedImage = new Image();
      resizedImage.src = canvas.toDataURL('image/jpeg', 0.9);
      await new Promise((resolve, reject) => {
        resizedImage.onload = resolve;
        resizedImage.onerror = reject;
      });
      
      try {
        const result = await reader.decodeFromImageElement(resizedImage);
        onSearch(result.getText());
        return;
      } catch (err) {
        console.warn('ZXing resized image failed, trying rotated...', err);
      }

      // Try 2.3: Rotate the image by 90 degrees
      canvas.width = height; // swapped
      canvas.height = width;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(resizedImage, -width / 2, -height / 2, width, height);

      const rotatedImage = new Image();
      rotatedImage.src = canvas.toDataURL('image/jpeg', 0.9);
      await new Promise((resolve, reject) => {
        rotatedImage.onload = resolve;
        rotatedImage.onerror = reject;
      });

      try {
        const result = await reader.decodeFromImageElement(rotatedImage);
        onSearch(result.getText());
        return;
      } catch (err) {
        throw new Error('All decoding attempts failed.');
      }

    } catch (err) {
      console.error('Barcode reading failed:', err);
      setLocalError('이미지에서 바코드를 인식하지 못했습니다. 바코드가 가로 방향으로 선명하게 보이도록 다시 촬영해 주세요.');
    } finally {
      URL.revokeObjectURL(url);
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
