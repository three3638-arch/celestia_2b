/**
 * 1688 开放平台 API 响应类型定义
 */

// ─── 商品清单响应 ───

export interface SellerOfferListResponse {
  success: boolean;
  code?: string;
  message?: string;
  result?: {
    totalRecords: number;
    totalPage: number;
    pageSize: number;
    currentPage: number;
    data: OfferListItem[];
  };
}

export interface OfferListItem {
  offerId: number;
  imageUrl: string;
  subject: string;
  subjectTrans?: string;
  priceInfo: {
    price?: string;
    consignPrice?: string;
    jxhyPrice?: string;
  };
  monthSold?: number;
  promotionURL?: string;
}

// ─── 商品详情响应 ───

export interface ProductDetailResponse {
  success: boolean;
  code?: string;
  message?: string;
  result?: ProductDetail;
}

export interface ProductDetail {
  offerId: number;
  categoryId?: number;
  categoryName?: string;
  subject: string;
  subjectTrans?: string;
  productImage?: {
    images?: string[];
    whiteImage?: string;
  };
  productSkuInfos?: ProductSkuInfo[];
  productSaleInfo?: {
    priceRangeList?: { startQuantity: number; price: string }[];
  };
}

export interface ProductSkuInfo {
  skuId: number;
  specId?: string;
  price?: string;
  amountOnSale?: number;
  skuAttributes?: SkuAttribute[];
}

export interface SkuAttribute {
  attributeId?: number;
  attributeName: string;
  attributeNameTrans?: string;
  value: string;
  valueTrans?: string;
  skuImageUrl?: string;
}