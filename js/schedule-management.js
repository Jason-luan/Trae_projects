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
        
        // 添加班次状态变更监听器，实现排班计划与班次管理的联动
        window.addEventListener('shiftStatusChanged', this.handleShiftStatusChange.bind(this));
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

            // 应用排班算法
            const scheduleResult = this.applySchedulingAlgorithm(
                filteredEmployees,
                shiftOrders,
                filteredActiveShifts, // 传递过滤后的非休班次
                calendarData,
                lastMonthSchedule,
                organization,
                department,
                position
            );

            // 保存排班结果
            const savedSchedule = await this.saveSchedule({
                year: year,
                month: month,
                organization: organization,
                department: department,
                position: position,
                scheduleData: scheduleResult,
                createTime: new Date().getTime()
            });

            return savedSchedule;
        } catch (error) {
            console.error('生成排班计划失败:', error);
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
                isCurrentMonth: true,
                isWeekend: date.getDay() === 0 || date.getDay() === 6
            });
        }

        return calendarData;
    }
    
    // 排班算法实现
    applySchedulingAlgorithm(employees, shiftOrders, activeShifts, calendarData, lastMonthSchedule, organization, department, position) {
        try {
            console.log('applySchedulingAlgorithm开始执行，参数:', { activeShifts, employeeCount: employees.length });
            // 结果对象，按员工号组织
            var scheduleResult = {};

            // 初始化每个员工的排班数据
            for (var i = 0; i < employees.length; i++) {
                var employee = employees[i];
                // 尝试从多个可能的字段获取部门信息
                var deptInfo = employee.deptName || employee.department || employee.dept || '未知部门';
                scheduleResult[employee.number] = {
                    employeeNumber: employee.number,
                    employeeName: employee.name,
                    department: deptInfo, // 修复：使用多个可能的字段获取部门信息
                    position: employee.position,
                    schedule: []
                };
            }

            // 记录每个员工的排班计数
            var shiftCounts = {};
            for (var j = 0; j < employees.length; j++) {
                var emp = employees[j];
                shiftCounts[emp.number] = {};
                // 初始化所有启用班次的计数
                for (var k = 0; k < activeShifts.length; k++) {
                    var shift = activeShifts[k];
                    shiftCounts[emp.number][shift] = 0;
                }
            }

            // 获取上个月最后几天的排班情况，用于保证连续性
            var lastMonthAssignments = this.getLastMonthAssignments(lastMonthSchedule, employees);

            // 遍历日历数据进行排班
            for (var l = 0; l < calendarData.length; l++) {
                var dayData = calendarData[l];
                if (!dayData.isCurrentMonth) continue; // 跳过非当前月的日期

                // 为每个员工安排班次
                for (var m = 0; m < employees.length; m++) {
                    var emp = employees[m];
                    console.log(`为员工 ${emp.number}(${emp.name}) 分配班次，当前活动班次:`, activeShifts);
                    var shiftCode = this.assignShiftToEmployee(
                        emp,
                        shiftOrders,
                        dayData,
                        lastMonthAssignments,
                        shiftCounts,
                        activeShifts
                    );
                    console.log(`员工 ${emp.number}(${emp.name}) 被分配班次:`, shiftCode);

                    // 将排班结果添加到员工的排班数据中
                    scheduleResult[emp.number].schedule.push({
                        date: dayData.date,
                        day: dayData.day,
                        shiftCode: shiftCode,
                        isWeekend: dayData.isWeekend
                    });

                    // 更新班次计数
                    if (shiftCode) {
                        shiftCounts[emp.number][shiftCode] = (shiftCounts[emp.number][shiftCode] || 0) + 1;
                    }
                }
            }

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
    assignShiftToEmployee(employee, shiftOrders, dayData, lastMonthAssignments, shiftCounts, activeShifts) {
        try {
            // 查找该员工所在岗位和部门的排班顺序
            var relevantOrders = shiftOrders.filter(function(order) {
                // 检查departmentOrders数组中的部门信息
                if (order.departmentOrders && Array.isArray(order.departmentOrders)) {
                    return order.departmentOrders.some(function(deptOrder) {
                        return deptOrder.department && employee.deptName && 
                        deptOrder.department.toLowerCase().trim() === employee.deptName.toLowerCase().trim() &&
                        deptOrder.employeeNumbers &&
                        deptOrder.employeeNumbers.includes(employee.number);
                    }) && order.position && employee.position && 
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

            // 如果没有找到相关排班顺序，直接返回空字符串
            if (relevantOrders.length === 0) {
                return '';
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
                // 如果员工不在排班顺序中，直接返回空字符串
                return '';
            }

            // 获取员工在排班顺序中的位置
            const employeeIndex = employeeNumbers.indexOf(employee.number);

            // 根据排班规则改进: 查看员工在哪些班次有值班记录，并考虑班次优先级
            // 首先，获取当天可用的班次列表
            // 确保只使用启用的班次
            let availableShifts = activeShifts; // 使用从外部传入的启用班次列表
            
            // 如果排班顺序中有具体的班次列表，使用它并过滤出启用的班次
            if (order.shifts && Array.isArray(order.shifts)) {
                availableShifts = order.shifts.filter(shift => activeShifts.includes(shift));
            } else if (order.shiftCode) {
                // 保持向后兼容
                availableShifts = activeShifts.includes(order.shiftCode) ? [order.shiftCode] : [];
            }
            
            // 确保至少有一个可用班次
            if (availableShifts.length === 0) {
                availableShifts = activeShifts; // 使用所有启用的班次
            }

            // 检查上个月的排班情况，避免连续排班
            var lastMonthShifts = lastMonthAssignments[employee.number] || [];
            var recentShifts = [];
            for (var i = 0; i < lastMonthShifts.length; i++) {
                recentShifts.push(lastMonthShifts[i].shiftCode);
            }

            // 根据员工的排班记录和班次优先级进行智能排班
            var selectedShift = this.selectShiftBasedOnPriority(
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
            console.error('错误时的上下文信息:', {
                employeeNumber: employee.number,
                employeeName: employee.name,
                activeShifts: activeShifts
            });
            // 出错时直接返回空字符串
            return '';
        }
    }

    // 基于分析数据添加的跨业务线和跨班次处理逻辑
    getBusinessLineFromDepartment(deptName) {
        // 从部门名称中提取业务线信息
        if (!deptName) return '未知';
        var lowerDept = deptName.toLowerCase();
        if (lowerDept.includes('对公')) return '对公';
        if (lowerDept.includes('个人')) return '个人';
        if (lowerDept.includes('风险')) return '风险';
        return '其他';
    }

    // 严格按照基础设置中的班次顺序进行排班的方法
    selectShiftBasedOnPriority(employee, availableShifts, dayData, shiftCounts, recentShifts, employeeIndex, totalEmployees) {
        try {
            // 过滤掉所有可能的'休'班次
            const nonRestShifts = availableShifts.filter(shift => shift !== '休');
            
            // 严格按照availableShifts中的顺序返回第一个可用的非'休'班次
            if (nonRestShifts.length > 0) {
                console.log(`员工 ${employee.number}(${employee.name}) 选择班次:`, nonRestShifts[0]);
                return nonRestShifts[0];
            } else {
                console.warn('没有找到合适的非休班次:', {
                    employeeNumber: employee.number,
                    employeeName: employee.name,
                    availableShifts: availableShifts
                });
                // 不使用随机或默认逻辑，严格按照排班顺序
                return '';
            }
        } catch (error) {
            console.error('选择班次失败:', error);
            console.error('错误时的上下文信息:', {
                employeeNumber: employee.number,
                employeeName: employee.name,
                availableShifts: availableShifts
            });
            // 出错时返回空字符串
            return '';
        }
    }
    
    // 保存排班计划
    async saveSchedule(scheduleData) {
        try {
            const savedSchedule = await this.dbManager.save('schedulePlans', scheduleData);
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
            
            if (!matchingSchedule) return null;
            
            // 获取所有员工数据用于修复部门信息
            const allEmployees = await this.dbManager.getAll('employees');
            const employeeMap = new Map();
            
            // 定义规范化ID的函数，与系统其他部分保持一致
            const normalizeId = (id) => {
                if (id === null || id === undefined) return '';
                return String(id).toLowerCase().trim();
            };
            
            // 创建规范化后的员工号到员工对象的映射
            allEmployees.forEach(emp => {
                const normalizedNumber = normalizeId(emp.number);
                employeeMap.set(normalizedNumber, emp);
            });
            
            // 修复排班数据中的部门信息
            const fixedScheduleData = { ...matchingSchedule.scheduleData };
            
            Object.keys(fixedScheduleData).forEach(employeeNumber => {
                const employeeSchedule = fixedScheduleData[employeeNumber];
                // 规范化员工号后再查找
                const normalizedNumber = normalizeId(employeeNumber);
                const employee = employeeMap.get(normalizedNumber);
                
                // 检查员工数据是否存在
                if (employee) {
                    // 优先使用员工对象中的deptName字段（根据系统数据结构这是最准确的部门信息字段）
                    if (employee.deptName && employee.deptName.trim() !== '') {
                        employeeSchedule.department = employee.deptName.trim();
                    } else {
                        // 如果deptName为空，再尝试其他可能的字段
                        employeeSchedule.department = (employee.department || employee.dept || '未知部门').trim();
                    }
                } else {
                    // 如果没有找到对应的员工数据，记录日志以便排查
                    console.log(`未找到员工号为 ${employeeNumber} 的员工数据，无法确定部门信息`);
                    employeeSchedule.department = '未知部门';
                }
            });
            
            return fixedScheduleData;
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