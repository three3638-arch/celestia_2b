/**
 * 新德艺供应商Excel转换脚本
 * 将新德艺原始报价表转换为系统导入模板格式
 * 
 * 使用方法: npx ts-node scripts/convert-xindeyi-excel.ts
 */

import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

// ============== 配置 ==============

// 供应商名称
const SUPPLIER_NAME = '新德艺';

// 汇率: 人民币 -> SAR
const EXCHANGE_RATE = 1.75;

// 莫桑石价格系数
const MOISSANITE_MULTIPLIER = 1.1;

// mm到CT的标准换算表
const MM_TO_CT: Record<number, number> = {
  4.0: 0.25,
  4.8: 0.40,
  5.0: 0.50,
  5.5: 0.66,
  6.0: 0.80,
  6.5: 1.00,
  7.0: 1.25,
  7.5: 1.50,
  8.0: 1.80,
  8.5: 2.00,
  9.0: 2.50,
  10.0: 3.50,
};

// 中文数字转换
const CHINESE_NUM: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
};

// 品类映射
const CATEGORY_MAP: Record<string, string> = {
  '戒指': '戒指',
  '项链': '项链',
  '手链': '手链',
  '耳环': '耳钉',
};

// 金属底色映射
const METAL_COLOR_MAP: Record<string, string> = {
  '白金色': '银色',
  '白金': '银色',
  '香槟金色': '玫瑰金',
  '香槟金': '玫瑰金',
  '金色': '金色',
  '玫瑰金': '玫瑰金',
  '银色': '银色',
};

// ============== 辅助函数 ==============

/**
 * 从单元格值中提取文本（处理富文本格式）
 */
function extractCellValue(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'object' && cell.richText) {
    return cell.richText.map((rt: any) => rt.text || '').join('').trim();
  }
  return String(cell).trim();
}

/**
 * 解析编号列，提取SPU编号和商品名称
 */
function parseCodeAndName(value: string): { spuCode: string | null; name: string } {
  if (!value) return { spuCode: null, name: '' };
  
  const parts = value.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return { spuCode: null, name: '' };
  
  // 尝试从每个部分匹配SPU编号
  const spuPattern = /^([A-Z]{2,}\d+(-[A-Z0-9]+)?)$/i;
  
  for (const part of parts) {
    const match = part.match(spuPattern);
    if (match) {
      const spuCode = match[1].toUpperCase();
      // 找到名称（其他部分或当前部分的中文）
      const otherParts = parts.filter(p => p !== part);
      const name = otherParts.join('') || '';
      return { spuCode, name };
    }
  }
  
  // 如果没有匹配到标准格式，尝试从开头提取
  const codeMatch = parts[0].match(/^([A-Z]{2,}\d+(-[A-Z0-9]+)?)/i);
  if (codeMatch) {
    const spuCode = codeMatch[1].toUpperCase();
    const remaining = parts[0].substring(codeMatch[0].length).trim();
    const name = [remaining, ...parts.slice(1)].filter(Boolean).join('');
    return { spuCode, name };
  }
  
  return { spuCode: null, name: value };
}

/**
 * 解析主石尺寸，转换为CT值
 */
function parseStoneSize(value: string): string {
  if (!value) return '';
  
  const ctValues: number[] = [];
  
  // 处理换行符分隔的多个尺寸
  const parts = value.split(/[\r\n]+/);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    // 克拉格式: X克拉 或 XCT
    const ctMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:克拉|CT|ct)/i);
    if (ctMatch) {
      ctValues.push(parseFloat(ctMatch[1]));
      continue;
    }
    
    // 分格式: X分
    const fenMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*分/);
    if (fenMatch) {
      ctValues.push(parseFloat(fenMatch[1]) / 100);
      continue;
    }
    
    // 中文数字+克拉: 一克拉、两克拉
    const chineseCtMatch = trimmed.match(/([一二三四五六七八九十两]+)\s*克拉/);
    if (chineseCtMatch) {
      const chineseNum = chineseCtMatch[1];
      const numMap: Record<string, number> = { ...CHINESE_NUM, '两': 2 };
      if (numMap[chineseNum]) {
        ctValues.push(numMap[chineseNum]);
      }
      continue;
    }
    
    // mm格式: Xmm 或 X mm
    const mmMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*mm/i);
    if (mmMatch) {
      const mm = parseFloat(mmMatch[1]);
      // 查找匹配的CT值
      if (MM_TO_CT[mm] !== undefined) {
        ctValues.push(MM_TO_CT[mm]);
      } else {
        // 没有精确匹配，保留原始mm值
        // 不添加到ctValues，后面会特殊处理
      }
      continue;
    }
  }
  
  if (ctValues.length === 0) {
    // 如果没有解析到CT值，尝试保留原始值（但清理格式）
    return value.replace(/[\r\n]+/g, ' ').trim();
  }
  
  // 返回最大的CT值
  const maxCt = Math.max(...ctValues);
  return `${maxCt}CT`;
}

