/**
 * 直接运行：验证 1688 member.get 调用是否成功
 *
 * 在 apps/api 目录下执行（需已配置 .env）：
 *   npx tsx src/modules/integration-1688/run-1688-member-get.ts
 * 或（先加载 .env）：
 *   node --env-file=.env --import tsx src/modules/integration-1688/run-1688-member-get.ts
 */

import { get1688Config } from './config.js';
import { buildSignedGetUrl } from './client.js';

async function main() {
  const config = get1688Config();
  const urlPath = `param2/1/cn.alibaba.open/member.get/${config.appKey}`;
  const memberId = process.env.ALI_1688_TEST_MEMBER_ID ?? 'tonytp4';
  const url = buildSignedGetUrl(urlPath, { memberId }, config);

  console.log('Request URL (without token):', url.replace(/access_token=[^&]+/, 'access_token=***'));
  const res = await fetch(url);
  const body = await res.json();

  if (!res.ok) {
    console.error('HTTP error:', res.status, body);
    process.exit(1);
  }
  if (body.error_code != null) {
    console.error('1688 API error:', body.error_code, body.error_message ?? body.exception);
    process.exit(1);
  }
  if (body.result == null) {
    console.error('Unexpected response (no result):', body);
    process.exit(1);
  }

  console.log('OK: member.get 调用成功');
  if (body.result.toReturn?.length) {
    console.log('toReturn 条数:', body.result.toReturn.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
