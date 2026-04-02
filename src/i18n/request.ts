import { getRequestConfig } from 'next-intl/server'
import { locales, defaultLocale, type Locale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  // 从请求中获取 locale，如果没有则使用默认语言
  let locale = await requestLocale
  
  // 验证 locale 是否有效
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale
  }

  // 动态导入对应语言的 messages
  const messages = (await import(`./messages/${locale}.json`)).default

  return {
    locale,
    messages,
  }
})