/**
 * 从备注中解析金属底色
 */
function parseMetalColor(remark: string): string {
  const colors: Set<string> = new Set();
  
  for (const [keyword, color] of Object.entries(METAL_COLOR_MAP)) {
    if (remark.includes(keyword)) {
      colors.add(color);
    }
  }
  
  // 默认银色
  if (colors.size === 0) {
    colors.add('银色');
  }
  
  return Array.from(colors).join(',');
}

/**
 * 从备注中解析尺码（戒指）
 */
function parseRingSize(remark: string): string {
  if (remark.includes('活口')) {
    return 'adjustable';
  }
  return '5,6,7,8,9,10';
}

/**
 * 从备注中解析长度（项链）
 */
function parseNecklaceLength(remark: string): string {
  // 尝试匹配长度
  const lengthMatch = remark.match(/(\d+)\s*cm/i);
  if (lengthMatch) {
    return `${lengthMatch[1]}cm`;
  }
  return '45cm';
}

/**
 * 从备注中解析长度（手链）
 */
function parseBraceletLength(remark: string): string {
  // 尝试匹配长度
  const lengthMatch = remark.match(/(\d+(?:\.\d+)?)\s*cm/i);
  if (lengthMatch) {
    return `${lengthMatch[1]}cm`;
  }
  return 'adjustable';
}

/**
 * 计算参考价格
 */
function calculatePrices(zirconPrice: number | null, moissanitePrice: number | null): {
  gemTypes: string;
  minPrice: number | null;
  maxPrice: number | null;
} {
  const prices: { type: string; price: number }[] = [];
  
  if (zirconPrice && zirconPrice > 0) {
    prices.push({ type: '锆石', price: zirconPrice * EXCHANGE_RATE });
  }
  
  if (moissanitePrice && moissanitePrice > 0) {
    prices.push({ type: '莫桑石', price: moissanitePrice * MOISSANITE_MULTIPLIER * EXCHANGE_RATE });
  }
  
  if (prices.length === 0) {
    return { gemTypes: '', minPrice: null, maxPrice: null };
  }
  
  const gemTypes = prices.map(p => p.type).join(',');
  const priceValues = prices.map(p => p.price);
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);
  
  return { gemTypes, minPrice, maxPrice };
}

// ============== 主转换逻辑 ==============

interface Product {
  spuCode: string;
  name: string;
  category: string;
  gemTypes: string;
  metalColor: string;
  stoneSize: string;
  size: string; // 尺码（戒指）
  length: string; // 长度（项链/手链）
  minPrice: number | null;
  maxPrice: number | null;
  imageBuffer: ArrayBuffer | null;
  imageExt: string;
}

