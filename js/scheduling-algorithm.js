/**
 * 排班算法模块
 * 负责处理排班算法的核心逻辑
 */
class SchedulingAlgorithm {
    constructor() {
        // 初始化所需的引用
        this.shiftManager = window.shiftManager;
        this.shiftOrderManager = window.shiftOrderManager;
        // 缓存上个月的排班信息，用于跨月连续排班
        this.lastMonthAssignments = {};
        // 缓存所有在排班顺序中出现的员工号
        this.employeesInShiftOrders = new Set();
    }

    // 初始化所有在排班顺序中出现的员工集合
    async initializeEmployeesInShiftOrders(activeShifts, organization, department) {
        try {
            console.log('开始初始化排班顺序中出现的员工集合');
            this.employeesInShiftOrders.clear();
            
            // 遍历所有活动班次
            for (const shiftCode of activeShifts) {
                // 跳过休班
                if (shiftCode === '休') continue;
                
                // 获取该班次在各岗位的员工顺序
                const shiftOrdersByPosition = await this.getShiftOrdersByPositionAndShift(shiftCode, organization, department);
                
                // 遍历所有岗位的员工顺序
                for (const position in shiftOrdersByPosition) {
                    if (shiftOrdersByPosition.hasOwnProperty(position)) {
                        const employeeNumbers = shiftOrdersByPosition[position];
                        // 将员工号添加到集合中
                        employeeNumbers.forEach(empNumber => {
                            this.employeesInShiftOrders.add(String(empNumber));
                        });
                    }
                }
            }
            
            console.log(`已初始化排班顺序中出现的员工集合，共 ${this.employeesInShiftOrders.size} 人`);
            return true;
        } catch (error) {
            console.error('初始化排班顺序中出现的员工集合失败:', error);
            return false;
        }
    }

    // 检查员工是否在排班顺序中出现
    isEmployeeInShiftOrders(employeeNumber) {
        return this.employeesInShiftOrders.has(String(employeeNumber));
    }

    // 自动分配休息日
    assignRestDays(scheduleResult, currentMonthDates) {
        try {
            console.log('开始自动分配休息日');
            
            // 遍历每个员工
            for (const empNumber in scheduleResult) {
                // 检查员工是否在排班顺序中出现，如果不在，则不分配任何休息日
                if (!this.isEmployeeInShiftOrders(empNumber)) {
                    console.log(`员工 ${empNumber} 未在排班顺序中出现，不分配任何休息日`);
                    continue;
                }
                
                const employeeSchedule = scheduleResult[empNumber].schedule;
                
                // 记录员工已排班的日期和对应的班次
                const scheduledDates = new Map();
                employeeSchedule.forEach(item => {
                    const dateKey = `${new Date(item.date).getFullYear()}-${String(new Date(item.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(item.date).getDate()).padStart(2, '0')}`;
                    scheduledDates.set(dateKey, item.shiftCode);
                });
                
                // 遍历当月所有日期
                currentMonthDates.forEach(day => {
                    const date = new Date(day.date);
                    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    
                    // 如果这一天还没有排班
                    if (!scheduledDates.has(dateKey)) {
                        let shouldAssignRest = false;
                        
                        // 情况1：处理周末休息
                        if (day.isWeekend) {
                            // 检查本周末是否有被安排特殊班次
                            const isThisDayFree = !scheduledDates.has(dateKey);
                            
                            // 对于周六
                            if (date.getDay() === 6) { // 6表示周六
                                // 检查周六当天是否被安排了特殊班次
                                shouldAssignRest = isThisDayFree;
                            }
                            // 对于周日
                            else if (date.getDay() === 0) { // 0表示周日
                                // 获取前一天（周六）的日期
                                const saturdayDate = new Date(date);
                                saturdayDate.setDate(saturdayDate.getDate() - 1);
                                const saturdayKey = `${saturdayDate.getFullYear()}-${String(saturdayDate.getMonth() + 1).padStart(2, '0')}-${String(saturdayDate.getDate()).padStart(2, '0')}`;
                                
                                // 检查前一天（周六）是否值G值-C班
                                const isSaturdayGZhiC = scheduledDates.has(saturdayKey) && scheduledDates.get(saturdayKey) === 'G值-C';
                                
                                if (isSaturdayGZhiC) {
                                    // 如果周六值G值-C班，那么周日休息
                                    shouldAssignRest = true;
                                } else {
                                    // 否则检查周日当天是否被安排了特殊班次
                                    shouldAssignRest = isThisDayFree;
                                }
                            }
                        }
                        
                        // 分配休息日
                        if (shouldAssignRest) {
                            employeeSchedule.push({
                                date: day.date,
                                day: day.day,
                                shiftCode: '休',
                                isWeekend: day.isWeekend,
                                position: scheduleResult[empNumber].position
                            });
                            
                            // 将新分配的日期添加到已排班集合中
                            scheduledDates.set(dateKey, '休');
                        }
                    }
                });
                
                // 重新排序，确保日期顺序正确
                employeeSchedule.sort((a, b) => {
                    return new Date(a.date) - new Date(b.date);
                });
            }
            
            console.log('休息日自动分配完成');
        } catch (error) {
            console.error('自动分配休息日失败:', error);
        }
    }

    // 统一调休函数 - 整合所有调休规则
    assignAllRestDays(scheduleResult, currentMonthDates) {
        try {
            console.log('开始统一分配所有休息日和调休日');
            
            // 1. 基础休息日分配（周末休息）
            this.assignBaseRestDays(scheduleResult, currentMonthDates);
            
            // 2. Y16综班次调休处理
            this.handleY16RestRules(scheduleResult, currentMonthDates);
            
            // 3. G值相关班次调休处理
            this.handleGZhiRestRules(scheduleResult, currentMonthDates);
            
            // 4. 连续工作天数检查和调休优化
            this.checkAndOptimizeConsecutiveWork(scheduleResult, currentMonthDates);
            
            console.log('所有休息日和调休日分配完成');
        } catch (error) {
            console.error('统一分配休息日和调休日失败:', error);
        }
    }
    
