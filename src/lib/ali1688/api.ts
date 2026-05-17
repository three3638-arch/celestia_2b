/**
 * 1688 开放平台业务 API 封装
 *
 * 封装 querySellerOfferList 和 queryProductDetail 两个核心接口。
 * 所有调用通过 client.callApi 完成，确保签名与请求格式一致。
 */

import { get1688Config, type Ali1688Config } from './config';
import { callApi } from './client';
import type {
  SellerOfferListResponse,
  ProductDetailResponse,
} from './types';

const NAMESPACE = 'com.alibaba.fenxiao.crossborder';

/**
 * 构建 API urlPath（不含 /openapi/ 前缀）
 * 格式：param2/1/{namespace}/{apiName}/{appKey}
 */
function buildApiPath(apiName: string, appKey: string): string {
  return `param2/1/${NAMESPACE}/${apiName}/${appKey}`;
}

/**
 * 获取商户商品清单（分页）
 *
 * 接口：com.alibaba.fenxiao.crossborder:product.search.querySellerOfferList
 * 业务参数名：offerQueryParam（JSON字符串）
 * 必传字段：sellerOpenId, beginPage, pageSize, country
 *
 * @param sellerOpenId - 商户的 OpenID
 * @param beginPage - 起始页码（从 1 开始）
 * @param pageSize - 每页条数
 * @param config - 若未传则从环境变量读取
 */
export async function querySellerOfferList(
  sellerOpenId: string,
  beginPage: number,
  pageSize: number,
  config?: Ali1688Config
): Promise<SellerOfferListResponse> {
  const cfg = config ?? get1688Config();
  const apiPath = buildApiPath('product.search.querySellerOfferList', cfg.appKey);

  const offerQueryParam = {
    sellerOpenId,
    beginPage,
    pageSize,
    country: 'en',
  };

  const extraParams = {
    offerQueryParam: JSON.stringify(offerQueryParam),
  };

  return callApi<SellerOfferListResponse>(apiPath, extraParams, cfg);
}

/**
 * 获取商品详情
 *
 * 接口：com.alibaba.fenxiao.crossborder:product.search.queryProductDetail
 * 业务参数名：offerDetailParam（JSON字符串）
 * 必传字段：offerId, country
 *
 * @param offerId - 商品 ID
 * @param config - 若未传则从环境变量读取
 */
export async function queryProductDetail(
  offerId: number,
  config?: Ali1688Config
): Promise<ProductDetailResponse> {
  const cfg = config ?? get1688Config();
  const apiPath = buildApiPath('product.search.queryProductDetail', cfg.appKey);

  const offerDetailParam = {
    offerId,
    country: 'en',
  };

  const extraParams = {
    offerDetailParam: JSON.stringify(offerDetailParam),
  };

  return callApi<ProductDetailResponse>(apiPath, extraParams, cfg);
}