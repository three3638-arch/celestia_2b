/**
 * 1688 开放平台请求签名（_aop_signature）
 *
 * 算法：concatString = urlPath + 排序后的(key+value) 拼接；
 *       Signature = uppercase(hex(hmac_sha1(concatString, secret)))
 */

import * as crypto from 'crypto';

/**
 * 计算 1688 API 请求签名
 * @param urlPath - URL 中从路径到 "?" 前的部分，如 param2/1/com.alibaba.fenxiao.crossborder/product.search.querySellerOfferList/7075497
 * @param paramDic - 参与签名的所有参数（query + body 展平），key/value 均为字符串
 * @param secretKey - AppSecret（与 urlPath 中的 AppKey 对应）
 * @returns 大写十六进制签名字符串，用于 _aop_signature
 */
export function sign(
  urlPath: string,
  paramDic: Record<string, string>,
  secretKey: string
): string {
  const list: string[] = [];
  for (const [key, value] of Object.entries(paramDic)) {
    if (value !== undefined && value !== null) {
      list.push(key + String(value));
    }
  }
  list.sort();
  const paramStr = list.join('');
  const concatString = urlPath + paramStr;

  const hmac = crypto.createHmac('sha1', secretKey);
  hmac.update(concatString, 'utf8');
  const hash = hmac.digest('hex');
  return hash.toUpperCase();
}