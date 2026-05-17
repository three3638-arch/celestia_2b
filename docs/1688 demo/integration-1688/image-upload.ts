/**
 * 1688 图片上传：product.image.upload，获取 imageId 供以图搜商品使用
 * 规范：系统参数 _aop_timestamp、_aop_signature、access_token；应用参数 uploadImageParam（imageBase64 必填，outMemberId 可选）
 * 接口：com.alibaba.fenxiao.crossborder:product.image.upload
 */

import { get1688Config } from './config.js';
import { addSignatureToParams, type ParamDic } from './client.js';

const NAMESPACE = 'com.alibaba.fenxiao.crossborder';
const API_NAME = 'product.image.upload';

function buildUploadUrlPath(appKey: string): string {
  return `param2/1/${NAMESPACE}/${API_NAME}/${appKey}`;
}

/** 1688 上传响应：result 可能为 imageId 字符串、数字、或含 imageId/result 的对象；部分网关会再包一层 result */
interface RawUploadResult {
  success?: boolean;
  code?: string;
  message?: string;
  result?: string | number | { imageId?: string; result?: string | number };
}

/**
 * 将图片上传至 1688，返回 imageId，供 imageQuery 以图搜商品使用
 * @param imageBuffer 图片二进制
 * @param outMemberId 可选，外部用户 id
 */
export async function uploadImageTo1688(
  imageBuffer: Buffer,
  outMemberId?: string
): Promise<{ imageId: string }> {
  const config = get1688Config();
  const urlPath = buildUploadUrlPath(config.appKey);

  const imageBase64 = imageBuffer.toString('base64');
  const uploadImageParam: Record<string, unknown> = { imageBase64 };
  if (outMemberId != null && outMemberId !== '') {
    uploadImageParam.outMemberId = outMemberId;
  }
  const uploadImageParamStr = JSON.stringify(uploadImageParam);

  const extraParams: ParamDic = { uploadImageParam: uploadImageParamStr };
  const signedParams = addSignatureToParams(urlPath, extraParams, config);

  const url = `https://${config.apiHost}/openapi/${urlPath}`;

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
    throw new Error(`1688 product.image.upload HTTP ${res.status}: ${res.statusText}${detail}`);
  }

  const json = (await res.json()) as RawUploadResult;

  if (!json.success && json.result == null) {
    const msg =
      (json as { error_message?: string; message?: string }).error_message ??
      (json as { error_message?: string; message?: string }).message ??
      'Unknown 1688 error';
    throw new Error(`1688 product.image.upload failed: ${msg}`);
  }

  const rawResult = json.result;
  let imageId: string;
  if (typeof rawResult === 'string') {
    imageId = rawResult;
  } else if (typeof rawResult === 'number') {
    imageId = String(rawResult);
  } else if (rawResult && typeof rawResult === 'object') {
    if (typeof rawResult.imageId === 'string') {
      imageId = rawResult.imageId;
    } else if (rawResult.result != null) {
      imageId = typeof rawResult.result === 'number' ? String(rawResult.result) : String(rawResult.result);
    } else {
      throw new Error(
        `1688 product.image.upload result missing imageId: ${JSON.stringify(rawResult)}`
      );
    }
  } else {
    throw new Error(
      `1688 product.image.upload result missing imageId: ${JSON.stringify(rawResult)}`
    );
  }

  return { imageId };
}
