import pandas as pd
import sys

# 指定Excel文件路径
file_path = '/Users/luanxiaowei/Documents/项目开发/智能排班表2/排班表新3.xlsx'

try:
    # 获取Excel文件中的所有工作表名称
    excel_file = pd.ExcelFile(file_path)
    sheet_names = excel_file.sheet_names
    
    print(f"Excel文件包含的工作表: {sheet_names}")
    
    # 遍历每个工作表，分析内容
    for sheet_name in sheet_names:
        print(f"\n===== 分析工作表 '{sheet_name}' =====")
        
        # 读取工作表数据
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        # 打印工作表的基本信息
        print(f"行数: {len(df)}, 列数: {len(df.columns)}")
        
        # 打印表头信息
        print(f"表头: {list(df.columns)}")
        
        # 如果是排班表或规则表，尝试识别其结构
        if '排班' in sheet_name or '规则' in sheet_name or 'shift' in sheet_name.lower() or 'rule' in sheet_name.lower():
            print("\n前5行数据预览:")
            print(df.head())
            
            # 尝试识别排班表的关键列
            if '员工号' in df.columns or '姓名' in df.columns or '部门' in df.columns:
                print("\n这似乎是一个排班表，包含员工信息和排班数据")
                
                # 找出可能的日期列
                date_columns = []
                for col in df.columns:
                    if isinstance(col, str) and ('日' in col or '号' in col or '/' in col):
                        date_columns.append(col)
                
                if date_columns:
                    print(f"识别到的日期列: {date_columns[:5]}...")
                    print(f"总日期列数: {len(date_columns)}")
            
            # 尝试识别规则表的结构
            elif '规则' in sheet_name or 'rule' in sheet_name.lower():
                print("\n这似乎是一个排班规则表")
                # 显示所有非空行
                non_empty_rows = df.dropna(how='all')
                if len(non_empty_rows) > 0:
                    print("规则内容预览:")
                    print(non_empty_rows)
        
        # 统计数据类型和唯一值等信息
        print("\n数据类型统计:")
        print(df.dtypes)
        
        # 检查是否包含班次代码（如G、Y、休等）
        shift_codes = set()
        for col in df.columns:
            if df[col].dtype == 'object':
                unique_vals = df[col].dropna().unique()
                for val in unique_vals:
                    if isinstance(val, str) and (val.startswith('G') or val.startswith('Y') or val == '休' or val == '休息'):
                        shift_codes.add(val)
        
        if shift_codes:
            print(f"\n识别到的班次代码: {shift_codes}")
        
        # 检查是否有数值列（可能是排班次数统计）
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            print(f"\n数值列（可能包含统计数据）: {list(numeric_cols)}")
            # 显示数值列的基本统计
            print(df[numeric_cols].describe())
            
    print("\n===== 分析完成 =====")
    
except Exception as e:
    print(f"分析Excel文件时出错: {e}")
    sys.exit(1)