const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 创建工作簿
const wb = XLSX.utils.book_new();

// 创建工作表数据 - 只包含要求的五个字段
const ws_data = [
  ['员工号', '姓名', '所属机构', '所属部门', '岗位'],
  ['', '', '机构1', '部门1', '对公'],
  ['', '', '机构1', '部门2', '个人'],
  ['', '', '机构2', '部门3', '风险核查']
];

// 创建工作表
const ws = XLSX.utils.aoa_to_sheet(ws_data);

// 设置列宽
ws['!cols'] = [
  {wch: 10}, // 员工号
  {wch: 10}, // 姓名
  {wch: 15}, // 所属机构
  {wch: 15}, // 所属部门
  {wch: 10}  // 岗位
];

// 添加数据验证 - 岗位列（下拉框选项：对公、个人、风险核查）
const dropdownRange = XLSX.utils.encode_range({s: {r: 1, c: 4}, e: {r: 100, c: 4}});
ws['!dataValidations'] = {
  lists: [{
    sqref: dropdownRange,
    formula1: '"对公,个人,风险核查"'
  }]
};

// 将工作表添加到工作簿
XLSX.utils.book_append_sheet(wb, ws, '员工数据');

// 保存工作簿
const outputPath = path.join(__dirname, 'employee_import_template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Excel模板已成功创建: ${outputPath}`);