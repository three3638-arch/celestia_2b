/**
 * integration-1688 模块入口
 *
 * 约束：所有 1688 开放平台调用必须通过本模块完成，禁止在其他模块实现签名或直接请求 1688。
 * 规范：docs/1688-SIGNATURE-AND-CALL.md、docs/1688-IMAGE-QUERY-API.md、docs/ENV-CONFIG.md
 */

export { sign } from './signature.js';
export { get1688Config, type Aliyun1688Config } from './config.js';
export {
  buildSignedGetUrl,
  addSignatureToParams,
  type ParamDic,
} from './client.js';
export { imageSearchByAddress, imageSearchByImageId } from './image-query.js';
export { uploadImageTo1688 } from './image-upload.js';
export type {
  ImageSearchOptions,
  ImageSearchResult,
  CandidateProduct,
} from './image-query-types.js';
