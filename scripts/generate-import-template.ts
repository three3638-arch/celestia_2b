import ExcelJS from 'exceljs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 列定义（19列 A-S）
const COLUMNS = [
  { key: 'spuCode', header: 'SPU编号', width: 16 },      // A
  { key: 'mainImage', header: '首图', width: 18 },        // B
  { key: 'name', header: '名称', width: 25 },             // C
  { key: 'category', header: '品类', width: 14 },         // D
  { key: 'gemTypes', header: '宝石类型', width: 18 },     // E
  { key: 'metalColors', header: '金属底色', width: 18 },  // F
  { key: 'mainStoneSizes', header: '主石尺寸(mm)', width: 16 }, // G
  { key: 'sizes', header: '尺码', width: 14 },            // H
  { key: 'chainLengths', header: '长度(cm)', width: 14 }, // I
  { key: 'priceMin', header: '参考价最低(SAR)', width: 16 }, // J
  { key: 'priceMax', header: '参考价最高(SAR)', width: 16 }, // K
  { key: 'description', header: '描述', width: 35 },      // L
  { key: 'image1', header: '其他图片1', width: 16 },      // M
  { key: 'image2', header: '其他图片2', width: 16 },      // N
  { key: 'image3', header: '其他图片3', width: 16 },      // O
  { key: 'image4', header: '其他图片4', width: 16 },      // P
  { key: 'image5', header: '其他图片5', width: 16 },      // Q
  { key: 'supplier', header: '供应商', width: 20 },       // R
  { key: 'supplierLink', header: '供应商链接', width: 30 }, // S
]

// 主题色
const THEME = {
  headerBg: '1a1a2e',      // 深色背景
  headerFont: 'd4af37',    // 金色文字
  dataRowBg: 'f5f5f5',     // 浅灰色背景
}

