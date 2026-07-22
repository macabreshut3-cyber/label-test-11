import { useEffect, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import MobileView from './components/MobileView';
import PcView from './components/PcView';
import AdminModal from './components/AdminModal';
import { ProductRecord, SearchResponse } from './types';
import { dbService } from './utils/db';

export default function App() {
  const [isMobile, setIsMobile] = useState(false);
  const [manualView, setManualView] = useState<'mobile' | 'pc' | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Seed initial data if needed
    dbService.seedDataIfEmpty();

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSearch = async (barcode: string) => {
    if (!barcode) return;
    
    setIsLoading(true);
    setError(null);
    setProducts([]);

    try {
      const items = await dbService.searchProducts(barcode);
      
      if (items.length === 0) {
        setError('등록되지 않은 바코드입니다.');
      } else {
        setProducts(items);
      }
    } catch (err) {
      console.error(err);
      setError('제품 정보를 조회하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const showMobileView = manualView === 'mobile' || (isMobile && manualView !== 'pc');

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center space-x-3">
          <div className="p-2 bg-gray-900 text-white rounded-lg">
            <ScanBarcode className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            라벨 바코드 조회
          </h1>
        </div>
      </header>

      <main>
        {showMobileView ? (
          <MobileView 
            onSearch={handleSearch} 
            products={products} 
            isLoading={isLoading} 
            error={error} 
            onSwitchToPc={() => setManualView('pc')}
          />
        ) : (
          <PcView 
            onSearch={handleSearch} 
            onOpenAdmin={() => setIsAdminOpen(true)}
            products={products} 
            isLoading={isLoading} 
            error={error} 
            onSwitchToMobile={() => setManualView('mobile')}
          />
        )}
      </main>

      <AdminModal 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
      />
    </div>
  );
}
