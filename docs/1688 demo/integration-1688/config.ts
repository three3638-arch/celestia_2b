/**
 * 1688 开放平台配置（仅从环境变量读取）
 * 规范：docs/ENV-CONFIG.md 第 3 节
 */

export interface Aliyun1688Config {
  appKey: string;
  appSecret: string;
  accessToken: string;
  apiHost: string;
}

/** 与 1688 官方示例一致，见 docs/1688-SIGNATURE-AND-CALL.md */
const DEFAULT_API_HOST = 'gw.open.1688.com';

/**
 * 从环境变量读取 1688 配置；未配置时抛出明确错误
 */
export function get1688Config(): Aliyun1688Config {
  const appKey = process.env.ALI_1688_APP_KEY;
  const appSecret = process.env.ALI_1688_APP_SECRET;
  const accessToken = process.env.ALI_1688_ACCESS_TOKEN;
  const apiHost = process.env.ALI_1688_API_HOST ?? DEFAULT_API_HOST;

  if (!appKey || !appSecret || !accessToken) {
    throw new Error(
      '1688 config missing: set ALI_1688_APP_KEY, ALI_1688_APP_SECRET, ALI_1688_ACCESS_TOKEN (see docs/ENV-CONFIG.md)'
    );
  }

  return { appKey, appSecret, accessToken, apiHost };
}
