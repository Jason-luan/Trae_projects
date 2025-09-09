import pandas as pd
import sys

# 指定Excel文件路径
file_path = '/Users/luanxiaowei/Documents/项目开发/智能排班表2/排班表新3.xlsx'

try:
    print("===== 深入分析 '规则' 工作表 =====")
    # 读取规则工作表，不设置表头，以便查看原始结构
    rule_df = pd.read_excel(file_path, sheet_name='规则', header=None)
    
    print(f"规则表行数: {len(rule_df)}, 列数: {len(rule_df.columns)}")
    print("\n规则表前15行原始数据:")
    for i in range(min(15, len(rule_df))):
        row_data = rule_df.iloc[i].tolist()
        # 过滤掉全NaN的列
        filtered_row = [x for x in row_data if pd.notna(x)]
        if filtered_row:
            print(f"行{i+1}: {filtered_row}")
    
    # 分析规则表的结构和含义
    print("\n规则表结构分析:")
    
    # 尝试识别不同的业务线和班次类型
    business_lines = []
    shift_types = []
    
    # 检查第一行，通常包含业务线或班次类型
    first_row = rule_df.iloc[0].tolist()
    business_lines = [x for x in first_row if pd.notna(x)]
    
    # 从规则表中提取班次类型
    for i in range(min(5, len(rule_df))):  # 检查前5行
        row_data = rule_df.iloc[i].tolist()
        for cell in row_data:
            if pd.notna(cell) and isinstance(cell, str):
                if ('班' in cell or '岗' in cell or '节假日' in cell) and cell not in shift_types:
                    shift_types.append(cell)
    
    print(f"识别到的业务线/部门: {business_lines}")
    print(f"识别到的班次类型: {shift_types}")
    
    # 分析排班表
    print("\n===== 深入分析 '排班表' 工作表 =====")
    # 读取排班表，先查看原始结构
    schedule_df = pd.read_excel(file_path, sheet_name='排班表', header=None)
    
    print(f"排班表行数: {len(schedule_df)}, 列数: {len(schedule_df.columns)}")
    
    # 显示排班表前3行，通常包含表头和说明
    print("\n排班表前3行（表头和说明）:")
    for i in range(min(3, len(schedule_df))):
        row_data = schedule_df.iloc[i].tolist()
        # 过滤掉全NaN的列
        filtered_row = [x for x in row_data if pd.notna(x)]
        if filtered_row:
            print(f"行{i+1}: {filtered_row}")
    
    # 从第2行提取班次时间信息
    if len(schedule_df) > 1:
        second_row = schedule_df.iloc[1].tolist()
        shift_info = [x for x in second_row if pd.notna(x) and isinstance(x, str) and '班次' in x]
        if shift_info:
            print("\n班次时间信息:")
            print(shift_info[0])
    
    # 重新读取排班表，将第3行作为表头
    if len(schedule_df) > 2:
        schedule_df_with_header = pd.read_excel(file_path, sheet_name='排班表', header=2)
        
        print("\n排班表字段信息（使用第3行作为表头）:")
        print(f"字段列表: {list(schedule_df_with_header.columns)}")
        
        # 识别员工信息字段
        emp_info_fields = []
        date_fields = []
        
        for col in schedule_df_with_header.columns:
            if isinstance(col, str):
                if '部门' in col or '用户ID' in col or '工号' in col or '姓名' in col:
                    emp_info_fields.append(col)
                elif ('/' in col and len(col) > 5) or ('日' in col and len(col) > 2):
                    date_fields.append(col)
        
        print(f"识别到的员工信息字段: {emp_info_fields}")
        print(f"识别到的日期字段数量: {len(date_fields)}")
        if date_fields:
            print(f"部分日期字段示例: {date_fields[:5]}")
        
        # 分析员工排班数据
        print("\n员工排班数据分析:")
        print(f"员工总数: {len(schedule_df_with_header)}")
        
        # 显示前5名员工的排班数据示例
        print("\n前5名员工的排班数据示例:")
        if len(schedule_df_with_header) > 0:
            # 选择员工信息字段和前5个日期字段
            display_cols = emp_info_fields + date_fields[:5]
            print(schedule_df_with_header[display_cols].head())
        
        # 统计班次代码分布
        print("\n班次代码分布统计:")
        shift_counts = {}
        
        # 遍历所有日期字段
        for col in date_fields:
            if col in schedule_df_with_header.columns:
                # 获取该字段中的所有非空值
                shifts = schedule_df_with_header[col].dropna()
                # 统计每个班次代码的出现次数
                for shift in shifts:
                    if isinstance(shift, str):
                        if shift in shift_counts:
                            shift_counts[shift] += 1
                        else:
                            shift_counts[shift] = 1
        
        # 按出现次数排序并显示
        if shift_counts:
            sorted_shifts = sorted(shift_counts.items(), key=lambda x: x[1], reverse=True)
            for shift, count in sorted_shifts:
                print(f"{shift}: {count}次")
        else:
            print("未识别到班次代码")
        
        # 分析不同部门的排班情况
        if '部门' in schedule_df_with_header.columns:
            departments = schedule_df_with_header['部门'].unique()
            print(f"\n涉及部门: {departments}")
    
    print("\n===== 综合分析结果 =====")
    
except Exception as e:
    print(f"分析Excel文件时出错: {e}")
    sys.exit(1)