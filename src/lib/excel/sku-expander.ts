import type { GemType, MetalColor } from '@prisma/client'

export interface ExpandedSku {
  gemType: GemType
  metalColor: MetalColor
  size?: string
  chainLength?: string
  referencePriceSarMin?: string
  referencePriceSarMax?: string
}

// 宝石类型映射
const GEM_TYPE_MAP: Record<string, GemType> = {
  '莫桑石': 'MOISSANITE',
  '锆石': 'ZIRCON',
  'moissanite': 'MOISSANITE',
  'zircon': 'ZIRCON',
  'MOISSANITE': 'MOISSANITE',
  'ZIRCON': 'ZIRCON',
}

// 金属底色映射
const METAL_COLOR_MAP: Record<string, MetalColor> = {
  '银': 'SILVER',
  '银色': 'SILVER',
  '金': 'GOLD',
  '金色': 'GOLD',
  '玫瑰金': 'ROSE_GOLD',
  '其他': 'OTHER',
  'silver': 'SILVER',
  'gold': 'GOLD',
  'rose gold': 'ROSE_GOLD',
  'rose_gold': 'ROSE_GOLD',
  'other': 'OTHER',
  'SILVER': 'SILVER',
  'GOLD': 'GOLD',
  'ROSE_GOLD': 'ROSE_GOLD',
  'OTHER': 'OTHER',
}

/**
 * 将中文属性值映射为枚举值
 * @param rawValue 原始值（如 "莫桑石,锆石"）
 * @param map 映射表
 * @returns 枚举值数组
 */
function mapValues<T extends string>(rawValue: string, map: Record<string, T>): T[] {
  if (!rawValue || !rawValue.trim()) {
    return []
  }

  return rawValue
    .split(/[,，、]/)
    .map(v => v.trim())
    .filter(v => v)
    .map(v => map[v])
    .filter((v): v is T => v !== undefined)
}

/**
 * 笛卡尔积展开 SKU
 * @param params 展开参数
 * @returns 展开的 SKU 数组
 */
export function expandSkus(params: {
  gemTypesRaw: string          // "莫桑石,锆石"
  metalColorsRaw: string       // "银,金"
  sizesRaw: string             // "6,7,8" 或 ""
  chainLengthsRaw: string      // "40cm,45cm" 或 ""
  referencePriceSarMin: string // 参考价最低
  referencePriceSarMax: string // 参考价最高
}): ExpandedSku[] {
  const { gemTypesRaw, metalColorsRaw, sizesRaw, chainLengthsRaw, referencePriceSarMin, referencePriceSarMax } = params

  // 1. 按逗号分割每个维度
  const gemTypes = mapValues(gemTypesRaw, GEM_TYPE_MAP)
  const metalColors = mapValues(metalColorsRaw, METAL_COLOR_MAP)
  
  // 解析尺码（可选）
  const sizes = sizesRaw
    ? sizesRaw.split(/[,，、]/).map(v => v.trim()).filter(v => v)
    : [undefined]
  
  // 解析链长度（可选）
  const chainLengths = chainLengthsRaw
    ? chainLengthsRaw.split(/[,，、]/).map(v => v.trim()).filter(v => v)
    : [undefined]

  // 如果没有有效的宝石类型或金属底色，返回空数组
  if (gemTypes.length === 0 || metalColors.length === 0) {
    return []
  }

  // 2. 笛卡尔积生成所有组合
  const skus: ExpandedSku[] = []

  for (const gemType of gemTypes) {
    for (const metalColor of metalColors) {
      for (const size of sizes) {
        for (const chainLength of chainLengths) {
          skus.push({
            gemType,
            metalColor,
            size,
            chainLength,
            referencePriceSarMin: referencePriceSarMin || undefined,
            referencePriceSarMax: referencePriceSarMax || undefined,
          })
        }
      }
    }
  }

  return skus
}

/**
 * 获取所有唯一的宝石类型
 */
export function extractGemTypes(gemTypesRaw: string): GemType[] {
  return mapValues(gemTypesRaw, GEM_TYPE_MAP)
}

/**
 * 获取所有唯一的金属底色
 */
export function extractMetalColors(metalColorsRaw: string): MetalColor[] {
  return mapValues(metalColorsRaw, METAL_COLOR_MAP)
}

/**
 * 计算 SKU 数量（不实际展开，用于预览）
 */
export function calculateSkuCount(params: {
  gemTypesRaw: string
  metalColorsRaw: string
  sizesRaw: string
  chainLengthsRaw: string
}): number {
  const { gemTypesRaw, metalColorsRaw, sizesRaw, chainLengthsRaw } = params

  const gemTypes = mapValues(gemTypesRaw, GEM_TYPE_MAP)
  const metalColors = mapValues(metalColorsRaw, METAL_COLOR_MAP)
  const sizes = sizesRaw ? sizesRaw.split(/[,，、]/).map(v => v.trim()).filter(v => v) : ['']
  const chainLengths = chainLengthsRaw ? chainLengthsRaw.split(/[,，、]/).map(v => v.trim()).filter(v => v) : ['']

  return gemTypes.length * metalColors.length * sizes.length * chainLengths.length
}