    // 基础休息日分配（周末休息）
    assignBaseRestDays(scheduleResult, currentMonthDates) {
        try {
            console.log('开始分配基础休息日');
            
            // 遍历每个员工
            for (const empNumber in scheduleResult) {
                // 检查员工是否在排班顺序中出现
                if (!this.isEmployeeInShiftOrders(empNumber)) {
                    console.log(`员工 ${empNumber} 未在排班顺序中出现，不安排Y16综调休`);
                    continue;
                }
                
                const employeeSchedule = scheduleResult[empNumber].schedule;
                
                // 记录员工已排班的日期和对应的班次
                const scheduledDates = new Map();
                employeeSchedule.forEach(item => {
                    const dateKey = `${new Date(item.date).getFullYear()}-${String(new Date(item.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(item.date).getDate()).padStart(2, '0')}`;
                    scheduledDates.set(dateKey, item.shiftCode);
                });
                
                // 找出员工所有Y16综班次的排班日期
                const y16ShiftDates = [];
                employeeSchedule.forEach(item => {
                    if (item.shiftCode === 'Y16综') {
                        y16ShiftDates.push(new Date(item.date));
                    }
                });
                
                // 为每个Y16综班次安排调休
                y16ShiftDates.forEach(shiftDate => {
                    // 1. 检查值Y16综前一周的休息情况
                    const preWeekRestCount = this.getPreWeekRestCount(empNumber, shiftDate, scheduleResult);
                    const needPreRest = preWeekRestCount < 2;
                    
                    // 2. 计算需要安排的休息日期
                    const restDates = this.calculateY16RestDates(shiftDate, needPreRest, currentMonthDates);
                    
                    // 3. 安排休息日
                    restDates.forEach(restDate => {
                        const dateKey = `${restDate.getFullYear()}-${String(restDate.getMonth() + 1).padStart(2, '0')}-${String(restDate.getDate()).padStart(2, '0')}`;
                        
                        // 检查这一天是否已经有排班
                        if (!scheduledDates.has(dateKey)) {
                            // 查找对应的day数据
                            const dayData = currentMonthDates.find(day => {
                                const dayDate = new Date(day.date);
                                return dayDate.getDate() === restDate.getDate() && 
                                       dayDate.getMonth() === restDate.getMonth() && 
                                       dayDate.getFullYear() === restDate.getFullYear();
                            });
                            
                            if (dayData) {
                                employeeSchedule.push({
                                    date: dayData.date,
                                    day: dayData.day,
                                    shiftCode: '休',
                                    isWeekend: dayData.isWeekend,
                                    position: scheduleResult[empNumber].position
                                });
                                
                                // 将新分配的日期添加到已排班集合中
                                scheduledDates.set(dateKey, '休');
                                
                                console.log(`为员工 ${empNumber} 安排Y16综调休日: ${dateKey}`);
                            }
                        }
                    });
                });
                
                // 重新排序，确保日期顺序正确
                employeeSchedule.sort((a, b) => {
                    return new Date(a.date) - new Date(b.date);
                });
            }
            
            console.log('Y16综班次调休安排完成');
        } catch (error) {
            console.error('为Y16综班次安排调休失败:', error);
        }
    }

    // 检查员工在前一周的休息天数
    getPreWeekRestCount(empNumber, shiftDate, scheduleResult) {
        try {
            const employeeSchedule = scheduleResult[empNumber].schedule;
            let restCount = 0;
            
            // 计算前一周的开始和结束日期
            const preWeekStart = new Date(shiftDate);
            preWeekStart.setDate(preWeekStart.getDate() - 7);
            const preWeekEnd = new Date(shiftDate);
            preWeekEnd.setDate(preWeekEnd.getDate() - 1);
            
            // 检查前一周的休息天数
            employeeSchedule.forEach(item => {
                const itemDate = new Date(item.date);
                if (item.shiftCode === '休' && itemDate >= preWeekStart && itemDate <= preWeekEnd) {
                    restCount++;
                }
            });
            
            // 特别检查：值Y16综前的那一个周末（周六和周日）是否是双休
            // 计算前一个周末的周六和周日
            const shiftDateObj = new Date(shiftDate);
            const dayOfWeek = shiftDateObj.getDay(); // 0表示周日，1-6表示周一到周六
            
            // 找到前一个周六
            let prevSaturday = new Date(shiftDateObj);
            prevSaturday.setDate(prevSaturday.getDate() - (dayOfWeek === 0 ? 1 : dayOfWeek + 1));
            
            // 找到前一个周日
            let prevSunday = new Date(prevSaturday);
            prevSunday.setDate(prevSunday.getDate() + 1);
            
            // 检查前一个周六和周日是否都安排了休息
            let isWeekendDoubleRest = false;
            const saturdayKey = `${prevSaturday.getFullYear()}-${String(prevSaturday.getMonth() + 1).padStart(2, '0')}-${String(prevSaturday.getDate()).padStart(2, '0')}`;
            const sundayKey = `${prevSunday.getFullYear()}-${String(prevSunday.getMonth() + 1).padStart(2, '0')}-${String(prevSunday.getDate()).padStart(2, '0')}`;
            
            const isSaturdayRest = employeeSchedule.some(item => {
                const itemDate = new Date(item.date);
                const itemDateKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
                return itemDateKey === saturdayKey && item.shiftCode === '休';
            });
            
            const isSundayRest = employeeSchedule.some(item => {
                const itemDate = new Date(item.date);
                const itemDateKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
                return itemDateKey === sundayKey && item.shiftCode === '休';
            });
            
            isWeekendDoubleRest = isSaturdayRest && isSundayRest;
            
            // 如果前一个周末是双休，即使前一周总休息天数不足2天，也视为已满足休息要求（返回2）
            if (isWeekendDoubleRest) {
                console.log(`员工 ${empNumber} 值Y16综前的周末是双休，视为已满足休息要求`);
                return 2;
            }
            
            console.log(`员工 ${empNumber} 在Y16综班次前一周休息了 ${restCount} 天`);
            return restCount;
        } catch (error) {
            console.error('计算前一周休息天数失败:', error);
            return 0;
        }
    }

    // Y16综班次调休处理
            handleY16RestRules(scheduleResult, currentMonthDates) {
                try {
                    console.log('开始处理Y16综班次调休规则');
                    
                    // 遍历每个员工
                    for (const empNumber in scheduleResult) {
                        // 检查员工是否在排班顺序中出现
                        if (!this.isEmployeeInShiftOrders(empNumber)) {
                            console.log(`员工 ${empNumber} 未在排班顺序中出现，不分配Y16综调休`);
                            continue;
                        }
                        
                        const employeeSchedule = scheduleResult[empNumber].schedule;
                        
                        // 记录员工已排班的日期和对应的班次
                        const scheduledDates = new Map();
                        employeeSchedule.forEach(item => {
                            const dateKey = `${new Date(item.date).getFullYear()}-${String(new Date(item.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(item.date).getDate()).padStart(2, '0')}`;
                            scheduledDates.set(dateKey, item.shiftCode);
                        });
                        
                        // 查找员工所有Y16综班次
                        const y16Shifts = employeeSchedule.filter(item => item.shiftCode === 'Y16综');
                        
                        // 为每个Y16综班次安排调休
                        for (const y16Shift of y16Shifts) {
                            const shiftDate = new Date(y16Shift.date);
                            
                            // 检查员工在前一周的休息天数
                            const restCount = this.getPreWeekRestCount(empNumber, shiftDate, scheduleResult);
                            
                            // 如果前一周休息天数少于2天，需要额外安排前一天休息
                            const needPreRest = restCount < 2;
                            
                            // 计算Y16综班次需要的休息日期
                            const restDates = this.calculateY16RestDates(shiftDate, needPreRest, currentMonthDates);
                            
                            // 为每个休息日期安排调休
                            for (const restDate of restDates) {
                                // 格式化休息日期为key
                                const restDateKey = `${restDate.getFullYear()}-${String(restDate.getMonth() + 1).padStart(2, '0')}-${String(restDate.getDate()).padStart(2, '0')}`;
                                
                                // 检查这个日期是否已经被安排了班次（避免重复安排）
                                if (!scheduledDates.has(restDateKey)) {
                                    // 查找对应的dayData
                                    const dayData = currentMonthDates.find(day => {
                                        const dayDate = new Date(day.date);
                                        return dayDate.getDate() === restDate.getDate() && 
                                               dayDate.getMonth() === restDate.getMonth() && 
                                               dayDate.getFullYear() === restDate.getFullYear();
                                    });
                                    
                                    if (dayData) {
                                        employeeSchedule.push({
                                            date: dayData.date,
                                            day: dayData.day,
                                            shiftCode: '休',
                                            isWeekend: dayData.isWeekend,
                                            position: scheduleResult[empNumber].position
                                        });
                                        
                                        // 将新分配的日期添加到已排班集合中
                                        scheduledDates.set(restDateKey, '休');
                                        
                                        console.log(`为员工 ${empNumber} 安排Y16综调休日: ${restDateKey}`);
                                    }
                                }
                            }
                        }
                        
                        // 重新排序，确保日期顺序正确
                        employeeSchedule.sort((a, b) => {
                            return new Date(a.date) - new Date(b.date);
                        });
                    }
                    
                    console.log('Y16综班次调休处理完成');
                } catch (error) {
                    console.error('处理Y16综班次调休规则失败:', error);
                }
            }
            
