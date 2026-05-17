/**
 * 1688 开放平台调用验证测试（member.get）
 * 验证签名与请求构建正确，并能成功调用 1688 官方示例接口。
 *
 * 运行前：在 apps/api/.env 中配置 ALI_1688_APP_KEY、ALI_1688_APP_SECRET、ALI_1688_ACCESS_TOKEN。
 * 可选：ALI_1688_TEST_MEMBER_ID（默认 tonytp4）、ALI_1688_API_HOST（默认 gw.open.1688.com）。
 *
 * 在 apps/api 目录下执行：
 *   npm run test:1688
 * 或直接运行脚本（不跑 test 框架）：
 *   npm run run:1688-member-get
 */

import * as test from 'node:test';
import * as assert from 'node:assert';
import { get1688Config } from './config.js';
import { buildSignedGetUrl } from './client.js';

const hasCredentials = () => {
  return !!(
    process.env.ALI_1688_APP_KEY &&
    process.env.ALI_1688_APP_SECRET &&
    process.env.ALI_1688_ACCESS_TOKEN
  );
};

test.describe('1688 API 调用验证（member.get）', () => {
  test.it('应能构建带签名的 URL 并成功调用 member.get', async () => {
    if (!hasCredentials()) {
      test.skip('未配置 1688 环境变量，跳过真实请求测试');
      return;
    }

    const config = get1688Config();
    // 官方示例：param2/1/cn.alibaba.open/member.get/{appKey}
    const urlPath = `param2/1/cn.alibaba.open/member.get/${config.appKey}`;
    // 业务参数：memberId（官方示例为 tonytp4，可改为你有权限的 memberId 或通过环境变量 ALI_1688_TEST_MEMBER_ID 覆盖）
    const memberId = process.env.ALI_1688_TEST_MEMBER_ID ?? 'tonytp4';
    const url = buildSignedGetUrl(urlPath, { memberId }, config);

    assert.ok(url.startsWith('https://'), 'URL 应为 https');
    assert.ok(url.includes('_aop_signature='), 'URL 应包含签名');
    assert.ok(url.includes('access_token='), 'URL 应包含 access_token');
    assert.ok(url.includes('memberId='), 'URL 应包含 memberId');

    const res = await fetch(url);
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      assert.fail(`响应不是 JSON（可能为错误页面或 ALI_1688_API_HOST 不正确，官方为 gw.open.1688.com）。状态: ${res.status}，前 200 字符: ${text.slice(0, 200)}`);
    }

    assert.ok(res.ok, `HTTP 状态应为 2xx，实际: ${res.status} ${JSON.stringify(body)}`);
    // 失败时 1688 返回 error_code / error_message
    assert.strictEqual((body as { error_code?: string }).error_code, undefined, `不应返回 error_code。响应: ${JSON.stringify(body)}`);

    // member.get 成功时应有 result（内可有 toReturn 数组）
    const result = (body as { result?: { toReturn?: unknown[] } }).result;
    assert.ok(result != null, `响应应包含 result。响应: ${JSON.stringify(body)}`);
    if (result?.toReturn) {
      assert.ok(Array.isArray(result.toReturn), 'result.toReturn 应为数组');
    }
  });
});
