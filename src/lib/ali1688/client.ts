/**
 * 1688 开放平台 HTTP 调用：构建带签名的 URL / 请求
 *
 * 所有 1688 调用必须通过本模块（或本模块暴露的 api 层）进行，
 * 禁止在其他模块直接请求 1688。
 */

import { get1688Config, type Ali1688Config } from './config';
import { sign } from './signature';

/** 参与签名的参数均为字符串（query 与 body 展平后） */
export type ParamDic = Record<string, string>;

/**
 * 构建完整的 1688 API URL（不含查询参数，用于 POST 请求）
 * @param apiPath - 用于签名的路径部分，如 param2/1/com.alibaba.fenxiao.crossborder/product.search.querySellerOfferList/{appKey}
 * @param config - 若未传则从环境变量读取
 * @returns 完整 URL，如 https://gw.open.1688.com/openapi/param2/1/...
 */
export function buildApiUrl(apiPath: string, config?: Ali1688Config): string {
  const cfg = config ?? get1688Config();
  return `https://${cfg.apiHost}/openapi/${apiPath}`;
}

/**
 * 对已有参数对象追加 _aop_timestamp、access_token、_aop_signature
 * 返回的 params 已包含签名，调用方可将之序列化为 body 或 query
 */
export function addSignatureToParams(
  urlPath: string,
  extraParams: ParamDic,
  config?: Ali1688Config
): ParamDic {
  const cfg = config ?? get1688Config();
  const params: ParamDic = {
    ...extraParams,
    _aop_timestamp: String(Date.now()),
    access_token: cfg.accessToken,
  };
  params._aop_signature = sign(urlPath, params, cfg.appSecret);
  return params;
}

/**
 * 发起签名后的 POST 请求，返回解析后的 JSON
 *
 * 流程：
 * 1. 对 extraParams 添加 _aop_timestamp、access_token、_aop_signature
 * 2. 以 application/x-www-form-urlencoded 格式发送 POST 请求
 * 3. 检查 HTTP 状态码，非 2xx 抛出错误
 * 4. 解析 JSON 响应
 *
 * @param apiPath - API路径，如 param2/1/com.alibaba.fenxiao.crossborder/product.search.querySellerOfferList/{appKey}
 * @param extraParams - 业务参数（key/value 均为字符串），如 { offerQueryParam: '{"sellerOpenId":"..."}' }
 * @param config - 若未传则从环境变量读取
 * @returns 解析后的 JSON 对象（具体类型由调用方决定）
 */
export async function callApi<T = unknown>(
  apiPath: string,
  extraParams: ParamDic,
  config?: Ali1688Config
): Promise<T> {
  const cfg = config ?? get1688Config();
  const signedParams = addSignatureToParams(apiPath, extraParams, cfg);
  const url = buildApiUrl(apiPath, cfg);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(signedParams).toString(),
  });

  if (!res.ok) {
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch {
      bodyText = '(failed to read body)';
    }
    const detail = bodyText ? ` ${bodyText}` : '';
    throw new Error(`1688 API HTTP ${res.status}: ${res.statusText}${detail}`);
  }

  const json = (await res.json()) as Record<string, unknown>;

  // 1688 可能返回嵌套：顶层 result 内还有 success/code/result
  const outer = json.result as
    | { success?: boolean | string; code?: string; message?: string }
    | undefined;

  const ok = (v: unknown) => v === true || v === 'true';
  const success = ok(json.success) || ok(outer?.success);

  if (!success) {
    const msg =
      (json as { error_message?: string }).error_message ??
      (json as { message?: string }).message ??
      outer?.message ??
      (json as { subMsg?: string }).subMsg ??
      (json as { subCode?: string }).subCode ??
      'Unknown 1688 error';
    const raw = JSON.stringify(json);
    throw new Error(`1688 API failed: ${msg}. Response: ${raw}`);
  }

  return json as T;
}