            // 计算Y16综班次需要的休息日期
            calculateY16RestDates(shiftDate, needPreRest, currentMonthDates) {
                try {
                    const restDates = [];
                    
                    // 1. 优先保证值完Y16综后休两天（无论前一周休息了多少天）
                    // 第一天休息（值完Y16综的第二天）
                    const postRestDate1 = new Date(shiftDate);
                    postRestDate1.setDate(postRestDate1.getDate() + 1);
                    
                    // 第二天休息（值完Y16综的第三天）
                    const postRestDate2 = new Date(shiftDate);
                    postRestDate2.setDate(postRestDate2.getDate() + 2);
                    
                    // 检查第一天是否在当月
                    const isInCurrentMonth1 = currentMonthDates.some(day => {
                        const dayDate = new Date(day.date);
                        return dayDate.getDate() === postRestDate1.getDate() && 
                               dayDate.getMonth() === postRestDate1.getMonth() && 
                               dayDate.getFullYear() === postRestDate1.getFullYear();
                    });
                    
                    // 检查第二天是否在当月
                    const isInCurrentMonth2 = currentMonthDates.some(day => {
                        const dayDate = new Date(day.date);
                        return dayDate.getDate() === postRestDate2.getDate() && 
                               dayDate.getMonth() === postRestDate2.getMonth() && 
                               dayDate.getFullYear() === postRestDate2.getFullYear();
                    });
                    
                    if (isInCurrentMonth1) {
                        restDates.push(postRestDate1);
                        console.log(`安排Y16综后必须休息1天: ${postRestDate1.toISOString().split('T')[0]}`);
                    }
                    
                    if (isInCurrentMonth2) {
                        restDates.push(postRestDate2);
                        console.log(`安排Y16综后必须休息2天: ${postRestDate2.toISOString().split('T')[0]}`);
                    }
                    
                    // 2. 额外处理：如果前一周只休了一天，再安排值班前1天的休息
                    if (needPreRest) {
                        const preRestDate = new Date(shiftDate);
                        preRestDate.setDate(preRestDate.getDate() - 1);
                        
                        // 检查这一天是否在当月
                        const isPreRestInCurrentMonth = currentMonthDates.some(day => {
                            const dayDate = new Date(day.date);
                            return dayDate.getDate() === preRestDate.getDate() && 
                                   dayDate.getMonth() === preRestDate.getMonth() && 
                                   dayDate.getFullYear() === preRestDate.getFullYear();
                        });
                        
                        if (isPreRestInCurrentMonth) {
                            // 检查这个日期是否已经被安排为休息（避免重复安排）
                            const isAlreadyScheduled = restDates.some(date => {
                                return date.getDate() === preRestDate.getDate() && 
                                       date.getMonth() === preRestDate.getMonth() && 
                                       date.getFullYear() === preRestDate.getFullYear();
                            });
                            
                            if (!isAlreadyScheduled) {
                                restDates.push(preRestDate);
                                console.log(`因前一周休息不足，额外安排Y16综前休息: ${preRestDate.toISOString().split('T')[0]}`);
                            }
                        }
                    }
                    
                    return restDates;
                } catch (error) {
                    console.error('计算Y16综休息日期失败:', error);
                    return [];
                }
            }
            
            // G值相关班次调休处理
            handleGZhiRestRules(scheduleResult, currentMonthDates) {
                try {
                    console.log('开始处理G值相关班次调休规则');
                    
                    // G值-C班次的特殊调休规则已经在基础休息日分配中处理
                    // 此处可以添加其他G值相关班次的调休规则
                    
                    console.log('G值相关班次调休处理完成');
                } catch (error) {
                    console.error('处理G值相关班次调休规则失败:', error);
                }
            }
            
            // 连续工作天数检查和调休优化
            checkAndOptimizeConsecutiveWork(scheduleResult, currentMonthDates) {
                try {
                    console.log('开始检查连续工作天数并优化调休');
                    
                    for (const empNumber in scheduleResult) {
                        // 检查员工是否在排班顺序中出现
                        if (!this.isEmployeeInShiftOrders(empNumber)) {
                            console.log(`员工 ${empNumber} 未在排班顺序中出现，跳过连续工作检查`);
                            continue;
                        }
                        
                        const employeeSchedule = scheduleResult[empNumber].schedule;
                        
                        // 检查连续工作天数
                        const consecutiveInfo = this.checkConsecutiveWorkDays(empNumber, employeeSchedule, currentMonthDates);
                        
                        // 如果连续工作超过7天，安排额外调休
                        if (consecutiveInfo.maxConsecutiveDays > 7) {
                            console.log(`员工 ${empNumber} 存在超过7天的连续工作区间，最长: ${consecutiveInfo.maxConsecutiveDays}天`);
                            this.handleConsecutiveWorkExceeding7Days(empNumber, employeeSchedule, consecutiveInfo.problemRanges, currentMonthDates);
                        }
                    }
                    
                    console.log('连续工作天数检查和调休优化完成');
                } catch (error) {
                    console.error('检查连续工作天数并优化调休失败:', error);
                }
            }
            
