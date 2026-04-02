import type { z } from 'zod'

/**
 * Zod 验证错误格式化工具
 * 将 Zod 验证错误转换为用户友好的中文错误消息
 */

/** 字段名映射类型 */
export type FieldNameMap = Record<string, string>

/**
 * 格式化 Zod 验证错误消息
 * @param issues - Zod 验证错误列表
 * @param fieldNameMap - 可选的字段名映射字典，用于将字段路径转换为中文名称
 * @returns 格式化后的错误消息字符串
 */
export function formatZodErrors(
  issues: z.ZodIssue[],
  fieldNameMap: FieldNameMap = {}
): string {
  const errors = issues.map((issue) => {
    // 获取字段路径
    const path = issue.path.join('.')
    const fieldName = fieldNameMap[path] || path || '未知字段'
    
    // 根据错误类型生成友好的错误消息
    let message = ''
    const code = issue.code as string
    
    if (code === 'invalid_type') {
      const typeIssue = issue as z.ZodIssue & { expected: string }
      if (typeIssue.expected === 'string') {
        message = `${fieldName}必须为文本`
      } else if (typeIssue.expected === 'array') {
        message = `${fieldName}必须为数组`
      } else if (typeIssue.expected === 'number') {
        message = `${fieldName}必须为数字`
      } else {
        message = `${fieldName}格式不正确`
      }
    } else if (code === 'too_small') {
      const smallIssue = issue as z.ZodIssue & { minimum: number; inclusive?: boolean }
      if (smallIssue.minimum === 1) {
        message = `${fieldName}不能为空`
      } else {
        message = `${fieldName}长度不足`
      }
    } else if (code === 'too_big') {
      message = `${fieldName}超出最大长度限制`
    } else if (code === 'invalid_value' || code === 'invalid_enum_value') {
      message = `${fieldName}的值无效`
    } else if (code === 'invalid_format' || code === 'invalid_string') {
      message = `${fieldName}格式不正确`
    } else if (code === 'custom') {
      // 自定义错误，使用 message
      message = issue.message || `${fieldName}验证失败`
    } else {
      message = issue.message || `${fieldName}验证失败`
    }
    return message
  })
  
  // 去重并拼接
  const uniqueErrors = [...new Set(errors)]
  return `验证失败：${uniqueErrors.join('；')}`
}
