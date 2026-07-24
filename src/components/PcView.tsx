import React, { useEffect, useRef, useState } from 'react';
import { Search, Settings, FileImage, Copy, Check } from 'lucide-react';
import { ProductRecord } from '../types';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="링크 복사"
      className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors ml-2"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

interface PcViewProps {
  onSearch: (barcode: string) => void;
  onOpenAdmin: () => void;
  products: ProductRecord[];
  isLoading: boolean;
  error: string | null;
  onSwitchToMobile: () => void;
}

export default function PcView({ onSearch, onOpenAdmin, products, isLoading, error, onSwitchToMobile }: PcViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto focus input on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Refocus after loading finishes to allow continuous scanning
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      if (val) {
        onSearch(val);
        // Clear input for next scan
        e.currentTarget.value = '';
      }
    }
  };

  const handleSearchClick = () => {
    const val = inputRef.current?.value.trim();
    if (val) {
      onSearch(val);
      inputRef.current!.value = '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">PC 바코드 조회</h2>
          <p className="text-gray-500 mt-1">USB 바코드 스캐너를 사용하거나 바코드 번호를 입력하세요.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onSwitchToMobile}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <span>모바일 화면으로</span>
          </button>
          <button
            onClick={onOpenAdmin}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>관리자 모드</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-4 mb-8">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            disabled={isLoading}
            onKeyDown={handleKeyDown}
            placeholder="바코드 입력 후 Enter..."
            className="block w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSearchClick}
          disabled={isLoading}
          className="px-8 py-4 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 active:bg-gray-950 transition-colors disabled:opacity-50"
        >
          조회
        </button>
      </div>

      {error && (
        <div className="w-full p-4 mb-8 bg-red-50 text-red-700 border border-red-100 rounded-xl text-center">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="w-full p-8 text-center text-gray-500 animate-pulse bg-white rounded-xl border border-gray-100">
          제품 정보를 조회하고 있습니다.
        </div>
      )}

      {products.length > 0 && !isLoading && (
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700 w-1/4">코드번호</th>
                <th className="px-6 py-4 font-semibold text-gray-700 w-1/2">제품명</th>
                <th className="px-6 py-4 font-semibold text-gray-700 w-1/4">시안</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-900 font-medium">{product.codeNumber}</td>
                  <td className="px-6 py-4 text-gray-700">{product.productName}</td>
                  <td className="px-6 py-4">
                    {product.link ? (
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            const trimmed = product.link.trim();
                            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                              window.open(trimmed, '_blank');
                              return;
                            }
                            navigator.clipboard.writeText(trimmed).then(() => {
                              alert(`웹 브라우저 보안 정책상 파일 탐색기를 직접 열 수 없습니다.\n\n경로가 클립보드에 복사되었으니:\n1. 파일 탐색기(Win + E)를 엽니다.\n2. 주소창에 붙여넣기(Ctrl + V) 한 후 Enter를 누르세요.\n\n복사된 경로: ${trimmed}`);
                            }).catch(() => {
                              alert(`파일 경로: ${trimmed}\n(브라우저에서 직접 열 수 없는 경로입니다. 복사하여 탐색기에서 열어주세요.)`);
                            });
                          }}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <FileImage className="w-4 h-4 mr-2" />
                          시안보기
                        </button>
                        <CopyButton text={product.link} />
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">링크 없음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
