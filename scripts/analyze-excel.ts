import ExcelJS from 'exceljs';

async function verifyOutput() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('products/output/新德艺导入模板_1.xlsx');
  
  const sheet = workbook.worksheets[0];
  const rows = sheet.getSheetValues();
  
  console.log('=== 验证输出文件（合并后）===\n');
  
  // 查找有多主石尺寸的商品
  console.log('查找有多主石尺寸的商品（主石尺寸包含逗号）:\n');
  let foundCount = 0;
  for (let i = 2; i <= rows.length && foundCount < 5; i++) {
    const row = rows[i] as any[];
    const stoneSize = row?.[7];
    if (stoneSize && String(stoneSize).includes(',')) {
      foundCount++;
      console.log(`\n第${i}行:`);
      console.log(`  SPU编号: ${row?.[1]}`);
      console.log(`  名称: ${row?.[3]}`);
      console.log(`  品类: ${row?.[4]}`);
      console.log(`  主石尺寸: ${stoneSize}`);
      console.log(`  参考价最低: ${row?.[10]}`);
      console.log(`  参考价最高: ${row?.[11]}`);
    }
  }
  
  if (foundCount === 0) {
    console.log('未找到有多主石尺寸的商品，显示前5行:\n');
    for (let i = 2; i <= 6; i++) {
      const row = rows[i] as any[];
      console.log(`\n第${i}行:`);
      console.log(`  SPU编号: ${row?.[1]}`);
      console.log(`  名称: ${row?.[3]}`);
      console.log(`  品类: ${row?.[4]}`);
      console.log(`  主石尺寸: ${row?.[7]}`);
    }
  }
}

verifyOutput().catch(console.error);
