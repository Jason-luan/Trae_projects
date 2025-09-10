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
            // 通过事件机制，而不是直接调用方法，保持模块间的解耦
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

            // 创建排班计划对象
            const schedulePlan = {
                year: year,
                month: month,
                organization: organization,
                department: department === '全部部门' ? '全部部门' : department, // 保留"全部部门"原值
                position: position === '全部岗位' ? '全部岗位' : position, // 保留"全部岗位"原值
                scheduleData: scheduleResult,
                createTime: new Date().getTime()
            };

            // 先检查是否已存在相同月份的排班计划，如果存在则删除
            const existingSchedules = await this.dbManager.getAll('schedulePlans');
            const existingSchedule = existingSchedules.find(s => 
                s.year === year && s.month === month && s.organization === organization && 
                s.department === department && s.position === position
            );
            
            if (existingSchedule && existingSchedule.id) {
                console.log(`已存在${year}年${month}月的排班计划，正在删除旧数据...`);
                await this.dbManager.delete('schedulePlans', existingSchedule.id);
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
                    
                    // 获取排序后的班次列表用于日志显示
                    let sortedShifts = [...activeShifts];
                    if (window.shiftDataCache && window.shiftDataCache.length > 0) {
                        // 根据班次优先级排序
                        const nonRestShifts = activeShifts.filter(shift => shift !== '休');
                        const shiftObjects = nonRestShifts.map(shiftCode => {
                            return window.shiftDataCache.find(shift => shift.code === shiftCode);
                        }).filter(Boolean);
                        
                        if (shiftObjects.length > 0) {
                            shiftObjects.sort((a, b) => {
                                const priorityA = a.priority !== undefined ? a.priority : 100;
                                const priorityB = b.priority !== undefined ? b.priority : 100;
                                return priorityA - priorityB;
                            });
                            
                            // 构建排序后的班次代码列表
                            sortedShifts = shiftObjects.map(shift => shift.code);
                            // 添加休班班次到最后
                            if (activeShifts.includes('休')) {
                                sortedShifts.push('休');
                            }
                        }
                    }
                    
                    console.log(`为员工 ${emp.number}(${emp.name}) 分配班次，当前活动班次(排序后):`, sortedShifts);
                    var shiftCode = this.assignShiftToEmployee(
                        emp,
                        shiftOrders,
                        dayData,
                        lastMonthAssignments,
                        shiftCounts,
                        activeShifts
                    );
                    
                    if (!shiftCode) {
                        // 增强错误日志，记录为什么没有分配到班次
                        const relevantOrders = shiftOrders.filter(function(order) {
                            if (order.departmentOrders && Array.isArray(order.departmentOrders)) {
                                return order.departmentOrders.some(function(deptOrder) {
                                    return deptOrder.department && emp.deptName && 
                                    deptOrder.department.toLowerCase().trim() === emp.deptName.toLowerCase().trim() &&
                                    deptOrder.employeeNumbers &&
                                    deptOrder.employeeNumbers.includes(emp.number);
                                }) && order.position && emp.position && 
                                order.position.toLowerCase().trim() === emp.position.toLowerCase().trim();
                            }
                            return order.department && emp.deptName && 
                                   order.department.toLowerCase().trim() === emp.deptName.toLowerCase().trim() &&
                                   order.position && emp.position && 
                                   order.position.toLowerCase().trim() === emp.position.toLowerCase().trim() &&
                                   order.employeeNumbers &&
                                   order.employeeNumbers.includes(emp.number);
                        });
                        
                        if (relevantOrders.length === 0) {
                            console.log(`员工 ${emp.number}(${emp.name}) 未分配到班次：没有找到匹配的排班顺序`);
                            console.log(`员工信息：部门=${emp.deptName}, 岗位=${emp.position}`);
                        }
                    }
                    
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
    
    // 为员工分配班次 - 遍历所有启用的班次，在每个班次下查找包含该员工的排班顺序
    assignShiftToEmployee(employee, shiftOrders, dayData, lastMonthAssignments, shiftCounts, activeShifts) {
        try {
            // 定义规范化ID的函数，确保匹配时不区分大小写和空格
            const normalizeId = (id) => {
                if (id === null || id === undefined) return '';
                return String(id).toLowerCase().trim();
            };
            
            // 规范化员工号
            const empNumber = employee.number;
            const normalizedEmpNumber = normalizeId(empNumber);
            
            // 获取最近班次记录用于连续排班检查
            const lastMonthShifts = lastMonthAssignments[employee.number] || [];
            const recentShifts = lastMonthShifts.map(day => day.shiftCode);

            // 核心匹配逻辑：先遍历所有启用的班次，然后在每个班次下查找包含该员工的排班顺序
            const shiftOrderInfo = [];
            
            // 遍历所有启用的班次
            activeShifts.forEach(shiftCode => {
                // 对于每个启用的班次，查找所有包含该班次的排班顺序
                shiftOrders.forEach(order => {
                    // 检查该排班顺序是否包含当前班次
                    let containsShift = false;
                    const shiftsInOrder = [];
                    if (order.shiftCode) shiftsInOrder.push(order.shiftCode);
                    if (order.shifts && Array.isArray(order.shifts)) shiftsInOrder.push(...order.shifts);
                    
                    containsShift = shiftsInOrder.includes(shiftCode);
                    
                    if (containsShift) {
                        let employeeIndex = -1;
                        let totalEmployees = 1;
                        
                        // 检查员工号是否在排班顺序中
                        if (order.departmentOrders && Array.isArray(order.departmentOrders)) {
                            // 处理部门排班数据结构
                            for (const dept of order.departmentOrders) {
                                if (dept.employeeNumbers) {
                                    const employeeNumbersArray = Array.isArray(dept.employeeNumbers) ? dept.employeeNumbers : [dept.employeeNumbers];
                                    const normalizedDeptEmployeeNumbers = employeeNumbersArray.map(num => normalizeId(num));
                                    
                                    // 查找员工在数组中的位置
                                    employeeIndex = normalizedDeptEmployeeNumbers.indexOf(normalizedEmpNumber);
                                    if (employeeIndex !== -1) {
                                        totalEmployees = employeeNumbersArray.length;
                                        break;
                                    }
                                }
                            }
                        } else if (order.employeeNumbers) {
                            // 处理直接员工数组数据结构
                            const employeeNumbersArray = Array.isArray(order.employeeNumbers) ? order.employeeNumbers : [order.employeeNumbers];
                            const normalizedOrderEmployeeNumbers = employeeNumbersArray.map(num => normalizeId(num));
                            
                            // 查找员工在数组中的位置
                            employeeIndex = normalizedOrderEmployeeNumbers.indexOf(normalizedEmpNumber);
                            if (employeeIndex !== -1) {
                                totalEmployees = employeeNumbersArray.length;
                            }
                        }
                        
                        // 如果找到员工，收集排班顺序中的班次信息
                        if (employeeIndex !== -1) {
                            shiftOrderInfo.push({
                                shiftCode: shiftCode,
                                order: order,
                                employeeIndex: employeeIndex,
                                totalEmployees: totalEmployees,
                                // 添加排序位置信息
                                rank: employeeIndex + 1, // 排名（从1开始）
                                isFirst: employeeIndex === 0, // 是否第一位
                                isLast: employeeIndex === totalEmployees - 1 // 是否最后一位
                            });
                        }
                    }
                });
            });
            
            // 添加详细日志，记录匹配结果
            console.log(`员工 ${empNumber}(${employee.name}) 的匹配结果:`, {
                matchedShiftsCount: shiftOrderInfo.length,
                matchedShiftCodes: shiftOrderInfo.map(info => info.shiftCode)
            });
            
            // 如果没有找到任何班次的排班顺序，返回空字符串
            if (shiftOrderInfo.length === 0) {
                // 增强错误诊断，找出为什么没有匹配到任何班次
                const matchingDetails = {
                    employee: { number: empNumber, name: employee.name, dept: employee.deptName, position: employee.position },
                    activeShifts: activeShifts,
                    shiftOrdersCount: shiftOrders.length,
                    // 检查是否有任何排班顺序包含该员工
                    hasAnyMatchingOrder: shiftOrders.some(order => {
                        // 检查部门排班数据结构
                        if (order.departmentOrders && Array.isArray(order.departmentOrders)) {
                            return order.departmentOrders.some(dept => {
                                if (dept.employeeNumbers) {
                                    const employeeNumbersArray = Array.isArray(dept.employeeNumbers) ? dept.employeeNumbers : [dept.employeeNumbers];
                                    const normalizedDeptEmployeeNumbers = employeeNumbersArray.map(num => normalizeId(num));
                                    return normalizedDeptEmployeeNumbers.includes(normalizedEmpNumber);
                                }
                                return false;
                            });
                        }
                        // 检查直接员工数组数据结构
                        else if (order.employeeNumbers) {
                            const employeeNumbersArray = Array.isArray(order.employeeNumbers) ? order.employeeNumbers : [order.employeeNumbers];
                            const normalizedOrderEmployeeNumbers = employeeNumbersArray.map(num => normalizeId(num));
                            return normalizedOrderEmployeeNumbers.includes(normalizedEmpNumber);
                        }
                        return false;
                    })
                };
                
                console.warn(`员工 ${empNumber}(${employee.name}) 未找到任何匹配的排班信息:`, matchingDetails);
                return '';
            }
            
            // 基于每个班次的排班顺序信息进行智能排班，包含员工排序信息
            const selectedShift = this.selectShiftBasedOnPriority(
                employee, 
                shiftOrderInfo, 
                dayData, 
                shiftCounts, 
                recentShifts
            );

            return selectedShift;
        } catch (error) {
            console.error('为员工分配班次失败:', error);
            console.error('错误时的上下文信息:', {
                employeeNumber: employee.number,
                normalizedEmployeeNumber: String(employee.number).toLowerCase().trim(),
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

    // 根据员工在每个班次中的排班顺序信息进行智能排班的方法
    selectShiftBasedOnPriority(employee, shiftOrderInfo, dayData, shiftCounts, recentShifts) {
        try {
            // 过滤掉所有可能的'休'班次
            let validShiftOrderInfo = shiftOrderInfo.filter(info => info.shiftCode !== '休');
            
            // 过滤掉优先级为0的班次（不参与排班）
            if (window.shiftDataCache && window.shiftDataCache.length > 0) {
                validShiftOrderInfo = validShiftOrderInfo.filter(info => {
                    const shiftObj = window.shiftDataCache.find(shift => shift.code === info.shiftCode);
                    // 保留优先级>0的班次
                    return shiftObj && shiftObj.priority !== undefined && shiftObj.priority > 0;
                });
            }
            
            if (validShiftOrderInfo.length > 0) {
                // 获取当前日期信息
                const currentDate = new Date(dayData.date);
                const dayOfWeek = currentDate.getDay(); // 0-6, 0是周日
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                
                // 特殊班次连续值班规则定义
                const specialShiftRules = {
                    // 风险-对公
                    '风险-对公': {
                        '夜班岗-Y16综': {
                            shiftCode: 'Y16综',
                            continuousDays: 5,
                            dailyLimit: 1
                        },
                        '周未A岗-G班': {
                            shiftCode: 'G值-A',
                            continuousDays: 2,
                            weeklyLimit: 1,
                            isWeekendOnly: true
                        },
                        '周六C岗-G班': {
                            shiftCode: 'G值-C',
                            dailyLimit: 1,
                            isSaturdayOnly: true
                        }
                    },
                    // 风险室-个人
                    '风险室-个人': {
                        '夜班岗-Y16综': {
                            shiftCode: 'Y16综',
                            continuousDays: 7,
                            dailyLimit: 1
                        },
                        '周未白班岗-G班': {
                            shiftCode: 'G值',
                            continuousDays: 2,
                            weeklyLimit: 1,
                            isWeekendOnly: true
                        }
                    },
                    // 风险室-风险核查
                    '风险室-风险核查': {
                        '周末B岗': {
                            shiftCode: 'G值-B',
                            continuousDays: 2,
                            weeklyLimit: 1,
                            isWeekendOnly: true
                        }
                    }
                };
                
                // 班次名称到代码的映射，用于处理不同格式的班次标识
                const shiftNameToCodeMap = {
                    'Y16综': 'Y16综',
                    'G班': 'G',
                    'G': 'G',
                    '夜班岗-Y16综': 'Y16综',
                    '周未A岗-G班': 'G值-A',
                    '周六C岗-G班': 'G值-C',
                    '周未白班岗-G班': 'G值',
                    '周末B岗': 'G值-B'
                };
                
                // 部门关键词映射，用于处理部门名称的不同表述
                const departmentKeywords = {
                    '风险-对公': ['风险-对公', '对公反诈组'],
                    '风险室-个人': ['风险室-个人', '风险室-个人业务'],
                    '风险室-风险核查': ['风险室-风险核查', '风险核查']
                };
                
                // 检查员工是否在最近几天有连续排班
                const isContinuousShiftAllowed = (shiftCode) => {
                    // 检查特殊班次的连续值班规则
                    let allowed = true;
                    
                    // 获取员工所在部门
                    const employeeDept = employee.deptName || '';
                    
                    // 标准化班次代码，使用映射表转换
                    const normalizedShiftCode = shiftNameToCodeMap[shiftCode] || shiftCode;
                    
                    // 查找员工部门对应的规则部门
                    let applicableDepartments = [];
                    
                    // 检查精确匹配
                    if (specialShiftRules[employeeDept]) {
                        applicableDepartments.push(employeeDept);
                    }
                    
                    // 使用部门关键词映射查找适用的规则部门
                    if (employeeDept) {
                        for (const ruleDept in departmentKeywords) {
                            const keywords = departmentKeywords[ruleDept];
                            if (keywords.some(keyword => employeeDept.includes(keyword))) {
                                applicableDepartments.push(ruleDept);
                            }
                        }
                    }
                    
                    // 去重
                    applicableDepartments = [...new Set(applicableDepartments)];
                    
                    // 只检查员工所在部门的规则
                    for (const dept of applicableDepartments) {
                        if (specialShiftRules[dept]) {
                            for (const ruleName in specialShiftRules[dept]) {
                                const rule = specialShiftRules[dept][ruleName];
                                
                                // 检查是否匹配当前班次（使用标准化后的代码）
                                if (rule.shiftCode === normalizedShiftCode) {
                                    // 检查是否是特定日期
                                    if (rule.isWeekendOnly && !isWeekend) {
                                        allowed = false;
                                        break;
                                    }
                                    if (rule.isSaturdayOnly && dayOfWeek !== 6) {
                                        allowed = false;
                                        break;
                                    }
                                    
                                    // 检查连续排班限制
                                    if (rule.continuousDays && recentShifts) {
                                        // 检查最近N天是否已经连续排了该班次
                                        let consecutiveCount = 0;
                                        for (let i = recentShifts.length - 1; i >= 0; i--) {
                                            const recentShiftNormalized = shiftNameToCodeMap[recentShifts[i]] || recentShifts[i];
                                            if (recentShiftNormalized === normalizedShiftCode) {
                                                consecutiveCount++;
                                            } else {
                                                break;
                                            }
                                        }
                                        
                                        if (consecutiveCount >= rule.continuousDays) {
                                            allowed = false;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (!allowed) break;
                        }
                    }
                    
                    return allowed;
                };
                
                // 过滤掉不符合连续排班规则的班次
                validShiftOrderInfo = validShiftOrderInfo.filter(info => 
                    isContinuousShiftAllowed(info.shiftCode)
                );
                
                if (validShiftOrderInfo.length === 0) {
                    console.warn(`没有符合连续排班规则的班次:`, {
                        employeeNumber: employee.number,
                        employeeName: employee.name
                    });
                    return '';
                }
                
                // 为每个班次添加员工排序信息
                validShiftOrderInfo = validShiftOrderInfo.map(info => ({
                    ...info,
                    // 添加员工排名信息（从1开始）
                    rank: info.employeeIndex + 1,
                    // 是否第一位
                    isFirst: info.employeeIndex === 0,
                    // 是否最后一位
                    isLast: info.employeeIndex === info.totalEmployees - 1,
                    // 排名百分比（用于比较）
                    rankPercentage: info.totalEmployees > 0 ? info.employeeIndex / info.totalEmployees : 1
                }));
                

                
                const bestShift = validShiftOrderInfo[0];
                
                // 记录排班选择的详细信息，包含员工排序位置
                console.log(`员工 ${employee.number}(${employee.name}) 选择最佳班次:`, bestShift.shiftCode, 
                          `(在班次中的排名: ${bestShift.rank}/${bestShift.totalEmployees}, ${bestShift.isFirst ? '首位' : bestShift.isLast ? '末位' : '中间位次'})`);
                
                // 记录排班选择的详细信息
                console.log(`排班选择详情 - 班次综合排序:`);
                validShiftOrderInfo.forEach((shift, index) => {
                    const shiftObj = window.shiftDataCache.find(s => s.code === shift.shiftCode);
                    const priority = shiftObj ? shiftObj.priority : '未知';
                    console.log(`  ${index + 1}. ${shift.shiftCode} (优先级: ${priority}, 员工排名: ${shift.rank}/${shift.totalEmployees})`);
                });
                
                return bestShift.shiftCode;
            } else {
                console.warn('没有找到合适的非休班次或所有班次优先级为0:', {
                    employeeNumber: employee.number,
                    employeeName: employee.name,
                    availableShiftsCount: shiftOrderInfo.length
                });
                // 不使用随机或默认逻辑，严格按照排班顺序
                return '';
            }
        } catch (error) {
            console.error('选择班次失败:', error);
            console.error('错误时的上下文信息:', {
                employeeNumber: employee.number,
                employeeName: employee.name,
                shiftOrderInfoCount: shiftOrderInfo ? shiftOrderInfo.length : 0
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
            
            // 确保每次都从数据库获取最新数据，不使用内存缓存
            console.log(`正在从数据库获取${year}年${month}月的排班数据...`);
            
            // 获取所有排班计划
            let schedules;
            try {
                // 强制从数据库重新读取，不使用缓存
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
            
            // 查找所有匹配年份和月份的排班计划
            const matchingSchedules = schedules.filter(schedule => 
                schedule.year === year && 
                schedule.month === month
            );
            
            if (!matchingSchedules || matchingSchedules.length === 0) {
                console.log(`未找到${year}年${month}月的排班数据`);
                return null;
            }
            
            console.log(`成功获取${year}年${month}月的排班数据，共找到${matchingSchedules.length}个排班计划`);
            
            // 合并所有排班计划的数据
            let mergedScheduleData = {};
            matchingSchedules.forEach(schedule => {
                if (schedule.scheduleData && typeof schedule.scheduleData === 'object') {
                    // 将每个排班计划的数据合并到结果中
                    mergedScheduleData = { ...mergedScheduleData, ...schedule.scheduleData };
                }
            });
            
            // 创建一个包含合并数据的新排班计划对象
            const matchingSchedule = {
                ...matchingSchedules[0], // 使用第一个计划的基本信息
                scheduleData: mergedScheduleData // 替换为合并后的数据
            };
            
            console.log(`合并后的排班数据包含${Object.keys(mergedScheduleData).length}个员工的数据`);
            
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
            // 创建一个新对象，使用规范化后的员工号作为键
            const fixedScheduleData = {};
            
            // 遍历原始排班数据中的所有员工
            Object.keys(matchingSchedule.scheduleData).forEach(employeeNumber => {
                const employeeSchedule = matchingSchedule.scheduleData[employeeNumber];
                
                // 规范化员工号作为新对象的键
                const normalizedKey = normalizeId(employeeNumber);
                
                // 创建新的员工排班数据对象
                const updatedEmployeeSchedule = { ...employeeSchedule };
                
                // 规范化员工号存储
                updatedEmployeeSchedule.employeeNumber = employeeNumber;
                
                // 修复部门信息
                // 优先使用排班数据中已有的部门信息
                if (!updatedEmployeeSchedule.department || updatedEmployeeSchedule.department.trim() === '') {
                    // 如果排班数据中没有部门信息，尝试从员工数据中获取
                    const employee = employeeMap.get(normalizeId(employeeNumber));
                    if (employee) {
                        // 优先使用员工对象中的deptName字段（根据系统数据结构这是最准确的部门信息字段）
                        if (employee.deptName && employee.deptName.trim() !== '') {
                            updatedEmployeeSchedule.department = employee.deptName.trim();
                        } else {
                            // 如果deptName为空，再尝试其他可能的字段
                            updatedEmployeeSchedule.department = (employee.department || employee.dept || '未知部门').trim();
                        }
                    } else {
                        // 如果没有找到对应的员工数据，记录日志以便排查
                        console.log(`未找到员工号为 ${employeeNumber} 的员工数据，无法确定部门信息`);
                        updatedEmployeeSchedule.department = '未知部门';
                    }
                }
                
                // 将更新后的员工排班数据添加到新对象中，使用规范化后的键
            fixedScheduleData[normalizedKey] = updatedEmployeeSchedule;
        });
        
        // 添加详细日志，验证返回的排班数据
            const scheduleDataInfo = {
                totalEmployees: Object.keys(fixedScheduleData).length,
                sampleKeys: Object.keys(fixedScheduleData).slice(0, 5) // 显示前5个键
            };
            console.log(`getScheduleByMonth返回的排班数据结构:`, scheduleDataInfo);
            

            
            
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