// 示例数据（3条，覆盖不同场景）
const SAMPLE_DATA = [
  {
    spuCode: 'CJ-RG-001',
    mainImage: '(嵌入图片)',
    name: '璀璨星光莫桑石戒指',
    category: '戒指',
    gemTypes: '莫桑石',
    metalColors: '银色,金色,玫瑰金',
    mainStoneSizes: '8,10',
    sizes: '6,7,8,9',
    chainLengths: '',
    priceMin: '80',
    priceMax: '200',
    description: '闪耀迷人的莫桑石戒指，适合日常佩戴，925银镶嵌',
    image1: '',
    image2: '',
    image3: '',
    image4: '',
    image5: '',
    supplier: '深圳金饰厂',
    supplierLink: 'https://example.com/supplier1',
  },
  {
    spuCode: 'CJ-NK-001',
    mainImage: '(嵌入图片)',
    name: '星辰吊坠项链',
    category: '项链',
    gemTypes: '莫桑石',
    metalColors: '银色,金色',
    mainStoneSizes: '6,8',
    sizes: '',
    chainLengths: '40,45,50',
    priceMin: '120',
    priceMax: '280',
    description: '经典星辰吊坠设计，可调节链长，优雅大方',
    image1: '(嵌入图片)',
    image2: '(嵌入图片)',
    image3: '',
    image4: '',
    image5: '',
    supplier: '广州珠宝供应商',
    supplierLink: 'https://example.com/supplier2',
  },
  {
    spuCode: 'CJ-BR-001',
    mainImage: '(嵌入图片)',
    name: '梦幻双星手链',
    category: '手链',
    gemTypes: '莫桑石,锆石',
    metalColors: '银色,玫瑰金',
    mainStoneSizes: '',
    sizes: '',
    chainLengths: '16,18,20',
    priceMin: '100',
    priceMax: '250',
    description: '莫桑石与锆石交相辉映的精美手链，多宝石组合',
    image1: '(嵌入图片)',
    image2: '',
    image3: '',
    image4: '',
    image5: '',
    supplier: '',
    supplierLink: '',
  },
]

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('商品导入模板')

  // 设置列
  worksheet.columns = COLUMNS.map(col => ({
    key: col.key,
    width: col.width,
  }))

  // 表头行
  const headerRow = worksheet.addRow(COLUMNS.map(col => col.header))
  headerRow.height = 25

  // 表头样式
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: THEME.headerBg },
    }
    cell.font = {
      bold: true,
      size: 12,
      color: { argb: THEME.headerFont },
    }
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'cccccc' } },
    }
  })

  // 示例数据行
  SAMPLE_DATA.forEach((data) => {
    const row = worksheet.addRow([
      data.spuCode,
      data.mainImage,
      data.name,
      data.category,
      data.gemTypes,
      data.metalColors,
      data.mainStoneSizes,
      data.sizes,
      data.chainLengths,
      data.priceMin,
      data.priceMax,
      data.description,
      data.image1,
      data.image2,
      data.image3,
      data.image4,
      data.image5,
      data.supplier,
      data.supplierLink,
    ])
    row.height = 22

    // 数据行样式
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: THEME.dataRowBg },
      }
      cell.alignment = {
        vertical: 'middle',
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'e0e0e0' } },
      }
    })
  })

  // 添加空行
  worksheet.addRow([])

  // 填写说明
  const instructions = [
    '【商品导入模板填写说明】',
    '',
    '一、必填字段（A, B, D, E, F）',
    '  • A-SPU编号：唯一标识，格式如 CJ-NK-001（CJ=Celestia Jewelry）',
    '  • B-首图：必须嵌入1张主图（插入 → 图片 → 嵌入单元格）',
    '  • D-品类：可选值：戒指、项链、手链、耳钉、其他',
    '  • E-宝石类型：逗号分隔，如 莫桑石 或 莫桑石,锆石',
    '  • F-金属底色：逗号分隔，如 银色,金色,玫瑰金',
    '',
    '二、可选字段（C, G, H, I, J, K, L, M-Q, R, S）',
    '  • C-名称：中文名称，为空时以SPU编号显示',
    '  • G-主石尺寸(mm)：逗号分隔如 8,10。耳钉可留空',
    '  • H-尺码：戒指用，逗号分隔如 6,7,8,9。项链/手链/耳钉留空',
    '  • I-长度(cm)：项链/手链用，逗号分隔如 40,45,50。戒指/耳钉留空',
    '  • J-参考价最低(SAR)：价格区间下限，纯数字',
    '  • K-参考价最高(SAR)：价格区间上限，纯数字',
    '  • L-描述：中文描述，系统将自动翻译为英文和阿拉伯文',
    '  • M~Q-其他图片1-5：附加图片，最多5张',
    '  • R-供应商：供应商名称，不参与翻译',
    '  • S-供应商链接：供应商产品链接或联系方式，不参与翻译',
    '',
    '三、图片嵌入方法',
    '  1. 点击单元格（如 B2 首图列）',
    '  2. 菜单栏：插入 → 图片 → 此设备/剪贴板',
    '  3. 选择图片后，右键图片 → 大小和属性 → 属性 → 随单元格改变位置和大小',
    '  4. 系统导入时会自动提取所有嵌入的图片',
    '',
    '四、SKU自动生成规则',
    '  系统根据宝石类型 × 金属底色 × 主石尺寸 × 尺码/长度 的笛卡尔积自动生成SKU',
    '  示例：宝石=莫桑石；金属=银色,金色；主石尺寸=8,10；长度=40,45',
    '        → 生成 1×2×2×2 = 8 个SKU',
    '  SKU编号格式：{SPU编号}-{宝石缩写}-{金属缩写}-{主石尺寸}MM-{尺码或长度}',
    '    宝石缩写：MO=莫桑石, ZR=锆石',
    '    金属缩写：SIL=银色, GLD=金色, RSG=玫瑰金, OTH=其他',
    '    示例：CJ-NK-001-MO-SIL-8MM-L40',
    '',
    '五、导入流程',
    '  上传Excel → 系统解析并提取图片 → AI翻译名称/描述 → 预览确认 → 写入数据库',
  ]

  instructions.forEach((text, index) => {
    const row = worksheet.addRow([text])
    if (index === 0) {
      // 标题行加粗
      row.getCell(1).font = { bold: true, size: 12 }
    }
  })

  // 合并说明行的单元格（扩展到A:S，共19列）
  const startRow = 6 // 空行之后
  const endRow = startRow + instructions.length - 1
  worksheet.mergeCells(`A${startRow}:S${endRow}`)

  // 设置合并单元格样式
  const mergedCell = worksheet.getCell(`A${startRow}`)
  mergedCell.alignment = {
    vertical: 'top',
    wrapText: true,
  }
  mergedCell.font = {
    size: 10,
  }

  // 设置行高以适应内容
  for (let i = startRow; i <= endRow; i++) {
    worksheet.getRow(i).height = 18
  }

  // 输出路径
  const outputPath = path.join(__dirname, '..', 'docs', 'import-template.xlsx')

  // 写入文件
  await workbook.xlsx.writeFile(outputPath)
  console.log(`✅ 模板文件已生成: ${outputPath}`)
}

generateTemplate().catch((err) => {
  console.error('❌ 生成失败:', err)
  process.exit(1)
})
