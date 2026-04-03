import XLSX from 'xlsx';
import * as fs from 'fs';

const workbook = XLSX.readFile('products/副本新德艺报价1月14.xlsx');
console.log('Sheets:', workbook.SheetNames);

// 分析每个sheet
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  console.log(`\n=== Sheet: ${sheetName} ===`);
  console.log(`Row count: ${data.length}`);
  console.log('First 10 rows:');
  for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(`Row ${i}: `, JSON.stringify(data[i]));
  }
  console.log('Last 5 rows:');
  for (let i = Math.max(0, data.length - 5); i < data.length; i++) {
    console.log(`Row ${i}: `, JSON.stringify(data[i]));
  }
}
