import pandas as pd
import numpy as np
from collections import defaultdict, Counter
import re

# 设置中文字体显示
pd.set_option('display.unicode.ambiguous_as_wide', True)
pd.set_option('display.unicode.east_asian_width', True)
pd.set_option('display.max_columns', None)
pd.set_option('display.max_rows', 50)

class ScheduleRuleValidator:
    def __init__(self, excel_file):
        self.excel_file = excel_file
        self.schedule_df = None  # 排班表数据
        self.rule_df = None      # 规则表数据
        self.shift_mapping = {
            'G': '正常班',
            'Y16': '夜班',
            'G值': '周末班',
            'G值-A': '周末班',
            'G值-B': '周末班', 
            'G值-C': '周末班',
            'Y1030普': '工作日Y1030班',
            '休': '休息'
        }
        self.priority_order = ['Y16综', '周末G班', '工作日Y1030普', '工作日G班']
        self.special_groups = {
            '风险-对公反诈组': {
                '夜班岗': 'Y16综',
                '周末A岗': 'G班',
                '周六C岗': 'G班'
            },
            '风险室-个人反诈': {
                '夜班岗': 'Y16综',
                '周末白班岗': 'G班'
            },
            '风险室-风险核查': {
                '周末B岗': 'G班'
            },
            '风险室-远程质检': {
                '周末B岗': 'G班'
            }
        }
        
        self.load_data()
    
    def load_data(self):
        """加载Excel文件中的排班表和规则表数据"""
        try:
            # 读取排班表
            self.schedule_df = pd.read_excel(self.excel_file, sheet_name='排班表')
            # 读取规则表
            self.rule_df = pd.read_excel(self.excel_file, sheet_name='规则')
            print(f"成功读取Excel文件：{self.excel_file}")
            print(f"排班表形状：{self.schedule_df.shape}")
            print(f"规则表形状：{self.rule_df.shape}")
        except Exception as e:
            print(f"读取Excel文件时出错：{e}")
    
    def identify_employees_and_dates(self):
        """识别员工列和日期列"""
        if self.schedule_df is None:
            print("排班表数据未加载")
            return None, None
        
        print("排班表列名预览：")
        print(self.schedule_df.columns.tolist())
        
        # 假设第一列是员工信息
        employee_col = self.schedule_df.columns[0]
        
        # 改进的日期列识别逻辑：尝试多种方法
        date_cols = []
        
        # 方法1：检查列名是否包含日期特征
        for col in self.schedule_df.columns[1:]:
            if isinstance(col, str):
                # 检查是否包含月份、日期相关关键词
                if (re.search(r'\d{1,2}[月日]', col) or 
                    re.search(r'\d{4}-\d{2}-\d{2}', col) or
                    re.search(r'星期[一二三四五六日]', col) or
                    re.search(r'周[一二三四五六日]', col)):
                    date_cols.append(col)
        
        # 如果方法1未能识别足够的列，尝试方法2：跳过前几行后检查数据内容
        if len(date_cols) < 5:  # 如果识别的日期列太少
            print("尝试通过数据内容识别日期列...")
            # 跳过前几行可能是表头的部分
            sample_data = self.schedule_df.iloc[2:10, 1:].copy()
            
            # 检查每列是否包含典型的排班数据（G、Y16、休等）
            for i, col in enumerate(self.schedule_df.columns[1:], 1):
                # 获取该列的非空值样本
                col_samples = sample_data.iloc[:, i-1].dropna().tolist()
                if len(col_samples) > 0:
                    # 检查是否包含典型的排班代码
                    has_shift_codes = any(isinstance(val, str) and 
                                         (val in ['G', '休'] or 
                                          val.startswith('Y16') or 
                                          val.startswith('G值') or 
                                          'Y1030' in val) 
                                         for val in col_samples)
                    if has_shift_codes:
                        date_cols.append(col)
        
        # 如果还是没有识别到足够的列，直接返回所有列（除了第一列）
        if len(date_cols) < 5:
            print("未能通过特征识别日期列，返回所有非员工列")
            date_cols = self.schedule_df.columns[1:].tolist()
        
        print(f"识别到的日期列数量：{len(date_cols)}")
        if len(date_cols) > 0:
            print(f"前5个日期列示例：{date_cols[:5]}")
        
        return employee_col, date_cols
    
    def validate_work_days_per_week(self):
        """验证每周上五休二规则和连续上班天数规则"""
        if self.schedule_df is None:
            print("排班表数据未加载")
            return
        
        employee_col, date_cols = self.identify_employees_and_dates()
        if not date_cols:
            print("未能识别日期列")
            return
        
        issues = defaultdict(list)
        
        # 识别实际员工行和部门行
        for idx, row in self.schedule_df.iterrows():
            employee = row[employee_col]
            
            # 跳过表头行和说明行
            if isinstance(employee, str):
                if "注意：" in employee or "排班信息" in employee:
                    continue
                # 对于部门行，可能需要特殊处理
                if "部门" in employee or "风险-" in employee or "风险室-" in employee:
                    # 部门行可能包含多人排班信息，不进行个人规则验证
                    continue
            
            shifts = row[date_cols].tolist()
            
            # 只处理有实际排班数据的行
            valid_shifts = [s for s in shifts if pd.notna(s) and s not in ['', 'nan']]
            if len(valid_shifts) < 5:  # 跳过数据太少的行
                continue
            
            # 检查连续上班天数 - 允许连续7天，但不允许超过7天
            consecutive_work_days = 0
            for i in range(len(shifts)):
                shift = shifts[i]
                if pd.notna(shift) and shift != '休' and shift != '':
                    consecutive_work_days += 1
                    # 只有超过7天才算异常
                    if consecutive_work_days > 7:
                        issues[employee].append(f"第{i+1}天连续上班超过7天")
                else:
                    consecutive_work_days = 0
            
            # 检查上五休二规则 - 按周统计
            # 假设排班周期为4周左右（28天）
            total_work_days = sum(1 for s in shifts if pd.notna(s) and s != '休' and s != '')
            total_days = len([s for s in shifts if pd.notna(s) and s != ''])
            
            # 计算平均每周工作天数
            if total_days > 7:  # 确保有足够的数据进行统计
                weeks = total_days / 7
                avg_work_days_per_week = total_work_days / weeks
                
                # 上五休二制允许的范围：4-6天/周
                if avg_work_days_per_week < 4 or avg_work_days_per_week > 6:
                    issues[employee].append(f"平均每周工作{avg_work_days_per_week:.1f}天，不符合上五休二制")
        
        if issues:
            print("上五休二规则验证问题：")
            for emp, emp_issues in issues.items():
                # 去重问题描述
                unique_issues = list(set(emp_issues))
                print(f"{emp}: {', '.join(unique_issues)}")
        else:
            print("上五休二规则验证通过")
    
    def analyze_shift_priority(self):
        """分析班次优先级"""
        if self.schedule_df is None:
            print("排班表数据未加载")
            return
        
        employee_col, date_cols = self.identify_employees_and_dates()
        if not date_cols:
            print("未能识别日期列")
            return
        
        # 统计各类班次出现的次数
        shift_counter = Counter()
        
        for idx, row in self.schedule_df.iterrows():
            shifts = row[date_cols].dropna().tolist()
            for shift in shifts:
                # 识别班次类型
                if isinstance(shift, str):
                    if 'Y16' in shift:
                        shift_counter['Y16综'] += 1
                    elif shift.startswith('G值') or ('周末' in shift and 'G' in shift):
                        shift_counter['周末G班'] += 1
                    elif 'Y1030' in shift:
                        shift_counter['工作日Y1030普'] += 1
                    elif shift == 'G':
                        shift_counter['工作日G班'] += 1
                    elif shift == '休':
                        shift_counter['休息'] += 1
                    else:
                        shift_counter['其他'] += 1
        
        print("班次分布统计：")
        for shift_type, count in sorted(shift_counter.items()):
            print(f"{shift_type}: {count}次")
    
    def validate_special_groups(self):
        """验证特殊部门的排班规则"""
        if self.schedule_df is None or self.rule_df is None:
            print("数据未加载完整")
            return
        
        print("\n特殊部门排班规则验证：")
        
        # 尝试从规则表中提取部门信息
        print("规则表前10行数据预览：")
        print(self.rule_df.head(10))
        
        # 分析排班表中特殊班次的分布
        employee_col, date_cols = self.identify_employees_and_dates()
        if not date_cols:
            print("未能识别日期列")
            return
        
        # 检查风险-对公反诈组的夜班（每日一人）
        y16_count_per_day = defaultdict(int)
        for col in date_cols:
            # 计算每天Y16班次的数量
            y16_count = self.schedule_df[col].str.contains('Y16', na=False).sum()
            y16_count_per_day[col] = y16_count
        
        # 找出Y16班次数量异常的日期
        abnormal_y16_days = {day: count for day, count in y16_count_per_day.items() if count != 1}
        if abnormal_y16_days:
            print("风险-对公反诈组夜班岗异常（应为每日1人）：")
            for day, count in abnormal_y16_days.items():
                print(f"{day}: {count}人")
        else:
            print("风险-对公反诈组夜班岗配置正常（每日1人）")
    
    def analyze_shift_sequence(self):
        """分析各班次的排班顺序"""
        if self.schedule_df is None:
            print("排班表数据未加载")
            return
        
        print("\n班次排班顺序分析：")
        employee_col, date_cols = self.identify_employees_and_dates()
        if not date_cols:
            print("未能识别日期列")
            return
        
        # 统计每位员工的班次序列
        employee_sequences = {}
        for idx, row in self.schedule_df.iterrows():
            employee = row[employee_col]
            if pd.notna(employee):
                shifts = row[date_cols].fillna('').tolist()
                # 过滤掉空值
                valid_shifts = [s for s in shifts if s]
                employee_sequences[employee] = valid_shifts
        
        # 显示部分员工的排班序列示例
        print("部分员工排班序列示例：")
        sample_size = min(5, len(employee_sequences))
        for i, (emp, seq) in enumerate(employee_sequences.items()):
            if i < sample_size:
                print(f"{emp}: {seq[:7]}...")
    
    def run_full_analysis(self):
        """运行完整的规则验证分析"""
        print("\n===== 排班规则验证分析报告 =====")
        
        # 1. 验证每周上五休二规则
        print("\n1. 每周上五休二规则验证：")
        self.validate_work_days_per_week()
        
        # 2. 分析班次优先级
        print("\n2. 班次优先级分析：")
        self.analyze_shift_priority()
        
        # 3. 验证特殊部门排班规则
        print("\n3. 特殊部门排班规则验证：")
        self.validate_special_groups()
        
        # 4. 分析排班顺序
        print("\n4. 排班顺序分析：")
        self.analyze_shift_sequence()
        
        print("\n===== 分析完成 =====")

if __name__ == "__main__":
    # 替换为实际的Excel文件路径
    excel_file = '/Users/luanxiaowei/Documents/项目开发/智能排班表2/排班表新3.xlsx'
    
    validator = ScheduleRuleValidator(excel_file)
    validator.run_full_analysis()