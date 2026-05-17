/**
 * 探测脚本：1688 同店搜索 product.search.querySellerOfferList
 *
 * 目的：确定 offerQueryParam 中"店铺标识"的正确字段名。
 * 已知：跨境店铺只有形如 b2b-22115202039330bb6a 的字符串 OpenID，
 * 服务端报错 param=sellerId NumberFormatException，说明服务端期望 sellerId
 * 是数字，但跨境场景没有数字 ID。需要测试其他候选字段名。
 *
 * 用法（在项目根目录或 docs 子目录下执行均可）：
 *   $env:SELLER_ID="b2b-22115202039330bb6a"; npx tsx "docs/1688 demo/integration-1688/run-1688-query-seller-offer-list.ts"
 *
 * 也可通过 ALI_1688_TEST_SELLER_ID 覆盖默认值。
 */

import { get1688Config } from './config.js';
import { addSignatureToParams, type ParamDic } from './client.js';

const NAMESPACE = 'com.alibaba.fenxiao.crossborder';
const API_NAME = 'product.search.querySellerOfferList';

function buildUrlPath(appKey: string): string {
  return `param2/1/${NAMESPACE}/${API_NAME}/${appKey}`;
}

interface ProbeCandidate {
  label: string;
  // offerQueryParam JSON 内的字段集合（不含分页/country）
  fields: Record<string, string | number>;
}

async function callOnce(
  candidate: ProbeCandidate,
  appKey: string,
  appSecret: string,
  apiHost: string,
  accessToken: string,
): Promise<void> {
  const urlPath = buildUrlPath(appKey);

  const offerQueryParam = {
    ...candidate.fields,
    beginPage: 1,
    pageSize: 5,
    country: 'en',
  };

  const extraParams: ParamDic = {
    offerQueryParam: JSON.stringify(offerQueryParam),
  };
  const signedParams = addSignatureToParams(
    urlPath,
    extraParams,
    { appKey, appSecret, accessToken, apiHost },
  );

  const url = `https://${apiHost}/openapi/${urlPath}`;

  console.log(`\n========== 候选: ${candidate.label} ==========`);
  console.log('offerQueryParam =', JSON.stringify(offerQueryParam));

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(signedParams as Record<string, string>).toString(),
    });
  } catch (e) {
    console.log('网络异常:', e);
    return;
  }

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.log(`HTTP ${res.status} 非 JSON 响应:`, text.slice(0, 300));
    return;
  }

  if (!res.ok) {
    const errMsg =
      (json as { error_message?: string }).error_message ??
      (json as { message?: string }).message;
    console.log(`HTTP ${res.status} 错误:`, errMsg ?? text.slice(0, 300));
    return;
  }

  const errCode =
    (json as { error_code?: string }).error_code ??
    (json as { result?: { code?: string } }).result?.code;
  const errMsg =
    (json as { error_message?: string }).error_message ??
    (json as { result?: { message?: string } }).result?.message;
  const result = json.result as
    | { success?: boolean | string; result?: unknown; data?: unknown }
    | undefined;
  const success = result?.success === true || result?.success === 'true';

  if (errCode != null && !success) {
    console.log(`✗ 业务错误 [${errCode}]:`, errMsg);
    return;
  }

  console.log('✓ 调用成功');
  // 输出关键摘要：商品条数 / 总数
  const inner = (result?.result ?? result?.data ?? result) as
    | Record<string, unknown>
    | undefined;
  if (inner) {
    const totalRecord =
      (inner as { totalRecord?: number; totalRecords?: number }).totalRecord ??
      (inner as { totalRecords?: number }).totalRecords;
    const data = (inner as { data?: unknown[] }).data;
    console.log(
      'totalRecord =',
      totalRecord,
      ', data.length =',
      Array.isArray(data) ? data.length : '(非数组)',
    );
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0] as Record<string, unknown>;
      console.log('首条 offerId / subject =', first.offerId, '/', first.subject);
    }
  } else {
    console.log('完整响应:', JSON.stringify(json).slice(0, 500));
  }
}

async function main() {
  const cfg = get1688Config();

  const sellerOpenId =
    process.env.SELLER_ID ??
    process.env.ALI_1688_TEST_SELLER_ID ??
    'b2b-22115202039330bb6a';

  console.log('使用店铺标识:', sellerOpenId);
  console.log('apiHost:', cfg.apiHost);
  console.log('appKey:', cfg.appKey);

  const candidates: ProbeCandidate[] = [
    { label: 'sellerOpenId（当前生产代码用法）', fields: { sellerOpenId } },
    { label: 'sellerLoginId', fields: { sellerLoginId: sellerOpenId } },
    { label: 'loginId', fields: { loginId: sellerOpenId } },
    { label: 'sellerMemberId', fields: { sellerMemberId: sellerOpenId } },
    { label: 'memberId', fields: { memberId: sellerOpenId } },
    { label: 'sellerId（字符串）', fields: { sellerId: sellerOpenId } },
  ];

  for (const c of candidates) {
    await callOnce(c, cfg.appKey, cfg.appSecret, cfg.apiHost, cfg.accessToken);
  }

  console.log('\n========== 探测完成 ==========');
  console.log('请观察上方哪个候选打印 "✓ 调用成功"，那个字段名就是正确的。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
