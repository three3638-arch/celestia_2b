/**
 * 以图搜商品：入参、出参类型（与 DESIGN-FIND-SUPPLIER、1688-IMAGE-QUERY-API 对齐）
 */

export interface ImageSearchOptions {
  country?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

/** 标准化商品条目（供 find-supplier 使用） */
export interface CandidateProduct {
  offerId: string;
  imageUrl: string;
  subject: string;
  priceInfo: {
    price?: string;
    consignPrice?: string;
    promotionPrice?: string;
  };
  tradeScore?: string;
  monthSold?: number;
  minOrderQuantity?: number;
  isOnePsale?: boolean;
  shippingTimeGuarantee?: string;
}

export interface ImageSearchResult {
  data: CandidateProduct[];
  totalRecords?: number;
  totalPage?: number;
  currentPage?: number;
  pageSize?: number;
}
