/**
 * 1688 开放平台 HTTP 调用：构建带签名的 URL / 请求
 * 规范：docs/1688-SIGNATURE-AND-CALL.md
 *
 * 所有 1688 调用必须通过本模块（或本模块暴露的 imageSearchByAddress 等）进行，禁止在其他模块直接请求 1688。
 */

import { get1688Config, type Aliyun1688Config } from './config.js';
import { sign } from './signature.js';

/** 参与签名的参数均为字符串（query 与 body 展平后） */
export type ParamDic = Record<string, string>;

/**
 * 构建带 _aop_timestamp、access_token、_aop_signature 的完整请求 URL（GET）
 * @param urlPath - 用于签名的路径部分，如 param2/1/cn.alibaba.open/member.get/{appKey}
 * @param extraParams - 除 timestamp/access_token/signature 外的业务参数，将出现在 query 中并参与签名
 * @param config - 若未传则从环境变量读取
 */
export function buildSignedGetUrl(
  urlPath: string,
  extraParams: ParamDic,
  config?: Aliyun1688Config
): string {
  const cfg = config ?? get1688Config();
  const protocol = 'https';
  const host = cfg.apiHost;

  const params: ParamDic = {
    ...extraParams,
    _aop_timestamp: String(Date.now()),
    access_token: cfg.accessToken,
  };

  const signature = sign(urlPath, params, cfg.appSecret);
  params._aop_signature = signature;

  const query = new URLSearchParams(params).toString();
  return `${protocol}://${host}/openapi/${urlPath}?${query}`;
}

/**
 * 对已有参数对象追加 _aop_timestamp、access_token、_aop_signature（用于 POST 等需将参数放在 body 的接口）
 * 返回的 params 已包含签名，调用方可将之序列化为 body 或 query
 */
export function addSignatureToParams(
  urlPath: string,
  extraParams: ParamDic,
  config?: Aliyun1688Config
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
