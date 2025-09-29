/**
 * 排班计划管理模块
 * 负责处理排班计划的生成、查看、导出等功能
 */
class ScheduleManager {
    constructor() {
        this.dbManager = window.dbManager;
        this.shiftOrderManager = window.shiftOrderManager;
        this.shiftManager = window.shiftManager;
        
        // 初始化排班算法实例
        this.schedulingAlgorithm = new SchedulingAlgorithm();
        
        // 初始化存储
        this.initializeStore();
        
        // 当前选中的筛选条件
        this.currentFilters = {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            organization: '',
            department: '',
            position: ''
        };
        
        // 添加班次状态变更监听器，实现排班计划与班次管理的联动
        window.addEventListener('shiftStatusChanged', this.handleShiftStatusChange.bind(this));
        
        // 添加班次数据变更的监听
        this.initDataChangeListeners();
    }
    
    // 初始化数据变更监听器
    initDataChangeListeners() {
        // 监听班次数据变更事件
        window.addEventListener('scheduleDataNeedRefresh', (event) => {
            console.log('收到排班数据刷新通知，原因:', event.detail.reason);
            // 清空班次数据缓存，确保下次加载时使用最新数据
            if (window.shiftDataCache) {
                window.shiftDataCache = null;
            }
            
            // 通知其他模块重新加载数据
            console.log('排班管理模块已处理数据刷新请求');
        });
    }
    
    // 处理班次状态变更
    async handleShiftStatusChange(event) {
        var shiftCode = event.detail.shiftCode;
        var status = event.detail.status;

        try {
            // 获取所有排班计划
            var allSchedules = await this.getAllSchedulePlans();

            // 检查每个排班计划是否包含该班次
            var schedulesToUpdate = allSchedules.filter(function(schedule) {
                // 检查排班计划的数据中是否包含该班次
                if (schedule.scheduleData) {
                    for (var empNumber in schedule.scheduleData) {
                        var employeeSchedule = schedule.scheduleData[empNumber];
                        if (employeeSchedule && employeeSchedule.schedule) {
                            if (employeeSchedule.schedule.some(function(day) { return day.shiftCode === shiftCode; })) {
                                return true;
                            }
                        }
                    }
                }
                return false;
            });

            // 如果班次被停用，更新相关的排班计划
            if (status === 1) {
                for (var i = 0; i < schedulesToUpdate.length; i++) {
                    var schedule = schedulesToUpdate[i];
                    // 获取所有启用的班次
                    var allShifts = await window.shiftManager.getAllShifts();
                    var activeShifts = allShifts.filter(function(s) { return s.status === 0; }).map(function(s) { return s.code; });

                    // 如果排班计划中使用了被停用的班次，重新生成排班计划
                    console.log('班次 ' + shiftCode + ' 已被停用，正在更新排班计划: ' + schedule.year + '年' + schedule.month + '月 - ' + schedule.department + ' ' + schedule.position);

                    try {
                        // 重新生成排班计划
                        await this.generateSchedule(
                            schedule.year,
                            schedule.month,
                            schedule.organization,
                            schedule.department,
                            schedule.position
                        );
                    } catch (error) {
                        console.error('更新排班计划失败: ' + error.message);
                    }
                }
            }

            console.log('班次状态变更处理完成，共更新了 ' + schedulesToUpdate.length + ' 个排班计划');
        } catch (error) {
            console.error('处理班次状态变更失败:', error);
        }
    }
    