async function convertExcel() {
  console.log('=== 新德艺Excel转换脚本 ===\n');
  
  // 读取原始报价表
  const sourcePath = 'products/副本新德艺报价1月14.xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  
  console.log(`读取文件: ${sourcePath}`);
  console.log(`Sheets: ${workbook.worksheets.map(ws => ws.name).join(', ')}\n`);
  
  const allProducts: Product[] = [];
  
  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    const category = CATEGORY_MAP[sheetName] || '其他';
    
    console.log(`处理 Sheet: ${sheetName} -> 品类: ${category}`);
    
    // 获取图片映射
    const images = worksheet.getImages();
    const imageMap = new Map<number, { buffer: ArrayBuffer; ext: string }>();
    
    for (const img of images) {
      const range = img.range as any;
      if (range?.tl?.row !== undefined) {
        const row = Math.floor(range.tl.row);
        // imageId 在 ExcelJS 中是 string 类型
        const imageData = (workbook as any).model.media.find((m: any) => m.index === img.imageId);
        if (imageData && imageData.buffer) {
          // 标准化图片扩展名
          let ext = imageData.type || 'png';
          // 处理可能的非标准扩展名
          if (ext === 'image') {
            ext = 'jpeg';
          }
          // 确保扩展名有效
          const validExts = ['png', 'jpeg', 'jpg', 'gif', 'bmp'];
          if (!validExts.includes(ext.toLowerCase())) {
            ext = 'jpeg';
          }
          imageMap.set(row, {
            buffer: imageData.buffer,
            ext,
          });
        }
      }
    }
    
    // 获取数据行
    const rows = worksheet.getSheetValues();
    
    // 使用Map来合并同一SPU的多行数据
    const spuMap = new Map<string, {
      spuCode: string;
      name: string;
      category: string;
      gemTypes: string;
      metalColor: string;
      stoneSizes: string[];
      size: string;
      length: string;
      minPrice: number | null;
      maxPrice: number | null;
      imageBuffer: ArrayBuffer;
      imageExt: string;
    }>();
    
    for (let i = 3; i <= rows.length; i++) {
      const row = rows[i] as any[];
      if (!row) continue;
      
      // 提取单元格值
      const codeAndNameValue = extractCellValue(row[1]);
      const zirconPrice = row[3] ? parseFloat(extractCellValue(row[3])) : null;
      const moissanitePrice = row[4] ? parseFloat(extractCellValue(row[4])) : null;
      const stoneSizeValue = extractCellValue(row[5]);
      const remark = extractCellValue(row[6]);
      
      // 解析SPU编号和名称
      const { spuCode, name } = parseCodeAndName(codeAndNameValue);
      
      if (!spuCode) {
        continue; // 跳过没有编号的行
      }
      
      // 获取图片
      const imageData = imageMap.get(i - 1);
      if (!imageData) {
        continue; // 跳过没有图片的行
      }
      
      // 解析各项属性
      const { gemTypes, minPrice, maxPrice } = calculatePrices(zirconPrice, moissanitePrice);
      const metalColor = parseMetalColor(remark);
      const stoneSize = parseStoneSize(stoneSizeValue);
      
      // 根据品类设置尺码/长度
      let size = '';
      let length = '';
      
      if (category === '戒指') {
        size = parseRingSize(remark);
      } else if (category === '项链') {
        length = parseNecklaceLength(remark);
      } else if (category === '手链') {
        length = parseBraceletLength(remark);
      }
      
      // 检查是否已存在该SPU
      if (spuMap.has(spuCode)) {
        // 合并：添加主石尺寸
        const existing = spuMap.get(spuCode)!;
        if (stoneSize && !existing.stoneSizes.includes(stoneSize)) {
          existing.stoneSizes.push(stoneSize);
        }
        // 更新价格范围（取最小和最大）
        if (minPrice !== null) {
          existing.minPrice = existing.minPrice !== null 
            ? Math.min(existing.minPrice, minPrice) 
            : minPrice;
        }
        if (maxPrice !== null) {
          existing.maxPrice = existing.maxPrice !== null 
            ? Math.max(existing.maxPrice, maxPrice) 
            : maxPrice;
        }
      } else {
        // 新建SPU记录
        spuMap.set(spuCode, {
          spuCode,
          name,
          category,
          gemTypes,
          metalColor,
          stoneSizes: stoneSize ? [stoneSize] : [],
          size,
          length,
          minPrice,
          maxPrice,
          imageBuffer: imageData.buffer,
          imageExt: imageData.ext,
        });
      }
    }
    
    // 将Map转换为Product数组
    for (const spuData of spuMap.values()) {
      allProducts.push({
        spuCode: spuData.spuCode,
        name: spuData.name,
        category: spuData.category,
        gemTypes: spuData.gemTypes,
        metalColor: spuData.metalColor,
        stoneSize: spuData.stoneSizes.join(','),
        size: spuData.size,
        length: spuData.length,
        minPrice: spuData.minPrice,
        maxPrice: spuData.maxPrice,
        imageBuffer: spuData.imageBuffer,
        imageExt: spuData.imageExt,
      });
    }
  }
  
  console.log(`\n共解析 ${allProducts.length} 个有效商品`);
  
  // 按品类统计
  const categoryCount: Record<string, number> = {};
  for (const p of allProducts) {
    categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
  }
  console.log('品类统计:', JSON.stringify(categoryCount));
  
  // 拆分文件（每100个商品一个文件）
  const batchSize = 100;
  const batchCount = Math.ceil(allProducts.length / batchSize);
  
  // 创建输出目录
  const outputDir = 'products/output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`\n开始生成 ${batchCount} 个Excel文件...\n`);
  
  for (let batch = 0; batch < batchCount; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, allProducts.length);
    const batchProducts = allProducts.slice(start, end);
    
    const outputPath = path.join(outputDir, `新德艺导入模板_${batch + 1}.xlsx`);
    await createImportExcel(batchProducts, outputPath);
    
    console.log(`生成文件 ${batch + 1}/${batchCount}: ${outputPath} (${batchProducts.length} 个商品)`);
  }
  
  console.log('\n✅ 转换完成！');
}

