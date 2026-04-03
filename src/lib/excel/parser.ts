import ExcelJS from 'exceljs'

export interface ParsedProduct {
  rowIndex: number
  spuCode: string
  nameZh: string               // 名称（可为空，为空时用SPU编号代替）
  categoryName: string         // 品类名称（中文）
  gemTypesRaw: string          // 原始宝石类型（如 "莫桑石,锆石"）
  metalColorsRaw: string       // 原始金属底色（如 "银,金"）
  mainStoneSizesRaw: string    // 原始主石尺寸（如 "8,10"）
  sizesRaw: string             // 原始尺码（如 "6,7,8"）
  chainLengthsRaw: string      // 原始链长度（如 "40cm,45cm"）
  referencePriceSarMin: string // 参考价最低(SAR)
  referencePriceSarMax: string // 参考价最高(SAR)
  descriptionZh: string
  supplier: string             // 供应商
  supplierLink: string         // 供应商链接
  primaryImage: ArrayBuffer | null   // 首图（B列，必填）
  extraImages: ArrayBuffer[]         // 其他图片（M-Q列，可选）
}

// 列索引映射（A=1, B=2, ...）
const COLUMN_MAPPING = {
  SPU_CODE: 1,              // A: SPU编号
  PRIMARY_IMAGE: 2,         // B: 首图（嵌入）
  NAME: 3,                  // C: 名称（为空用SPU代替）
  CATEGORY: 4,              // D: 品类
  GEM_TYPES: 5,             // E: 宝石类型
  METAL_COLORS: 6,          // F: 金属底色
  MAIN_STONE_SIZES: 7,      // G: 主石尺寸(mm)
  SIZES: 8,                 // H: 尺码
  CHAIN_LENGTHS: 9,         // I: 链长度(cm)
  PRICE_MIN: 10,            // J: 参考价最低(SAR)
  PRICE_MAX: 11,            // K: 参考价最高(SAR)
  DESCRIPTION: 12,          // L: 描述
  EXTRA_IMAGES_START: 13,   // M: 其他图片起始
  EXTRA_IMAGES_END: 17,     // Q: 其他图片结束
  SUPPLIER: 18,             // R: 供应商
  SUPPLIER_LINK: 19,        // S: 供应商链接
}

interface ImageInfo {
  buffer: ArrayBuffer
  col: number  // 列号（1-based）
  row: number  // 行号（1-based）
}

/**
 * 解析 Excel 文件
 * @param filePath Excel 文件路径
 * @returns 解析后的商品数组
 */
export async function parseExcel(filePath: string): Promise<ParsedProduct[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) {
    throw new Error('Excel file has no worksheets')
  }

  const products: ParsedProduct[] = []

  // 获取所有图片信息
  const images = worksheet.getImages()
  const imageList: ImageInfo[] = []

  // 构建图片列表：根据图片位置记录列和行
  for (const image of images) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageData = workbook.getImage(image.imageId as any)
    if (!imageData || !imageData.buffer) continue

    // 获取图片所在的左上角位置
    const tl = image.range?.tl
    
    if (tl) {
      // ExcelJS 使用 0-based 行列索引
      const row = Math.floor(tl.row) + 1  // 转换为 1-based
      const col = Math.floor(tl.col) + 1  // 转换为 1-based
      
      imageList.push({
        buffer: imageData.buffer as ArrayBuffer,
        col,
        row,
      })
    }
  }

  // 遍历行数据（从第2行开始，跳过表头）
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // 跳过表头

    const spuCode = row.getCell(COLUMN_MAPPING.SPU_CODE).text?.trim()
    const nameZh = row.getCell(COLUMN_MAPPING.NAME).text?.trim()

    // 跳过空行（SPU编码为空）
    if (!spuCode) return

    // 获取该行的图片，按列位置区分首图和其他图片
    const rowImages = imageList.filter(img => img.row === rowNumber)
    
    // 首图：B列（列号2）
    const primaryImage = rowImages.find(img => img.col === COLUMN_MAPPING.PRIMARY_IMAGE)
    
    // 其他图片：L-P列（列号12-16）
    const extraImages = rowImages
      .filter(img => img.col >= COLUMN_MAPPING.EXTRA_IMAGES_START && img.col <= COLUMN_MAPPING.EXTRA_IMAGES_END)
      .sort((a, b) => a.col - b.col) // 按列号排序
      .map(img => img.buffer)

    const product: ParsedProduct = {
      rowIndex: rowNumber,
      spuCode: spuCode || '',
      nameZh: nameZh || '',
      categoryName: row.getCell(COLUMN_MAPPING.CATEGORY).text?.trim() || '',
      gemTypesRaw: row.getCell(COLUMN_MAPPING.GEM_TYPES).text?.replace(/[\r\n]+/g, ',')?.trim() || '',
      metalColorsRaw: row.getCell(COLUMN_MAPPING.METAL_COLORS).text?.replace(/[\r\n]+/g, ',')?.trim() || '',
      mainStoneSizesRaw: row.getCell(COLUMN_MAPPING.MAIN_STONE_SIZES).text?.replace(/[\r\n]+/g, ',')?.trim() || '',
      sizesRaw: row.getCell(COLUMN_MAPPING.SIZES).text?.replace(/[\r\n]+/g, ',')?.trim() || '',
      chainLengthsRaw: row.getCell(COLUMN_MAPPING.CHAIN_LENGTHS).text?.replace(/[\r\n]+/g, ',')?.trim() || '',
      referencePriceSarMin: row.getCell(COLUMN_MAPPING.PRICE_MIN).text?.trim() || '',
      referencePriceSarMax: row.getCell(COLUMN_MAPPING.PRICE_MAX).text?.trim() || '',
      descriptionZh: row.getCell(COLUMN_MAPPING.DESCRIPTION).text?.trim() || '',
      supplier: row.getCell(COLUMN_MAPPING.SUPPLIER).text?.trim() || '',
      supplierLink: row.getCell(COLUMN_MAPPING.SUPPLIER_LINK).text?.trim() || '',
      primaryImage: primaryImage?.buffer || null,
      extraImages,
    }

    products.push(product)
  })

  return products
}

/**
 * 验证解析的商品数据
 * @param products 解析后的商品数组
 * @returns 验证结果
 */
export function validateParsedProducts(products: ParsedProduct[]): {
  valid: ParsedProduct[]
  invalid: { rowIndex: number; errors: string[] }[]
} {
  const valid: ParsedProduct[] = []
  const invalid: { rowIndex: number; errors: string[] }[] = []

  for (const product of products) {
    const errors: string[] = []

    if (!product.spuCode) {
      errors.push('SPU编号不能为空')
    }

    // 名称非必填，为空时后端用SPU编号代替
    // 移除 nameZh 的必填验证

    if (!product.categoryName) {
      errors.push('品类不能为空')
    }

    if (!product.gemTypesRaw) {
      errors.push('宝石类型不能为空')
    }

    if (!product.metalColorsRaw) {
      errors.push('金属底色不能为空')
    }

    // 首图必填验证
    if (!product.primaryImage) {
      errors.push('首图不能为空')
    }

    if (errors.length > 0) {
      invalid.push({ rowIndex: product.rowIndex, errors })
    } else {
      valid.push(product)
    }
  }

  return { valid, invalid }
}
