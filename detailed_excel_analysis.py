import pandas as pd
import sys

# 指定Excel文件路径
file_path = '/Users/luanxiaowei/Documents/项目开发/智能排班表2/排班表新3.xlsx'

try:
    # 读取'规则'工作表
    print("===== 详细分析 '规则' 工作表 =====")
    rule_df = pd.read_excel(file_path, sheet_name='规则')
    
    print(f"行数: {len(rule_df)}, 列数: {len(rule_df.columns)}")
    print(f"表头: {list(rule_df.columns)}")
    
    # 显示所有非空行，因为规则可能是分散的
    non_empty_rule_rows = rule_df.dropna(how='all')
    print("\n规则内容（所有非空行）:")
    print(non_empty_rule_rows)
    
    # 读取'排班表'工作表
    print("\n===== 详细分析 '排班表' 工作表 =====")
    schedule_df = pd.read_excel(file_path, sheet_name='排班表')
    
    print(f"行数: {len(schedule_df)}, 列数: {len(schedule_df.columns)}")
    print(f"表头: {list(schedule_df.columns)}")
    
    # 显示前10行数据，了解排班表结构
    print("\n排班表前10行数据预览:")
    print(schedule_df.head(10))
    
    # 识别员工信息列
    emp_info_cols = []
    date_cols = []
    
    for col in schedule_df.columns:
        if isinstance(col, str):
            if '员工' in col or '姓名' in col or '部门' in col or '岗位' in col:
                emp_info_cols.append(col)
            elif ('日' in col or '号' in col or '/' in col) and not any(x in col for x in ['员工', '姓名', '部门', '岗位']):
                date_cols.append(col)
        
    print(f"\n识别到的员工信息列: {emp_info_cols}")
    print(f"识别到的日期列数量: {len(date_cols)}, 部分日期列: {date_cols[:5]}...")
    
    # 统计排班表中的班次代码分布
    print("\n班次代码分布统计:")
    shift_counts = {}    
    # 遍历所有日期列
    for col in date_cols:
        # 获取该列中的所有班次代码
        shifts = schedule_df[col].dropna()
        # 统计每个班次代码的出现次数
        for shift in shifts:
            if isinstance(shift, str):
                if shift in shift_counts:
                    shift_counts[shift] += 1
                else:
                    shift_counts[shift] = 1
    
    # 按出现次数排序并显示
    sorted_shifts = sorted(shift_counts.items(), key=lambda x: x[1], reverse=True)
    for shift, count in sorted_shifts:
        print(f"{shift}: {count}次")
    
    # 检查是否存在特殊标记或备注
    print("\n检查是否存在特殊标记或备注:")
    for col in schedule_df.columns:
        if isinstance(col, str) and ('备注' in col or '说明' in col):
            print(f"找到备注列: {col}")
            non_empty_remarks = schedule_df[col].dropna()
            if len(non_empty_remarks) > 0:
                print(f"备注内容示例: {non_empty_remarks.iloc[0] if len(non_empty_remarks) > 0 else '无'}")
    
    print("\n===== 详细分析完成 =====")
    
except Exception as e:
    print(f"分析Excel文件时出错: {e}")
    sys.exit(1)