            // 检查连续工作天数
            checkConsecutiveWorkDays(empNumber, employeeSchedule, currentMonthDates) {
                try {
                    // 排序员工的排班记录
                    const sortedSchedule = [...employeeSchedule].sort((a, b) => {
                        return new Date(a.date) - new Date(b.date);
                    });
                    
                    let maxConsecutiveDays = 0;
                    let currentConsecutiveDays = 0;
                    let problemRanges = [];
                    let currentRangeStart = null;
                    
                    // 创建日期到班次的映射
                    const dateToShiftMap = new Map();
                    sortedSchedule.forEach(item => {
                        const dateKey = `${new Date(item.date).getFullYear()}-${String(new Date(item.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(item.date).getDate()).padStart(2, '0')}`;
                        dateToShiftMap.set(dateKey, item.shiftCode);
                    });
                    
                    // 遍历当月所有日期
                    for (let i = 0; i < currentMonthDates.length; i++) {
                        const day = currentMonthDates[i];
                        const date = new Date(day.date);
                        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        
                        // 获取当天的班次
                        const shiftCode = dateToShiftMap.get(dateKey);
                        
                        // 如果当天没有排班或者是休息日，重置连续工作天数
                        if (!shiftCode || shiftCode === '休') {
                            if (currentConsecutiveDays > 7) {
                                problemRanges.push({
                                    start: currentRangeStart,
                                    end: currentMonthDates[i-1],
                                    days: currentConsecutiveDays
                                });
                            }
                            currentConsecutiveDays = 0;
                            currentRangeStart = null;
                        } else {
                            // 如果当天有排班且不是休息日，增加连续工作天数
                            if (currentConsecutiveDays === 0) {
                                currentRangeStart = day;
                            }
                            currentConsecutiveDays++;
                            maxConsecutiveDays = Math.max(maxConsecutiveDays, currentConsecutiveDays);
                        }
                    }
                    
                    // 检查最后一个连续工作区间
                    if (currentConsecutiveDays > 7) {
                        problemRanges.push({
                            start: currentRangeStart,
                            end: currentMonthDates[currentMonthDates.length-1],
                            days: currentConsecutiveDays
                        });
                    }
                    
                    return {
                        maxConsecutiveDays: maxConsecutiveDays,
                        problemRanges: problemRanges
                    };
                } catch (error) {
                    console.error('检查连续工作天数失败:', error);
                    return {
                        maxConsecutiveDays: 0,
                        problemRanges: []
                    };
                }
            }
            
