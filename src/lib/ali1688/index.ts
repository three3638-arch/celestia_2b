/**
 * ali1688 模块入口
 *
 * 约束：所有 1688 开放平台调用必须通过本模块完成，禁止在其他模块实现签名或直接请求 1688。
 */

// 配置
export { get1688Config, type Ali1688Config } from './config';

// 签名
export { sign } from './signature';

// HTTP 客户端
export { buildApiUrl, addSignatureToParams, callApi, type ParamDic } from './client';

// 业务 API
export { querySellerOfferList, queryProductDetail } from './api';

// 类型
export type {
  SellerOfferListResponse,
  OfferListItem,
  ProductDetailResponse,
  ProductDetail,
  ProductSkuInfo,
  SkuAttribute,
} from './types';