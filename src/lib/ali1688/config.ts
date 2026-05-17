/**
 * 1688 开放平台配置（从环境变量读取）
 * 约束：所有 1688 调用必须通过本模块完成，禁止在其他模块直接请求 1688。
 */

export interface Ali1688Config {
  appKey: string;
  appSecret: string;
  accessToken: string;
  apiHost: string;
}

const DEFAULT_API_HOST = 'gw.open.1688.com';

/**
 * 从环境变量读取 1688 配置；未配置时抛出明确错误
 */
export function get1688Config(): Ali1688Config {
  const appKey = process.env.ALI_1688_APP_KEY;
  const appSecret = process.env.ALI_1688_APP_SECRET;
  const accessToken = process.env.ALI_1688_ACCESS_TOKEN;
  const apiHost = process.env.ALI_1688_API_HOST || DEFAULT_API_HOST;

  if (!appKey || !appSecret || !accessToken) {
    throw new Error(
      '1688 config missing: set ALI_1688_APP_KEY, ALI_1688_APP_SECRET, ALI_1688_ACCESS_TOKEN'
    );
  }

  return { appKey, appSecret, accessToken, apiHost };
}