            // 处理连续工作超过7天的情况，安排额外调休
            handleConsecutiveWorkExceeding7Days(empNumber, employeeSchedule, problemRanges, currentMonthDates) {
                try {
                    console.log(`为员工 ${empNumber} 处理连续工作超过7天的情况`);
                    
                    // 创建日期到班次的映射
                    const dateToShiftMap = new Map();
                    employeeSchedule.forEach(item => {
                        const dateKey = `${new Date(item.date).getFullYear()}-${String(new Date(item.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(item.date).getDate()).padStart(2, '0')}`;
                        dateToShiftMap.set(dateKey, item.shiftCode);
                    });
                    
                    // 为每个问题区间安排调休
                    for (const range of problemRanges) {
                        // 计算需要安排的调休天数
                        const extraRestDaysNeeded = Math.ceil(range.days / 7) - 1; // 每7天需要1天调休
                        
                        console.log(`问题区间: ${range.start.day}日-${range.end.day}日 (${range.days}天)，需要安排 ${extraRestDaysNeeded} 天额外调休`);
                        
                        let assignedRestDays = 0;
                        
                        // 尝试在问题区间内安排调休，优先选择非周末的日期
                        for (let i = 1; i < range.days - 1; i++) { // 避开区间的第一天和最后一天
                            const currentIndex = currentMonthDates.findIndex(day => day.day === range.start.day);
                            if (currentIndex === -1) break;
                            
                            const targetDate = currentMonthDates[currentIndex + i];
                            if (!targetDate) break;
                            
                            // 如果是周末，跳过（周末通常已经是休息日）
                            if (targetDate.isWeekend) continue;
                            
                            const targetDateKey = `${new Date(targetDate.date).getFullYear()}-${String(new Date(targetDate.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(targetDate.date).getDate()).padStart(2, '0')}`;
                            
                            // 检查这一天是否已经安排了班次
                            if (dateToShiftMap.has(targetDateKey) && dateToShiftMap.get(targetDateKey) !== '休') {
                                // 将原班次改为调休
                                const existingShiftIndex = employeeSchedule.findIndex(item => {
                                    const itemDate = new Date(item.date);
                                    return itemDate.getDate() === new Date(targetDate.date).getDate() && 
                                           itemDate.getMonth() === new Date(targetDate.date).getMonth() && 
                                           itemDate.getFullYear() === new Date(targetDate.date).getFullYear();
                                });
                                
                                if (existingShiftIndex !== -1) {
                                    employeeSchedule[existingShiftIndex].shiftCode = '休';
                                    dateToShiftMap.set(targetDateKey, '休');
                                    assignedRestDays++;
                                    
                                    console.log(`为员工 ${empNumber} 在连续工作区间中安排调休: ${targetDateKey}`);
                                    
                                    // 如果已经安排了足够的调休天数，停止
                                    if (assignedRestDays >= extraRestDaysNeeded) {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    // 重新排序，确保日期顺序正确
                    employeeSchedule.sort((a, b) => {
                        return new Date(a.date) - new Date(b.date);
                    });
                } catch (error) {
                    console.error('处理连续工作超过7天的情况失败:', error);
                }
            }

    // 通用排班算法主方法
    async applyGeneralSchedulingAlgorithm(employees, activeShifts, calendarData, lastMonthSchedule, organization, department, position) {
        try {
            console.log('通用排班算法开始执行，参数:', { activeShifts, employeeCount: employees.length });
            
            // 初始化在排班顺序中出现的员工集合
            await this.initializeEmployeesInShiftOrders(activeShifts, organization, department);
            
            // 结果对象，按员工号组织
            const scheduleResult = {};

            // 初始化每个员工的排班数据
            for (let i = 0; i < employees.length; i++) {
                const employee = employees[i];
                const deptInfo = employee.deptName || employee.department || employee.dept || '未知部门';
                scheduleResult[employee.number] = {
                    employeeNumber: employee.number,
                    employeeName: employee.name,
                    department: deptInfo,
                    position: employee.position,
                    schedule: []
                };
            }

            // 记录每个员工的排班计数
            const shiftCounts = {};
            // 记录员工是否已被分配班次
            const assignedEmployees = new Set();
            
            // 初始化员工相关数据结构
            for (let j = 0; j < employees.length; j++) {
                const emp = employees[j];
                shiftCounts[emp.number] = {};
                
                // 初始化所有启用班次的计数
                activeShifts.forEach(shift => {
                    shiftCounts[emp.number][shift] = 0;
                });
            }

            // 获取上个月的排班情况
            this.lastMonthAssignments = this.getLastMonthAssignments(lastMonthSchedule, employees);

            // 按班次优先级排序（优先处理重要班次）
            const sortedShifts = await this.sortShiftsByPriority(activeShifts);
            
            console.log('所有班次按优先级排序结果:', sortedShifts);
            
            // 创建当月日期数组（只包含当月日期）
            const currentMonthDates = calendarData.filter(day => day.isCurrentMonth);
            
            // 遍历所有班次（按优先级）
            for (let s = 0; s < sortedShifts.length; s++) {
                const currentShift = sortedShifts[s];
                
                // 跳过休班，它会在最后自动分配
                if (currentShift === '休') continue;
                
                console.log(`开始处理班次: ${currentShift}`);
                
                // 构建该班次的日期上下文
                const dateContext = {
                    isSingleDay: false, 
                    dateRange: currentMonthDates,
                    currentMonthDates: currentMonthDates,
                    startDateIndex: 0 
                };
                
                // 调用改进的通用排班流程
                const assignedCount = await this.applyEnhancedSchedulingProcess(
                    currentShift, 
                    employees, 
                    scheduleResult, 
                    shiftCounts, 
                    assignedEmployees,
                    dateContext,
                    organization,
                    department
                );
                
                console.log(`班次 ${currentShift} 排班完成，已分配 ${assignedCount} 人`);
                
                // 特殊处理：当处理完Y16综班次后，将在统一调休函数中处理
            // Y16综班次的调休逻辑已经整合到assignAllRestDays函数中
            }
             
            // 对每个员工的排班进行排序
            for (const empNumber in scheduleResult) {
                scheduleResult[empNumber].schedule.sort((a, b) => {
                    return new Date(a.date) - new Date(b.date);
                });
            }

            // 使用统一调休函数分配所有休息日和调休日
            this.assignAllRestDays(scheduleResult, currentMonthDates);

            return scheduleResult;
        } catch (error) {
            console.error('通用排班算法执行失败:', error);
            throw error;
        }
    }

    // 改进的通用排班流程
    async applyEnhancedSchedulingProcess(shiftCode, employees, scheduleResult, shiftCounts, assignedEmployees, dateContext, organization, department) {
        try {
            console.log(`开始执行${shiftCode}班次的排班流程`);
            
            // 统计已分配的人数
            let assignedCount = 0;
            
            // 创建员工映射，方便快速查找
            const employeeMap = new Map();
            for (const employee of employees) {
                employeeMap.set(String(employee.number), employee);
            }
            
            // 获取该班次在各岗位的员工顺序（从数据库获取）
            const shiftOrdersByPosition = await this.getShiftOrdersByPositionAndShift(shiftCode, organization, department);
            
            if (!shiftOrdersByPosition || Object.keys(shiftOrdersByPosition).length === 0) {
                console.log(`没有找到班次 ${shiftCode} 的岗位和人员配置，跳过`);
                return 0;
            }
            
            // 记录岗位人员顺序映射关系，用于匹配排班表格
            console.log(`班次 ${shiftCode} 的岗位人员顺序映射关系:`);
            for (const [position, employeeNumbers] of Object.entries(shiftOrdersByPosition)) {
                console.log(`  ${position}: ${employeeNumbers.join(', ')}`);
            }
            
            // 遍历该班次的所有岗位
            for (const position in shiftOrdersByPosition) {
                if (shiftOrdersByPosition.hasOwnProperty(position)) {
                    console.log(`处理${shiftCode}班次的${position}岗位`);
                    
                    // 获取该岗位的员工顺序
                    const employeeNumbersInPosition = shiftOrdersByPosition[position];
                    if (!employeeNumbersInPosition || employeeNumbersInPosition.length === 0) {
                        console.log(`岗位 ${position} 没有配置员工，跳过`);
                        continue;
                    }
                    
                    // 验证员工顺序中的员工是否在排班表格中存在
                    const validEmployeeNumbers = [];
                    const missingEmployees = [];
                    
                    for (const empNumber of employeeNumbersInPosition) {
                        const empNumberStr = String(empNumber);
                        if (employeeMap.has(empNumberStr)) {
                            validEmployeeNumbers.push(empNumber);
                        } else {
                            missingEmployees.push(empNumber);
                        }
                    }
                    
                    // 如果有员工不在排班表格中，记录警告
                    if (missingEmployees.length > 0) {
                        console.warn(`警告: 岗位 ${position} 的员工顺序中有 ${missingEmployees.length} 人不在当前排班表格中: ${missingEmployees.join(', ')}`);
                    }
                    
                    // 如果有效员工数量不足，记录警告
                    if (validEmployeeNumbers.length === 0) {
                        console.warn(`警告: 岗位 ${position} 没有有效的员工可以排班`);
                        continue;
                    }
                    
                    // 获取轮换键
                    const rotationKey = this.getRotationKeyForShiftAndPosition(shiftCode, position, dateContext);
                    
                    // 获取上次排班的起始索引（从localStorage获取，支持跨月连续排班）
                    const startIndex = this.getRotationStartIndex(rotationKey);
                    
                    // 获取该班次在该岗位的连值天数
                    const consecutiveDays = this.getConsecutiveDaysRule(shiftCode, position);
                    
                    // 开始排班，使用验证后的员工顺序
                    assignedCount += await this.assignShiftForPosition(
                        shiftCode, 
                        position, 
                        validEmployeeNumbers, 
                        employeeMap, 
                        scheduleResult, 
                        shiftCounts, 
                        assignedEmployees,
                        dateContext, 
                        consecutiveDays,
                        startIndex,
                        rotationKey
                    );
                }
            }
            
            console.log(`班次 ${shiftCode} 排班流程完成，已分配 ${assignedCount} 人`);
            
            return assignedCount;
        } catch (error) {
            console.error(`排班流程处理${shiftCode}班次失败:`, error);
            return 0;
        }
    }

    // 为指定岗位分配班次
    async assignShiftForPosition(shiftCode, position, employeeNumbersInPosition, employeeMap, scheduleResult, shiftCounts, assignedEmployees, dateContext, consecutiveDays, startIndex, rotationKey) {
        try {
            let assignedCount = 0;
            let attempts = 0;
            let currentIndex = startIndex;
            const totalEmployees = employeeNumbersInPosition.length;
            
            // 获取可排班的日期范围（根据班次特殊规则过滤）
            const availableDates = this.getAvailableDatesForShift(shiftCode, position, dateContext.currentMonthDates);
            
            if (availableDates.length === 0) {
                console.log(`班次 ${shiftCode} 在岗位 ${position} 没有可排班的日期`);
                return 0;
            }
            
            // 计算需要安排的轮次
            const rounds = Math.ceil(availableDates.length / consecutiveDays);
            
            console.log(`班次 ${shiftCode} 在岗位 ${position} 需要安排 ${rounds} 轮，每轮 ${consecutiveDays} 天`);
            console.log(`使用的员工顺序: ${employeeNumbersInPosition.map(num => num).join(', ')}`);
            
            // 开始安排
            let currentDateIndex = 0;
            
            for (let round = 0; round < rounds; round++) {
                attempts = 0;
                let assigned = false;
                
                // 使用总尝试次数的限制，而不是每轮最多尝试totalEmployees次
                // 这样可以让系统在人员不足时从头重新轮换
                let maxAttempts = totalEmployees * 2; // 允许最多尝试2倍员工数量的次数
                while (attempts < maxAttempts && !assigned) {
                    const empNumber = employeeNumbersInPosition[currentIndex];
                    // 确保员工号转换为字符串类型，以便在employeeMap中正确查找
                    const empNumberStr = String(empNumber);
                    const employee = employeeMap.get(empNumberStr);
                    
                    // 再次验证员工是否存在，以防在处理过程中数据发生变化
                    if (!employee) {
                        console.log(`员工号为 ${empNumber} 的员工不在表格中，跳过`);
                        currentIndex = (currentIndex + 1) % totalEmployees;
                        attempts++;
                        continue;
                    }
                    
                    // 检查员工是否在排班顺序中出现
                    if (!this.isEmployeeInShiftOrders(empNumber)) {
                        console.log(`员工 ${employee.number}(${employee.name}) 未在排班顺序中出现，跳过`);
                        currentIndex = (currentIndex + 1) % totalEmployees;
                        attempts++;
                        continue;
                    }
                    
                    // 计算本轮需要排班的日期范围
                    const remainingDays = availableDates.length - currentDateIndex;
                    const actualConsecutiveDays = Math.min(consecutiveDays, remainingDays);
                    const roundDates = availableDates.slice(currentDateIndex, currentDateIndex + actualConsecutiveDays);
                    
                    // 检查员工是否可以安排
                    if (this.canAssignShiftToEmployee(employee, shiftCode, position, roundDates, assignedEmployees, scheduleResult)) {
                        // 分配班次
                        this.assignConsecutiveDaysShift(employee, roundDates, shiftCode, position, scheduleResult, shiftCounts, assignedEmployees);
                        assignedCount++;
                        assigned = true;
                        currentDateIndex += actualConsecutiveDays;
                        
                        // 保存轮换起始索引
                        this.saveRotationStartIndex(rotationKey, (currentIndex + 1) % totalEmployees);
                        
                        console.log(`员工 ${employee.number}(${employee.name}) 被分配${shiftCode}班次${actualConsecutiveDays}天（${roundDates[0].day}日-${roundDates[roundDates.length-1].day}日）`);
                        
                        // 记录排班匹配信息
                        console.log(`排班匹配信息: 班次=${shiftCode}, 岗位=${position}, 员工=${employee.name}(${employee.number}), 顺序位置=${currentIndex+1}/${totalEmployees}`);
                    }
                    
                    currentIndex = (currentIndex + 1) % totalEmployees;
                    attempts++;
                }
                
                // 如果尝试了足够次数仍无法分配，则记录警告但继续尝试下一轮
                if (!assigned) {
                    console.warn(`班次 ${shiftCode} 在岗位 ${position} 的第 ${round+1} 轮暂时无法分配员工，尝试继续下一轮`);
                    // 不中断循环，继续尝试下一轮排班
                }
            }
            
            // 记录岗位排班结果统计
            console.log(`岗位 ${position} 的排班结果: 共分配 ${assignedCount} 人，完成 ${Math.min(currentDateIndex, availableDates.length)} 天的排班，剩余 ${availableDates.length - currentDateIndex} 天未排班`);
            
            return assignedCount;
        } catch (error) {
            console.error(`为岗位 ${position} 分配 ${shiftCode} 班次失败:`, error);
            return 0;
        }
    }

    // 获取班次在各岗位的人员排序（从排班顺序管理数据库获取）
    async getShiftOrdersByPositionAndShift(shiftCode, organization, department) {
        try {
            const shiftOrdersByPosition = {};
            
            console.log(`=== 开始获取班次 ${shiftCode} 的各个岗位人员顺序 ===`);
            console.log(`查询条件: 机构=${organization}, 部门=${department}`);
            
            // 直接从排班顺序管理数据库获取所有岗位（不再从员工数据库获取）
            let allShiftOrders = [];
            try {
                const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
                if (exists) {
                    allShiftOrders = await window.dbManager.getAll('shiftOrders');
                    console.log(`从排班顺序数据库获取到 ${allShiftOrders.length} 条记录`);
                }
            } catch (dbError) {
                console.warn('获取排班顺序数据库失败:', dbError);
            }
            
            // 从排班顺序记录中提取所有岗位
            const positions = new Set();
            if (allShiftOrders.length > 0) {
                allShiftOrders.forEach(order => {
                    if (order && order.position && order.position.trim() && order.shiftCode === shiftCode) {
                        positions.add(order.position.trim());
                    }
                });
            }
            
            // 如果从数据库没有找到岗位，则尝试直接从查询条件获取（全部部门和岗位）
            if (positions.size === 0) {
                console.log('从排班顺序数据库未找到相关岗位，尝试使用默认岗位');
                // 这里可以根据实际需求添加默认岗位或从其他地方获取岗位信息
                positions.add('全部岗位');
            }
            
            const positionArray = Array.from(positions);
            console.log(`找到 ${positionArray.length} 个相关岗位:`, positionArray);
            
            // 提前获取所有员工信息，避免重复查询数据库
            const allEmployees = await window.dbManager.getAll('employees');
            const employeeMap = new Map();
            allEmployees.forEach(emp => {
                employeeMap.set(String(emp.number), emp);
            });
            
            // 遍历所有岗位，获取每个岗位的人员排序
            for (const position of positionArray) {
                console.log(`正在获取岗位 ${position} 的人员顺序`);
                
                const shiftOrder = await this.shiftOrderManager.getShiftOrderByPositionAndShift(
                        position, 
                        shiftCode, 
                        department, 
                        organization 
                    );
                
                if (shiftOrder) {
                    // 处理不同的返回情况
                    if (shiftOrder.hasMultipleDepartments && shiftOrder.departmentOrders) {
                        // 处理多部门情况
                        console.log(`岗位 ${position} 包含多个部门的排班顺序记录`);
                        // 创建一个包含所有部门员工号的数组
                        const allEmployeeNumbers = [];
                        shiftOrder.departmentOrders.forEach(deptOrder => {
                            if (deptOrder && deptOrder.employeeNumbers && Array.isArray(deptOrder.employeeNumbers)) {
                                allEmployeeNumbers.push(...deptOrder.employeeNumbers);
                            }
                        });
                        shiftOrdersByPosition[position] = [...new Set(allEmployeeNumbers)]; // 去重
                    } else if (shiftOrder.employeeNumbers && shiftOrder.employeeNumbers.length > 0) {
                        // 普通情况，只有一个部门的员工排序
                        shiftOrdersByPosition[position] = shiftOrder.employeeNumbers;
                    }
                    
                    // 记录详细的人员排序信息到日志
                    const employeeNumbers = shiftOrdersByPosition[position];
                    if (employeeNumbers && employeeNumbers.length > 0) {
                        console.log(`岗位 ${position} 的人员顺序 (共${employeeNumbers.length}人):`);
                        
                        // 遍历人员排序，显示详细信息
                        for (let i = 0; i < employeeNumbers.length; i++) {
                            const empNumber = employeeNumbers[i];
                            const employee = employeeMap.get(String(empNumber));
                            
                            if (employee) {
                                console.log(`  ${i+1}. ${employee.number} - ${employee.name} (${employee.position}, ${employee.deptName || employee.department || '未知部门'})`);
                            } else {
                                console.log(`  ${i+1}. ${empNumber} - 员工信息未找到`);
                            }
                        }
                    } else {
                        console.log(`岗位 ${position} 没有配置人员顺序或人员列表为空`);
                    }
                } else {
                    console.log(`岗位 ${position} 没有配置人员顺序或人员列表为空`);
                }
            }
            
            // 检查是否有班次下的岗位人员顺序
            if (Object.keys(shiftOrdersByPosition).length === 0) {
                console.log(`警告: 未找到班次 ${shiftCode} 的任何岗位人员顺序配置`);
            }
            
            console.log(`=== 班次 ${shiftCode} 的岗位人员顺序获取完成 ===`);
            console.log(`总计找到 ${Object.keys(shiftOrdersByPosition).length} 个有人员配置的岗位`);
            
            // 创建一个包含完整人员信息的排序结果对象，用于调试和匹配排班表格
            const detailedShiftOrders = {};
            for (const [position, employeeNumbers] of Object.entries(shiftOrdersByPosition)) {
                const detailedEmployees = [];
                
                // 为每个员工添加详细信息
                employeeNumbers.forEach((empNumber, index) => {
                    const employee = employeeMap.get(String(empNumber));
                    if (employee) {
                        detailedEmployees.push({
                            order: index + 1,
                            number: empNumber,
                            name: employee.name,
                            position: employee.position,
                            department: employee.deptName || employee.department || '未知部门',
                            status: employee.status
                        });
                    } else {
                        detailedEmployees.push({
                            order: index + 1,
                            number: empNumber,
                            name: '未知员工',
                            position: '未知岗位',
                            department: '未知部门',
                            status: '未知'
                        });
                    }
                });
                
                detailedShiftOrders[position] = detailedEmployees;
            }
            
            // 将详细信息保存到控制台日志，方便调试
            console.log(`班次 ${shiftCode} 的详细岗位人员顺序信息:`, detailedShiftOrders);
            
            return shiftOrdersByPosition;
        } catch (error) {
            console.error(`从数据库获取班次-岗位-人员排序失败:`, error);
            return {};
        }
    }

    // 获取所有适用于该班次的岗位
    // 注意：此函数现在主要用于向后兼容，建议新代码使用直接从排班顺序管理数据库获取岗位的方式
    // getShiftOrdersByPositionAndShift函数已经不再使用此函数
    async getAllPositionsForShift(shiftCode, organization, department) {
        try {
            // 从数据库获取所有员工
            const employees = await window.dbManager.getAll('employees');
            const positions = new Set();
            
            // 筛选在职员工（不再考虑部门匹配）
            const filteredEmployees = employees.filter(emp => {
                // 检查员工是否在职
                const isActive = (typeof emp.status === 'number' && emp.status === 0) || 
                                 (typeof emp.status === 'string' && 
                                  (String(emp.status).toLowerCase().trim() === 'active' || 
                                   String(emp.status).toLowerCase().trim() === '0'));
                
                // 检查员工机构是否匹配
                const isOrgMatch = !organization || organization === '全部机构' || 
                                   (emp.orgName && emp.orgName.toLowerCase().trim() === organization.toLowerCase().trim());
                
                return isActive && isOrgMatch;
            });
            
            // 提取岗位
            filteredEmployees.forEach(emp => {
                if (emp.position && emp.position.trim()) {
                    positions.add(emp.position.trim());
                }
            });
            
            return Array.from(positions);
        } catch (error) {
            console.error(`获取所有岗位失败:`, error);
            return [];
        }
    }

    // 获取班次-岗位对应的连值天数（包含特殊规则）
    getConsecutiveDaysRule(shiftCode, position) {
        try {
            // Y16综班次的特殊规则
            if (shiftCode === 'Y16综') {
                if (position.includes('对公')) {
                    // Y16综班次的对公岗位连值5天
                    return 5;
                } else if (position.includes('个人')) {
                    // Y16综班次的个人岗位连值7天
                    return 7;
                }
            }
            
            // G值-A、G值-B、G值班次的特殊规则 - 所有岗位周末连值2天
            if (['G值-A', 'G值-B', 'G值'].includes(shiftCode)) {
                return 2;
            }
            
            // G值-C班次只值1天（周六）
            if (shiftCode === 'G值-C') {
                return 1;
            }
            
            // 其余特殊班次都是每天1人1天
            return 1;
        } catch (error) {
            console.error(`获取连值天数规则失败:`, error);
            return 1;
        }
    }

    // 获取班次的可排班日期
    getAvailableDatesForShift(shiftCode, position, currentMonthDates) {
        try {
            // G值-A、G值-B、G值班次只在周末排班
            if (['G值-A', 'G值-B', 'G值'].includes(shiftCode)) {
                const weekendDates = currentMonthDates.filter(day => day.isWeekend);
                console.log(`${shiftCode}班次筛选周末日期: ${weekendDates.length}天`);
                return weekendDates;
            }
            
            // G值-C班次只在周六排班（增强版筛选逻辑）
            if (shiftCode === 'G值-C') {
                console.log(`G值-C班次筛选前的总日期数: ${currentMonthDates.length}天`);
                
                // 严格筛选周六的日期，同时确保是当前月的日期
                const saturdayDates = currentMonthDates.filter(day => {
                    const isSaturday = day.dayOfWeek === 6;
                    const isCurrentMonth = day.isCurrentMonth === true;
                    console.log(`  日期: ${day.day}日, dayOfWeek=${day.dayOfWeek}, 星期${['日','一','二','三','四','五','六'][day.dayOfWeek]}, isSaturday=${isSaturday}, isCurrentMonth=${isCurrentMonth}`);
                    return isSaturday && isCurrentMonth;
                });
                
                console.log(`G值-C班次最终筛选出的周六日期: ${saturdayDates.length}天`);
                return saturdayDates;
            }
            
            // 不允许在周末排班的班次列表
            // 将来如果有新的班次需要排除周末，只需要添加到这个列表中
            const noWeekendShifts = [
                'G',         // G班次
                'G班',       // G班
                'Y10',       // Y10相关班次
                '1030',      // 1030相关班次
                '10:30'      // 10:30相关班次
            ];
            
            // 检查当前班次是否在不允许周末排班的列表中
            const isNoWeekendShift = noWeekendShifts.some(keyword => 
                shiftCode === keyword || shiftCode.includes(keyword)
            );
            
            if (isNoWeekendShift) {
                const weekdayDates = currentMonthDates.filter(day => !day.isWeekend);
                console.log(`${shiftCode}班次排除周末日期，剩余: ${weekdayDates.length}天`);
                return weekdayDates;
            }
            
            // 其他班次在所有工作日排班
            return currentMonthDates;
        } catch (error) {
            console.error(`获取可排班日期失败:`, error);
            return currentMonthDates;
        }
    }

    // 检查员工是否可以被分配班次
    canAssignShiftToEmployee(employee, shiftCode, position, dateRange, assignedEmployees, scheduleResult) {
        try {
            // 移除"员工是否已经被分配了班次"的检查，允许员工从头再进行轮换
            // 这样即使员工已经被分配了班次，只要满足其他条件，仍可以被再次分配
            // 注意：保留其他检查(岗位匹配、日期冲突等)以确保排班合理性
            
            // 检查员工岗位是否匹配
            if (!employee.position) {
                return false;
            }
            
            // 严格的岗位匹配逻辑
            // 1. 完全匹配
            if (employee.position === position) {
                // 岗位匹配通过，继续进行其他检查
            } else if (
                // 2. 部分匹配规则
                (position.includes('对公') && employee.position.includes('对公')) ||
                (position.includes('个人') && employee.position.includes('个人')) ||
                (position.includes('风险') && employee.position.includes('风险')) ||
                // 3. 其他包含关系匹配
                employee.position.includes(position) ||
                position.includes(employee.position)
            ) {
                // 岗位匹配通过，继续进行其他检查
            } else {
                // 所有匹配规则都不满足，返回false
                return false;
            }
            
            // 检查员工在这些日期是否已经有排班
            for (const dayData of dateRange) {
                const hasExistingShift = scheduleResult[employee.number].schedule.some(item => {
                    const itemDate = new Date(item.date);
                    const currentDate = new Date(dayData.date);
                    return itemDate.getDate() === currentDate.getDate() && 
                           itemDate.getMonth() === currentDate.getMonth() && 
                           itemDate.getFullYear() === currentDate.getFullYear();
                });
                
                if (hasExistingShift) {
                    return false;
                }
            }
            
            // 检查跨月连续排班规则
            const lastMonthInfo = this.lastMonthAssignments[employee.number] || { recentShifts: [] };
            const recentShift = lastMonthInfo.recentShifts[0];
            
            if (recentShift && recentShift.shiftCode === shiftCode) {
                // 如果员工上个月最后一次排班也是同一个班次，检查是否需要继续排班
                // 这里可以根据实际需求调整逻辑
                return true;
            }
            
            return true;
        } catch (error) {
            console.error(`检查员工是否可以分配班次失败:`, error);
            return false;
        }
    }

    // 分配连值班次
    assignConsecutiveDaysShift(employee, dateRange, shiftCode, position, scheduleResult, shiftCounts, assignedEmployees) {
        try {
            // 一次性安排连值日期
            for (const dayData of dateRange) {
                // 将排班结果添加到员工的排班数据中
                scheduleResult[employee.number].schedule.push({
                    date: dayData.date,
                    day: dayData.day,
                    shiftCode: shiftCode,
                    isWeekend: dayData.isWeekend,
                    position: position
                });
                
                // 更新班次计数
                shiftCounts[employee.number][shiftCode] = (shiftCounts[employee.number][shiftCode] || 0) + 1;
            }
            
            // 移除将员工添加到assignedEmployees集合的操作，允许员工从头再进行轮换
            // 注意：即使员工已经被分配了班次，只要满足其他条件，仍可以被再次分配
            
            // 返回实际分配的天数
            return dateRange.length;
        } catch (error) {
            console.error(`分配连值班次失败:`, error);
            return 0;
        }
    }

    // 按优先级排序班次（从数据库获取优先级）
    async sortShiftsByPriority(activeShifts) {
        try {
            // 从数据库获取所有班次信息
            const allShifts = await this.shiftManager.getAllShifts();
            
            // 创建班次优先级映射
            const priorityMap = new Map();
            
            // 创建一个activeShifts的code集合，用于快速查找
            const activeShiftCodes = new Set(activeShifts);
            
            // 初始化所有班次的优先级
            activeShifts.forEach(shiftCode => {
                priorityMap.set(shiftCode, 0); // 默认优先级为0
            });
            
            // 从数据库中获取班次优先级
            allShifts.forEach(shift => {
                if (activeShiftCodes.has(shift.code) && shift.priority !== undefined) {
                    priorityMap.set(shift.code, shift.priority);
                }
            });
            
            // 按优先级排序（优先级数字越小，优先级越高）
            const sortedShifts = [...activeShifts].sort((a, b) => {
                const priorityA = priorityMap.get(a) || 0;
                const priorityB = priorityMap.get(b) || 0;
                return priorityA - priorityB;
            });
            
            return sortedShifts;
        } catch (error) {
            console.error(`按优先级排序班次失败:`, error);
            return activeShifts;
        }
    }

    // 获取上个月的排班情况（用于跨月连续排班）
    getLastMonthAssignments(lastMonthSchedule, employees) {
        try {
            const result = {};
            
            // 初始化每个员工的上个月排班信息
            employees.forEach(employee => {
                result[employee.number] = {
                    recentShifts: []
                };
            });
            
            if (!lastMonthSchedule) {
                return result;
            }
            
            // 解析上个月的排班数据
            // 这里假设lastMonthSchedule是一个对象，键是员工号，值是排班信息
            for (const empNumber in lastMonthSchedule) {
                if (lastMonthSchedule.hasOwnProperty(empNumber) && result.hasOwnProperty(empNumber)) {
                    const schedule = lastMonthSchedule[empNumber].schedule;
                    if (schedule && Array.isArray(schedule) && schedule.length > 0) {
                        // 获取员工上个月最后几天的排班信息（这里只取最后一次）
                        const sortedSchedule = [...schedule].sort((a, b) => {
                            return new Date(b.date) - new Date(a.date);
                        });
                        result[empNumber].recentShifts = sortedSchedule.slice(0, 3); // 保留最后3次排班
                    }
                }
            }
            
            return result;
        } catch (error) {
            console.error(`获取上个月的排班情况失败:`, error);
            return {};
        }
    }

    // 获取轮换键
    getRotationKeyForShiftAndPosition(shiftCode, position, dateContext) {
        try {
            if (dateContext.isSingleDay) {
                // 单日排班使用简单的轮换键
                return `${shiftCode}-${position}`;
            } else {
                // 连值排班使用包含日期信息的轮换键
                const firstDayData = dateContext.dateRange[0];
                const dateString = `${firstDayData.date.getFullYear()}-${String(firstDayData.date.getMonth() + 1).padStart(2, '0')}`;
                return `${dateString}-${shiftCode}-${position}-rotation`;
            }
        } catch (error) {
            console.error(`获取轮换键失败:`, error);
            return `${shiftCode}-${position}`;
        }
    }

    // 获取轮换起始索引（支持跨月连续排班）
    getRotationStartIndex(rotationKey) {
        try {
            // 从localStorage获取上次的起始索引
            const storedIndex = localStorage.getItem(rotationKey);
            
            // 如果存在且是有效数字，则返回该索引
            if (storedIndex !== null) {
                const index = parseInt(storedIndex, 10);
                if (!isNaN(index)) {
                    return index;
                }
            }
            
            // 默认返回0
            return 0;
        } catch (error) {
            console.error(`获取轮换起始索引失败:`, error);
            return 0;
        }
    }

    // 保存轮换起始索引（支持跨月连续排班）
    saveRotationStartIndex(rotationKey, index) {
        try {
            // 将起始索引保存到localStorage
            localStorage.setItem(rotationKey, index.toString());
        } catch (error) {
            console.error(`保存轮换起始索引失败:`, error);
        }
    }
}

// 将SchedulingAlgorithm挂载到window对象上，以便其他模块可以访问
window.SchedulingAlgorithm = SchedulingAlgorithm;