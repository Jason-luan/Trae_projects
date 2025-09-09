import sys
import pandas as pd
import os
from collections import defaultdict

class RuleDetailAnalyzer:
    def __init__(self, file_path=None):
        # 优先使用传入的路径，否则使用默认路径
        self.file_path = file_path or '/Users/luanxiaowei/Documents/项目开发/智能排班表2/排班表新3.xlsx'
        self.rule_df = None
        self.schedule_df = None
        self.business_line_shift_map = {}
        self.business_line_columns = []
        self.employee_stats = defaultdict(lambda: {'business_lines': set(), 'shifts': set()})
        
    def load_excel_data(self):
        """加载Excel数据"""
        try:
            if not os.path.exists(self.file_path):
                raise FileNotFoundError(f"Excel文件不存在: {self.file_path}")
                
            # 读取规则工作表，不设置表头，以便查看原始结构
            self.rule_df = pd.read_excel(self.file_path, sheet_name='规则', header=None)
            # 读取排班表数据，用于后续分析
            self.schedule_df = pd.read_excel(self.file_path, sheet_name='排班表', header=0)
            
            return True
        except Exception as e:
            print(f"加载Excel数据时出错: {e}")
            return False
            
    def analyze_rule_structure(self):
        """分析规则表的基本结构"""
        if self.rule_df is None:
            print("规则表数据未加载")
            return False
            
        print(f"规则表整体信息：行数={len(self.rule_df)}, 列数={len(self.rule_df.columns)}")
        
        # 识别业务线（通常在第一行的非空单元格中）
        business_lines = []
        first_row = self.rule_df.iloc[0].tolist()
        for cell in first_row:
            if pd.notna(cell) and isinstance(cell, str):
                business_lines.append(cell)
        
        print(f"\n识别到的业务线：{business_lines}")
        
        # 识别班次类型（通常在第二行）
        shift_types = []
        second_row = self.rule_df.iloc[1].tolist()
        for cell in second_row:
            if pd.notna(cell) and isinstance(cell, str):
                shift_types.append(cell)
        
        print(f"\n识别到的班次类型：{shift_types}")
        
        return True
        
    def build_business_line_shift_mapping(self):
        """构建业务线与班次类型的映射关系"""
        if self.rule_df is None:
            print("规则表数据未加载")
            return False
            
        first_row = self.rule_df.iloc[0].tolist()
        second_row = self.rule_df.iloc[1].tolist()
        
        print("\n=== 业务线与班次对应关系分析 ===")
        
        # 确定每个业务线对应的列范围
        current_line = None
        start_col = 0
        
        for i, cell in enumerate(first_row):
            if pd.notna(cell) and isinstance(cell, str):
                if current_line is not None:
                    self.business_line_columns.append((current_line, start_col, i))
                current_line = cell
                start_col = i
        # 添加最后一个业务线
        if current_line is not None:
            self.business_line_columns.append((current_line, start_col, len(first_row)))
            
        # 提取每个业务线对应的班次类型
        for line, start_col, end_col in self.business_line_columns:
            line_shifts = []
            for i in range(start_col, end_col):
                if pd.notna(second_row[i]) and isinstance(second_row[i], str):
                    line_shifts.append(second_row[i])
            self.business_line_shift_map[line] = line_shifts
            print(f"{line}业务线包含班次：{line_shifts}")
            
        return True
            
    def analyze_employee_allocation(self):
        """分析人员分配规则"""
        if self.rule_df is None or not self.business_line_shift_map:
            print("规则表数据未加载或业务线映射未构建")
            return False
            
        print("\n=== 人员-班次分配规则分析 ===")
        second_row = self.rule_df.iloc[1].tolist()
        
        # 遍历每个业务线
        for line, shifts in self.business_line_shift_map.items():
            print(f"\n{line}业务线人员分配：")
            
            # 找到该业务线对应的列范围
            line_cols = []
            for l, s, e in self.business_line_columns:
                if l == line:
                    line_cols = list(range(s, e))
                    break
            
            # 遍历每个班次类型
            for shift_idx, shift in enumerate(shifts):
                # 确定该班次对应的列
                shift_col = -1
                for i in line_cols:
                    if pd.notna(second_row[i]) and second_row[i] == shift:
                        shift_col = i
                        break
                
                if shift_col != -1:
                    # 收集该班次的所有人员
                    shift_employees = []
                    for row_idx in range(2, len(self.rule_df)):
                        cell = self.rule_df.iloc[row_idx, shift_col]
                        if pd.notna(cell) and isinstance(cell, str):
                            shift_employees.append(cell)
                    
                    if shift_employees:
                        print(f"  {shift}：{', '.join(shift_employees[:5])}{'...' if len(shift_employees) > 5 else ''} (共{len(shift_employees)}人)")
                    else:
                        print(f"  {shift}：暂无人员分配")
                        
        return True
            
    def analyze_cross_business_shift_employees(self):
        """分析人员跨业务线和跨班次情况"""
        if self.rule_df is None:
            print("规则表数据未加载")
            return False
            
        print("\n=== 人员跨业务线和跨班次分析 ===")
        second_row = self.rule_df.iloc[1].tolist()
        
        # 遍历所有行和列，收集人员信息
        for row_idx in range(2, len(self.rule_df)):
            for col_idx in range(len(self.rule_df.columns)):
                cell = self.rule_df.iloc[row_idx, col_idx]
                if pd.notna(cell) and isinstance(cell, str):
                    # 确定该人员所在的业务线
                    employee_business_line = None
                    for line, s, e in self.business_line_columns:
                        if s <= col_idx < e:
                            employee_business_line = line
                            break
                    
                    # 确定该人员所在的班次类型
                    employee_shift = second_row[col_idx] if pd.notna(second_row[col_idx]) else "未知班次"
                    
                    # 更新人员统计信息
                    self.employee_stats[cell]['business_lines'].add(employee_business_line)
                    self.employee_stats[cell]['shifts'].add(employee_shift)
        
        # 找出跨多个业务线或多个班次的人员
        cross_business_employees = []
        cross_shift_employees = []
        
        for emp, stats in self.employee_stats.items():
            if len(stats['business_lines']) > 1:
                cross_business_employees.append((emp, stats['business_lines']))
            if len(stats['shifts']) > 1:
                cross_shift_employees.append((emp, stats['shifts']))
        
        if cross_business_employees:
            print(f"跨多个业务线的人员 ({len(cross_business_employees)}人):")
            for emp, lines in cross_business_employees:
                print(f"  {emp}：{', '.join(lines)}")
        else:
            print("未发现跨多个业务线的人员")
        
        print()
        if cross_shift_employees:
            print(f"跨多个班次的人员 ({len(cross_shift_employees)}人):")
            for emp, shifts in cross_shift_employees:
                # 只显示前几个班次，避免输出过长
                shifts_list = list(shifts)
                print(f"  {emp}：{', '.join(shifts_list[:3])}{'...' if len(shifts_list) > 3 else ''}")
        else:
            print("未发现跨多个班次的人员")
            
        return True
            
    def generate_rule_summary(self):
        """生成规则表结构总结"""
        print("\n=== 规则表结构总结 ===")
        print("1. 规则表采用多列布局，每列对应不同业务线的不同班次类型")
        print("2. 第一行定义业务线（对公、个人、风险）")
        print("3. 第二行定义具体班次类型（正常班、夜班、周末岗、节假日等）")
        print("4. 从第三行开始，每行列出被分配到对应班次的员工姓名")
        print("5. 部分员工被分配到多个班次，显示出灵活的排班策略")
        
    def analyze_employee_work_patterns(self):
        """分析员工工作模式 - 基于排班表数据"""
        if self.schedule_df is None:
            print("\n警告：排班表数据未加载，无法分析员工工作模式")
            return
            
        print("\n=== 员工工作模式分析 ===")
        
        # 尝试识别员工列和日期列
        try:
            # 假设第一列是员工信息
            employee_col = self.schedule_df.columns[0]
            date_cols = []
            
            # 尝试识别日期列
            for col in self.schedule_df.columns[1:]:
                # 检查列名是否包含日期相关词汇或数字
                if isinstance(col, str) and any(keyword in col for keyword in ['日期', '星期', '周', '日', '月']) or isinstance(col, (int, float)):
                    date_cols.append(col)
            
            if date_cols:
                print(f"识别到 {len(date_cols)} 个可能的日期列")
                
                # 分析部分员工的工作模式示例
                sample_size = 5  # 分析的样本数量
                sample_count = 0
                
                for idx, row in self.schedule_df.iterrows():
                    employee = row[employee_col]
                    # 跳过表头行和说明行
                    if isinstance(employee, str) and ("注意：" in employee or "排班信息" in employee or "部门" in employee):
                        continue
                    
                    # 收集该员工的排班信息
                    shifts = row[date_cols].tolist()
                    # 过滤掉无效值
                    valid_shifts = [s for s in shifts if pd.notna(s) and s != '']
                    
                    if valid_shifts:
                        # 计算工作天数和休息天数
                        work_days = sum(1 for s in valid_shifts if s != '休' and s != '休息')
                        rest_days = sum(1 for s in valid_shifts if s == '休' or s == '休息')
                        
                        # 计算工作比例
                        work_ratio = work_days / len(valid_shifts) if valid_shifts else 0
                        
                        print(f"{employee}：总天数={len(valid_shifts)}, 工作天数={work_days}, 休息天数={rest_days}, 工作比例={work_ratio:.2f}")
                        
                        sample_count += 1
                        if sample_count >= sample_size:
                            break
        except Exception as e:
            print(f"分析员工工作模式时出错: {e}")
            
    def run_complete_analysis(self):
        """运行完整的规则详情分析"""
        print("===== 规则页签排班规则详细分析 ======")
        
        # 按顺序执行分析步骤
        if not self.load_excel_data():
            return False
            
        if not self.analyze_rule_structure():
            return False
            
        if not self.build_business_line_shift_mapping():
            return False
            
        if not self.analyze_employee_allocation():
            return False
            
        if not self.analyze_cross_business_shift_employees():
            return False
            
        self.generate_rule_summary()
        self.analyze_employee_work_patterns()
        
        print("\n===== 规则页签分析完成 ======")
        return True

# 主程序
if __name__ == "__main__":
    # 支持从命令行传入文件路径参数
    file_path = sys.argv[1] if len(sys.argv) > 1 else None
    
    analyzer = RuleDetailAnalyzer(file_path)
    analyzer.run_complete_analysis()