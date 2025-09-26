import pandas as pd
import sys
import re
from datetime import datetime

# 读取 Excel 文件
try:
    # 读取所有页签
    excel_file = pd.ExcelFile('/Users/luanxiaowei/Documents/项目开发/智能排班表2/排班表新3.xlsx')
    
    # 打印所有页签名称
    print("Excel文件中的所有页签:")
    for sheet_name in excel_file.sheet_names:
        print(f"- {sheet_name}")
    
    # 直接选择'排班表'页签进行分析
    if '排班表' in excel_file.sheet_names:
        sheet_name = '排班表'
        print(f"\n分析页签: '{sheet_name}'")
    else:
        print("未找到'排班表'页签")
        sys.exit(1)
    
    # 读取整个工作表，不设置表头，稍后手动处理
    df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
    
    print("\n表格前10行数据预览:")
    print(df.head(10))
    
    # 尝试识别表头行 - 寻找包含班次信息的行
    schedule_info_row = -1
    for i, row in df.iterrows():
        for cell in row.values:
            if isinstance(cell, str) and ('班次' in cell or 'G值' in cell):
                schedule_info_row = i
                break
        if schedule_info_row != -1:
            break
    
    if schedule_info_row != -1:
        print(f"\n找到班次信息行: 第{schedule_info_row+1}行")
        print(f"班次信息: {df.iloc[schedule_info_row, 0]}")
        
        # 提取班次信息
        schedule_info = str(df.iloc[schedule_info_row, 0])
        shift_pattern = r'班次(\w+):\s*(\d{1,2}:\d{2}-\d{1,2}:\d{2}|\d{1,2}:\d{2}-次日\d{1,2}:\d{2})'
        shifts = re.findall(shift_pattern, schedule_info)
        
        print("\n识别到的班次类型:")
        for i, (shift_code, time) in enumerate(shifts, 1):
            print(f"{i}. {shift_code}: {time}")
        
        # 尝试寻找员工信息表头行（通常在班次信息行下方）
        employee_header_row = -1
        for i in range(schedule_info_row + 1, min(schedule_info_row + 10, len(df))):
            row = df.iloc[i]
            # 寻找包含'部门'、'工号'、'姓名'等关键词的行
            has_dept = any('部门' in str(cell) for cell in row.values)
            has_id = any('工号' in str(cell) or 'ID' in str(cell) for cell in row.values)
            has_name = any('姓名' in str(cell) for cell in row.values)
            
            if has_dept and (has_id or has_name):
                employee_header_row = i
                break
        
        if employee_header_row != -1:
            print(f"\n找到员工信息表头行: 第{employee_header_row+1}行")
            
            # 设置表头并重读数据
            df_clean = pd.read_excel(excel_file, sheet_name=sheet_name, header=employee_header_row)
            
            # 清理列名
            df_clean.columns = [str(col).strip().replace('\n', '') for col in df_clean.columns]
            
            print("\n清理后的列名:")
            for i, col in enumerate(df_clean.columns, 1):
                print(f"{i}. {col}")
            
            # 识别日期列
            date_cols = []
            for col in df_clean.columns:
                if any(keyword in col for keyword in ['2025', '月', '日', '周一', '周二', '周三', '周四', '周五', '周六', '周日']):
                    date_cols.append(col)
            
            print(f"\n识别到的日期列数量: {len(date_cols)}")
            if date_cols:
                print(f"前5个日期列: {date_cols[:5]}")
            
            # 分析排班数据
            if date_cols and len(df_clean) > 0:
                print("\n排班数据分析:")
                
                # 统计员工数量
                emp_count = 0
                for _, row in df_clean.iterrows():
                    # 跳过空行和表头
                    if any('部门' in str(cell) or pd.isna(cell) for cell in row[:3].values):
                        continue
                    emp_count += 1
                
                print(f"估计员工数量: {emp_count}")
                
                # 分析G值班次
                print("\nG值班次分析:")
                g_shifts_count = 0
                total_shift_count = 0
                
                # 识别周末和工作日列
                weekend_cols = [col for col in date_cols if any(day in col for day in ['周六', '周日'])]
                weekday_cols = [col for col in date_cols if col not in weekend_cols]
                
                print(f"周末列数量: {len(weekend_cols)}")
                print(f"工作日列数量: {len(weekday_cols)}")
                
                # 统计G值班次在周末和工作日的分布
                g_on_weekend = 0
                g_on_weekday = 0
                
                for _, row in df_clean.iterrows():
                    # 跳过空行和表头
                    if any('部门' in str(cell) or pd.isna(cell) for cell in row[:3].values):
                        continue
                    
                    # 统计周末G值
                    for col in weekend_cols:
                        if col in df_clean.columns:
                            shift = str(row.get(col, '')).strip()
                            if shift and 'G' in shift:
                                g_on_weekend += 1
                                total_shift_count += 1
                            elif shift:
                                total_shift_count += 1
                    
                    # 统计工作日G值
                    for col in weekday_cols:
                        if col in df_clean.columns:
                            shift = str(row.get(col, '')).strip()
                            if shift and 'G' in shift:
                                g_on_weekday += 1
                                total_shift_count += 1
                            elif shift:
                                total_shift_count += 1
                
                print(f"G值班次在周末安排次数: {g_on_weekend}")
                print(f"G值班次在工作日安排次数: {g_on_weekday}")
                print(f"G值班次总数: {g_on_weekend + g_on_weekday}")
                
                # 分析连值规则
                print("\n连值规则详细分析:")
                
                # 准备存储每位员工的排班记录
                employee_schedules = []
                
                for idx, row in df_clean.iterrows():
                    # 跳过空行和表头
                    if any('部门' in str(cell) or pd.isna(cell) for cell in row[:3].values):
                        continue
                    
                    # 获取员工基本信息
                    dept = str(row.get('部门', '')).strip()
                    emp_id = str(row.get('工号', '')).strip()
                    emp_name = str(row.get('姓名', '')).strip()
                    
                    if not emp_id or not emp_name:
                        continue
                    
                    # 存储该员工的排班记录
                    emp_schedule = []
                    for col in date_cols:
                        if col in df_clean.columns:
                            shift = str(row.get(col, '')).strip()
                            # 提取日期信息（从列名中）
                            date_info = col.split('周')[0].strip()
                            # 提取星期几信息
                            weekday = ''.join([c for c in col if c in '一二三四五六日'])
                            
                            emp_schedule.append({
                                'date': date_info,
                                'weekday': weekday,
                                'shift': shift,
                                'is_weekend': weekday in ['六', '日']
                            })
                    
                    employee_schedules.append({
                        'dept': dept,
                        'id': emp_id,
                        'name': emp_name,
                        'schedule': emp_schedule
                    })
                
                # 分析连值情况
                consecutive_records = []
                
                for emp in employee_schedules:
                    # 跟踪连续相同班次的天数
                    current_shift = None
                    current_count = 0
                    max_consecutive = 0
                    max_shift = None
                    
                    for day in emp['schedule']:
                        shift = day['shift']
                        
                        if shift == current_shift and shift != '':
                            current_count += 1
                            if current_count > max_consecutive:
                                max_consecutive = current_count
                                max_shift = shift
                        else:
                            current_shift = shift
                            current_count = 1 if shift != '' else 0
                    
                    if max_consecutive > 1:
                        consecutive_records.append({
                            'name': emp['name'],
                            'id': emp['id'],
                            'dept': emp['dept'],
                            'shift': max_shift,
                            'days': max_consecutive
                        })
                
                # 按连值天数排序
                consecutive_records.sort(key=lambda x: x['days'], reverse=True)
                
                print(f"\n检测到的连值记录数: {len(consecutive_records)}")
                print("连值天数最多的前10个记录:")
                
                # 显示前10个记录
                for i, record in enumerate(consecutive_records[:10], 1):
                    print(f"{i}. 员工{record['name']}({record['id']}) - {record['dept']} - 班次{record['shift']}: 连续{record['days']}天")
                
                # 分析G值班次的连续情况
                g_consecutive_records = [r for r in consecutive_records if 'G' in r['shift']]
                print(f"\nG值班次连值记录数: {len(g_consecutive_records)}")
                if g_consecutive_records:
                    g_consecutive_records.sort(key=lambda x: x['days'], reverse=True)
                    print("G值班次连值天数最多的前5个记录:")
                    for i, record in enumerate(g_consecutive_records[:5], 1):
                        print(f"{i}. 员工{record['name']}({record['id']}) - 班次{record['shift']}: 连续{record['days']}天")
                
                # 分析G值班次周末安排规则
                print("\nG值班次周末安排规则分析:")
                
                # 统计每个部门的G值班次周末安排情况
                dept_g_weekend_stats = {}
                for emp in employee_schedules:
                    dept = emp['dept']
                    g_weekend_count = 0
                    
                    for day in emp['schedule']:
                        if day['is_weekend'] and 'G' in day['shift']:
                            g_weekend_count += 1
                    
                    if dept not in dept_g_weekend_stats:
                        dept_g_weekend_stats[dept] = {'total': 0, 'employees': []}
                    
                    if g_weekend_count > 0:
                        dept_g_weekend_stats[dept]['total'] += g_weekend_count
                        dept_g_weekend_stats[dept]['employees'].append({
                            'name': emp['name'],
                            'count': g_weekend_count
                        })
                
                # 按部门显示G值班次周末安排情况
                print("G值班次周末安排按部门统计:")
                for dept, stats in dept_g_weekend_stats.items():
                    if stats['total'] > 0:
                        print(f"- {dept}: 共安排{stats['total']}次")
                        # 显示该部门安排周末G值最多的3位员工
                        stats['employees'].sort(key=lambda x: x['count'], reverse=True)
                        for emp in stats['employees'][:3]:
                            print(f"  * {emp['name']}: {emp['count']}次")
                
            else:
                print("未找到有效的日期列或数据行")
            
        else:
            print("未找到员工信息表头行")
    else:
        print("未找到包含班次信息的行")
        
except Exception as e:
    print(f"读取Excel文件时发生错误: {e}")
    print(f"错误类型: {type(e).__name__}")
    sys.exit(1)