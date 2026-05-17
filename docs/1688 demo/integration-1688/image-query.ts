/**
 * 1688 以图搜商品：imageQuery 调用与 DTO 映射
 * 规范：docs/1688-IMAGE-QUERY-API.md、docs/1688-SIGNATURE-AND-CALL.md
 *
 * 接口：com.alibaba.fenxiao.crossborder:product.search.imageQuery
 * 请求方式：POST；业务参数 offerQueryParam 使用 imageId（由 product.image.upload 获取），不使用 imageAddress。
 */

import { get1688Config, type Aliyun1688Config } from './config.js';
import { addSignatureToParams, type ParamDic } from './client.js';
import type {
  ImageSearchOptions,
  ImageSearchResult,
  CandidateProduct,
} from './image-query-types.js';

const NAMESPACE = 'com.alibaba.fenxiao.crossborder';
const IMAGE_QUERY_API_NAME = 'product.search.imageQuery';

/**
 * 构建 imageQuery 的 urlPath（不含 /openapi/ 前缀）
 * 格式：param2/1/{namespace}/{apiName}/{appKey}
 */
function buildImageQueryUrlPath(appKey: string): string {
  return `param2/1/${NAMESPACE}/${IMAGE_QUERY_API_NAME}/${appKey}`;
}

/** 1688 原始 data[] 单条（仅用到的字段） */
interface RawOfferItem {
  offerId?: number | string;
  subject?: string;
  imageUrl?: string;
  priceInfo?: { price?: string; consignPrice?: string; promotionPrice?: string };
  tradeScore?: string;
  monthSold?: number;
  minOrderQuantity?: number;
  isOnePsale?: boolean;
  productSimpleShippingInfo?: { shippingTimeGuarantee?: string };
}

/** 1688 响应 result 结构 */
interface RawApiResult {
  success?: boolean;
  code?: string | number;
  message?: string;
  result?: {
    totalRecords?: number;
    totalPage?: number;
    currentPage?: number;
    pageSize?: number;
    data?: RawOfferItem[];
  };
}

function mapItemToCandidate(item: RawOfferItem): CandidateProduct {
  const offerId = item.offerId != null ? String(item.offerId) : '';
  const priceInfo = item.priceInfo ?? {};
  return {
    offerId,
    imageUrl: item.imageUrl ?? '',
    subject: item.subject ?? '',
    priceInfo: {
      price: priceInfo.price,
      consignPrice: priceInfo.consignPrice,
      promotionPrice: priceInfo.promotionPrice,
    },
    tradeScore: item.tradeScore,
    monthSold: item.monthSold,
    minOrderQuantity: item.minOrderQuantity,
    isOnePsale: item.isOnePsale,
    shippingTimeGuarantee: item.productSimpleShippingInfo?.shippingTimeGuarantee,
  };
}

/**
 * 以 imageId（由 product.image.upload 返回）调用 1688 以图搜，返回标准化商品列表
 * 推荐流程：先调用 uploadImageTo1688(buffer) 获取 imageId，再调用本方法。
 */
export async function imageSearchByImageId(
  imageId: string,
  options?: ImageSearchOptions
): Promise<ImageSearchResult> {
  const config = get1688Config();
  const urlPath = buildImageQueryUrlPath(config.appKey);

  const beginPage = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20));
  const country = options?.country ?? 'en';

  const offerQueryParam = {
    imageId,
    beginPage,
    pageSize,
    country,
    userId: 0,
    ...(options?.sort ? { sort: options.sort } : {}),
  };

  return doImageQuery(urlPath, offerQueryParam, config);
}

/**
 * 以图片 URL（如 1688/阿里 CDN 链接）调用 1688 以图搜；自建 OSS URL 可能被 1688 拒绝（400）。
 * 推荐使用 imageSearchByImageId（先 product.image.upload 获取 imageId）。
 */
export async function imageSearchByAddress(
  imageAddress: string,
  options?: ImageSearchOptions
): Promise<ImageSearchResult> {
  const config = get1688Config();
  const urlPath = buildImageQueryUrlPath(config.appKey);

  const beginPage = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20));
  const country = options?.country ?? 'en';

  const offerQueryParam = {
    imageAddress,
    beginPage,
    pageSize,
    country,
    userId: 0,
    ...(options?.sort ? { sort: options.sort } : {}),
  };

  return doImageQuery(urlPath, offerQueryParam, config);
}

async function doImageQuery(
  urlPath: string,
  offerQueryParam: Record<string, unknown>,
  config: Aliyun1688Config
): Promise<ImageSearchResult> {

  // 参与签名的参数：offerQueryParam 以 JSON 字符串形式（与 1688 约定一致）
  const offerQueryParamStr = JSON.stringify(offerQueryParam);
  const extraParams: ParamDic = { offerQueryParam: offerQueryParamStr };
  const signedParams = addSignatureToParams(urlPath, extraParams, config);

  const protocol = 'https';
  const url = `${protocol}://${config.apiHost}/openapi/${urlPath}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(signedParams as Record<string, string>).toString(),
  });

  if (!res.ok) {
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch {
      bodyText = '(failed to read body)';
    }
    const detail = bodyText ? ` ${bodyText}` : '';
    throw new Error(`1688 imageQuery HTTP ${res.status}: ${res.statusText}${detail}`);
  }

  const json = (await res.json()) as RawApiResult & Record<string, unknown>;

  // 1688 可能返回嵌套：顶层 result 内还有 success/code/result，实际数据在 result.result.data
  const outer = json.result as
    | { success?: string; code?: string; result?: RawApiResult['result'] }
    | undefined;
  const ok = (v: unknown) => v === true || v === 'true';
  const success = ok(json.success) || ok(outer?.success);
  const result = outer?.result ?? json.result;
  const hasData = Array.isArray(result?.data);

  if (!success || !hasData) {
    const msg =
      (json as { error_message?: string }).error_message ??
      (json as { message?: string }).message ??
      (outer as { message?: string } | undefined)?.message ??
      (json as { subMsg?: string }).subMsg ??
      (json as { subCode?: string }).subCode ??
      'Unknown 1688 error';
    const raw = JSON.stringify(json);
    throw new Error(`1688 imageQuery failed: ${msg}. Response: ${raw}`);
  }

  const rawList = result.data ?? [];
  const data = rawList.map(mapItemToCandidate);

  return {
    data,
    totalRecords: result?.totalRecords,
    totalPage: result?.totalPage,
    currentPage: result?.currentPage,
    pageSize: result?.pageSize,
  };
}
