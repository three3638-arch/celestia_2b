/**
 * 直接运行：调用 1688 多语言商详接口 product.search.queryProductDetail
 *
 * 在 apps/api 目录下执行（需已配置 .env）：
 *   npx tsx src/modules/integration-1688/run-1688-query-product-detail.ts
 * 或指定 offerId / country：
 *   OFFER_ID=979596531490 COUNTRY=en npx tsx src/modules/integration-1688/run-1688-query-product-detail.ts
 */

import { get1688Config } from './config.js';
import { addSignatureToParams, type ParamDic } from './client.js';

const NAMESPACE = 'com.alibaba.fenxiao.crossborder';
const API_NAME = 'product.search.queryProductDetail';

function buildUrlPath(appKey: string): string {
  return `param2/1/${NAMESPACE}/${API_NAME}/${appKey}`;
}

async function main() {
  const offerId = process.env.OFFER_ID ?? '979596531490';
  const country = process.env.COUNTRY ?? 'en';

  const config = get1688Config();
  const urlPath = buildUrlPath(config.appKey);

  const offerDetailParam = { offerId: Number(offerId), country, outMemberId: '1' };
  const extraParams: ParamDic = {
    offerDetailParam: JSON.stringify(offerDetailParam),
  };
  const signedParams = addSignatureToParams(urlPath, extraParams, config);

  const url = `https://${config.apiHost}/openapi/${urlPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(signedParams as Record<string, string>).toString(),
  });

  const json = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    console.error('HTTP error:', res.status, json);
    process.exit(1);
  }

  const errCode = json.error_code ?? (json as { result?: { code?: string } }).result?.code;
  const errMsg = (json as { error_message?: string }).error_message ?? (json as { message?: string }).message;
  const result = json.result as {
    success?: boolean | 'true' | 'false';
    code?: string;
    message?: string;
    result?: Record<string, unknown>;
  } | undefined;
  const inner = result?.result;

  if (result?.success !== true && result?.success !== 'true' && errCode != null) {
    console.error('1688 API error:', errCode, errMsg ?? result?.message, json);
    process.exit(1);
  }

  if (!inner) {
    console.log('Response (no result.result):', JSON.stringify(json, null, 2));
    return;
  }

  // 输出英文商详关键字段
  const subjectTrans = inner.subjectTrans ?? inner.subject;
  const descriptionTrans = inner.descriptionTrans ?? inner.description;
  const categoryName = inner.categoryName;
  const productImageTrans = inner.productImageTrans as { images?: string[]; whiteImage?: string } | undefined;
  const productSaleInfo = inner.productSaleInfo as Record<string, unknown> | undefined;
  const minOrderQuantity = inner.minOrderQuantity;
  const promotionUrl = inner.promotionUrl;

  console.log('--- Product detail (English) ---');
  console.log('offerId:', inner.offerId);
  console.log('category:', categoryName);
  console.log('subject (EN):', subjectTrans);
  console.log('description (EN):', typeof descriptionTrans === 'string' ? descriptionTrans.slice(0, 200) + (descriptionTrans.length > 200 ? '...' : '') : descriptionTrans);
  console.log('minOrderQuantity:', minOrderQuantity);
  console.log('productSaleInfo:', productSaleInfo != null ? JSON.stringify(productSaleInfo, null, 2) : undefined);
  console.log('images (EN):', productImageTrans?.images?.length ?? 0, 'items', productImageTrans?.whiteImage ?? '');
  console.log('promotionUrl:', promotionUrl);
  console.log('');
  console.log('--- Full result.result (JSON) ---');
  console.log(JSON.stringify(inner, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