    // 初始化排班计划存储空间
    async initializeStore() {
        try {
            await this.dbManager.ensureInitialized();
            
            // 检查是否已存在schedulePlans存储空间
            const exists = await this.dbManager.checkObjectStoreExists('schedulePlans');
            if (!exists) {
                // 请求数据库升级以创建存储空间
                await this.dbManager.createObjectStore('schedulePlans', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                
                // 创建索引以支持快速查询
                await this.dbManager.createIndex('schedulePlans', 'year', { unique: false });
                await this.dbManager.createIndex('schedulePlans', 'month', { unique: false });
                await this.dbManager.createIndex('schedulePlans', 'organization', { unique: false });
                await this.dbManager.createIndex('schedulePlans', 'department', { unique: false });
                await this.dbManager.createIndex('schedulePlans', 'createdAt', { unique: false });
            }
        } catch (error) {
            console.error('初始化排班计划存储空间失败:', error);
        }
    }
    
    // 生成排班计划
    async generateSchedule(year, month, organization = '', department = '', position = '') {
        try {
            console.log(`开始生成${year}年${month}月的排班计划，筛选条件：机构=${organization}, 部门=${department}, 岗位=${position}`);
            
            // 获取筛选后的员工列表
            const filteredEmployees = await this.getFilteredEmployees(organization, department, position);
            if (filteredEmployees.length === 0) {
                console.log('没有找到匹配的员工');
                return null;
            }

            // 获取筛选后的排班顺序
            const shiftOrders = await this.getFilteredShiftOrders(organization, department, position);
            if (shiftOrders.length === 0) {
                console.log('没有找到匹配的排班顺序');
                return null;
            }

            // 获取班次数据 - 优化版
            let activeShifts = [];
            try {
                // 详细检查shiftManager状态
                if (!window.shiftManager) {
                    console.warn('警告: window.shiftManager 全局实例不存在');
                    // 尝试动态创建一个临时实例
                    if (window.ShiftManager) {
                        console.log('尝试创建临时ShiftManager实例');
                        const tempShiftManager = new ShiftManager();
                        if (typeof tempShiftManager.getActiveShifts === 'function') {
                            const activeShiftsData = await tempShiftManager.getActiveShifts();
                            activeShifts = activeShiftsData.map(shift => shift.code);
                            console.log('从临时ShiftManager实例获取的启用班次:', activeShifts);
                        }
                    } else {
                        console.warn('ShiftManager类也不存在，无法获取班次数据');
                    }
                } else if (typeof window.shiftManager.getActiveShifts !== 'function') {
                    console.warn('警告: window.shiftManager实例存在，但getActiveShifts方法不存在');
                    // 打印shiftManager对象结构，帮助调试
                    console.log('shiftManager对象结构:', Object.keys(window.shiftManager));
                    // 如果没有getActiveShifts，尝试使用getAllShifts作为备选
                    if (typeof window.shiftManager.getAllShifts === 'function') {
                        const allShifts = await window.shiftManager.getAllShifts();
                        // 注意：在这个系统中status=0表示启用
                        activeShifts = allShifts
                            .filter(shift => shift.status === 0)
                            .map(shift => shift.code);
                        console.log('从shiftManager获取的启用班次数量(备选方法):', activeShifts.length);
                    }
                } else {
                    // 正常获取班次 - 使用专门的getActiveShifts方法
                    const activeShiftsData = await window.shiftManager.getActiveShifts();
                    activeShifts = activeShiftsData.map(shift => shift.code);
                    console.log('从shiftManager获取的启用班次数量:', activeShifts.length);
                }
            } catch (error) {
                console.error('获取班次数据时发生错误:', error);
                // 打印错误堆栈，便于调试
                if (error.stack) {
                    console.error('错误堆栈:', error.stack);
                }
                activeShifts = [];
            }
            
            // 确保班次数据不为空
            if (activeShifts.length === 0) {
                console.warn('警告: 未获取到任何启用的班次数据');
            }
            
            // 直接使用activeShifts，包含所有需要的班次（包括'休'班）
            const filteredActiveShifts = activeShifts;
            
            console.log('所有启用班次:', activeShifts);
            console.log('保留所有启用班次(包括休班次):', filteredActiveShifts);

            // 生成日历数据
            const calendarData = this.generateCalendarData(year, month);

            // 获取上个月的排班计划
            const lastMonthSchedule = await this.getLastMonthSchedule(year, month, organization, department, position);

            // 应用排班算法（使用await等待异步结果）
            const scheduleResult = await this.schedulingAlgorithm.applyGeneralSchedulingAlgorithm(
                filteredEmployees,
                filteredActiveShifts,
                calendarData,
                lastMonthSchedule,
                organization,
                department,
                position
            );

            // 创建排班计划对象
            const schedulePlan = {
                year: year,
                month: month,
                organization: organization,
                department: department === '全部部门' ? '全部部门' : department,
                position: position === '全部岗位' ? '全部岗位' : position,
                scheduleData: scheduleResult,
                createTime: new Date().getTime()
            };

            // 彻底删除相同年月的所有排班计划，确保重新生成时不会有冲突
            const existingSchedules = await this.dbManager.getAll('schedulePlans');
            
            // 筛选出相同年月的所有排班计划
            const schedulesToDelete = existingSchedules.filter(s => 
                s.year === year && s.month === month
            );
            
            if (schedulesToDelete.length > 0) {
                console.log(`已存在${schedulesToDelete.length}个${year}年${month}月的排班计划，正在删除所有旧数据...`);
                
                // 批量删除所有匹配的排班计划
                const deletePromises = schedulesToDelete.map(schedule => 
                    this.dbManager.delete('schedulePlans', schedule.id)
                );
                
                // 等待所有删除操作完成
                await Promise.all(deletePromises);
                console.log('所有旧的排班计划已成功删除');
            }

            // 保存新的排班计划
            const savedSchedule = await this.saveSchedule(schedulePlan);
            console.log('排班计划已保存:', savedSchedule);

            // 清除班次数据缓存，确保下次加载时使用最新数据
            if (window.shiftDataCache) {
                window.shiftDataCache = null;
                console.log('已清除班次数据缓存');
            }
            
            // 通知其他模块数据已更新
            const event = new CustomEvent('scheduleDataNeedRefresh', {
                detail: {
                    reason: 'scheduleGenerated',
                    year: year,
                    month: month,
                    organization: organization,
                    department: department,
                    position: position
                }
            });
            window.dispatchEvent(event);
            console.log('已触发排班数据刷新事件');

            return savedSchedule;
        } catch (error) {
            console.error('生成排班计划失败:', error);
            if (error.stack) {
                console.error('错误堆栈:', error.stack);
            }
            throw error;
        }
    }
    
    // 获取筛选条件下的员工
    async getFilteredEmployees(organization, department, position) {
        try {
            let employees = await this.dbManager.getAll('employees');
            
            // 筛选在职员工
            // 注意：员工status可能是数字类型(0表示在职)或字符串类型
            employees = employees.filter(function(emp) {
                // 处理数字类型的status
                if (typeof emp.status === 'number') {
                    return emp.status === 0;
                }
                // 处理字符串类型的status
                var statusStr = String(emp.status).toLowerCase().trim();
                return statusStr === 'active' || statusStr === '0';
            });
            
            // 按机构筛选 - 注意员工数据中存储的是orgName而不是organizationId
            if (organization && organization !== '全部机构') {
                employees = employees.filter(function(emp) {
                    return emp.orgName && emp.orgName.toLowerCase().trim() === organization.toLowerCase().trim();
                });
            }
            
            // 按部门筛选
            // 注意：员工数据中存储部门信息的字段是deptName而不是department
            if (department && department !== '全部部门') {
                employees = employees.filter(function(emp) {
                    return emp.deptName && emp.deptName.toLowerCase().trim() === department.toLowerCase().trim();
                });
            }
            
            // 按岗位筛选
            if (position && position !== '全部岗位') {
                employees = employees.filter(function(emp) {
                    return emp.position && emp.position.toLowerCase().trim() === position.toLowerCase().trim();
                });
            }
            
            return employees;
        } catch (error) {
            console.error('获取筛选员工失败:', error);
            return [];
        }
    }
    
    // 获取筛选条件下的排班顺序
    async getFilteredShiftOrders(organization, department, position) {
        try {
            let shiftOrders = await this.dbManager.getAll('shiftOrders');
            let filteredOrders = shiftOrders;
            
            // 按部门筛选
            // 注意：shiftOrders数据结构中的部门信息存储在departmentOrders数组中
            if (department && department !== '全部部门') {
                filteredOrders = filteredOrders.filter(function(order) {
                    return order.departmentOrders && order.departmentOrders.some(function(deptOrder) {
                        return deptOrder.department && deptOrder.department.toLowerCase().trim() === department.toLowerCase().trim();
                    });
                });
            }
            
            // 按岗位筛选
            if (position && position !== '全部岗位') {
                filteredOrders = filteredOrders.filter(function(order) {
                    return order.position && order.position.toLowerCase().trim() === position.toLowerCase().trim();
                });
            }
            
            return filteredOrders;
        } catch (error) {
            console.error('获取排班顺序失败:', error);
            return [];
        }
    }
    
    // 获取上个月的排班计划
    async getLastMonthSchedule(year, month, organization, department, position) {
        try {
            let lastMonth = month - 1;
            let lastYear = year;
            
            if (lastMonth < 1) {
                lastMonth = 12;
                lastYear = year - 1;
            }
            
            // 查询上个月的排班计划
            let schedules;
            try {
                schedules = await this.dbManager.getAll('schedulePlans');
            } catch (dbError) {
                // 如果是存储空间不存在的错误，尝试初始化存储空间
                if (dbError.name === 'NotFoundError' || dbError.message.includes('object stores was not found')) {
                    console.log('检测到schedulePlans存储空间不存在，尝试初始化...');
                    await this.initializeStore();
                    // 再次尝试获取数据
                    schedules = await this.dbManager.getAll('schedulePlans');
                } else {
                    throw dbError;
                }
            }
            
            // 筛选匹配的计划
            const matchingSchedule = schedules.find(function(schedule) {
                return schedule.year === lastYear &&
                       schedule.month === lastMonth &&
                       schedule.organization === organization &&
                       schedule.department === department &&
                       schedule.position === position;
            });
            
            return matchingSchedule || null;
        } catch (error) {
            console.error('获取上个月排班计划失败:', error);
            return null;
        }
    }
    
    // 生成日历数据
    generateCalendarData(year, month) {
        var firstDay = new Date(year, month - 1, 1);
        var lastDay = new Date(year, month, 0);
        var daysInMonth = lastDay.getDate();
        var startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

        var calendarData = [];

        // 添加上个月的日期（用于填充第一行）
        for (var i = 0; i < startingDayOfWeek; i++) {
            var prevMonthDate = new Date(year, month - 1, -startingDayOfWeek + i + 1);
            calendarData.push({
                date: prevMonthDate,
                day: prevMonthDate.getDate(),
                dayOfWeek: prevMonthDate.getDay(), // 0 = 星期日, 1 = 星期一, ..., 6 = 星期六
                isCurrentMonth: false,
                isWeekend: prevMonthDate.getDay() === 0 || prevMonthDate.getDay() === 6
            });
        }

        // 添加当前月的日期
        for (var day = 1; day <= daysInMonth; day++) {
            var date = new Date(year, month - 1, day);
            calendarData.push({
                date: date,
                day: day,
                dayOfWeek: date.getDay(), // 0 = 星期日, 1 = 星期一, ..., 6 = 星期六
                isCurrentMonth: true,
                isWeekend: date.getDay() === 0 || date.getDay() === 6
            });
        }

        return calendarData;
    }
    
    // 保存排班计划
    async saveSchedule(scheduleData) {
        try {
            // 确保scheduleData对象包含必要的字段
            const scheduleToSave = {
                ...scheduleData,
                createdAt: new Date().getTime(),
                updatedAt: new Date().getTime()
            };
            
            // 保存到数据库
            const result = await this.dbManager.save('schedulePlans', scheduleToSave);
            console.log('排班计划保存成功，ID:', result);
            
            return result;
        } catch (error) {
            console.error('保存排班计划失败:', error);
            throw error;
        }
    }
    
    // 获取指定的排班计划
    async getSchedule(scheduleId) {
        try {
            const schedule = await this.dbManager.getById('schedulePlans', scheduleId);
            return schedule;
        } catch (error) {
            console.error('获取排班计划失败:', error);
            return null;
        }
    }
    
    // 获取所有排班计划
    async getAllSchedulePlans(filters = {}) {
        try {
            let allSchedules = await this.dbManager.getAll('schedulePlans');
            
            // 应用筛选条件
            if (filters.year) {
                allSchedules = allSchedules.filter(s => s.year === filters.year);
            }
            if (filters.month) {
                allSchedules = allSchedules.filter(s => s.month === filters.month);
            }
            if (filters.organization) {
                allSchedules = allSchedules.filter(s => s.organization === filters.organization);
            }
            if (filters.department) {
                allSchedules = allSchedules.filter(s => s.department === filters.department);
            }
            if (filters.position) {
                allSchedules = allSchedules.filter(s => s.position === filters.position);
            }
            
            // 按创建时间降序排序
            allSchedules.sort((a, b) => {
                // 先按年份排序
                if (a.year !== b.year) {
                    return b.year - a.year;
                }
                // 再按月份排序
                if (a.month !== b.month) {
                    return b.month - a.month;
                }
                // 最后按创建时间排序
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
            
            return allSchedules;
        } catch (error) {
            console.error('获取所有排班计划失败:', error);
            return [];
        }
    }
    
    // 删除排班计划
    async deleteSchedule(scheduleId) {
        try {
            await this.dbManager.delete('schedulePlans', scheduleId);
            console.log('排班计划已删除，ID:', scheduleId);
            
            // 触发数据刷新事件
            const event = new CustomEvent('scheduleDataNeedRefresh', {
                detail: {
                    reason: 'scheduleDeleted',
                    scheduleId: scheduleId
                }
            });
            window.dispatchEvent(event);
            
            return true;
        } catch (error) {
            console.error('删除排班计划失败:', error);
            throw error;
        }
    }
    
    // 根据年份和月份导出排班表
    async exportSchedule(year, month) {
        try {
            console.log(`开始导出${year}年${month}月的排班表`);
            
            // 获取当月所有排班计划
            const schedules = await this.getAllSchedulePlans({ year, month });
            
            if (schedules.length === 0) {
                console.error(`未找到${year}年${month}月的排班计划`);
                throw new Error(`未找到${year}年${month}月的排班计划`);
            }
            
            // 如果当月有多个排班计划，选择最新的一个
            const latestSchedule = schedules[0];
            
            // 调用现有的导出方法
            return await this.exportScheduleToExcel(latestSchedule.id);
        } catch (error) {
            console.error('导出排班表失败:', error);
            throw error;
        }
    }
    
    // 导出排班计划为Excel
    async exportScheduleToExcel(scheduleId) {
        try {
            // 获取排班计划数据
            const schedule = await this.getSchedule(scheduleId);
            if (!schedule || !schedule.scheduleData) {
                console.error('无法获取排班计划数据');
                return null;
            }
            
            // 准备导出数据
            const exportData = [];
            
            // 构建表头
            const header = ['员工工号', '员工姓名', '部门', '岗位'];
            
            // 获取当月天数，构建日期列
            const year = schedule.year;
            const month = schedule.month;
            const daysInMonth = new Date(year, month, 0).getDate();
            
            for (let day = 1; day <= daysInMonth; day++) {
                header.push(`${day}日`);
            }
            
            exportData.push(header);
            
            // 遍历每个员工的排班数据
            for (const empNumber in schedule.scheduleData) {
                const empSchedule = schedule.scheduleData[empNumber];
                
                // 创建员工数据行
                const row = [
                    empSchedule.employeeNumber,
                    empSchedule.employeeName,
                    empSchedule.department,
                    empSchedule.position
                ];
                
                // 填充每日排班数据
                const scheduleMap = new Map();
                empSchedule.schedule.forEach(daySchedule => {
                    const date = new Date(daySchedule.date);
                    if (date.getMonth() + 1 === month && date.getFullYear() === year) {
                        scheduleMap.set(date.getDate(), daySchedule.shiftCode);
                    }
                });
                
                // 按日期顺序填充数据
                for (let day = 1; day <= daysInMonth; day++) {
                    row.push(scheduleMap.get(day) || '');
                }
                
                exportData.push(row);
            }
            
            // 这里应该调用Excel导出工具
            // 由于没有具体的Excel导出实现，我们返回准备好的数据
            console.log('排班数据已准备好导出:', exportData);
            
            return exportData;
        } catch (error) {
            console.error('导出排班计划失败:', error);
            return null;
        }
    }
    
    // 获取指定月份的排班数据
    async getScheduleByMonth(year, month) {
        try {
            console.log(`获取${year}年${month}月的排班数据`);
            
            // 规范化员工号的函数，与schedule-planning.js中的处理保持一致
            const normalizeId = (id) => {
                if (id === null || id === undefined) return '';
                return String(id).toLowerCase().trim();
            };
            
            // 使用现有的getAllSchedulePlans方法获取数据
            const schedules = await this.getAllSchedulePlans({ year, month });
            
            // 创建一个以员工号为键的对象，整合所有排班数据
            const result = {};
            
            // 遍历所有排班计划
            schedules.forEach(schedule => {
                if (schedule.scheduleData) {
                    // 合并不同部门/岗位的排班数据
                    for (const empNumber in schedule.scheduleData) {
                        // 使用规范化后的员工号作为键
                        const normalizedEmpNumber = normalizeId(empNumber);
                        result[normalizedEmpNumber] = schedule.scheduleData[empNumber];
                    }
                }
            });
            
            return result;
        } catch (error) {
            console.error('获取排班数据失败:', error);
            return {};
        }
    }
    
    // 获取历史排班记录
    async getHistoryRecords(filters = {}) {
        try {
            // 获取所有排班计划
            let allSchedules = await this.getAllSchedulePlans(filters);
            
            // 初始化数据库连接（如果需要）
            if (!this.dbManager || !this.dbManager.initialized) {
                await this.dbManager.ensureInitialized();
            }
            
            // 处理历史记录数据
            const historyRecords = [];
            
            allSchedules.forEach(schedule => {
                // 格式化排班数据为历史记录格式
                const record = {
                    id: schedule.id,
                    year: schedule.year,
                    month: schedule.month,
                    organization: schedule.organization,
                    department: schedule.department,
                    position: schedule.position,
                    createTime: schedule.createTime,
                    totalEmployeeCount: schedule.scheduleData ? Object.keys(schedule.scheduleData).length : 0
                };
                
                historyRecords.push(record);
            });
            
            // 按创建时间降序排序
            historyRecords.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
            
            return historyRecords;
        } catch (error) {
            console.error('获取历史排班记录失败:', error);
            return [];
        }
    }
    
    // 获取指定日期范围的连续日期
    getConsecutiveDatesFromIndex(calendarData, startIndex, count) {
        const consecutiveDates = [];
        
        for (let i = 0; i < count; i++) {
            const currentIndex = startIndex + i;
            
            // 检查是否超出数组范围或不是当月日期
            if (currentIndex >= calendarData.length || !calendarData[currentIndex].isCurrentMonth) {
                break; // 月底时停止
            }
            
            consecutiveDates.push(calendarData[currentIndex]);
        }
        
        return consecutiveDates;
    }
    

}

// 初始化排班管理模块
window.scheduleManager = new ScheduleManager();