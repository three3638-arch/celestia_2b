/** 反机器人蜜罐字段名（须与表单 hidden input 的 name 一致） */
export const HONEYPOT_FIELD = 'website'

export function isHoneypotTripped(data: Record<string, unknown>): boolean {
  const value = data[HONEYPOT_FIELD]
  return typeof value === 'string' && value.trim().length > 0
}
