import { createHash, createHmac } from 'crypto'

export interface TranslationResult {
  en: string
  ar: string
}

// 阿里云翻译 API 配置
const ALIMT_ACCESS_KEY_ID = process.env.ALIMT_ACCESS_KEY_ID
const ALIMT_ACCESS_KEY_SECRET = process.env.ALIMT_ACCESS_KEY_SECRET
const ALIMT_ENDPOINT = 'https://mt.aliyuncs.com'

// 分隔符，用于批量翻译时分割文本
const TEXT_SEPARATOR = ' ||| '
const MAX_TEXT_LENGTH = 4500 // 阿里云限制单次请求文本长度

/**
 * 批量翻译（中文 → 英文/阿拉伯文）
 * @param texts 要翻译的文本数组
 * @returns 翻译结果数组
 */
export async function batchTranslate(texts: string[]): Promise<TranslationResult[]> {
  // 开发环境 fallback：如果未配置阿里云密钥，返回占位文本
  if (!ALIMT_ACCESS_KEY_ID || !ALIMT_ACCESS_KEY_SECRET) {
    console.log('[Translator] Using fallback mode (no ALIMT credentials)')
    return texts.map(text => ({
      en: `[EN] ${text}`,
      ar: `[AR] ${text}`,
    }))
  }

  // 过滤空文本
  const nonEmptyTexts = texts.filter(text => text && text.trim())
  if (nonEmptyTexts.length === 0) {
    return texts.map(() => ({ en: '', ar: '' }))
  }

  try {
    // 分批处理，每批不超过最大长度限制
    const batches: string[][] = []
    let currentBatch: string[] = []
    let currentLength = 0

    for (const text of nonEmptyTexts) {
      const textWithSeparator = text + TEXT_SEPARATOR
      if (currentLength + textWithSeparator.length > MAX_TEXT_LENGTH && currentBatch.length > 0) {
        batches.push(currentBatch)
        currentBatch = [text]
        currentLength = text.length
      } else {
        currentBatch.push(text)
        currentLength += textWithSeparator.length
      }
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    // 并行翻译所有批次
    const batchResults = await Promise.all(
      batches.map(batch => translateBatch(batch))
    )

    // 合并结果
    const allResults: TranslationResult[] = []
    for (const result of batchResults) {
      allResults.push(...result)
    }

    // 处理原始文本中的空文本
    let resultIndex = 0
    return texts.map(text => {
      if (!text || !text.trim()) {
        return { en: '', ar: '' }
      }
      return allResults[resultIndex++]
    })
  } catch (error) {
    console.error('[Translator] Translation failed:', error)
    // 出错时返回 fallback 文本
    return texts.map(text => ({
      en: `[EN] ${text}`,
      ar: `[AR] ${text}`,
    }))
  }
}

/**
 * 翻译一批文本
 */
async function translateBatch(texts: string[]): Promise<TranslationResult[]> {
  const sourceText = texts.join(TEXT_SEPARATOR)

  // 并行翻译英文和阿拉伯文
  const [enResults, arResults] = await Promise.all([
    callAlimtAPI(sourceText, 'zh', 'en'),
    callAlimtAPI(sourceText, 'zh', 'ar'),
  ])

  // 解析结果
  const enTexts = enResults.split(TEXT_SEPARATOR).map(s => s.trim())
  const arTexts = arResults.split(TEXT_SEPARATOR).map(s => s.trim())

  return texts.map((_, index) => ({
    en: enTexts[index] || '',
    ar: arTexts[index] || '',
  }))
}

/**
 * 调用阿里云翻译 API
 */
async function callAlimtAPI(
  sourceText: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const accessKeyId = ALIMT_ACCESS_KEY_ID!
  const accessKeySecret = ALIMT_ACCESS_KEY_SECRET!

  // 构建请求参数
  const params: Record<string, string> = {
    Action: 'TranslateGeneral',
    Format: 'JSON',
    Version: '2018-10-12',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: Math.random().toString(36).substring(2, 15),
    RegionId: 'cn-hangzhou',
    SourceText: sourceText,
    SourceLanguage: sourceLanguage,
    TargetLanguage: targetLanguage,
    FormatType: 'text',
    Scene: 'general',
  }

  // 按参数名排序
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key]
      return acc
    }, {} as Record<string, string>)

  // 构建待签名字符串
  const canonicalQueryString = Object.entries(sortedParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(canonicalQueryString)}`

  // 计算签名
  const signature = createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64')

  // 构建完整 URL
  const url = `${ALIMT_ENDPOINT}/?${canonicalQueryString}&Signature=${encodeURIComponent(signature)}`

  // 发送请求
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ALIMT API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  if (data.Code) {
    throw new Error(`ALIMT API error: ${data.Code} - ${data.Message}`)
  }

  return data.Data?.Translated || ''
}

/**
 * 单条文本翻译（便捷方法）
 */
export async function translate(text: string): Promise<TranslationResult> {
  const results = await batchTranslate([text])
  return results[0]
}
