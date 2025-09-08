/**
 * 排班计划管理模块
 * 负责处理排班计划的生成、查看、导出等功能
 */
class ScheduleManager {
    constructor() {
        this.dbManager = window.dbManager;
        this.shiftOrderManager = window.shiftOrderManager;
        this.shiftManager = window.shiftManager;
        
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
    async generateSchedule(month, year, organization = '', department = '', position = '') {
        try {
            console.log(`开始生成排班计划: ${year}年${month}月, 机构: ${organization}, 部门: ${department}, 岗位: ${position}`);
            
            // 1. 获取筛选条件下的所有员工
            let employees = await this.getFilteredEmployees(organization, department, position);
            if (employees.length === 0) {
                throw new Error('没有找到符合条件的员工');
            }
            
            // 2. 获取筛选条件下的排班顺序
            const shiftOrders = await this.getFilteredShiftOrders(organization, department, position);
            
            // 3. 获取所有有效班次
            const shifts = await this.shiftManager.getAllShifts();
            const activeShifts = shifts.filter(shift => shift.status === 0);
            
            // 4. 获取上个月的排班计划，以保证连续性
            const lastMonthSchedule = await this.getLastMonthSchedule(year, month, organization, department, position);
            
            // 5. 生成日历数据
            const calendarData = this.generateCalendarData(year, month);
            
            // 6. 开始排班算法
            const scheduleResult = this.applySchedulingAlgorithm(
                employees,
                shiftOrders,
                activeShifts,
                calendarData,
                lastMonthSchedule,
                organization,
                department,
                position
            );
            
            // 7. 保存排班结果
            const savedSchedule = await this.saveSchedule({
                year: year,
                month: month,
                organization: organization,
                department: department,
                position: position,
                scheduleData: scheduleResult,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            console.log('排班计划生成成功:', savedSchedule);
            return savedSchedule;
        } catch (error) {
            console.error('生成排班计划失败:', error);
            showNotification('生成排班计划失败: ' + error.message, 'error');
            throw error;
        }
    }
    
    // 获取筛选条件下的员工
    async getFilteredEmployees(organization, department, position) {
        try {
            let employees = await this.dbManager.getAll('employees');
            
            // 筛选在职员工
            // 注意：员工status可能是数字类型(0表示在职)或字符串类型
            employees = employees.filter(emp => {
                // 处理数字类型的status
                if (typeof emp.status === 'number') {
                    return emp.status === 0;
                }
                // 处理字符串类型的status
                const statusStr = String(emp.status).toLowerCase().trim();
                return statusStr === 'active' || statusStr === '0';
            });
            
            // 按机构筛选 - 注意员工数据中存储的是orgName而不是organizationId
            if (organization && organization !== '全部机构') {
                employees = employees.filter(emp => 
                    emp.orgName && emp.orgName.toLowerCase().trim() === organization.toLowerCase().trim()
                );
            }
            
            // 按部门筛选
            // 注意：员工数据中存储部门信息的字段是deptName而不是department
            if (department && department !== '全部部门') {
                employees = employees.filter(emp => 
                    emp.deptName && emp.deptName.toLowerCase().trim() === department.toLowerCase().trim()
                );
            }
            
            // 按岗位筛选
            if (position && position !== '全部岗位') {
                employees = employees.filter(emp => 
                    emp.position && emp.position.toLowerCase().trim() === position.toLowerCase().trim()
                );
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
            const shiftOrders = await this.dbManager.getAll('shiftOrders');
            let filteredOrders = shiftOrders;
            
            // 按部门筛选
            // 注意：shiftOrders数据结构中的部门信息存储在departmentOrders数组中
            if (department && department !== '全部部门') {
                filteredOrders = filteredOrders.filter(order => 
                    order.departmentOrders && order.departmentOrders.some(deptOrder => 
                        deptOrder.department && deptOrder.department.toLowerCase().trim() === department.toLowerCase().trim()
                    )
                );
            }
            
            // 按岗位筛选
            if (position && position !== '全部岗位') {
                filteredOrders = filteredOrders.filter(order => 
                    order.position && order.position.toLowerCase().trim() === position.toLowerCase().trim()
                );
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
            const matchingSchedule = schedules.find(schedule => 
                schedule.year === lastYear &&
                schedule.month === lastMonth &&
                schedule.organization === organization &&
                schedule.department === department &&
                schedule.position === position
            );
            
            return matchingSchedule || null;
        } catch (error) {
            console.error('获取上个月排班计划失败:', error);
            return null;
        }
    }
    
    // 生成日历数据
    generateCalendarData(year, month) {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
        
        const calendarData = [];
        
        // 添加上个月的日期（用于填充第一行）
        for (let i = 0; i < startingDayOfWeek; i++) {
            const prevMonthDate = new Date(year, month - 1, -startingDayOfWeek + i + 1);
            calendarData.push({
                date: prevMonthDate,
                day: prevMonthDate.getDate(),
                isCurrentMonth: false,
                isWeekend: prevMonthDate.getDay() === 0 || prevMonthDate.getDay() === 6
            });
        }
        
        // 添加当前月的日期
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            calendarData.push({
                date: date,
                day: day,
                isCurrentMonth: true,
                isWeekend: date.getDay() === 0 || date.getDay() === 6
            });
        }
        
        return calendarData;
    }
    
    // 排班算法实现
    applySchedulingAlgorithm(employees, shiftOrders, activeShifts, calendarData, lastMonthSchedule, organization, department, position) {
        try {
            // 结果对象，按员工号组织
            const scheduleResult = {};
            
            // 初始化每个员工的排班数据
            employees.forEach(employee => {
                scheduleResult[employee.number] = {
                    employeeNumber: employee.number,
                    employeeName: employee.name,
                    department: employee.department,
                    position: employee.position,
                    schedule: []
                };
            });
            
            // 记录每个员工的排班计数
            const shiftCounts = {};
            employees.forEach(employee => {
                shiftCounts[employee.number] = {};
                activeShifts.forEach(shift => {
                    shiftCounts[employee.number][shift.code] = 0;
                });
            });
            
            // 获取上个月最后几天的排班情况，用于保证连续性
            const lastMonthAssignments = this.getLastMonthAssignments(lastMonthSchedule, employees);
            
            // 遍历日历数据进行排班
            calendarData.forEach(dayData => {
                if (!dayData.isCurrentMonth) return; // 跳过非当前月的日期
                
                // 为每个员工安排班次
                employees.forEach(employee => {
                    const shiftCode = this.assignShiftToEmployee(
                        employee,
                        shiftOrders,
                        dayData,
                        lastMonthAssignments,
                        shiftCounts
                    );
                    
                    // 将排班结果添加到员工的排班数据中
                    scheduleResult[employee.number].schedule.push({
                        date: dayData.date,
                        day: dayData.day,
                        shiftCode: shiftCode,
                        isWeekend: dayData.isWeekend
                    });
                    
                    // 更新班次计数
                    if (shiftCode) {
                        shiftCounts[employee.number][shiftCode] = (shiftCounts[employee.number][shiftCode] || 0) + 1;
                    }
                });
            });
            
            return scheduleResult;
        } catch (error) {
            console.error('排班算法执行失败:', error);
            throw error;
        }
    }
    
    // 获取上个月最后几天的排班情况
    getLastMonthAssignments(lastMonthSchedule, employees) {
        const assignments = {};
        
        if (!lastMonthSchedule || !lastMonthSchedule.scheduleData) {
            // 如果没有上个月的排班计划，初始化空对象
            employees.forEach(employee => {
                assignments[employee.number] = [];
            });
            return assignments;
        }
        
        // 提取上个月最后几天的排班情况（这里取最后3天）
        Object.keys(lastMonthSchedule.scheduleData).forEach(empNumber => {
            const empData = lastMonthSchedule.scheduleData[empNumber];
            if (empData && empData.schedule && Array.isArray(empData.schedule)) {
                // 取最后3天的排班
                const lastThreeDays = empData.schedule.slice(-3);
                assignments[empNumber] = lastThreeDays.map(day => ({
                    date: day.date,
                    shiftCode: day.shiftCode
                }));
            }
        });
        
        return assignments;
    }
    
    // 为员工分配班次 - 按照排班顺序中的实际班次信息进行安排
    assignShiftToEmployee(employee, shiftOrders, dayData, lastMonthAssignments, shiftCounts) {
        try {
            // 查找该员工所在岗位和部门的排班顺序
            const relevantOrders = shiftOrders.filter(order => {
                // 检查departmentOrders数组中的部门信息
                if (order.departmentOrders && Array.isArray(order.departmentOrders)) {
                    return order.departmentOrders.some(deptOrder => 
                        deptOrder.department && employee.deptName && 
                        deptOrder.department.toLowerCase().trim() === employee.deptName.toLowerCase().trim() &&
                        deptOrder.employeeNumbers &&
                        deptOrder.employeeNumbers.includes(employee.number)
                    ) && order.position && employee.position && 
                    order.position.toLowerCase().trim() === employee.position.toLowerCase().trim();
                }
                // 兼容旧数据结构
                return order.department && employee.deptName && 
                       order.department.toLowerCase().trim() === employee.deptName.toLowerCase().trim() &&
                       order.position && employee.position && 
                       order.position.toLowerCase().trim() === employee.position.toLowerCase().trim() &&
                       order.employeeNumbers &&
                       order.employeeNumbers.includes(employee.number);
            });

            if (relevantOrders.length === 0) {
                return '休'; // 默认安排休息
            }

            // 获取第一个匹配的排班顺序
            const order = relevantOrders[0];
            
            // 获取包含该员工的部门排班顺序
            let departmentOrder;
            if (order.departmentOrders && Array.isArray(order.departmentOrders)) {
                departmentOrder = order.departmentOrders.find(deptOrder => 
                    deptOrder.department && employee.deptName &&
                    deptOrder.department.toLowerCase().trim() === employee.deptName.toLowerCase().trim() &&
                    deptOrder.employeeNumbers &&
                    deptOrder.employeeNumbers.includes(employee.number)
                );
            }

            // 使用部门排班顺序或直接使用排班顺序中的员工列表
            const employeeNumbers = departmentOrder && departmentOrder.employeeNumbers ? 
                                   departmentOrder.employeeNumbers : order.employeeNumbers;
            
            if (!employeeNumbers || !employeeNumbers.includes(employee.number)) {
                return '休'; // 员工不在排班顺序中，安排休息
            }

            // 获取员工在排班顺序中的位置
            const employeeIndex = employeeNumbers.indexOf(employee.number);

            // 根据排班规则改进: 查看员工在哪些班次有值班记录，并考虑班次优先级
            // 首先，获取当天可用的班次列表（从排班顺序中获取或使用默认班次）
            let availableShifts = ['G', 'Y', '休']; // 默认班次类型
            
            // 如果排班顺序中有具体的班次列表，使用它
            if (order.shifts && Array.isArray(order.shifts)) {
                availableShifts = order.shifts;
            } else if (order.shiftCode) {
                // 保持向后兼容
                availableShifts = [order.shiftCode, '休'];
            }

            // 检查上个月的排班情况，避免连续排班
            const lastMonthShifts = lastMonthAssignments[employee.number] || [];
            const recentShifts = lastMonthShifts.map(day => day.shiftCode);

            // 根据员工的排班记录和班次优先级进行智能排班
            let selectedShift = this.selectShiftBasedOnPriority(
                employee, 
                availableShifts, 
                dayData, 
                shiftCounts, 
                recentShifts,
                employeeIndex,
                employeeNumbers.length
            );

            return selectedShift;
        } catch (error) {
            console.error('为员工分配班次失败:', error);
            return '休'; // 出错时默认安排休息
        }
    }

    // 基于班次优先级和员工排班记录选择班次
    selectShiftBasedOnPriority(employee, availableShifts, dayData, shiftCounts, recentShifts, employeeIndex, totalEmployees) {
        // 班次优先级配置（可以根据实际需求调整）
        const shiftPriority = {
            'G': 1, // 高优先级
            'Y': 2, // 中优先级
            '休': 3  // 低优先级（优先安排工作，最后安排休息）
        };

        // 计算排班索引 - 基于日期和员工索引
        const scheduleIndex = (dayData.day - 1 + employeeIndex) % totalEmployees;
        
        // 创建班次候选项及其权重
        const shiftCandidates = availableShifts.map(shift => {
            let weight = 0;
            
            // 根据班次优先级调整权重
            weight += shiftPriority[shift] || 10; // 默认较低优先级
            
            // 检查员工最近是否已经安排过相同班次，避免连续排班
            if (recentShifts.includes(shift)) {
                weight += 5; // 增加权重，降低连续安排相同班次的概率
            }
            
            // 基于员工的排班记录，平衡各班次的数量
            const currentCount = shiftCounts[employee.number][shift] || 0;
            weight += currentCount * 2; // 班次安排次数越多，权重越高
            
            // 周末特殊处理
            if (dayData.isWeekend) {
                if (shift === '休') {
                    // 周末优先安排休息
                    weight -= 5;
                } else {
                    // 周末工作班次权重增加
                    weight += 3;
                }
            }
            
            return { shift, weight };
        });
        
        // 按照权重排序，选择权重最小的班次（权重越小优先级越高）
        shiftCandidates.sort((a, b) => a.weight - b.weight);
        
        // 根据排班索引和总员工数确定是否安排休息
        // 例如：每3个员工中安排1个休息（可根据实际需求调整）
        const restFrequency = Math.max(1, Math.floor(totalEmployees / 3)); // 至少每1人中有1人休息
        const shouldRest = scheduleIndex % restFrequency === 0;
        
        // 如果应该安排休息，优先选择休息班次
        if (shouldRest && shiftCandidates.some(candidate => candidate.shift === '休')) {
            return '休';
        }
        
        // 返回权重最小的班次
        return shiftCandidates[0]?.shift || '休';
    }
    
    // 保存排班计划
    async saveSchedule(scheduleData) {
        try {
            const savedSchedule = await this.dbManager.save('schedulePlans', scheduleData);
            showNotification('排班计划保存成功');
            return savedSchedule;
        } catch (error) {
            console.error('保存排班计划失败:', error);
            throw error;
        }
    }
    
    // 获取排班计划
    async getSchedule(year, month, organization = '', department = '', position = '') {
        try {
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
            
            // 查找匹配的排班计划
            const matchingSchedule = schedules.find(schedule => 
                schedule.year === year &&
                schedule.month === month &&
                schedule.organization === organization &&
                schedule.department === department &&
                schedule.position === position
            );
            
            return matchingSchedule || null;
        } catch (error) {
            console.error('获取排班计划失败:', error);
            return null;
        }
    }
    
    // 获取所有排班计划列表
    async getAllSchedulePlans() {
        try {
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
            
            // 按年份和月份排序
            return schedules.sort((a, b) => {
                if (a.year !== b.year) {
                    return b.year - a.year;
                }
                return b.month - a.month;
            });
        } catch (error) {
            console.error('获取所有排班计划失败:', error);
            return [];
        }
    }
    
    // 根据月份获取排班计划
    async getScheduleByMonth(year, month) {
        try {
            await this.dbManager.ensureInitialized();
            
            // 获取所有排班计划
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
            
            // 查找匹配的排班计划
            const matchingSchedule = schedules.find(schedule => 
                schedule.year === year && 
                schedule.month === month
            );
            
            return matchingSchedule ? matchingSchedule.scheduleData : null;
        } catch (error) {
            console.error('获取指定月份排班计划失败:', error);
            return null;
        }
    }

    // 获取所有历史排班记录
    async getHistoryRecords() {
        try {
            await this.dbManager.ensureInitialized();
            
            // 获取所有排班计划并按时间倒序排列
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
            
            // 格式化历史记录数据
            const historyRecords = schedules.map(schedule => ({
                id: schedule.id,
                year: schedule.year,
                month: schedule.month,
                organization: schedule.organization || '全部机构',
                department: schedule.department || '全部部门',
                position: schedule.position || '全部岗位',
                createdAt: new Date(schedule.createdAt),
                employeeCount: schedule.scheduleData ? Object.keys(schedule.scheduleData).length : 0
            }));
            
            // 按创建时间倒序排列
            historyRecords.sort((a, b) => b.createdAt - a.createdAt);
            
            return historyRecords;
        } catch (error) {
            console.error('获取历史排班记录失败:', error);
            return [];
        }
    }

    // 导出排班计划为Excel
    async exportScheduleToExcel(scheduleId) {
        try {
            const schedule = await this.dbManager.getById('schedulePlans', scheduleId);
            if (!schedule || !schedule.scheduleData) {
                throw new Error('未找到排班计划数据');
            }
            
            // 准备导出数据
            const exportData = [];
            
            // 添加表头行
            const header = ['员工号', '姓名', '部门', '岗位'];
            
            // 获取当前月份的天数
            const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
            
            // 添加日期列头
            for (let day = 1; day <= daysInMonth; day++) {
                header.push(`${day}日`);
            }
            
            exportData.push(header);
            
            // 添加员工排班数据
            Object.values(schedule.scheduleData).forEach(empData => {
                const row = [
                    empData.employeeNumber,
                    empData.employeeName,
                    empData.department,
                    empData.position
                ];
                
                // 添加每天的排班情况
                empData.schedule.forEach(dayData => {
                    if (dayData.isCurrentMonth) {
                        row.push(dayData.shiftCode || '');
                    }
                });
                
                exportData.push(row);
            });
            
            // 使用XLSX库创建工作簿
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `${schedule.year}年${schedule.month}月排班表`);
            
            // 生成文件名
            const fileName = `${schedule.year}年${schedule.month}月${schedule.department || ''}排班表.xlsx`;
            
            // 下载文件
            XLSX.writeFile(wb, fileName);
            
            showNotification('排班表导出成功');
            return fileName;
        } catch (error) {
            console.error('导出排班表失败:', error);
            showNotification('导出排班表失败: ' + error.message, 'error');
            throw error;
        }
    }
}

// 初始化排班管理器
window.scheduleManager = new ScheduleManager();