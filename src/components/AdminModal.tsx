import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Lock } from 'lucide-react';
import { dbService } from '../utils/db';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminModal({ isOpen, onClose }: AdminModalProps) {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD || '1234';
    
    if (password === expectedPassword) {
      setToken('authenticated');
    } else {
      setError('관리자 비밀번호가 올바르지 않습니다.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await dbService.updateData(file);
      
      if (result.success) {
        setSuccessMsg(result.message);
      } else {
        setError(result.message || '데이터를 업데이트하지 못했습니다. 기존 데이터는 유지됩니다.');
        if (result.errors && result.errors.length > 0) {
          setError(prev => `${prev}\n\n상세 오류:\n${result.errors!.join('\n')}`);
        }
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">관리자 모드</h2>
          </div>

          {!token ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                  autoFocus
                />
              </div>
              
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? '인증 중...' : '확인'}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                <p>새로운 Excel (xlsx) 데이터를 업로드하여 기존 데이터를 교체합니다.</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>필수 컬럼: 바코드, 코드번호, 제품명, 링크</li>
                  <li>"barcode12" 시트 우선 적용</li>
                </ul>
              </div>

              <input
                type="file"
                accept=".xlsx"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center justify-center py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-700 font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-5 h-5 mr-2 text-green-600" />
                {loading ? '업로드 중...' : '새 data.xlsx 적용'}
              </button>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 p-4 rounded-xl border border-red-100 whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="text-sm text-green-700 bg-green-50 p-4 rounded-xl border border-green-100">
                  {successMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