async function createImportExcel(products: Product[], outputPath: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('商品导入');
  
  // 设置表头
  const headers = [
    'SPU编号', '首图', '名称', '品类', '宝石类型', '金属底色',
    '主石尺寸(mm)', '尺码', '长度(cm)', '参考价最低(SAR)', '参考价最高(SAR)',
    '描述', '其他图片1', '其他图片2', '其他图片3', '其他图片4', '其他图片5',
    '供应商', '供应商链接'
  ];
  
  worksheet.addRow(headers);
  
  // 设置列宽
  worksheet.columns = [
    { width: 15 }, // SPU编号
    { width: 12 }, // 首图
    { width: 20 }, // 名称
    { width: 8 },  // 品类
    { width: 15 }, // 宝石类型
    { width: 12 }, // 金属底色
    { width: 12 }, // 主石尺寸
    { width: 15 }, // 尺码
    { width: 10 }, // 长度
    { width: 15 }, // 参考价最低
    { width: 15 }, // 参考价最高
    { width: 30 }, // 描述
    { width: 10 }, // 其他图片1
    { width: 10 }, // 其他图片2
    { width: 10 }, // 其他图片3
    { width: 10 }, // 其他图片4
    { width: 10 }, // 其他图片5
    { width: 10 }, // 供应商
    { width: 20 }, // 供应商链接
  ];
  
  // 设置行高（用于图片）
  const ROW_HEIGHT = 60;
  
  for (const product of products) {
    const row = worksheet.addRow([
      product.spuCode,
      '', // 首图（稍后添加）
      product.name,
      product.category,
      product.gemTypes,
      product.metalColor,
      product.stoneSize,
      product.size,
      product.length,
      product.minPrice ? Math.round(product.minPrice * 100) / 100 : '',
      product.maxPrice ? Math.round(product.maxPrice * 100) / 100 : '',
      '', // 描述
      '', '', '', '', '', // 其他图片
      SUPPLIER_NAME,
      '', // 供应商链接
    ]);
    
    row.height = ROW_HEIGHT;
    
    // 添加图片
    if (product.imageBuffer) {
      const imageId = workbook.addImage({
        buffer: product.imageBuffer,
        extension: product.imageExt as any,
      });
      
      const rowNum = row.number;
      worksheet.addImage(imageId, {
        tl: { col: 1, row: rowNum - 1 },
        ext: { width: 60, height: 60 },
      });
    }
  }
  
  await workbook.xlsx.writeFile(outputPath);
}

// 运行
convertExcel().catch(console.error);
