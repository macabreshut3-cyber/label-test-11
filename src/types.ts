export interface ProductRecord {
  id: string;
  barcode: string;
  codeNumber: string;
  productName: string;
  link: string;
  country?: string;
  liquorType?: string;
  dataVersion: string;
  createdAt: string;
}

export interface ProductDataMetadata {
  activeVersion: string;
  originalFileName: string;
  totalRows: number;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface SearchResponse {
  success: boolean;
  barcode: string;
  count: number;
  items: ProductRecord[];
  message?: string;
}
