// 排班顺序管理功能

class ShiftOrderManager {
    constructor() {
        var self = this;
        this.initializeStore().catch(function(err) {
            console.error('初始化排班顺序存储空间失败: ' + err);
            // 创建一个临时的内存存储作为备选方案
            self.memoryStore = [];
        });
        
        // 初始化缓存对象
        this.cache = {};
        this.shiftOrdersCache = {};
        this.employeeCache = {};
    }
    
    // 清除缓存方法
    clearCache() {
        try {
            console.log('执行ShiftOrderManager缓存清理...');
            
            // 清空所有缓存对象
            this.cache = {};
            this.shiftOrdersCache = {};
            this.employeeCache = {};
            
            // 如果有memoryStore，也清空它
            if (this.memoryStore) {
                this.memoryStore = [];
            }
            
            console.log('ShiftOrderManager缓存清理完成');
            return true;
        } catch (error) {
            console.error('ShiftOrderManager缓存清理失败:', error);
            return false;
        }
    }

    // 初始化排班顺序存储空间
    async initializeStore() {
        try {
            // 现在我们使用全局的dbManager，所以只需要确保它已经初始化
            await window.dbManager.ensureInitialized();
            
            // 检查全局数据库中是否已存在shiftOrders存储空间
            const hasShiftOrderStore = await this._checkShiftOrderStoreExists();
            
            if (hasShiftOrderStore) {
                console.log('全局数据库中的shiftOrders存储空间已存在');
            } else {
                // 如果不存在，我们不需要在这里创建，因为全局数据库会在升级时创建
                // 这里只是做一个警告提示
                console.warn('全局数据库中尚未创建shiftOrders存储空间，将在数据库升级时创建');
            }
            
            return true;
        } catch (error) {
            console.error('初始化排班顺序存储空间异常: ' + error);
            throw error;
        }
    }
    
    // 检查全局数据库中是否存在shiftOrders存储空间
    async _checkShiftOrderStoreExists() {
        try {
            // 在IndexedDB中，我们不能直接检查objectStore是否存在于异步环境中
            // 所以这里我们通过尝试获取所有记录来间接检查存储空间是否存在
            const allOrders = await window.dbManager.getAll('shiftOrders');
            return true; // 如果能成功获取，说明存储空间存在
        } catch (error) {
            console.log('检查shiftOrders存储空间时出错（可能不存在）: ' + error);
            return false;
        }
    }

    // 获取所有有效班次
    async getAllActiveShifts() {
        try {
            const shifts = await window.dbManager.getAll('shifts');
            var result = [];
            for (var i = 0; i < shifts.length; i++) {
                if (shifts[i].status === 0) {
                    result.push(shifts[i]);
                }
            }
            return result;
        } catch (error) {
            console.error('获取班次失败: ' + error);
            return [];
        }
    }

    // 内部辅助函数：清理并验证员工号数组
    async _cleanAndValidateEmployeeNumbers(employeeNumbers) {
        try {
            if (!employeeNumbers || !Array.isArray(employeeNumbers)) {
                return [];
            }
            
            // 获取所有员工数据
            const allEmployees = await window.dbManager.getAll('employees');
            
            // 创建有效的员工号集合
            const validEmployeeNumbers = new Set();
            allEmployees.forEach(emp => {
                if (emp.number) {
                    validEmployeeNumbers.add(emp.number);
                }
            });
            
            // 清理并验证employeeNumbers数组
            const cleanedEmployeeNumbers = [];
            employeeNumbers.forEach(number => {
                // 跳过空值或非字符串值
                if (!number || typeof number !== 'string') {
                    return;
                }
                
                // 去除空格
                const trimmedNumber = number.trim();
                if (!trimmedNumber) {
                    return;
                }
                
                // 如果是有效的员工号，添加到结果数组
                if (validEmployeeNumbers.has(trimmedNumber)) {
                    cleanedEmployeeNumbers.push(trimmedNumber);
                }
            });
            
            return cleanedEmployeeNumbers;
        } catch (error) {
            console.error('清理员工号数组失败:', error);
            return [];
        }
    }
    
    // 获取指定岗位和班次的排班顺序
    async getShiftOrderByPositionAndShift(position, shiftCode, department = '') {
        try {
            console.log(`尝试获取排班顺序: position=${position}, shiftCode=${shiftCode}, department=${department}`);
            
            // 特殊处理：当选择"全部岗位"时
            const isAllPositions = position === '' || position === '全部岗位';
            // 判断是否为"全部部门"
            const isAllDepartments = !department || department === '' || department === '全部部门' || department === 'all';
            
            // 首先尝试从IndexedDB获取
            try {
                const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
                if (exists) {
                    // 直接使用getAll方法查询
                    const allOrders = await window.dbManager.getAll('shiftOrders');
                    console.log(`获取到所有排班顺序数量: ${allOrders ? allOrders.length : 0}`);
                    
                    // 优先查找完全匹配的记录（特定部门）
                    let foundOrder = null;
                    if (isAllPositions) {
                        // 当选择"全部岗位"时，查找通用排班顺序（不指定岗位）
                        foundOrder = allOrders.find(order => {
                            if (!order) return false;
                            
                            // 对部门的匹配逻辑：精确匹配指定部门
                            const isDepartmentMatch = !isAllDepartments && order.department && order.department === department;
                            
                            // 对岗位的匹配逻辑 - 寻找通用岗位记录
                            const isGeneralPosition = order.position === '' || order.position === '全部岗位';
                            
                            // 对班次的匹配逻辑
                            const isShiftCodeMatch = order.shiftCode === shiftCode;
                            
                            return isGeneralPosition && isDepartmentMatch && isShiftCodeMatch;
                        });
                    } else {
                        // 常规查询逻辑
                        foundOrder = allOrders.find(order => {
                            // 确保order对象存在
                            if (!order) return false;
                                
                            // 对部门的匹配逻辑：精确匹配指定部门
                            const isDepartmentMatch = !isAllDepartments && order.department && order.department === department;
                                
                            // 对岗位的匹配逻辑
                            const isPositionMatch = order.position === position;
                                
                            // 对班次的匹配逻辑
                            const isShiftCodeMatch = order.shiftCode === shiftCode;
                                
                            return isDepartmentMatch && isPositionMatch && isShiftCodeMatch;
                        });
                    }
                    
                    // 如果找到匹配记录，返回它
                    if (foundOrder) {
                        console.log('从IndexedDB获取排班顺序成功, 原始顺序:', foundOrder.employeeNumbers);
                        
                        // 确保返回的是一个新对象，避免修改原始数据
                        const result = { ...foundOrder };
                        
                        // 清理并规范化员工号数组
                        const cleanedNumbers = [];
                        if (result.employeeNumbers && Array.isArray(result.employeeNumbers)) {
                            for (const num of result.employeeNumbers) {
                                // 处理null、undefined、空字符串
                                if (!num) continue;
                                
                                // 使用normalizeId函数进行规范化处理，确保与查询时的规范化逻辑一致
                                const normalizedNum = this.normalizeId(String(num).trim());
                                
                                // 只添加非空的员工号
                                if (normalizedNum) {
                                    cleanedNumbers.push(normalizedNum);
                                }
                            }
                        }
                        result.employeeNumbers = cleanedNumbers;
                        
                        console.log('规范化后员工号列表:', result.employeeNumbers);
                        return result;
                    }
                }
            } catch (dbError) {
                console.warn('IndexedDB获取失败，将从内存获取: ' + dbError);
            }
            
            // 如果IndexedDB没有找到，从内存存储中获取
            if (this.memoryStore) {
                let foundOrder = null;
                
                if (isAllPositions) {
                    // 当选择"全部岗位"时，查找通用排班顺序（不指定岗位）
                    foundOrder = this.memoryStore.find(order => {
                        // 对部门的匹配逻辑：精确匹配指定部门
                        const isDepartmentMatch = !isAllDepartments && order.department && order.department === department;
                        
                        // 对岗位的匹配逻辑 - 寻找通用岗位记录
                        const isGeneralPosition = order.position === '' || order.position === '全部岗位';
                        
                        // 对班次的匹配逻辑
                        const isShiftCodeMatch = order.shiftCode === shiftCode;
                        
                        return isGeneralPosition && isDepartmentMatch && isShiftCodeMatch;
                    });
                } else {
                    // 常规内存查找逻辑
                    foundOrder = this.memoryStore.find(order => {
                        // 对部门的匹配逻辑：精确匹配指定部门
                        const isDepartmentMatch = !isAllDepartments && order.department && order.department === department;
                        
                        // 匹配岗位和班次
                        return order.position === position && order.shiftCode === shiftCode && isDepartmentMatch;
                    });
                }
                
                if (foundOrder) {
                    console.log('从内存获取排班顺序成功, 原始顺序:', foundOrder.employeeNumbers);
                    
                    // 确保返回的是一个新对象，避免修改原始数据
                    const result = { ...foundOrder };
                    
                    // 清理并规范化员工号数组
                    const cleanedNumbers = [];
                    if (result.employeeNumbers && Array.isArray(result.employeeNumbers)) {
                        for (const num of result.employeeNumbers) {
                            // 处理null、undefined、空字符串
                            if (!num) continue;
                            
                            // 使用normalizeId函数进行规范化处理，确保与查询时的规范化逻辑一致
                            const normalizedNum = this.normalizeId(String(num).trim());
                            
                            // 只添加非空的员工号
                            if (normalizedNum) {
                                cleanedNumbers.push(normalizedNum);
                            }
                        }
                    }
                    result.employeeNumbers = cleanedNumbers;
                    
                    console.log('规范化后员工号列表:', result.employeeNumbers);
                    return result;
                }
            }
            
            // 当选择"全部部门"时，如果没有找到特定部门的排班顺序，
            // 尝试查找数据库中该岗位下的所有排班顺序记录
            if (isAllDepartments) {
                try {
                    const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
                    if (exists) {
                        const allOrders = await window.dbManager.getAll('shiftOrders');
                        
                        // 查找所有匹配该岗位和班次的记录
                        const matchingOrders = allOrders.filter(order => {
                            if (!order) return false;
                            
                            // 对岗位的匹配逻辑
                            const isPositionMatch = order.position === position;
                            
                            // 对班次的匹配逻辑
                            const isShiftCodeMatch = order.shiftCode === shiftCode;
                            
                            return isPositionMatch && isShiftCodeMatch;
                        });
                        
                        if (matchingOrders.length > 0) {
                            console.log(`找到${matchingOrders.length}条匹配的排班顺序记录，属于不同部门`);
                            
                            // 创建一个包含所有部门信息的特殊对象
                            // 注意：这里不合并员工号，而是保留各部门的独立性
                            // 具体渲染时应该分别处理各部门的排班顺序
                            const allDepartmentsOrder = {
                                position: position,
                                shiftCode: shiftCode,
                                department: '全部部门',
                                employeeNumbers: [], // 空数组，让渲染逻辑自行处理各部门
                                excludeAllEmployees: false,
                                updatedAt: new Date(),
                                isShiftBased: true,
                                hasMultipleDepartments: true,
                                departmentOrders: matchingOrders // 保存各个部门的原始排班顺序记录
                            };
                            
                            return allDepartmentsOrder;
                        }
                    }
                } catch (error) {
                    console.warn('获取全部部门排班顺序失败:', error);
                }
            }
            
            console.log(`未找到排班顺序: position=${position}, shiftCode=${shiftCode}`);
            return null;
        } catch (error) {
            console.error('获取排班顺序失败: ' + error);
            return null;
        }
    }





    // 保存指定岗位和班次的排班顺序
    async saveShiftOrderByShift(position, shiftCode, employeeNumbers, excludeAllEmployees = false, department = '') {
        try {
            console.log('3. 调用 ShiftOrderManager.saveShiftOrderByShift() 方法保存数据');
            console.log('   - 原始保存数据:', {position, shiftCode, employeeNumbers, excludeAllEmployees, department});
            
            // 确保position和shiftCode都有值
            if (!position || !shiftCode) {
                throw new Error('岗位和班次代码不能为空');
            }
            
            // 创建保存数据
            const data = {
                position: position,
                shiftCode: shiftCode,
                employeeNumbers: employeeNumbers, // 始终保存employeeNumbers，用于标识哪些员工在剔除列表中
                excludeAllEmployees: excludeAllEmployees, // 添加标记表示是否是剔除列表所有人员
                updatedAt: new Date(),
                // 确保只有基于班次的排班数据会被保存
                isShiftBased: true
            };
            
            // 处理部门参数，正确识别"全部部门"情况
            if (!department || department === '' || department === '全部部门' || department === 'all') {
                data.department = '全部部门';
                console.log('部门选择为"全部部门"，设置为全部部门');
            } else {
                data.department = department;
                console.log(`使用传入的部门信息: ${department}`);
            }
            
            // 处理特殊情况：当选择"全部岗位"时，尝试从其他来源获取部门信息
            if (position === '' || position === '全部岗位') {
                // 尝试从localStorage获取当前选中的部门
                const storedDepartment = localStorage.getItem('selectedDept') || '';
                if (storedDepartment && storedDepartment !== '') {
                    data.department = storedDepartment;
                    console.log(`已从localStorage获取部门信息: ${data.department}`);
                } else {
                    // 如果未找到部门信息，明确设置为'全部部门'表示不限制部门
                    data.department = '全部部门';
                    console.log('未找到特定部门信息，设置为全部部门');
                }
            } else {
                // 常规情况：优先使用传入的部门信息，只有在没有传入时才通过岗位名称查找部门
                if (!department || department === '' || department === '全部部门' || department === 'all') {
                    // 如果没有传入有效的部门信息，才尝试通过岗位名称查找对应的部门
                    if (window.dbManager && typeof window.dbManager.getAll === 'function') {
                        try {
                            const employees = await window.dbManager.getAll('employees');
                            // 查找第一个拥有该岗位的员工，获取其部门名称
                            const employeeWithPosition = employees.find(emp => emp.position === position);
                            if (employeeWithPosition && employeeWithPosition.deptName) {
                                data.department = employeeWithPosition.deptName;
                                console.log(`已获取到岗位[${position}]的部门信息: ${data.department}`);
                            } else {
                                console.log(`未找到岗位[${position}]对应的部门信息`);
                            }
                        } catch (error) {
                            console.error('获取部门信息失败:', error);
                        }
                    }
                } else {
                    // 使用传入的部门信息
                    data.department = department;
                    console.log(`使用传入的部门信息: ${department}`);
                }
            }
            
            console.log('4. 准备保存到数据库的数据对象:');
            console.log('   - 完整数据:', JSON.stringify(data, null, 2));
            

            
            // 确保数据完整性，特别是department字段
            if (!data.department || data.department === '') {
                data.department = '全部部门';
                console.log('确保department字段不为空，设置为全部部门');
            }
            
            // 首选：尝试使用全局dbManager保存
            try {
                if (window.dbManager && typeof window.dbManager.save === 'function') {
                    // 检查是否存在相同岗位、班次和部门的记录
                    console.log('5. 检查是否存在相同岗位、班次和部门的记录');
                    
                    // 使用复合索引查找现有记录
                    let existingOrder = null;
                    try {
                        // 尝试使用position_shiftCode_department复合索引查找
                        const matchingOrders = await window.dbManager.getByIndex('shiftOrders', 'position_shiftCode_department', [position, shiftCode, data.department]);
                        if (matchingOrders && matchingOrders.length > 0) {
                            existingOrder = matchingOrders[0];
                            console.log('   - 通过复合索引找到现有记录，使用ID:', existingOrder.id);
                            data.id = existingOrder.id;
                        } else {
                            console.log('   - 通过复合索引未找到现有记录');
                        }
                    } catch (indexError) {
                        console.warn('使用复合索引查找失败，尝试备选方案:', indexError);
                        // 如果复合索引不存在或查询失败，回退到原来的方式
                        const allOrders = await window.dbManager.getAll('shiftOrders');
                        const foundOrder = allOrders.find(order => {
                            return order.position === position && 
                                   order.shiftCode === shiftCode && 
                                   order.department === data.department;
                        });
                        if (foundOrder) {
                            existingOrder = foundOrder;
                            console.log('   - 通过备用方式找到现有记录，使用ID:', existingOrder.id);
                            data.id = existingOrder.id;
                        }
                    }
                    
                    if (!existingOrder) {
                        console.log('   - 未找到现有记录，将创建新记录');
                    }
                    
                    // 使用全局dbManager保存数据
                    console.log('6. 执行数据库保存操作:');
                    console.log('   - 存储名: shiftOrders');
                    console.log('   - 准备保存的最终数据:', JSON.stringify(data, null, 2));
                    const result = await window.dbManager.save('shiftOrders', data);
                    console.log('7. 数据库保存成功!');
                    console.log('   - 保存结果:', result);
                    
                    // 触发自动刷新
                    this._autoRefreshAfterSave();
                    return result;
                } else {
                    throw new Error('全局dbManager不可用');
                }
            } catch (dbError) {
                console.warn('全局dbManager保存失败，使用内存存储: ' + dbError);
                
                // 降级到内存存储
                this._saveToMemory(data);
                
                // 触发自动刷新
                this._autoRefreshAfterSave();
                return 'memory_backup';
            }
        } catch (error) {
            console.error('保存排班顺序失败: ' + error);
            throw error;
        }
    }
    
    // 保存到内存存储（作为备选方案）
    _saveToMemory(data) {
        if (!this.memoryStore) {
            this.memoryStore = [];
        }
        
        // 确保只有有效的基于班次的排班数据才会被保存
        if (!data.position || !data.shiftCode) {
            console.error('岗位和班次代码不能为空，无法保存到内存');
            return;
        }
        
        // 增强employeeNumbers数据处理
        const dataToSave = { ...data };
        
        // 确保标记为基于班次的排班数据
        dataToSave.isShiftBased = true;
        
        // 处理employeeNumbers，确保它是一个有效的数组
        if (data.employeeNumbers) {
            console.log('原始保存的employeeNumbers:', data.employeeNumbers);
            
            // 确保employeeNumbers是数组
            const rawNumbers = Array.isArray(data.employeeNumbers) ? data.employeeNumbers : [data.employeeNumbers];
            
            // 清理并规范化employeeNumbers数组
            const cleanedNumbers = [];
            for (const number of rawNumbers) {
                // 处理null、undefined、空字符串
                if (!number) continue;
                
                // 使用normalizeId函数进行规范化处理，确保与查询时的规范化逻辑一致
                const normalizedNumber = this.normalizeId(String(number).trim());
                
                // 只添加非空的员工号
                if (normalizedNumber) {
                    cleanedNumbers.push(normalizedNumber);
                }
            }
            
            dataToSave.employeeNumbers = cleanedNumbers;
            console.log('规范化后保存的employeeNumbers:', cleanedNumbers);
        } else {
            // 如果没有提供employeeNumbers，设置为空数组
            dataToSave.employeeNumbers = [];
        }
        

        
        // 查找是否已存在相同岗位、班次和部门的记录
        var existingIndex = -1;
        for (var i = 0; i < this.memoryStore.length; i++) {
            const record = this.memoryStore[i];
            // 如果提供了部门参数，需要同时匹配部门、岗位和班次
            if (dataToSave.department && dataToSave.department !== '') {
                if (record.position === dataToSave.position && 
                    record.shiftCode === dataToSave.shiftCode && 
                    record.department === dataToSave.department) {
                    existingIndex = i;
                    break;
                }
            } else {
                // 否则只匹配岗位和班次（保持向后兼容）
                if (record.position === dataToSave.position && record.shiftCode === dataToSave.shiftCode) {
                    existingIndex = i;
                    break;
                }
            }
        }
        
        if (existingIndex >= 0) {
            // 更新现有记录
            const updatedRecord = {};
            for (var key in this.memoryStore[existingIndex]) {
                updatedRecord[key] = this.memoryStore[existingIndex][key];
            }
            for (var key2 in dataToSave) {
                updatedRecord[key2] = dataToSave[key2];
            }
            updatedRecord.updatedAt = new Date();
            this.memoryStore[existingIndex] = updatedRecord;
        } else {
            // 添加新记录
            const newRecord = {};
            for (var key3 in dataToSave) {
                newRecord[key3] = dataToSave[key3];
            }
            newRecord.id = Date.now();
            this.memoryStore.push(newRecord);
        }
        
        // 保存到localStorage作为持久化
        try {
            localStorage.setItem('shiftOrdersBackup', JSON.stringify(this.memoryStore));
        } catch (e) {
            console.error('保存到localStorage失败: ' + e);
        }
        
        console.log('数据已保存到内存存储');
    }
    
    // 清理内存存储中的旧版基于岗位的排班数据


    // 自动刷新排班数据（私有方法）
    _autoRefreshAfterSave() {
        try {
            console.log('排班数据保存成功，准备自动刷新...');
            
            // 清除缓存，确保获取最新数据
            if (this.clearCache) {
                this.clearCache();
            }
            
            // 延迟一小段时间，确保数据完全写入后再刷新
            setTimeout(() => {
                try {
                    // 触发班次数据变更事件，通知其他模块和监听器
                    const event = new CustomEvent('shiftDataChanged', {
                        detail: {
                            reason: '排班数据保存',
                            shiftId: null,
                            shiftCode: null
                        }
                    });
                    window.dispatchEvent(event);
                    
                    console.log('已触发shiftDataChanged事件，排班数据将通过事件监听器自动刷新');
                } catch (refreshError) {
                    console.error('自动刷新排班数据失败:', refreshError);
                }
            }, 50); // 50ms的延迟，平衡性能和实时性
        } catch (error) {
            console.error('执行自动刷新逻辑失败:', error);
        }
    }
    
    // 获取所有岗位的排班顺序
    async getAllShiftOrders() {
        try {
            // 首先尝试从IndexedDB获取
            let dbResults = [];
            try {
                const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
                if (exists) {
                    dbResults = await window.dbManager.getAll('shiftOrders');
                }
            } catch (dbError) {
                console.warn('IndexedDB获取失败，将仅使用内存存储数据: ' + dbError);
            }
            
            // 如果有内存存储，将其与IndexedDB结果合并
            let allResults = [];
            if (this.memoryStore) {
                // 创建一个合并结果的Map，使用position、shiftCode和department作为唯一键
                const mergedResultsMap = new Map();
                
                // 先添加IndexedDB的结果
                for (const order of dbResults) {
                    if (order.position && order.shiftCode) {
                        // 使用岗位+班次+部门作为唯一键，确保不同部门的数据不互相覆盖
                        const department = order.department || '全部部门';
                        const key = `${order.position}_${order.shiftCode}_${department}`;
                        mergedResultsMap.set(key, order);
                    }
                }
                
                // 再添加内存存储的结果，覆盖相同键的记录（优先使用更新的数据）
                for (const order of this.memoryStore) {
                    if (order.position && order.shiftCode) {
                        // 使用岗位+班次+部门作为唯一键，确保不同部门的数据不互相覆盖
                        const department = order.department || '全部部门';
                        const key = `${order.position}_${order.shiftCode}_${department}`;
                        mergedResultsMap.set(key, order);
                    }
                }
                
                // 将Map转换为数组
                allResults = Array.from(mergedResultsMap.values());
            } else {
                // 如果没有内存存储，直接使用IndexedDB的结果
                // 但只保留有position和shiftCode的记录
                allResults = dbResults.filter(order => order.position && order.shiftCode);
            }
            
            console.log(`合并后去重的排班数据数量: ${allResults.length}`);
            
            // 对所有结果进行员工数据清理和验证，确保数据一致性
            const cleanedResults = [];
            for (const order of allResults) {
                try {
                    // 统一使用employeeNumbers字段
                    const cleanedNumbers = [];
                    
                    // 只处理employeeNumbers字段
                    let rawNumbers = [];
                    if (order.employeeNumbers) {
                        rawNumbers = Array.isArray(order.employeeNumbers) ? order.employeeNumbers : [order.employeeNumbers];
                    }
                    
                    // 清理并规范化员工号
                    for (const number of rawNumbers) {
                        if (!number) continue;
                        const normalizedNumber = String(number).trim();
                        if (normalizedNumber) {
                            cleanedNumbers.push(normalizedNumber);
                        }
                    }
                    
                    // 添加清理后的排班顺序对象，确保标记为基于班次
                    cleanedResults.push({
                        position: order.position,
                        shiftCode: order.shiftCode,
                        employeeNumbers: cleanedNumbers,
                        excludeAllEmployees: order.excludeAllEmployees || false,
                        updatedAt: order.updatedAt || new Date(),
                        isShiftBased: true // 确保标记为基于班次
                        // 只保留必要字段，避免数据冗余
                    });
                } catch (cleanError) {
                    console.warn('清理排班顺序员工数据失败:', cleanError);
                    // 即使清理失败，也添加简化的原始数据，避免数据丢失
                    cleanedResults.push({
                        position: order.position,
                        shiftCode: order.shiftCode,
                        employeeNumbers: order.employeeNumbers || [],
                        excludeAllEmployees: order.excludeAllEmployees || false,
                        isShiftBased: true
                    });
                }
            }
            
            return cleanedResults;
        } catch (error) {
            console.error('获取所有排班顺序失败: ' + error);
            // 如果发生错误，尝试返回内存存储中的数据，并确保只返回基于班次的
            if (this.memoryStore) {
                console.log('返回内存存储中的排班顺序数据');
                // 从内存存储中也只返回基于班次的排班数据
                const memoryShiftBasedOrders = this.memoryStore.filter(order => {
                    const isShiftBased = order.isShiftBased || (order.shiftCode && order.shiftCode !== '');
                    return isShiftBased;
                });
                return memoryShiftBasedOrders;
            }
            return [];
        }
    }

    // 添加新员工到对应岗位和班次的排班顺序末尾
    async addEmployeeToShiftOrderByShift(employeeNumber, position, shiftCode) {
        try {
            // 获取当前岗位和班次的排班顺序
            let shiftOrder = await this.getShiftOrderByPositionAndShift(position, shiftCode);
            
            if (!shiftOrder) {
                // 如果该岗位和班次还没有排班顺序，创建一个新的
                shiftOrder = {
                    position: position,
                    shiftCode: shiftCode,
                    employeeNumbers: []
                };
            }
            
            // 确保使用employeeNumbers字段
            if (!shiftOrder.employeeNumbers) {
                shiftOrder.employeeNumbers = [];
            }
            
            // 检查员工是否已在排班顺序中
            var employeeExists = false;
            for (var i = 0; i < shiftOrder.employeeNumbers.length; i++) {
                if (shiftOrder.employeeNumbers[i] === employeeNumber) {
                    employeeExists = true;
                    break;
                }
            }
            
            if (!employeeExists) {
                // 将新员工号添加到排班顺序末尾
                shiftOrder.employeeNumbers.push(employeeNumber);
                shiftOrder.updatedAt = new Date();
                
                // 保存更新后的排班顺序
                const result = await window.dbManager.save('shiftOrders', shiftOrder);
                
                // 添加自动刷新逻辑
                this._autoRefreshAfterSave();
                
                return result;
            }
            
            return shiftOrder;
        } catch (error) {
            console.error('添加员工到排班顺序失败: ' + error);
            throw error;
        }
    }



    // 获取指定员工号在所有排班顺序中的数据
    async getShiftOrdersByEmployeeNumber(employeeNumber) {
        try {
            // 获取所有排班顺序
            const allShiftOrders = await this.getAllShiftOrders();
            const result = [];
            
            // 检查并收集包含该员工的排班顺序
            for (const shiftOrder of allShiftOrders) {
                let isEmployeeFound = false;
                
                // 检查employeeNumbers数组
                if (Array.isArray(shiftOrder.employeeNumbers)) {
                    if (shiftOrder.employeeNumbers.includes(employeeNumber)) {
                        isEmployeeFound = true;
                    }
                }
                
                if (isEmployeeFound) {
                    result.push(shiftOrder);
                }
            }
            
            return result;
        } catch (error) {
            console.error('获取员工排班数据失败:', error);
            return [];
        }
    }



    // 更新指定班次的排班顺序
    async updateShiftOrderPositionByShift(shiftOrderId, employeeNumbers) {
        try {
            // 检查存储空间是否存在，如果不存在则尝试初始化
            let exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
            if (!exists) {
                console.log('排班顺序存储空间不存在，尝试初始化...');
                await this.initializeStore();
                // 再次检查是否初始化成功
                exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
                if (!exists) {
                    console.error('初始化排班顺序存储空间失败');
                    throw new Error('初始化排班顺序存储空间失败');
                }
            }
            
            // 获取现有排班顺序
            const shiftOrder = await window.dbManager.getById('shiftOrders', shiftOrderId);
            if (!shiftOrder) {
                throw new Error('排班顺序不存在');
            }
            
            // 只更新员工号字段，按员工号匹配
            shiftOrder.employeeNumbers = employeeNumbers;
            shiftOrder.updatedAt = new Date();
            
            return await window.dbManager.save('shiftOrders', shiftOrder);
        } catch (error) {
            console.error('更新排班顺序失败:', error);
            throw error;
        }
    }


    
    // 当员工新增时更新排班顺序
    async updateShiftOrderWhenEmployeeAdded(newEmployee) {
        try {
            // 获取所有有效班次
            const activeShifts = await this.getAllActiveShifts();
            
            // 优先使用员工号，如果没有则回退到员工ID
            const employeeNumber = newEmployee.number || newEmployee.id;
            
            // 为新员工添加到对应岗位的所有班次的排班顺序末尾
            var promises = [];
            var self = this;
            for (var i = 0; i < activeShifts.length; i++) {
                var shift = activeShifts[i];
                promises.push(
                    self.addEmployeeToShiftOrderByShift(employeeNumber, newEmployee.position, shift.code)
                        .catch(function(error) {
                            console.error('添加员工到' + newEmployee.position + '岗位' + shift.code + '班次排班顺序失败:', error);
                            // 继续处理其他班次，不中断流程
                            return Promise.resolve();
                        })
                );
            }
            
            // 也为兼容旧版添加到没有班次的排班顺序
            promises.push(
                this.addEmployeeToShiftOrder(employeeNumber, newEmployee.position)
                    .catch(error => {
                        console.error(`添加员工到${newEmployee.position}岗位排班顺序失败:`, error);
                        return Promise.resolve();
                    })
            );
            
            // 等待所有操作完成
            await Promise.all(promises);
            
            // 更新排班表显示
            this.renderShiftOrderTable();
        } catch (error) {
            console.error('添加员工时更新排班顺序失败:', error);
        }
    }
    
    // 创建规范化ID的函数
    normalizeId(id) {
        if (id === null || id === undefined) return '';
        return String(id).toLowerCase().trim();
    }
    
    // 当员工删除时更新排班顺序
    async updateShiftOrderWhenEmployeeDeleted(employeeId) {
        try {
            console.log('执行增强版updateShiftOrderWhenEmployeeDeleted，员工ID:', employeeId);
            
            // 第一步：获取员工信息，以获取员工号
            let employeeNumber = null;
            try {
                // 尝试通过员工ID查找员工信息
                const employees = await window.dbManager.getAll('employees');
                const employee = employees.find(emp => emp.id === employeeId);
                if (employee && employee.number) {
                    employeeNumber = employee.number;
                    console.log(`找到员工ID:${employeeId}对应的员工号:${employeeNumber}`);
                } else {
                    console.log(`未找到员工ID:${employeeId}对应的员工号，无法清理排班数据`);
                    return;
                }
            } catch (empError) {
                console.error('获取员工信息失败:', empError);
                console.log('无法获取员工号，无法清理排班数据');
                return;
            }
            
            // 第二步：获取该员工在所有排班顺序中的数据
            let employeeShiftOrders = [];
            
            try {
                console.log(`获取员工号:${employeeNumber}在所有排班顺序中的数据`);
                employeeShiftOrders = await this.getShiftOrdersByEmployeeNumber(employeeNumber);
            } catch (error) {
                console.error('通过员工号获取排班顺序数据失败:', error);
                employeeShiftOrders = [];
            }
            
            // 处理找到的排班顺序数据
            if (employeeShiftOrders.length > 0) {
                console.log(`总共找到 ${employeeShiftOrders.length} 个包含该员工的排班顺序，准备清理`);
                
                // 逐个处理包含该员工的排班顺序
                const updatePromises = [];
                const normalizedEmployeeNumber = this.normalizeId(employeeNumber);
                
                for (const shiftOrder of employeeShiftOrders) {
                    try {
                        // 确保employeeNumbers是数组
                        if (!Array.isArray(shiftOrder.employeeNumbers)) {
                            shiftOrder.employeeNumbers = [];
                        }
                        
                        // 保存原始长度用于比较
                        const originalNumbersLength = shiftOrder.employeeNumbers.length;
                        
                        // 通过员工号移除员工
                        shiftOrder.employeeNumbers = shiftOrder.employeeNumbers.filter(number => 
                            this.normalizeId(number) !== normalizedEmployeeNumber
                        );
                        
                        // 检查是否有变化
                        const hasChanges = shiftOrder.employeeNumbers.length < originalNumbersLength;
                        
                        // 如果有员工被移除，保存更新后的排班顺序
                        if (hasChanges) {
                            shiftOrder.updatedAt = new Date();
                            updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                            
                            // 输出详细日志，包括班次信息
                            if (shiftOrder.shiftCode) {
                                console.log(`已从${shiftOrder.position}岗位${shiftOrder.shiftCode}班次的排班顺序中移除员工`);
                            } else {
                                console.log(`已从${shiftOrder.position}岗位的排班顺序中移除员工`);
                            }
                        }
                    } catch (shiftOrderError) {
                        console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                        // 继续处理下一个排班顺序，不中断整体流程
                    }
                }
                
                // 等待所有更新操作完成
                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                }
            } else {
                console.log('未找到包含该员工的排班顺序数据');
            }
            
            // 第三步：删除与员工相关的所有排班表数据
            try {
                let employeeSchedules = [];
                
                // 尝试通过员工号查找排班表数据
                if (employeeNumber) {
                    try {
                        console.log(`尝试通过员工号:${employeeNumber}查找排班表数据`);
                        employeeSchedules = await window.dbManager.getByIndex('schedules', 'employeeId', employeeNumber);
                    } catch (error) {
                        console.error('通过索引查询排班表数据失败:', error);
                    }
                }
                
                // 如果没有找到，再尝试使用规范化ID进行全文搜索
                if (!employeeSchedules || employeeSchedules.length === 0) {
                    console.log(`直接索引查询未找到排班表数据，尝试全文搜索`);
                    const allSchedules = await window.dbManager.getAll('schedules');
                    
                    // 同时使用employeeId和employeeNumber进行匹配
                    const normalizedEmployeeId = this.normalizeId(employeeId);
                    const normalizedEmployeeNumber = employeeNumber ? this.normalizeId(employeeNumber) : null;
                    
                    employeeSchedules = allSchedules.filter(schedule => {
                        if (!schedule.employeeId) return false;
                        
                        const normalizedScheduleEmpId = this.normalizeId(schedule.employeeId);
                        return normalizedScheduleEmpId === normalizedEmployeeId || 
                               (normalizedEmployeeNumber && normalizedScheduleEmpId === normalizedEmployeeNumber);
                    });
                }
                
                if (employeeSchedules && employeeSchedules.length > 0) {
                    console.log(`找到${employeeSchedules.length}条与员工相关的排班表数据，准备删除`);
                    
                    // 创建删除Promise数组
                    const deleteSchedulePromises = employeeSchedules.map(schedule => 
                        window.dbManager.delete('schedules', schedule.id)
                            .catch(err => {
                                console.error(`删除排班表数据失败，ID:${schedule.id}`, err);
                                // 即使单个删除失败，也继续尝试删除其他数据
                            })
                    );
                    
                    // 等待所有删除操作完成
                    await Promise.allSettled(deleteSchedulePromises);
                    console.log(`已完成所有排班表数据的删除操作`);
                } else {
                    console.log(`未找到与员工相关的排班表数据`);
                }
            } catch (scheduleError) {
                console.error('删除排班表数据时出错:', scheduleError);
                // 排班表删除失败不应影响主流程
            }
            
            // 第四步：清理空的排班顺序记录
            try {
                await this.cleanupEmptyShiftOrders();
            } catch (cleanupError) {
                console.error('清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第五步：刷新排班表显示
            try {
                console.log('删除员工排班数据完成，准备刷新排班表显示');
                
                // 清理缓存，确保获取最新数据
                if (window.shiftOrderManager && window.shiftOrderManager.clearCache) {
                    window.shiftOrderManager.clearCache();
                    console.log('已清除排班顺序管理器缓存');
                }
                
                // 只使用一种可靠的方式刷新排班表数据，避免多次刷新
                if (window.loadShiftOrderData) {
                    await window.loadShiftOrderData();
                    console.log('通过window.loadShiftOrderData成功刷新排班表显示');
                } else if (window.loadAllShiftOrders) {
                    await window.loadAllShiftOrders();
                    console.log('通过window.loadAllShiftOrders成功刷新排班表显示');
                }
            } catch (refreshError) {
                console.error('刷新排班表显示时出错:', refreshError);
            }
            
            console.log('员工排班数据清理完成');
        } catch (error) {
            console.error('删除员工时更新排班顺序出错:', error);
        }
    }
    
    // 支持两种调用方式：
    // 1. removeEmployeeFromShiftOrder(employeeNumber) - 从所有班次中移除员工
    // 2. removeEmployeeFromShiftOrder(position, shiftCode, employeeNumber, employeeId, department) - 从特定岗位、班次和部门中移除员工
    async removeEmployeeFromShiftOrder(position, shiftCode, employeeNumber, employeeId, department) {
        try {
            // 检查是否是单参数调用（从所有班次中移除员工）
            if (arguments.length === 1 && typeof position === 'string') {
                const singleEmployeeNumber = position;
                console.log(`开始从所有排班顺序中移除员工，员工号:${singleEmployeeNumber}`);
                
                // 直接从数据库获取所有排班数据
                let allShiftOrders = [];
                try {
                    // 直接从dbManager获取所有数据，不经过过滤
                    allShiftOrders = await window.dbManager.getAll('shiftOrders');
                } catch (dbError) {
                    console.error('获取所有排班数据失败，使用内存中的数据:', dbError);
                    // 如果数据库操作失败，尝试使用内存中的数据作为备选
                    if (this.shiftOrders && this.shiftOrders.length > 0) {
                        allShiftOrders = [...this.shiftOrders];
                    }
                }
                
                if (!Array.isArray(allShiftOrders)) {
                    console.error('获取的排班数据不是数组:', allShiftOrders);
                    return;
                }
                
                console.log(`找到${allShiftOrders.length}条排班数据`);
                
                // 标记是否有变更
                let orderChanged = false;
                const updatePromises = [];
                const normalizedEmpNum = this.normalizeId(singleEmployeeNumber);
                
                // 遍历所有排班数据
                for (const shiftOrder of allShiftOrders) {
                    try {
                        // 确保employeeNumbers是数组
                        if (!Array.isArray(shiftOrder.employeeNumbers)) {
                            shiftOrder.employeeNumbers = [];
                        }
                        
                        // 记录原始长度用于比较
                        const originalNumbersLength = shiftOrder.employeeNumbers.length;
                        
                        // 从employeeNumbers中移除员工
                        shiftOrder.employeeNumbers = shiftOrder.employeeNumbers.filter(num => 
                            this.normalizeId(num) !== normalizedEmpNum
                        );
                        
                        // 检查是否有员工被移除
                        const hasChanged = shiftOrder.employeeNumbers.length < originalNumbersLength;
                        
                        if (hasChanged) {
                            orderChanged = true;
                            shiftOrder.updatedAt = new Date();
                            updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                            console.log(`已从排班顺序(ID:${shiftOrder.id})中移除员工${singleEmployeeNumber}`);
                        }
                    } catch (shiftOrderError) {
                        console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                        // 继续处理下一个排班顺序，不中断整体流程
                    }
                }
                
                // 如果有变更，保存所有更新
                if (updatePromises.length > 0) {
                    await Promise.all(updatePromises);
                    console.log(`已完成${updatePromises.length}个排班顺序的更新`);
                }
                
                // 清理空的排班顺序记录
                try {
                    await this.cleanupEmptyShiftOrders();
                } catch (cleanupError) {
                    console.error('清理空排班顺序记录时出错:', cleanupError);
                    // 清理失败不应影响主流程
                }
                
                // 如果有变更，刷新数据显示
                if (orderChanged) {
                    await this._autoRefreshAfterSave();
                }
                
                console.log('从所有排班顺序中移除员工操作完成');
                return;
            }
            
            // 优化后的从特定岗位、班次和部门中移除员工的逻辑
            console.log(`开始从${department ? department + '部门' : ''}${position}岗位${shiftCode}班次的排班顺序中移除员工，员工号:${employeeNumber}`);
            
            // 第一步：根据岗位和班次代码查找排班顺序
            const shiftOrders = await window.dbManager.getAll('shiftOrders');
            
            // 查找匹配的排班顺序：部门匹配（如果提供了部门），岗位匹配，班次代码匹配（如果提供了班次代码）
            let matchingShiftOrders = [];
            
            if (shiftCode) {
                if (department) {
                    matchingShiftOrders = shiftOrders.filter(order => 
                        order.department === department && order.position === position && order.shiftCode === shiftCode
                    );
                } else {
                    matchingShiftOrders = shiftOrders.filter(order => 
                        order.position === position && order.shiftCode === shiftCode
                    );
                }
            } else {
                // 兼容没有班次代码的情况
                if (department) {
                    matchingShiftOrders = shiftOrders.filter(order => 
                        order.department === department && order.position === position && !order.shiftCode
                    );
                } else {
                    matchingShiftOrders = shiftOrders.filter(order => 
                        order.position === position && !order.shiftCode
                    );
                }
            }
            
            if (matchingShiftOrders.length === 0) {
                console.log(`未找到${department ? department + '部门' : ''}${position}岗位${shiftCode}班次的排班顺序`);
                return;
            }
            
            console.log(`找到${matchingShiftOrders.length}个匹配的排班顺序${department ? `(${department}部门)` : ''}`);
            
            // 第二步：从排班顺序中移除员工
            const updatePromises = [];
            const normalizedEmployeeNumber = employeeNumber ? this.normalizeId(employeeNumber) : null;
            const normalizedEmployeeId = employeeId ? this.normalizeId(employeeId) : null;
            
            for (const shiftOrder of matchingShiftOrders) {
                try {
                    // 确保employeeNumbers是数组
                    if (!Array.isArray(shiftOrder.employeeNumbers)) {
                        shiftOrder.employeeNumbers = [];
                    }
                    
                    // 保存原始长度用于比较
                    const originalNumbersLength = shiftOrder.employeeNumbers.length;
                    
                    // 通过员工号移除员工
                    if (normalizedEmployeeNumber) {
                        shiftOrder.employeeNumbers = shiftOrder.employeeNumbers.filter(number => 
                            this.normalizeId(number) !== normalizedEmployeeNumber
                        );
                    }
                    
                    // 检查是否有变化
                    const hasChanges = shiftOrder.employeeNumbers.length < originalNumbersLength;
                    
                    // 如果有员工被移除，保存更新后的排班顺序
                    if (hasChanges) {
                        shiftOrder.updatedAt = new Date();
                        updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                        
                        console.log(`已从排班顺序(ID:${shiftOrder.id})中移除员工${employeeNumber}`);
                    } else {
                        console.log(`排班顺序(ID:${shiftOrder.id})中未找到员工${employeeNumber}`);
                    }
                } catch (shiftOrderError) {
                    console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新操作完成
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                console.log(`已完成${updatePromises.length}个排班顺序的更新`);
            }
            
            // 第三步：清理空的排班顺序记录
            try {
                await this.cleanupEmptyShiftOrders();
            } catch (cleanupError) {
                console.error('清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第四步：刷新排班表显示
            try {
                // 清理缓存，确保获取最新数据
                if (this.clearCache) {
                    this.clearCache();
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    await window.loadShiftOrderData();
                } else if (window.loadAllShiftOrders) {
                    await window.loadAllShiftOrders();
                }
                
                console.log('排班表显示已刷新');
            } catch (refreshError) {
                console.error('刷新排班表显示时出错:', refreshError);
            }
            
            console.log(`从${department ? department + '部门' : ''}${position}岗位${shiftCode}班次的排班顺序中移除员工完成`);
        } catch (error) {
            console.error('从排班顺序中移除员工失败:', error);
            throw error;
        }
    }
    
    // 清理空的排班顺序记录
    async cleanupEmptyShiftOrders() {
        try {
            console.log('开始清理空的排班顺序记录...');
            
            // 获取所有排班顺序
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            console.log(`总共获取到 ${allShiftOrders.length} 条排班顺序记录`);
            
            // 找出空记录（employeeNumbers为空的记录）
            const emptyShiftOrders = allShiftOrders.filter(order => {
                const hasEmployeeNumbers = Array.isArray(order.employeeNumbers) && order.employeeNumbers.length > 0;
                return !hasEmployeeNumbers;
            });
            
            if (emptyShiftOrders.length > 0) {
                console.log(`找到 ${emptyShiftOrders.length} 条空的排班顺序记录，准备删除`);
                
                // 创建删除Promise数组
                const deletePromises = emptyShiftOrders.map(order => 
                    window.dbManager.delete('shiftOrders', order.id)
                        .then(() => {
                            console.log(`已删除空排班顺序记录，ID:${order.id}`);
                        })
                        .catch(err => {
                            console.error(`删除空排班顺序记录失败，ID:${order.id}`, err);
                        })
                );
                
                // 等待所有删除操作完成
                await Promise.allSettled(deletePromises);
                console.log(`空排班顺序记录清理完成`);
            } else {
                console.log('没有发现空的排班顺序记录');
            }
            
            return emptyShiftOrders.length;
        } catch (error) {
            console.error('清理空排班顺序记录时发生错误:', error);
            throw error;
        }
    }
    
    // 当部门被删除时更新排班顺序
    async updateShiftOrderWhenDepartmentDeleted(departmentId) {
        try {
            console.log(`开始处理部门删除时的排班顺序更新，部门ID:${departmentId}`);
            
            // 第一步：获取部门下的所有岗位
            const positions = await window.dbManager.getAll('positions');
            const departmentPositions = positions.filter(position => 
                position.departmentId && this.normalizeId(position.departmentId) === this.normalizeId(departmentId)
            );
            
            console.log(`找到部门相关岗位数量: ${departmentPositions.length}`);
            
            // 如果部门下没有岗位，直接返回
            if (departmentPositions.length === 0) {
                console.log(`部门(ID:${departmentId})下没有岗位，无需更新排班顺序`);
                return;
            }
            
            // 第二步：获取所有排班顺序
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            console.log(`总共获取到 ${allShiftOrders.length} 条排班顺序记录`);
            
            // 第三步：遍历所有排班顺序，清空部门下岗位的员工数据
            const updatePromises = [];
            const departmentPositionNames = departmentPositions.map(pos => pos.name);
            
            for (const shiftOrder of allShiftOrders) {
                try {
                    // 检查排班顺序是否属于要删除的部门下的岗位
                    if (departmentPositionNames.includes(shiftOrder.position)) {
                        // 保存原始长度用于比较
                        const originalNumbersLength = Array.isArray(shiftOrder.employeeNumbers) ? shiftOrder.employeeNumbers.length : 0;
                        
                        // 清空员工数据
                        shiftOrder.employeeNumbers = [];
                        shiftOrder.updatedAt = new Date();
                        
                        updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                        
                        console.log(`已清空排班顺序(ID:${shiftOrder.id})中部门相关岗位的员工数据`);
                    }
                } catch (shiftOrderError) {
                    console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新操作完成
            if (updatePromises.length > 0) {
                await Promise.allSettled(updatePromises);
                console.log(`已完成${updatePromises.length}个排班顺序的更新`);
            }
            
            // 第四步：清理空的排班顺序记录
            try {
                await this.cleanupEmptyShiftOrders();
            } catch (cleanupError) {
                console.error('清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第五步：刷新排班表显示
            try {
                console.log('部门删除时排班数据清理完成，准备刷新排班表显示');
                
                // 清理缓存，确保获取最新数据
                if (window.shiftOrderManager && window.shiftOrderManager.clearCache) {
                    window.shiftOrderManager.clearCache();
                    console.log('已清除排班顺序管理器缓存');
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    await window.loadShiftOrderData();
                    console.log('通过window.loadShiftOrderData成功刷新排班表显示');
                } else if (window.loadAllShiftOrders) {
                    await window.loadAllShiftOrders();
                    console.log('通过window.loadAllShiftOrders成功刷新排班表显示');
                }
            } catch (refreshError) {
                console.error('刷新排班表显示时出错:', refreshError);
            }
            
            console.log(`部门(ID:${departmentId})相关排班数据清理完成`);
        } catch (error) {
            console.error('删除部门时更新排班顺序出错:', error);
        }
    }
    
    // 清空所有排班顺序数据
    async clearAllShiftOrders() {
        try {
            console.log('开始清空所有排班顺序数据');
            
            // 检查存储空间是否存在
            const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
            if (!exists) {
                console.log('排班顺序存储空间不存在，无需清空');
                return;
            }
            
            // 删除所有排班顺序记录
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            
            if (allShiftOrders && allShiftOrders.length > 0) {
                console.log(`找到${allShiftOrders.length}条排班顺序记录，准备清空`);
                
                // 批量删除
                const deletePromises = allShiftOrders.map(order => 
                    window.dbManager.delete('shiftOrders', order.id)
                );
                
                await Promise.all(deletePromises);
                console.log('所有排班顺序记录已成功清空');
            } else {
                console.log('没有找到排班顺序记录，无需清空');
            }
            
            // 清理缓存
            this.clearCache();
            
            // 清空内存存储（如果使用）
            if (this.memoryStore) {
                this.memoryStore = [];
            }
            
            console.log('排班顺序数据清空完成');
        } catch (error) {
            console.error('清空排班顺序数据失败:', error);
            throw error;
        }
    }
    
    // 清理缓存
    clearCache() {
        this.cache = {};
        this.shiftOrdersCache = {};
        this.employeeCache = {};
        console.log('排班顺序管理器缓存已清理');
    }
    
    // 当岗位被删除时更新排班顺序
    async updateShiftOrderWhenPositionDeleted(positionName) {
        try {
            console.log(`开始处理岗位删除时的排班顺序更新，岗位名称:${positionName}`);
            
            // 第一步：获取所有排班顺序
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            console.log(`总共获取到 ${allShiftOrders.length} 条排班顺序记录`);
            
            // 第二步：遍历所有排班顺序，清空指定岗位的员工数据
            const updatePromises = [];
            
            for (const shiftOrder of allShiftOrders) {
                try {
                    // 检查排班顺序是否属于要删除的岗位
                    if (shiftOrder.position === positionName) {
                        // 保存原始长度用于比较
                        const originalNumbersLength = Array.isArray(shiftOrder.employeeNumbers) ? shiftOrder.employeeNumbers.length : 0;
                        
                        // 清空员工数据
                        shiftOrder.employeeNumbers = [];
                        shiftOrder.updatedAt = new Date();
                        
                        updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                        
                        console.log(`已清空排班顺序(ID:${shiftOrder.id})中岗位(${positionName})的员工数据`);
                    }
                } catch (shiftOrderError) {
                    console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新操作完成
            if (updatePromises.length > 0) {
                await Promise.allSettled(updatePromises);
                console.log(`已完成${updatePromises.length}个排班顺序的更新`);
            }
            
            // 第三步：清理空的排班顺序记录
            try {
                await this.cleanupEmptyShiftOrders();
            } catch (cleanupError) {
                console.error('清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第四步：刷新排班表显示
            try {
                console.log('岗位删除时排班数据清理完成，准备刷新排班表显示');
                
                // 清理缓存，确保获取最新数据
                if (window.shiftOrderManager && window.shiftOrderManager.clearCache) {
                    window.shiftOrderManager.clearCache();
                    console.log('已清除排班顺序管理器缓存');
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    await window.loadShiftOrderData();
                    console.log('通过window.loadShiftOrderData成功刷新排班表显示');
                } else if (window.loadAllShiftOrders) {
                    await window.loadAllShiftOrders();
                    console.log('通过window.loadAllShiftOrders成功刷新排班表显示');
                }
            } catch (refreshError) {
                console.error('刷新排班表显示时出错:', refreshError);
            }
            
            console.log(`岗位(${positionName})相关排班数据清理完成`);
        } catch (error) {
            console.error('删除岗位时更新排班顺序出错:', error);
        }
    }
    
    // 当机构删除时更新排班顺序
    async updateShiftOrderWhenOrganizationDeleted(organizationId = null) {
        try {
            console.log('[机构删除] 开始处理机构删除时的排班数据清理', organizationId ? `，机构ID: ${organizationId}` : '，未指定机构ID');
            
            // 获取所有排班顺序
            console.log('[机构删除] 开始获取所有排班顺序');
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            console.log(`[机构删除] 总共获取到 ${allShiftOrders.length} 条排班顺序记录`);
            
            if (allShiftOrders.length === 0) {
                console.log('[机构删除] 没有找到排班顺序数据，无需清理');
                return;
            }
            
            // 获取该机构对象并提取机构名称（这段代码是必要的，因为后续的员工匹配逻辑依赖于机构名称）
            // 不能删除，否则无法正确识别需要清理的员工数据
            let organization = null;
            let organizationName = '';
            if (organizationId) {
                try {
                    console.log(`[机构删除] 获取机构对象: ${organizationId}`);
                    organization = await window.dbManager.getById('organizations', organizationId);
                    organizationName = organization ? organization.name : `机构${organizationId}`;
                    console.log(`[机构删除] 获取到机构名称: ${organizationName}`);
                } catch (orgError) {
                    console.error('[机构删除] 获取机构对象失败:', orgError);
                }
            }
            
            // 获取该机构的所有员工信息（仅使用机构名称进行一次匹配）
            let organizationEmployeeNumbers = new Set();
            if (organizationId && organizationName) {
                try {
                    console.log(`[机构删除] 开始获取机构 ${organizationId}(${organizationName}) 的员工信息`);
                    const allEmployees = await window.dbManager.getAll('employees');
                    
                    // 获取员工所属机构名称并进行匹配（直接从数据库获取，只执行一次匹配机制）
                    for (const emp of allEmployees) {
                        try {
                            let empOrgName = '';
                            // 直接使用员工数据中存储的机构名称
                            empOrgName = emp.orgName || '';
                            if (empOrgName.toLowerCase() === organizationName.toLowerCase()) {
                                if (emp.number) {
                                    organizationEmployeeNumbers.add(emp.number);
                                }
                            }
                        } catch (error) {
                            console.error('[机构删除] 获取员工所属机构信息失败:', error);
                        }
                    }
                    
                    console.log(`[机构删除] 获取到机构 ${organizationName} 的员工数量: ${organizationEmployeeNumbers.size}`);
                } catch (empError) {
                    console.error('[机构删除] 获取机构员工信息失败:', empError);
                }
            }
            
            // 准备更新的排班顺序
            const updatePromises = [];
            const deletePromises = [];
            let processedCount = 0;
            let updatedCount = 0;
            let deletedCount = 0;
            
            console.log('[机构删除] 开始遍历排班顺序记录');
            for (const shiftOrder of allShiftOrders) {
                processedCount++;
                if (processedCount % 10 === 0) {
                    console.log(`[机构删除] 已处理 ${processedCount}/${allShiftOrders.length} 条排班顺序记录`);
                }
                
                try {
                    // 保存原始长度用于记录
                    const originalNumbersLength = Array.isArray(shiftOrder.employeeNumbers) ? shiftOrder.employeeNumbers.length : 0;
                    
                    // 记录原始员工列表以便调试
                    const originalEmployeeNumbers = Array.isArray(shiftOrder.employeeNumbers) ? [...shiftOrder.employeeNumbers] : [];
                    
                    // 使用同一种匹配机制：检查排班顺序中是否包含该机构的员工
                    let hasOrganizationEmployees = false;
                    if (Array.isArray(shiftOrder.employeeNumbers) && shiftOrder.employeeNumbers.length > 0) {
                        hasOrganizationEmployees = shiftOrder.employeeNumbers.some(num => organizationEmployeeNumbers.has(num));
                    }
                    
                    // 移除排班顺序中的机构员工
                    if (hasOrganizationEmployees) {
                        shiftOrder.employeeNumbers = Array.isArray(shiftOrder.employeeNumbers) 
                            ? shiftOrder.employeeNumbers.filter(num => !organizationEmployeeNumbers.has(num))
                            : [];
                        shiftOrder.updatedAt = new Date();
                        
                        // 只有当员工列表确实发生变化时才保存
                        if (shiftOrder.employeeNumbers.length !== originalNumbersLength) {
                            updatedCount++;
                            // 记录被移除的员工号
                            const removedNumbers = originalEmployeeNumbers.filter(num => !shiftOrder.employeeNumbers.includes(num));
                            updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder).catch(err => {
                                console.error(`[机构删除] 保存排班顺序(ID:${shiftOrder.id})失败:`, err);
                            }));
                            console.log(`[机构删除] 已从排班顺序(ID:${shiftOrder.id})中移除机构员工数据，移除前:${originalNumbersLength}，移除后:${shiftOrder.employeeNumbers.length}，移除员工号:${removedNumbers.join(', ')}`);
                        }
                    }
                } catch (shiftOrderError) {
                    console.error(`[机构删除] 处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新操作完成
            if (updatePromises.length > 0) {
                console.log(`[机构删除] 开始等待${updatePromises.length}个更新操作完成`);
                const updateResults = await Promise.allSettled(updatePromises);
                const successfulUpdates = updateResults.filter(result => result.status === 'fulfilled').length;
                const failedUpdates = updateResults.filter(result => result.status === 'rejected').length;
                console.log(`[机构删除] 已完成${updatePromises.length}个排班顺序的更新，成功:${successfulUpdates}，失败:${failedUpdates}`);
            }
            
            console.log(`[机构删除] 排班顺序记录处理完成，共处理 ${processedCount} 条，更新 ${updatedCount} 条`);
            
            // 清理空的排班顺序记录
            try {
                console.log('[机构删除] 开始清理空的排班顺序记录');
                await this.cleanupEmptyShiftOrders();
                console.log('[机构删除] 已清理空的排班顺序记录');
            } catch (cleanupError) {
                console.error('[机构删除] 清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 刷新排班表显示
            try {
                console.log('[机构删除] 开始刷新排班表显示');
                // 清理缓存，确保获取最新数据
                if (window.shiftOrderManager && window.shiftOrderManager.clearCache) {
                    window.shiftOrderManager.clearCache();
                    console.log('[机构删除] 已清除排班顺序管理器缓存');
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    console.log('[机构删除] 通过window.loadShiftOrderData刷新排班表显示');
                    await window.loadShiftOrderData();
                    console.log('[机构删除] 通过window.loadShiftOrderData成功刷新排班表显示');
                } else if (window.loadAllShiftOrders) {
                    console.log('[机构删除] 通过window.loadAllShiftOrders刷新排班表显示');
                    await window.loadAllShiftOrders();
                    console.log('[机构删除] 通过window.loadAllShiftOrders成功刷新排班表显示');
                } else {
                    console.log('[机构删除] 未找到合适的刷新方法');
                }
                
                console.log('[机构删除] 排班表显示已刷新');
            } catch (refreshError) {
                console.error('[机构删除] 刷新排班表显示时出错:', refreshError);
            }
            
            console.log('[机构删除] 机构删除时排班数据清理完成');
        } catch (error) {
            console.error('[机构删除] 机构删除时更新排班顺序出错:', error);
        }
    }
    

    
    // 当岗位被删除时更新排班顺序
    async updateShiftOrderWhenPositionDeleted(positionName) {
        try {
            console.log(`开始处理岗位删除时的排班顺序更新，岗位名称:${positionName}`);
            
            // 第一步：获取所有排班顺序
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            console.log(`总共获取到 ${allShiftOrders.length} 条排班顺序记录`);
            
            // 第二步：遍历所有排班顺序，清空指定岗位的员工数据
            const updatePromises = [];
            
            for (const shiftOrder of allShiftOrders) {
                try {
                    // 检查排班顺序是否属于要删除的岗位
                    if (shiftOrder.position === positionName) {
                        // 保存原始长度用于比较
                        const originalNumbersLength = Array.isArray(shiftOrder.employeeNumbers) ? shiftOrder.employeeNumbers.length : 0;
                        
                        // 清空员工数据
                        shiftOrder.employeeNumbers = [];
                        shiftOrder.updatedAt = new Date();
                        
                        updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                        
                        console.log(`已清空排班顺序(ID:${shiftOrder.id})中岗位的员工数据`);
                    }
                } catch (shiftOrderError) {
                    console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新操作完成
            if (updatePromises.length > 0) {
                await Promise.allSettled(updatePromises);
                console.log(`已完成${updatePromises.length}个排班顺序的更新`);
            }
            
            // 第三步：清理空的排班顺序记录
            try {
                await this.cleanupEmptyShiftOrders();
                console.log('已清理空的排班顺序记录');
            } catch (cleanupError) {
                console.error('清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第四步：刷新排班表显示
            try {
                // 清理缓存，确保获取最新数据
                if (window.shiftOrderManager && window.shiftOrderManager.clearCache) {
                    window.shiftOrderManager.clearCache();
                    console.log('已清除排班顺序管理器缓存');
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    await window.loadShiftOrderData();
                    console.log('通过window.loadShiftOrderData成功刷新排班表显示');
                } else if (window.loadAllShiftOrders) {
                    await window.loadAllShiftOrders();
                    console.log('通过window.loadAllShiftOrders成功刷新排班表显示');
                }
                
                console.log('排班表显示已刷新');
            } catch (refreshError) {
                console.error('刷新排班表显示时出错:', refreshError);
            }
            
            console.log('岗位删除时的排班顺序更新完成');
        } catch (error) {
            console.error('处理岗位删除时更新排班顺序失败:', error);
        }
    }

    
    // 当岗位被删除时更新排班顺序
    async updateShiftOrderWhenPositionDeleted(positionName) {
        try {
            console.log(`开始处理岗位删除时的排班顺序更新，岗位名称:${positionName}`);
            
            // 第一步：获取所有排班顺序
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            console.log(`总共获取到 ${allShiftOrders.length} 条排班顺序记录`);
            
            // 第二步：遍历所有排班顺序，清空指定岗位的员工数据
            const updatePromises = [];
            
            for (const shiftOrder of allShiftOrders) {
                try {
                    // 检查排班顺序是否属于要删除的岗位
                    if (shiftOrder.position === positionName) {
                        // 保存原始长度用于比较
                        const originalNumbersLength = Array.isArray(shiftOrder.employeeNumbers) ? shiftOrder.employeeNumbers.length : 0;
                        
                        // 清空员工数据
                        shiftOrder.employeeNumbers = [];
                        shiftOrder.updatedAt = new Date();
                        
                        updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                        
                        console.log(`已清空排班顺序(ID:${shiftOrder.id})中岗位(${positionName})的员工数据`);
                    }
                } catch (shiftOrderError) {
                    console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新操作完成
            if (updatePromises.length > 0) {
                await Promise.allSettled(updatePromises);
                console.log(`已完成${updatePromises.length}个排班顺序的更新`);
            } else {
                console.log(`未找到与岗位(${positionName})相关的排班顺序记录`);
            }
            
            // 第三步：清理空的排班顺序记录
            try {
                await this.cleanupEmptyShiftOrders();
            } catch (cleanupError) {
                console.error('清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第四步：刷新排班表显示
            try {
                // 清理缓存，确保获取最新数据
                if (this.clearCache) {
                    this.clearCache();
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    await window.loadShiftOrderData();
                } else if (window.loadAllShiftOrders) {
                    await window.loadAllShiftOrders();
                }
                
                console.log('排班表显示已刷新');
            } catch (refreshError) {
                console.error('刷新排班表显示时出错:', refreshError);
            }
            
            console.log(`岗位删除时的排班顺序更新完成`);
        } catch (error) {
            console.error('岗位删除时更新排班顺序失败:', error);
        }
    }
    // 更新部门删除时的排班顺序（优化版，仅执行一次匹配机制）
    async updateShiftOrderWhenDepartmentDeleted(departmentId) {
        try {
            console.log(`[部门删除] 开始处理部门删除时的排班数据清理，部门ID:${departmentId}`);
            
            // 第一步：获取部门下的所有岗位（仅查询一次）
            const positions = await window.dbManager.getAll('positions');
            const departmentPositions = positions.filter(position => 
                position.departmentId && this.normalizeId(position.departmentId) === this.normalizeId(departmentId)
            );
            
            console.log(`[部门删除] 找到部门相关岗位数量: ${departmentPositions.length}`);
            
            // 如果部门下没有岗位，直接返回
            if (departmentPositions.length === 0) {
                console.log(`[部门删除] 部门(ID:${departmentId})下没有岗位，无需更新排班顺序`);
                return;
            }
            
            // 第二步：获取所有排班顺序
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            console.log(`[部门删除] 总共获取到 ${allShiftOrders.length} 条排班顺序记录`);
            
            // 第三步：提取部门下所有岗位的名称（用于匹配）
            const departmentPositionNames = departmentPositions.map(pos => pos.name);
            
            // 第四步：遍历所有排班顺序，清空部门下岗位的员工数据
            const updatePromises = [];
            let processedCount = 0;
            let updatedCount = 0;
            
            console.log('[部门删除] 开始遍历排班顺序记录');
            for (const shiftOrder of allShiftOrders) {
                processedCount++;
                if (processedCount % 10 === 0) {
                    console.log(`[部门删除] 已处理 ${processedCount}/${allShiftOrders.length} 条排班顺序记录`);
                }
                
                try {
                    // 使用同一种匹配机制：检查排班顺序是否属于要删除的部门下的岗位
                    if (departmentPositionNames.includes(shiftOrder.position)) {
                        // 保存原始长度用于比较
                        const originalNumbersLength = Array.isArray(shiftOrder.employeeNumbers) ? shiftOrder.employeeNumbers.length : 0;
                        
                        // 记录原始员工列表以便调试
                        const originalEmployeeNumbers = Array.isArray(shiftOrder.employeeNumbers) ? [...shiftOrder.employeeNumbers] : [];
                        
                        // 清空员工数据
                        shiftOrder.employeeNumbers = [];
                        shiftOrder.updatedAt = new Date();
                        
                        // 只有当员工列表确实存在数据时才保存
                        if (originalNumbersLength > 0) {
                            updatedCount++;
                            updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder).catch(err => {
                                console.error(`[部门删除] 保存排班顺序(ID:${shiftOrder.id})失败:`, err);
                            }));
                            console.log(`[部门删除] 已清空排班顺序(ID:${shiftOrder.id})中部门相关岗位(${shiftOrder.position})的员工数据，共${originalNumbersLength}人`);
                        }
                    }
                } catch (shiftOrderError) {
                    console.error(`[部门删除] 处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新操作完成
            if (updatePromises.length > 0) {
                console.log(`[部门删除] 开始等待${updatePromises.length}个更新操作完成`);
                const updateResults = await Promise.allSettled(updatePromises);
                const successfulUpdates = updateResults.filter(result => result.status === 'fulfilled').length;
                const failedUpdates = updateResults.filter(result => result.status === 'rejected').length;
                console.log(`[部门删除] 已完成${updatePromises.length}个排班顺序的更新，成功:${successfulUpdates}，失败:${failedUpdates}`);
            }
            
            console.log(`[部门删除] 排班顺序记录处理完成，共处理 ${processedCount} 条，更新 ${updatedCount} 条`);
            
            // 第五步：清理空的排班顺序记录
            try {
                console.log('[部门删除] 开始清理空的排班顺序记录');
                await this.cleanupEmptyShiftOrders();
                console.log('[部门删除] 已清理空的排班顺序记录');
            } catch (cleanupError) {
                console.error('[部门删除] 清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第六步：刷新排班表显示
            try {
                console.log('[部门删除] 开始刷新排班表显示');
                // 清理缓存，确保获取最新数据
                if (this.clearCache) {
                    this.clearCache();
                    console.log('[部门删除] 已清除排班顺序管理器缓存');
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    console.log('[部门删除] 通过window.loadShiftOrderData刷新排班表显示');
                    await window.loadShiftOrderData();
                    console.log('[部门删除] 通过window.loadShiftOrderData成功刷新排班表显示');
                } else if (window.loadAllShiftOrders) {
                    console.log('[部门删除] 通过window.loadAllShiftOrders刷新排班表显示');
                    await window.loadAllShiftOrders();
                    console.log('[部门删除] 通过window.loadAllShiftOrders成功刷新排班表显示');
                } else {
                    console.log('[部门删除] 未找到合适的刷新方法');
                }
                
                console.log('[部门删除] 排班表显示已刷新');
            } catch (refreshError) {
                console.error('[部门删除] 刷新排班表显示时出错:', refreshError);
            }
            
            console.log('[部门删除] 部门删除时排班数据清理完成');
        } catch (error) {
            console.error('[部门删除] 部门删除时更新排班顺序失败:', error);
        }
    }
    
    // 当岗位被删除时更新排班顺序
    async updateShiftOrderWhenPositionDeleted(positionId) {
        try {
            console.log(`开始更新排班顺序，移除岗位ID: ${positionId}下所有班次的员工`);
            
            // 第一步：获取所有排班顺序
            const allShiftOrders = await window.dbManager.getAll('shiftOrders');
            
            // 第二步：遍历所有排班顺序，查找属于该岗位的记录
            const updatePromises = [];
            
            for (const shiftOrder of allShiftOrders) {
                try {
                    // 如果排班顺序属于该岗位
                    if (shiftOrder.positionId === positionId) {
                        console.log(`清空岗位ID: ${positionId}, 班次ID: ${shiftOrder.shiftId}的排班顺序`);
                        
                        // 确保employeeNumbers是数组
                        if (!Array.isArray(shiftOrder.employeeNumbers)) {
                            shiftOrder.employeeNumbers = [];
                        }
                        
                        // 检查是否有员工数据需要清空
                        const hasEmployeeNumbers = shiftOrder.employeeNumbers.length > 0;
                        
                        if (hasEmployeeNumbers) {
                            // 清空员工号数组
                            shiftOrder.employeeNumbers = [];
                            shiftOrder.updatedAt = new Date();
                            
                            // 保存更新后的排班顺序
                            updatePromises.push(window.dbManager.save('shiftOrders', shiftOrder));
                        }
                    }
                } catch (shiftOrderError) {
                    console.error(`处理排班顺序 ${shiftOrder.id} 失败:`, shiftOrderError);
                    // 继续处理下一个排班顺序，不中断整体流程
                }
            }
            
            // 等待所有更新完成
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                console.log(`已完成${updatePromises.length}个排班顺序的清空操作`);
            }
            
            // 第三步：清理空的排班顺序记录
            try {
                await this.cleanupEmptyShiftOrders();
            } catch (cleanupError) {
                console.error('清理空排班顺序记录时出错:', cleanupError);
                // 清理失败不应影响主流程
            }
            
            // 第四步：刷新排班表显示
            try {
                // 清理缓存，确保获取最新数据
                if (this.clearCache) {
                    this.clearCache();
                }
                
                // 刷新排班表数据
                if (window.loadShiftOrderData) {
                    await window.loadShiftOrderData();
                } else if (window.loadAllShiftOrders) {
                    await window.loadAllShiftOrders();
                }
                
                console.log('排班表显示已刷新');
            } catch (refreshError) {
                console.error('刷新排班表显示时出错:', refreshError);
            }
            
            console.log(`排班顺序更新完成，成功清空岗位ID: ${positionId}下所有班次的员工排班数据`);
        } catch (error) {
            console.error(`更新排班顺序时出错:`, error);
        }
    }
}

// 排班顺序管理实例
// window.shiftOrderManager = new ShiftOrderManager(); // 移除这个立即执行的初始化，避免在dbManager准备好之前创建实例

// 初始化排班顺序管理功能
window.initShiftOrderManagement = async function() {
    try {
        console.log('开始初始化排班顺序管理功能...');
        
        // 创建排班顺序管理实例
        window.shiftOrderManager = new ShiftOrderManager();
        
        // 已移除loadAllShiftOrders()调用，避免与筛选框触发的CHANGE事件加载重复
        // 现在只通过筛选框CHANGE事件来加载数据
        
        // 绑定事件监听器
        bindShiftOrderEvents();
        
        console.log('排班顺序管理功能初始化完成');
    } catch (error) {
        console.error('初始化排班顺序管理功能失败:', error);
    }
};

// 加载所有岗位的排班顺序
async function loadAllShiftOrders() {
    try {
        // 获取所有岗位
        const employees = await window.dbManager.getAll('employees');
        const positions = new Set(employees.map(emp => emp.position).filter(pos => pos));
        
        // 渲染排班顺序列表
        await renderShiftOrderTable(positions);
    } catch (error) {
        console.error('加载排班顺序列表失败:', error);
        showNotification('加载排班顺序列表失败: ' + error.message, 'error');
    }
}

// 根据筛选条件加载排班顺序数据
window.loadShiftOrderData = async function() {
    // 检查是否需要跳过此次加载（仅用于初始化阶段防止重复加载）
    if (window.skipNextShiftOrderLoad) {
        console.log('[跳过] 开始加载排班顺序数据（初始化阶段，已标记跳过）');
        // 仍执行数据加载但不重复输出日志
        // window.skipNextShiftOrderLoad = false; // 不移除标志，让300ms后自动清除
    } else {
        console.log('[Log] 开始加载排班顺序数据');
    }
    
    // 创建规范化ID的函数
    const normalizeId = (id) => {
        if (id === null || id === undefined) return '';
        return String(id).toLowerCase().trim();
    };
    
    try {
        console.log('开始加载排班顺序数据');
        
        // 获取部门和岗位筛选值
        const deptFilter = document.getElementById('shiftOrderDeptFilter');
        const positionFilter = document.getElementById('shiftOrderPositionFilter');
        
        // 确保获取正确的部门值，默认使用空字符串表示"全部部门"
        const selectedDept = deptFilter && deptFilter.value ? deptFilter.value : '';
        const selectedPosition = positionFilter && positionFilter.value ? positionFilter.value : '';
        
        // 保存当前选择的部门和岗位到localStorage
        if (selectedDept) {
            localStorage.setItem('lastSelectedDepartment', selectedDept);
        }
        if (selectedPosition) {
            localStorage.setItem('lastSelectedPosition', selectedPosition);
        }
        
        console.log(`当前选中的部门: ${selectedDept || '全部部门'}, 岗位: ${selectedPosition || '全部岗位'}`);
        
        // 获取所有员工
        const employees = await window.dbManager.getAll('employees');
        
        // 根据筛选条件过滤员工
            let filteredEmployees = employees;
            if (selectedDept) {
                console.log(`开始根据部门[${selectedDept}]筛选员工`);
                
                // 优化：仅使用部门名称进行匹配，不使用机构ID，不区分大小写
                filteredEmployees = filteredEmployees.filter(emp => {
                    if (!emp.deptName) return false;
                    
                    const empDeptName = emp.deptName.toString().trim().toLowerCase();
                    const targetDeptName = selectedDept.toString().trim().toLowerCase();
                    
                    return empDeptName === targetDeptName;
                });
                
                console.log(`部门筛选后员工数量: ${filteredEmployees.length}`);
            }
        
        // 初始化positions变量，确保始终是有效的Set对象
        let positions = new Set(filteredEmployees.map(emp => emp.position).filter(pos => pos));
        if (selectedPosition) {
            positions = new Set([selectedPosition]);
        }
        
        // 获取所有标识数据并过滤员工
        if (window.identifierManager) {
            try {
                const allIdentifiers = await window.identifierManager.getAllIdentifiers();
                
                // 检查是否有标识数据，如果有则进行过滤
                if (allIdentifiers && allIdentifiers.length > 0) {
                    // 只保留至少有一个有效标识（canWork=true）的员工，只用员工号匹配
                    const employeesWithValidIdentifiers = filteredEmployees.filter(employee => {
                        const empNumber = normalizeId(employee.number);
                        return allIdentifiers.some(id => {
                            const identifierNumber = normalizeId(id.employeeNumber || id.employeeId);
                            return identifierNumber === empNumber && id.canWork === true;
                        });
                    });
                    
                    // 使用过滤后的结果
                    filteredEmployees = employeesWithValidIdentifiers;
                    
                    console.log(`过滤后有有效标识的员工数量: ${filteredEmployees.length}`);
                } else {
                    // 如果没有标识数据，显示空列表（只加载有有效标识的员工）
                    console.warn('没有找到标识数据，将显示空列表（只加载有有效标识的员工）');
                    filteredEmployees = [];
                    positions = new Set();
                }
                
                // 重新计算岗位集合
                if (!selectedPosition) {
                    positions = new Set(filteredEmployees.map(emp => emp.position).filter(pos => pos));
                }
                
            } catch (identifierError) {
                console.warn('获取标识数据失败，将显示空列表（只加载有有效标识的员工）:', identifierError);
                // 出错时显示空列表（只加载有有效标识的员工）
                filteredEmployees = [];
                positions = new Set();
            }
        } else {
            console.warn('identifierManager不存在，将显示空列表（只加载有有效标识的员工）');
            // identifierManager不存在时显示空列表（只加载有有效标识的员工）
            filteredEmployees = [];
            positions = new Set();
        }
        
        // 确保positions不为空，先检查positions是否存在
        if ((!positions || !positions.size) && filteredEmployees.length > 0) {
            positions = new Set(filteredEmployees.map(emp => emp.position).filter(pos => pos));
        }
        
        // 渲染排班顺序表格，传递部门参数
        await renderShiftOrderTable(positions, null, filteredEmployees, selectedDept);
    } catch (error) {
        console.error('加载排班顺序数据失败:', error);
        showNotification('加载排班顺序数据失败: ' + error.message, 'error');
    }
}
            
// 注意：此处代码已被清理，renderShiftOrderTable函数的完整实现位于文件下方

// 更新排班顺序表格表头，添加班次列
function updateShiftOrderTableHeader(tableHeader, activeShifts) {
    // 清空表头
    tableHeader.innerHTML = '';
    
    // 添加基础列
    const baseColumns = ['序号', '员工号', '姓名', '所属部门', '岗位'];
    baseColumns.forEach(columnName => {
        const th = document.createElement('th');
        th.textContent = columnName;
        tableHeader.appendChild(th);
    });
    
    // 添加班次列，支持点击编辑
    activeShifts.forEach(shift => {
        const th = document.createElement('th');
        th.textContent = shift.code;
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.dataset.shiftCode = shift.code;
        th.addEventListener('click', async function() {
            // 获取当前选中的岗位
            const positionFilter = document.getElementById('shiftOrderPositionFilter');
            let selectedPosition = positionFilter && positionFilter.value ? positionFilter.value : null;
            
            // 如果没有选中岗位，则提示用户先选择岗位
            if (!selectedPosition) {
                showNotification('请先选择岗位，再点击班次列编辑排班顺序', 'info');
                return;
            }
            
            // 获取当前选中的部门
            const deptFilter = document.getElementById('shiftOrderDeptFilter');
            const selectedDept = deptFilter && deptFilter.value ? deptFilter.value : '';
            
            // 调用按岗位和班次编辑排班顺序的方法，添加部门参数
            await window.editShiftOrderByPositionAndShift(selectedPosition, shift.code, selectedDept);
        });
        
        // 添加悬停效果提示
        th.title = '点击编辑排班顺序';
        tableHeader.appendChild(th);
    });
    

}

// 内部辅助函数：通用的员工排序逻辑
function sortEmployeesByOrder(employees, orderedEmployeeNumbers) {
    return [...employees].sort((a, b) => {
        // 只使用员工号进行比较
        const findIndexWithNumber = (emp) => {
            if (emp.number) {
                const indexByNumber = orderedEmployeeNumbers.findIndex(id => 
                    String(id) === String(emp.number) || 
                    normalizeId(String(id)) === normalizeId(String(emp.number))
                );
                return indexByNumber;
            }
            return -1;
        };
        
        const indexA = findIndexWithNumber(a);
        const indexB = findIndexWithNumber(b);
        
        if (indexA !== -1 && indexB !== -1) {
            // 两个员工都在排班顺序中，按照排班顺序排序
            return indexA - indexB;
        } else if (indexA !== -1) {
            // 只有a在排班顺序中，a排在前面
            return -1;
        } else if (indexB !== -1) {
            // 只有b在排班顺序中，b排在前面
            return 1;
        } else {
            // 两个员工都不在排班顺序中，按姓名排序
            return a.name.localeCompare(b.name);
        }
    });
}

// 内部辅助函数：加载并准备编辑排班顺序（增加部门过滤功能）
async function _prepareEditShiftOrder(position, shiftCode = null, department = '') {
    try {
        // 定义normalizeId函数，用于规范化ID和员工号
        const normalizeId = (id) => {
            if (!id) return '';
            return String(id).toLowerCase().trim();
        };
        
        console.log(`开始准备编辑排班顺序：岗位=${position}，班次=${shiftCode || '无'}`);
        // 注意：不再预先调用window.loadAllShiftOrders()，避免绕过标识过滤逻辑
        // 获取该岗位的所有员工
        const allEmployees = await window.dbManager.getAll('employees');
        console.log(`从数据库获取的员工总数：${allEmployees.length}`);
        // 添加日志检查员工对象结构
        if (allEmployees.length > 0) {
            console.log(`员工对象结构示例：${JSON.stringify(allEmployees[0])}`);
        }
        
        // 先筛选符合岗位和在职状态的员工
        let positionEmployees = allEmployees.filter(emp => emp.position === position && emp.status === 0);
        
        // 当department不为空字符串、"全部部门"或"all"时，添加部门过滤
        // 当department为空字符串(代表"全部部门")时，不进行部门过滤，显示所有部门员工
        const isAllDepartments = !department || department === '' || department === '全部部门' || department === 'all';
        
        if (!isAllDepartments) {
            console.log(`应用部门过滤：${department}`);
            positionEmployees = positionEmployees.filter(emp => {
                if (!emp.deptName) return false;
                
                const empDeptName = emp.deptName.toString().trim().toLowerCase();
                const targetDeptName = department.toString().trim().toLowerCase();
                
                return empDeptName === targetDeptName;
            });
        } else {
            console.log('部门选择为"全部部门"，不进行部门过滤，显示所有部门员工');
        }
        
        // 将positionEmployees中的员工ID改成员工号
        positionEmployees = positionEmployees.map(emp => ({
            ...emp,
            id: emp.number // 使用员工号作为ID
        }));
        
        console.log(`过滤后的岗位员工数：${positionEmployees.length}`);
        // 添加日志检查过滤后的员工对象
        if (positionEmployees.length > 0) {
            console.log(`过滤后员工对象示例：${JSON.stringify(positionEmployees[0])}`);
            
            // 列出所有员工的具体信息
            console.log('所有员工详细信息列表：');
            positionEmployees.forEach((emp, index) => {
                console.log(`${index + 1}. 姓名: ${emp.name || '未设置'}, 工号: ${emp.number}, 职位: ${emp.position}, 状态: ${emp.status === 0 ? '在职' : '离职'}`);
            });
        }
        
        // 未设置该班次的员工列表（用于在剔除列表中显示）
        let notSetShiftEmployees = [];
        
        // 始终只显示有有效标识的员工，无论是否提供了班次代码
        if (window.identifierManager) {
            if (shiftCode) {
                // 如果提供了班次代码，过滤只显示在该班次有标识的员工
                // 获取当前选中的班次ID
                const shifts = await window.dbManager.getAll('shifts');
                const selectedShift = shifts.find(shift => shift.code === shiftCode);
                
                if (selectedShift) {
                    // 获取该班次的所有标识
                    const shiftIdentifiers = await window.identifierManager.getIdentifiersByShiftId(selectedShift.id);
                    
                    // 提取有标识且canWork为true的员工（包含employeeNumber或employeeId）
                    const allIdentifiersWithCanWork = shiftIdentifiers.filter(identifier => identifier.canWork === true);
                    
                    // 统计并记录使用情况
                    const employeeNumberCount = allIdentifiersWithCanWork.filter(identifier => identifier.employeeNumber).length;
                    const employeeIdOnlyCount = allIdentifiersWithCanWork.filter(identifier => identifier.employeeId && !identifier.employeeNumber).length;
                    console.log(`canWork为true的标识总数: ${allIdentifiersWithCanWork.length}`);
                    console.log(`有员工号(employeeNumber)的标识数: ${employeeNumberCount}`);
                    console.log(`只有员工ID(employeeId)的标识数: ${employeeIdOnlyCount}`);
                    
                    // 生成员工号列表，严格使用员工号
                    const identifiedEmployeeNumbers = [];
                    
                    // 首先处理已有employeeNumber的标识
                    const identifiersWithNumber = allIdentifiersWithCanWork.filter(identifier => identifier.employeeNumber);
                    identifiersWithNumber.forEach(identifier => {
                        identifiedEmployeeNumbers.push(identifier.employeeNumber);
                    });
                    
                    // 收集只有employeeId的标识
                    const identifiersWithOnlyId = allIdentifiersWithCanWork.filter(identifier => identifier.employeeId && !identifier.employeeNumber);
                    console.log(`待处理只有employeeId的标识数: ${identifiersWithOnlyId.length}`);
                    
                    // 对于只有employeeId的标识，通过employeeId查找对应的员工，获取其员工号
                    // 这确保了我们始终使用员工号进行匹配，而不是直接使用employeeId
                    let additionalNumbersAdded = 0;
                    for (const identifier of identifiersWithOnlyId) {
                        try {
                            // 通过window.dbManager.getById直接从数据库获取员工信息
                            const employee = await window.dbManager.getById('employees', identifier.employeeId);
                            if (employee && employee.number) {
                                identifiedEmployeeNumbers.push(employee.number);
                                additionalNumbersAdded++;
                            } else {
                                console.warn(`通过employeeId ${identifier.employeeId} 未找到对应的员工号`);
                            }
                        } catch (error) {
                            console.error(`通过employeeId ${identifier.employeeId} 获取员工信息失败: ${error.message}`);
                        }
                    }
                    
                    console.log(`通过employeeId成功获取并添加的员工号数量: ${additionalNumbersAdded}`);
                    console.log(`已添加到identifiedEmployeeNumbers的员工号总数: ${identifiedEmployeeNumbers.length}`);
                    
                    // 先过滤只保留在该班次有有效标识的员工，严格按员工号匹配
                    console.log(`过滤前positionEmployees数量: ${positionEmployees.length}`);
                    console.log(`identifiedEmployeeNumbers列表: ${JSON.stringify(identifiedEmployeeNumbers)}`);
                    
                    // 记录匹配信息
                    const matchedEmployees = [];
                    const unmatchedEmployees = [];
                    
                    positionEmployees = positionEmployees.filter(emp => {
                        const empNumber = String(emp.number);
                        const isMatched = identifiedEmployeeNumbers.some(identifiedNumber => String(identifiedNumber) === empNumber);
                        
                        if (isMatched) {
                            matchedEmployees.push({name: emp.name || '未设置', number: emp.number});
                        } else {
                            unmatchedEmployees.push({name: emp.name || '未设置', number: emp.number});
                        }
                        
                        // 只保留canWork为true的员工
                        return isMatched;
                    });
                    
                    // 输出匹配结果统计
                    console.log(`成功匹配的员工数量: ${matchedEmployees.length}`);
                    console.log(`未匹配的员工数量: ${unmatchedEmployees.length}`);
                    if (matchedEmployees.length > 0) {
                        console.log(`匹配成功的员工列表: ${JSON.stringify(matchedEmployees)}`);
                    }
                    if (unmatchedEmployees.length > 0) {
                        console.log(`未匹配的员工列表: ${JSON.stringify(unmatchedEmployees)}`);
                    }
                } else {
                    console.warn('没有找到对应的班次，将使用岗位员工列表并跳过标识过滤');
                    // 如果没有找到对应的班次，不设置空列表，而是保留原始岗位员工列表
                }
            } else {
                // 如果没有提供班次代码，过滤所有有有效标识的员工
                try {
                    const allIdentifiers = await window.identifierManager.getAllIdentifiers();
                    // 只保留至少有一个有效标识（canWork=true）的员工，严格按员工号匹配
                    const employeesWithValidIdentifiers = positionEmployees.filter(employee => {
                        const empNumber = String(employee.number);
                        const hasValidIdentifier = allIdentifiers.some(id => {
                            const identifierNumber = String(id.employeeNumber || id.employeeId);
                            return identifierNumber === empNumber && id.canWork === true;
                        });
                        return hasValidIdentifier;
                    });
                    
                    positionEmployees = employeesWithValidIdentifiers;
                } catch (error) {
                    console.warn('获取所有标识数据失败，将显示空列表:', error);
                    positionEmployees = [];
                }
            }
            
            // 当过滤后没有有效员工但标识管理中有有效标识时，从标识管理中创建临时员工对象
            if (positionEmployees.length === 0) {
                console.log('过滤后没有有效员工，尝试从标识管理创建临时员工对象');
                try {
                    let validIdentifiers;
                    if (shiftCode) {
                        const shifts = await window.dbManager.getAll('shifts');
                        const selectedShift = shifts.find(shift => shift.code === shiftCode);
                        if (selectedShift) {
                            validIdentifiers = await window.identifierManager.getIdentifiersByShiftId(selectedShift.id);
                        }
                    } else {
                        validIdentifiers = await window.identifierManager.getAllIdentifiers();
                    }
                    
                    if (validIdentifiers && validIdentifiers.length > 0) {
                        // 过滤出canWork为true的标识
                        const activeIdentifiers = validIdentifiers.filter(id => id.canWork === true);
                        
                        if (activeIdentifiers.length > 0) {
                            console.log('从标识管理中创建临时员工对象，数量:', activeIdentifiers.length);
                            
                            // 创建临时员工对象映射（避免重复）
                            const tempEmployeesMap = new Map();
                            
                            // 为每个有效标识创建临时员工对象
                            for (const identifier of activeIdentifiers) {
                                // 使用employeeNumber作为员工号，如果没有则使用employeeId
                                const employeeNumber = identifier.employeeNumber || identifier.employeeId;
                                
                                if (!tempEmployeesMap.has(employeeNumber)) {
                                    // 尝试从数据库中获取实际的员工信息
                                    let tempEmployee = null;
                                    
                                    try {
                                        // 优先通过员工号查找
                                        if (identifier.employeeNumber) {
                                            const employeeByNumber = await window.dbManager.getByIndex('employees', 'number', identifier.employeeNumber);
                                            if (employeeByNumber && employeeByNumber.length > 0) {
                                                tempEmployee = employeeByNumber[0];
                                            }
                                        }
                                        
                                        // 如果通过员工号没找到，尝试通过员工ID查找
                                        if (!tempEmployee && identifier.employeeId) {
                                            const employeeById = await window.dbManager.getById('employees', identifier.employeeId);
                                            if (employeeById) {
                                                tempEmployee = employeeById;
                                            }
                                        }
                                    } catch (error) {
                                        console.warn('查找实际员工信息失败:', error);
                                    }
                                    
                                    // 如果找不到实际的员工信息，创建默认的临时员工对象
                                    if (!tempEmployee) {
                                        tempEmployee = {
                                            id: identifier.employeeNumber, // 使用员工号作为ID
                                            number: identifier.employeeNumber,
                                            name: identifier.employeeNumber ? `员工${identifier.employeeNumber}` : `未知员工`, // 默认名称
                                            position: position, // 使用当前岗位
                                            department: '', // 默认为空
                                            status: 0 // 在职状态
                                        };
                                    }
                                    
                                    tempEmployeesMap.set(employeeNumber, tempEmployee);
                                }
                            }
                            
                            // 转换为数组
                            positionEmployees = Array.from(tempEmployeesMap.values());
                            console.log(`成功从标识管理创建临时员工对象数量: ${positionEmployees.length}`);
                        }
                    }
                } catch (error) {
                    console.warn('从标识管理创建临时员工对象失败:', error);
                }
            }
        } else {
            // 如果identifierManager不存在，显示空列表
            console.warn('identifierManager不存在，将显示空列表');
            positionEmployees = [];
        }
        
        // 获取当前排班顺序
        let shiftOrder;
        let orderedEmployeeNumbers = [];
        
        if (shiftCode) {
            shiftOrder = await window.shiftOrderManager.getShiftOrderByPositionAndShift(position, shiftCode, department);
        } else {
            shiftOrder = await window.shiftOrderManager.getShiftOrderByPosition(position);
        }
        
        if (shiftOrder) {
            // 只使用employeeNumbers
            orderedEmployeeNumbers = shiftOrder.employeeNumbers || [];
        }
        
        // 创建员工号到员工对象的映射，使用规范化处理
        const employeeMapByNumber = new Map();
        
        positionEmployees.forEach(emp => {
            // 使用规范化的员工号作为主要匹配依据
            const empNumber = String(emp.number);
            const normalizedEmpNumber = normalizeId(empNumber);
            employeeMapByNumber.set(empNumber, emp);
            employeeMapByNumber.set(normalizedEmpNumber, emp);
        });
        
        // 严格按照用户需求：
        // 1. 员工号是否存在由标识管理中该班次的有效标识决定
        // 2. 展示顺序按数据库中该班次的顺序
        // 3. 如果数据库中的员工没有有效标识，后面的员工顺序自动前移
        
        // 创建严格按照数据库顺序的员工列表，只包含有有效标识的员工
        const orderedEmployees = [];
        const validEmployeeNumbers = new Set();
        
        // 为了确保顺序正确，我们需要先确定哪些员工有有效标识
        // 注意：positionEmployees已经被过滤，只包含有有效标识的员工
        positionEmployees.forEach(emp => {
            // 使用规范化的员工号作为有效标识的判断依据
            const empNumber = String(emp.number);
            const normalizedEmpNumber = normalizeId(empNumber);
            validEmployeeNumbers.add(empNumber);
            validEmployeeNumbers.add(normalizedEmpNumber);
        });
        
        // 首先创建原始排序列表中的员工号集合，用于后面判断notSetShiftEmployees
        const originalOrderedEmployeeNumbersSet = new Set();
        if (orderedEmployeeNumbers && orderedEmployeeNumbers.length > 0) {
            orderedEmployeeNumbers.forEach(empNumber => {
                const empNumStr = String(empNumber);
                const normalizedEmpNumStr = normalizeId(empNumStr);
                originalOrderedEmployeeNumbersSet.add(empNumStr);
                originalOrderedEmployeeNumbersSet.add(normalizedEmpNumStr);
            });
        }
        
        // 首先按照数据库中的employeeNumbers顺序处理，只保留有有效标识的员工
        if (orderedEmployeeNumbers && orderedEmployeeNumbers.length > 0) {
            orderedEmployeeNumbers.forEach(empNumber => {
                const empNumStr = String(empNumber);
                const normalizedEmpNumStr = normalizeId(empNumStr);
                
                // 检查这个员工号是否有有效标识
                if (validEmployeeNumbers.has(empNumStr) || validEmployeeNumbers.has(normalizedEmpNumStr)) {
                    const emp = employeeMapByNumber.get(empNumStr) || employeeMapByNumber.get(normalizedEmpNumStr);
                    if (emp) {
                        orderedEmployees.push(emp);
                        // 标记为已处理，避免重复添加
                        validEmployeeNumbers.delete(empNumStr);
                        validEmployeeNumbers.delete(normalizedEmpNumStr);
                    }
                }
                // 严格只使用员工号进行匹配，不再检查员工ID
                // 注意：如果员工没有有效标识，就不会添加到列表中，后面的员工会自动前移
            });
        }
        
        // 不再处理employeeIds，严格只使用员工号进行匹配
        
        // 计算有有效标识但没有在原始排班顺序中的员工
        // 这里要在添加剩余员工到orderedEmployees之前计算，确保正确
        if (shiftCode) {
            // 筛选出有有效标识(canWork=true)但没有在原始排班顺序中的员工
            notSetShiftEmployees = positionEmployees.filter(emp => {
                const empNumber = String(emp.number);
                const normalizedEmpNumber = normalizeId(empNumber);
                // 检查员工是否不在原始排班顺序中
                return !originalOrderedEmployeeNumbersSet.has(empNumber) && !originalOrderedEmployeeNumbersSet.has(normalizedEmpNumber);
            });
            
            console.log(`有有效标识但没有在排班顺序中的员工数量: ${notSetShiftEmployees.length}`);
        } else {
            // 如果没有提供班次代码，使用所有不在原始排班顺序中的员工作为剔除列表
            notSetShiftEmployees = positionEmployees.filter(emp => {
                const empNumber = String(emp.number);
                const normalizedEmpNumber = normalizeId(empNumber);
                // 检查员工是否不在原始排班顺序中
                return !originalOrderedEmployeeNumbersSet.has(empNumber) && !originalOrderedEmployeeNumbersSet.has(normalizedEmpNumber);
            });
        }
        
        // 当数据库中没有排班顺序记录但有临时员工时，直接添加这些临时员工
        if (orderedEmployees.length === 0 && positionEmployees.length > 0) {
            // 当没有数据库记录时，直接使用从标识管理创建的临时员工
            console.log('数据库中没有排班顺序记录，直接使用从标识管理创建的临时员工');
            if (shiftCode) {
                // 当有班次代码时，只添加到未设置班次的员工列表，这样它们会显示在剔除列表中
                notSetShiftEmployees = [...positionEmployees];
                console.log(`将所有${positionEmployees.length}个员工添加到剔除列表`);
            } else {
                // 当没有班次代码时，直接添加到主列表
                orderedEmployees.push(...positionEmployees);
            }
        } else if (!shiftCode) {
            // 只有在没有班次代码时，才添加剩余的有有效标识但不在排序列表中的员工
            
            // 优先添加通过员工号找到的剩余员工
            validEmployeeNumbers.forEach(empNumber => {
                const normalizedEmpNumber = normalizeId(empNumber);
                const emp = employeeMapByNumber.get(empNumber) || employeeMapByNumber.get(normalizedEmpNumber);
                if (emp) {
                    orderedEmployees.push(emp);
                }
            });
            
            // 不需要再添加通过ID找到的剩余员工，因为我们已经确保每个员工在employeeMapByNumber中都有映射
            
            // 对这部分员工按姓名排序
            const startIndex = orderedEmployees.length - validEmployeeNumbers.size;
            if (startIndex < orderedEmployees.length - 1 && startIndex >= 0) {
                const remainingEmployees = orderedEmployees.splice(startIndex);
                remainingEmployees.sort((a, b) => a.name.localeCompare(b.name));
                orderedEmployees.push(...remainingEmployees);
            }
        }
        
        console.log(`最终准备的员工列表数量: ${orderedEmployees.length}`);
        
        // 显示编辑模态框，传递有序员工列表
        // 同时传递未设置该班次的员工列表和部门信息
        showShiftOrderEditModal(position, orderedEmployees, shiftCode, notSetShiftEmployees, department);
    } catch (error) {
        console.error('编辑排班顺序失败:', error);
        showNotification('编辑排班顺序失败: ' + error.message, 'error');
    }
}

// 按岗位和班次编辑排班顺序（增加部门参数）
window.editShiftOrderByPositionAndShift = function(position, shiftCode, department) {
    return _prepareEditShiftOrder(position, shiftCode, department);
};

// 显示排班顺序编辑模态框
function showShiftOrderEditModal(position, employees, shiftCode = null, notSetShiftEmployees = [], department = '') {
    console.log(`进入showShiftOrderEditModal函数：传入员工数=${employees ? employees.length : 0}，未设置班次员工数=${notSetShiftEmployees ? notSetShiftEmployees.length : 0}，部门=${department}`);
    // 检查传入的员工对象结构
    if (employees && employees.length > 0) {
        console.log(`传入员工对象结构示例：${JSON.stringify(employees[0])}`);
    }
    const modal = document.getElementById('shiftOrderEditModal');
    const title = document.getElementById('shiftOrderModalTitle');
    const employeeList = document.getElementById('shiftOrderEmployeeList');
    const positionInput = document.getElementById('shiftOrderPositionInput');
    const shiftCodeInput = document.getElementById('shiftOrderShiftCodeInput');
    
    if (!modal || !title || !employeeList || !positionInput) return;
    
    // 设置标题和岗位
    if (shiftCode) {
        title.textContent = `编辑${position}岗位${shiftCode}班次排班顺序${department ? '(' + department + ')' : ''}`;
        // 如果存在班次代码输入框，设置其值
        if (shiftCodeInput) {
            shiftCodeInput.value = shiftCode;
            shiftCodeInput.style.display = 'block';
        }
    } else {
        title.textContent = `编辑${position}岗位排班顺序${department ? '(' + department + ')' : ''}`;
        // 如果存在班次代码输入框，隐藏它
        if (shiftCodeInput) {
            shiftCodeInput.style.display = 'none';
        }
    }
    
    positionInput.value = position;
    
    // 添加或更新隐藏的部门输入字段
    let departmentInput = document.getElementById('shiftOrderDepartmentInput');
    if (!departmentInput) {
        departmentInput = document.createElement('input');
        departmentInput.type = 'hidden';
        departmentInput.id = 'shiftOrderDepartmentInput';
        positionInput.parentNode.appendChild(departmentInput);
    }
    departmentInput.value = department;
    
    // 清空并填充员工列表
    employeeList.innerHTML = '';
    
    // 创建被剔除的员工容器
    let excludedEmployeesContainer = document.getElementById('excludedEmployeesContainer');
    if (!excludedEmployeesContainer) {
        excludedEmployeesContainer = document.createElement('div');
        excludedEmployeesContainer.id = 'excludedEmployeesContainer';
        // 初始设置为隐藏，后面会根据情况显示
        excludedEmployeesContainer.style.display = 'none';
        excludedEmployeesContainer.innerHTML = `
            <h4 style="margin-top: 20px; margin-bottom: 10px;">已剔除人员（点击可重新添加）</h4>
            <div id="excludedEmployeesList" style="
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                padding: 10px;
                background: rgba(255, 0, 0, 0.05);
            "></div>
        `;
        employeeList.parentNode.appendChild(excludedEmployeesContainer);
    }
    
    // 清空被剔除人员列表
    const excludedEmployeesList = document.getElementById('excludedEmployeesList');
    if (excludedEmployeesList) {
        excludedEmployeesList.innerHTML = '';
    }
    
    // 当按班次编辑时，始终显示剔除列表容器
    if (shiftCode) {
        excludedEmployeesContainer.style.display = 'block';
    } else {
        excludedEmployeesContainer.style.display = 'none';
    }
    
    // 创建更新序号函数
    function updateEmployeeNumbers() {
        const items = employeeList.querySelectorAll('.shift-order-employee-item');
        items.forEach((item, index) => {
            const numberSpan = item.querySelector('.employee-number');
            if (numberSpan) {
                // 确保显示为1, 2, 3等数字格式
                numberSpan.textContent = (index + 1) + '.';
                console.log(`更新序号: ${index + 1} 员工ID: ${item.dataset.employeeId}`);
            }
        });
    }
    
    // 添加员工到拖拽列表
    function addEmployeeToDraggableList(employee) {
        console.log(`添加员工到拖拽列表：${JSON.stringify(employee)}`);
        const item = document.createElement('div');
        item.className = 'shift-order-employee-item';
        item.draggable = true;
        item.dataset.employeeId = employee.number; // 使用员工号作为ID
        item.dataset.employeeNumber = employee.number; // 使用员工号
        item.innerHTML = `
            <span class="employee-number" style="width: 20px; display: inline-block; text-align: right; margin-right: 8px;">1.</span>
            <span class="shift-order-employee-handle">⋮⋮</span>
            <div class="employee-info">
                <span class="employee-name">${employee.name}</span>
                <span class="employee-detail">${employee.number}</span>
            </div>
            <button class="exclude-btn" style="
                margin-left: auto;
                background: rgba(255, 0, 0, 0.2);
                border: none;
                border-radius: 4px;
                color: white;
                padding: 4px 8px;
                cursor: pointer;
            ">剔除</button>
        `;
        
        // 添加拖拽事件
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.dataset.employeeId);
            this.classList.add('dragging');
        });
        
        item.addEventListener('dragend', function() {
            this.classList.remove('dragging');
        });
        
        // 添加剔除按钮事件
        const excludeBtn = item.querySelector('.exclude-btn');
        excludeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            excludeEmployee(employee);
        });
        
        employeeList.appendChild(item);
        updateEmployeeNumbers();
    }
    
    // 将员工添加到被剔除列表
    function excludeEmployee(employee) {
        // 从拖拽列表中移除 - 修复：不再使用parseInt，直接使用字符串比较
        const items = employeeList.querySelectorAll('.shift-order-employee-item');
        items.forEach(item => {
            if (item.dataset.employeeId === String(employee.number)) {
                item.remove();
            }
        });
        
        // 添加到被剔除列表
        const excludedItem = document.createElement('div');
        excludedItem.className = 'shift-order-employee-item';
        excludedItem.dataset.employeeId = employee.number; // 使用员工号作为ID
        excludedItem.dataset.employeeNumber = employee.number; // 使用员工号
        excludedItem.innerHTML = `
            <span class="shift-order-employee-handle">+</span>
            <div class="employee-info">
                <span class="employee-name">${employee.name}</span>
                <span class="employee-detail">${employee.number}</span>
            </div>
        `;
        excludedItem.style.cursor = 'pointer';
        excludedItem.style.background = 'rgba(255, 0, 0, 0.1)';
        
        // 添加点击事件，重新添加到拖拽列表（始终放在最后位置）
        excludedItem.addEventListener('click', function() {
            this.remove();
            // 直接创建员工元素并添加到列表末尾
            const item = document.createElement('div');
            item.className = 'shift-order-employee-item';
            item.draggable = true;
            item.dataset.employeeId = employee.number; // 使用员工号作为ID
            item.dataset.employeeNumber = employee.number; // 使用员工号
            item.innerHTML = `
                <span class="employee-number">${employeeList.children.length + 1}.</span>
                <span class="shift-order-employee-handle">⋮⋮</span>
                <div class="employee-info">
                    <span class="employee-name">${employee.name}</span>
                    <span class="employee-detail">${employee.number}</span>
                </div>
                <button class="exclude-btn" style="
                    margin-left: auto;
                    background: rgba(255, 0, 0, 0.2);
                    border: none;
                    border-radius: 4px;
                    color: white;
                    padding: 4px 8px;
                    cursor: pointer;
                ">剔除</button>
            `;
            
            // 添加拖拽事件
            item.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', this.dataset.employeeId);
                this.classList.add('dragging');
            });
            
            item.addEventListener('dragend', function() {
                this.classList.remove('dragging');
            });
            
            // 添加剔除按钮事件
            const excludeBtn = item.querySelector('.exclude-btn');
            excludeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                excludeEmployee(employee);
            });
            
            // 添加到列表末尾
            employeeList.appendChild(item);
            updateEmployeeNumbers();
            updateExcludedContainerVisibility();
        });
        
        excludedEmployeesList.appendChild(excludedItem);
        updateEmployeeNumbers();
        updateExcludedContainerVisibility();
    }
    
    // 更新被剔除容器的可见性
    function updateExcludedContainerVisibility() {
        // 当按班次编辑时，始终显示剔除列表容器，无论是否有被剔除的员工
        if (shiftCode) {
            excludedEmployeesContainer.style.display = 'block';
        } else {
            // 非按班次编辑时，根据是否有被剔除的员工决定显示或隐藏
            if (excludedEmployeesList.children.length > 0) {
                excludedEmployeesContainer.style.display = 'block';
            } else {
                excludedEmployeesContainer.style.display = 'none';
            }
        }
    }
    
    // 直接使用传入的员工列表，这个列表已经在_prepareEditShiftOrder函数中按照数据库顺序排序好了
    employees.forEach(employee => {
        addEmployeeToDraggableList(employee);
    });
    
    // 将未设置该班次的员工添加到剔除列表中
    if (notSetShiftEmployees && notSetShiftEmployees.length > 0) {
        // 1. 首先创建一个映射，用于快速检查员工是否已在主列表中
        const mainListEmployeeNumbers = new Set();
        employees.forEach(emp => {
            mainListEmployeeNumbers.add(String(emp.number));
        });
        
        // 2. 直接将当前岗位的未设置班次员工添加到剔除列表，不添加到主列表
        notSetShiftEmployees.forEach(employee => {
            // 确保只处理当前岗位的员工
            if (employee.position === position) {
                const empNumber = String(employee.number);
                
                // 检查该员工是否已经在主列表中
                if (!mainListEmployeeNumbers.has(empNumber)) {
                    // 直接添加到剔除列表，不添加到主列表
                    excludeEmployee(employee);
                }
            }
        });
    }
    
    // 设置拖拽放置事件
    employeeList.addEventListener('dragover', function(e) {
        e.preventDefault();
        const afterElement = getDragAfterElement(this, e.clientY);
        const draggable = document.querySelector('.dragging');
        
        if (afterElement == null) {
            this.appendChild(draggable);
        } else {
            this.insertBefore(draggable, afterElement);
        }
        
        // 更新序号
        updateEmployeeNumbers();
    });
    
    // 更新保存按钮的点击事件，根据是否有shiftCode来决定调用哪个保存方法
    // 使用更精确的选择器，确保找到正确的保存按钮
    var saveBtn = document.querySelector('#shiftOrderEditModal .modal-footer .btn-primary');
    if (saveBtn) {
        console.log('找到保存按钮，准备绑定事件');
        // 移除之前的事件监听器
        var newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        // 为了确保shiftCode在事件处理程序中可用，我们使用一个立即执行的函数表达式
        (function(currentShiftCode) {
            // 添加新的事件监听器
            newSaveBtn.addEventListener('click', function() {
                console.log('保存按钮被点击，currentShiftCode:' + currentShiftCode);
                // 从DOM中获取最新的shiftCode值，这样更可靠
                var latestShiftCodeInput = document.getElementById('shiftOrderShiftCodeInput');
                var latestShiftCode = latestShiftCodeInput ? latestShiftCodeInput.value : null;
                console.log('从DOM获取的shiftCode:' + latestShiftCode);
                
                if (latestShiftCode) {
                    // 调用按班次保存的方法
                    window.saveShiftOrderByShift();
                } else {
                    // 不再支持岗位级排班顺序保存，必须提供shiftCode
                    console.error('不支持岗位级排班顺序保存，必须选择具体班次');
                    showNotification('请选择具体班次后再保存', 'error');
                }
            });
        })(shiftCode);
    } else {
        console.error('未找到保存按钮！选择器: #shiftOrderEditModal .modal-footer .btn-primary');
    }
    
    // 添加清空按钮
    var modalFooter = document.querySelector('#shiftOrderEditModal .modal-footer');
    if (modalFooter) {
        // 检查是否已经存在清空按钮
        var clearBtn = document.querySelector('#shiftOrderEditModal .modal-footer .btn-danger');
        if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.className = 'btn btn-danger';
            clearBtn.textContent = '清空排序';
            clearBtn.style.marginLeft = '10px';
            
            // 在模态框底部添加清空按钮
            // 优先放在保存按钮旁边，如果找不到保存按钮则直接添加到模态框底部
            try {
                if (saveBtn && saveBtn.parentNode) {
                    saveBtn.parentNode.insertBefore(clearBtn, saveBtn.nextSibling);
                } else {
                    // 如果没有保存按钮或无法访问其父元素，直接添加到模态框底部
                    modalFooter.appendChild(clearBtn);
                }
            } catch (error) {
                console.warn('在保存按钮旁边添加清空按钮失败，尝试直接添加到模态框底部:', error);
                modalFooter.appendChild(clearBtn);
            }
            
            // 只在创建新按钮时添加点击事件，避免多次绑定
            clearBtn.addEventListener('click', function() {
                var position = document.getElementById('shiftOrderPositionInput').value;
                var shiftCodeInput = document.getElementById('shiftOrderShiftCodeInput');
                var shiftCode = shiftCodeInput ? shiftCodeInput.value : null;
                
                var confirmMessage = shiftCode ? 
                    `确定要清空${position}岗位${shiftCode}班次的排班顺序吗？` : 
                    `确定要清空${position}岗位的排班顺序吗？`;
                
                if (confirm(confirmMessage)) {
                    window.clearShiftOrder(position, shiftCode);
                }
            });
        }
    } else {
        console.error('未找到模态框底部！选择器: #shiftOrderEditModal .modal-footer');
    }
    
    // 显示模态框前，确保'不再进行排序'复选框处于未勾选状态
    var excludeAllCheckbox = document.getElementById('excludeAllEmployees');
    if (excludeAllCheckbox) {
        excludeAllCheckbox.checked = false;
    }
    
    // 显示模态框
    modal.style.display = 'block';
}

// 辅助函数：获取拖拽元素应该放置的位置
function getDragAfterElement(container, y) {
    // 使用传统方法获取元素列表
    const elements = container.querySelectorAll('.shift-order-employee-item:not(.dragging)');
    const draggableElements = [];
    for (var i = 0; i < elements.length; i++) {
        draggableElements.push(elements[i]);
    }
    
    // 手动实现reduce逻辑
    let closest = { offset: -Infinity, element: null };
    for (var i = 0; i < draggableElements.length; i++) {
        const child = draggableElements[i];
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            closest = { offset: offset, element: child };
        }
    }
    
    return closest.element;
}

// 内部辅助函数：重新加载排班顺序数据 - 修复重复加载问题
function _reloadShiftOrderData() {
    // 精简实现，直接调用加载函数
    console.log('重新加载排班数据');
    
    // 先确保shiftOrderManager实例已经初始化并清除缓存
    if (window.shiftOrderManager && window.shiftOrderManager.clearCache) {
        window.shiftOrderManager.clearCache();
    }
    
    // 直接调用核心加载函数
    if (window.loadShiftOrderData) {
        try {
            const result = window.loadShiftOrderData();
            if (result && typeof result.then === 'function') {
                return result.then(() => {
                    console.log('排班数据重新加载成功');
                }).catch(error => {
                    console.error('loadShiftOrderData执行失败:', error);
                    throw error;
                });
            } else {
                console.log('直接调用loadShiftOrderData完成');
                return Promise.resolve();
            }
        } catch (error) {
            console.error('执行过程中发生错误:', error);
            return Promise.reject(error);
        }
    } else if (typeof loadAllShiftOrders === 'function') {
        // 作为备选方案
        try {
            const result = loadAllShiftOrders();
            if (result && typeof result.then === 'function') {
                return result.then(() => {
                    console.log('调用loadAllShiftOrders成功');
                }).catch(error => {
                    console.error('loadAllShiftOrders执行失败:', error);
                    throw error;
                });
            } else {
                console.log('直接调用loadAllShiftOrders完成');
                return Promise.resolve();
            }
        } catch (error) {
            console.error('执行过程中发生错误:', error);
            return Promise.reject(error);
        }
    } else {
        console.error('错误: 未找到数据加载函数');
        return Promise.reject(new Error('未找到数据加载函数'));
    }
}

// 内部辅助函数：强制刷新排班顺序表格
function _refreshShiftOrderTable() {
    try {
        const tableBody = document.getElementById('shift-order-table-body');
        const positionFilter = document.getElementById('shiftOrderPositionFilter');
        const deptFilter = document.getElementById('shiftOrderDeptFilter');
        const selectedPosition = positionFilter && positionFilter.value ? positionFilter.value : null;
        const selectedDept = deptFilter && deptFilter.value ? deptFilter.value : '';
        
        if (tableBody) {
            console.log('执行排班表格强制刷新，选中的岗位:', selectedPosition, '选中的部门:', selectedDept);
            
            // 获取所有员工
            window.dbManager.getAll('employees').then(async function(allEmployees) {
                // 根据选中的部门和岗位筛选员工
                let filteredEmployees = allEmployees || [];
                
                // 先根据部门筛选
                if (selectedDept) {
                    // 优化：仅使用部门名称进行匹配，不使用机构ID，不区分大小写
                    filteredEmployees = filteredEmployees.filter(emp => {
                        if (!emp.deptName) return false;
                        
                        const empDeptName = emp.deptName.toString().trim().toLowerCase();
                        const targetDeptName = selectedDept.toString().trim().toLowerCase();
                        
                        return empDeptName === targetDeptName;
                    });
                }
                
                // 然后根据岗位筛选
                if (selectedPosition) {
                    filteredEmployees = filteredEmployees.filter(emp => emp.position === selectedPosition);
                }
                
                // 过滤只显示有有效标识（canWork=true）的员工
            if (window.identifierManager) {
                try {
                    // 获取所有标识
                    const allIdentifiers = await window.identifierManager.getAllIdentifiers();
                    // 只保留至少有一个有效标识（canWork=true）的员工，按员工号匹配
                    const employeesWithValidIdentifiers = filteredEmployees.filter(employee => {
                        const empNumber = String(employee.number || employee.id);
                        return allIdentifiers.some(id => {
                            const identifierNumber = String(id.employeeNumber || id.employeeId);
                            return identifierNumber === empNumber && id.canWork === true;
                        });
                    });
                    
                    // 始终使用过滤后的结果，即使结果为空
                    filteredEmployees = employeesWithValidIdentifiers;
                    console.log(`过滤后有有效标识的员工数量: ${filteredEmployees.length}`);
                } catch (identifierError) {
                    console.warn('获取标识数据失败，显示空列表:', identifierError);
                    // 获取标识数据失败时，显示空列表而不是所有员工
                    filteredEmployees = [];
                    // 确保修改的是局部变量positions
                    positions = new Set();
                }
            } else {
                // identifierManager不存在时，显示空列表
                filteredEmployees = [];
                // 确保修改的是局部变量positions
                positions = new Set();
                console.warn('identifierManager不存在，显示空列表');
            }
                
                // 创建岗位集合
                let positions = new Set();
                if (selectedPosition) {
                    positions = new Set([selectedPosition]);
                } else if (filteredEmployees && filteredEmployees.length > 0) {
                    positions = new Set(filteredEmployees.map(emp => emp.position).filter(pos => pos));
                }
                
                // 强制重新渲染表格
                if (positions.size > 0) {
                    renderShiftOrderTable(positions, null, filteredEmployees);
                }
            });
        }
    } catch (error) {
        console.error('刷新排班表格时发生错误:', error);
    }
}

// 内部辅助函数：保存排班顺序的通用逻辑
function _saveShiftOrderInternal(position, employeeNumbers, shiftCode = null, excludeAllEmployees = false, department = '') {
    console.log('8. 进入内部保存函数 _saveShiftOrderInternal()');
    console.log('   - 参数:', {position, employeeNumbers, shiftCode, excludeAllEmployees, department});
    // 关闭模态框
    document.getElementById('shiftOrderEditModal').style.display = 'none';
    
    // 实际保存排班顺序到存储中
    let savePromise;
    if (shiftCode) {
        // 如果是剔除列表所有人员，我们存储一个特殊的标记值
        // 表示所有人员都没有排序（值为0）
        const saveData = excludeAllEmployees ? { position, shiftCode, excludeAllEmployees: true, employeeNumbers } : { position, shiftCode, employeeNumbers };
        console.log('9. 准备调用 ShiftOrderManager.saveShiftOrderByShift 方法');
        console.log('   - 保存数据准备:', saveData);
        savePromise = window.shiftOrderManager.saveShiftOrderByShift(position, shiftCode, employeeNumbers, excludeAllEmployees, department);
    } else {
        // 不再支持岗位级排班顺序保存，只支持班次级保存
        console.error('不支持岗位级排班顺序保存，必须提供shiftCode');
        showNotification('不支持岗位级排班顺序保存，请选择具体班次', 'error');
        return Promise.reject(new Error('不支持岗位级排班顺序保存，必须提供shiftCode'));
    }
    
    // 保存成功后添加短暂延迟确保数据完全写入，然后重新加载数据并刷新表格
    return savePromise
        .then(function() {
            console.log('排班顺序已成功保存到存储，等待一小段时间确保数据完全写入');
            // 添加短暂延迟确保数据完全写入数据库
            return new Promise(resolve => setTimeout(resolve, 100));
        })
        .then(function() {
            console.log('准备重新加载数据');
            return _reloadShiftOrderData();
        })
        .then(function() {
            console.log('排班数据已重新加载并刷新表格');
            // 根据是否勾选了剔除列表所有人员决定通知内容
            const message = excludeAllEmployees ? '已设置班次所有人员为不分先后' : '排班顺序保存成功';
            showNotification(message);
        })
        .catch(function(error) {
            console.error('保存排班顺序失败: ' + error);
            showNotification('保存排班顺序失败: ' + (error.message || error), 'error');
        });
}



// 按班次保存排班顺序
window.saveShiftOrderByShift = function() {
    console.log('======= 开始保存排班顺序 =======');
    console.log('1. 调用入口函数: window.saveShiftOrderByShift()');
    var position = document.getElementById('shiftOrderPositionInput').value;
    var shiftCodeInput = document.getElementById('shiftOrderShiftCodeInput');
    var shiftCode = shiftCodeInput ? shiftCodeInput.value : null;
    var excludeAllEmployees = document.getElementById('excludeAllEmployees').checked;
    
    console.log('2. 从表单获取数据:');
    console.log('   - 岗位:', position);
    console.log('   - 班次代码:', shiftCode);
    console.log('   - 是否为剔除列表所有人员:', excludeAllEmployees);
    
    var employeeNumbers = [];
    
    // 如果勾选了'剔除列表所有人员'，将剔除列表中的所有人员添加到员工列表中
        if (excludeAllEmployees) {
            var excludedEmployeeItems = document.querySelectorAll('#excludedEmployeesList .shift-order-employee-item');
            for (var i = 0; i < excludedEmployeeItems.length; i++) {
                var employeeNumber = excludedEmployeeItems[i].dataset.employeeNumber || excludedEmployeeItems[i].dataset.employeeId;
                if (employeeNumber) {
                    // 规范化员工号，确保与查询时的规范化逻辑一致
                    var normalizedNumber = window.shiftOrderManager.normalizeId(employeeNumber);
                    employeeNumbers.push(normalizedNumber);
                }
            }
        } else {
        // 否则，获取普通员工列表
        var employeeItems = document.querySelectorAll('#shiftOrderEmployeeList .shift-order-employee-item');
        for (var i = 0; i < employeeItems.length; i++) {
            var employeeNumber = employeeItems[i].dataset.employeeNumber || employeeItems[i].dataset.employeeId;
            if (employeeNumber) {
                // 规范化员工号，确保与查询时的规范化逻辑一致
                var normalizedNumber = window.shiftOrderManager.normalizeId(employeeNumber);
                employeeNumbers.push(normalizedNumber);
            }
        }
        
        if (employeeNumbers.length === 0) {
            showNotification('请添加员工', 'error');
            return;
        }
    }
    
    if (!position || !shiftCode) {
        showNotification('请选择岗位和班次', 'error');
        return;
    }
    
    // 获取部门信息 - 修复：确保能正确获取部门信息
    var departmentInput = document.getElementById('shiftOrderDepartmentInput');
    var department = departmentInput ? departmentInput.value : '';
    
    // 额外检查：如果部门信息为空，尝试从部门过滤器中获取
    if (!department) {
        var deptFilter = document.getElementById('shiftOrderDeptFilter');
        if (deptFilter && deptFilter.value) {
            department = deptFilter.value;
            console.log('从部门过滤器获取的部门信息:', department);
        }
    }
    
    console.log('最终使用的部门信息:', department);
    
    // 保存排班顺序
    return _saveShiftOrderInternal(position, employeeNumbers, shiftCode, excludeAllEmployees, department);
};

// 清空排班顺序
window.clearShiftOrder = function(position, shiftCode) {
    // 关闭模态框
    document.getElementById('shiftOrderEditModal').style.display = 'none';
    
    // 获取部门信息
    var departmentInput = document.getElementById('shiftOrderDepartmentInput');
    var department = departmentInput ? departmentInput.value : '';
    console.log('清空排班顺序时获取的部门信息:', department);
    
    // 清空排班顺序（保存空数组）
    let savePromise;
    if (shiftCode) {
        savePromise = window.shiftOrderManager.saveShiftOrderByShift(position, shiftCode, [], false, department);
    } else {
        // 不再支持岗位级排班顺序清空，必须提供shiftCode
        console.error('不支持岗位级排班顺序清空，必须提供shiftCode');
        showNotification('不支持岗位级排班顺序清空，请选择具体班次', 'error');
        return Promise.reject(new Error('不支持岗位级排班顺序清空，必须提供shiftCode'));
    }
    
    // 清空成功后添加短暂延迟确保数据完全写入，然后重新加载数据并刷新表格
    savePromise
        .then(function() {
            console.log('排班顺序已成功清空，等待一小段时间确保数据完全写入');
            // 添加短暂延迟确保数据完全写入数据库
            return new Promise(resolve => setTimeout(resolve, 100));
        })
        .then(function() {
            console.log('准备重新加载数据');
            return _reloadShiftOrderData();
        })
        .then(function() {
            console.log('排班数据已重新加载并刷新表格');
            showNotification('排班顺序清空成功');
        })
        .catch(function(error) {
            console.error('清空排班顺序失败: ' + error);
            showNotification('清空排班顺序失败: ' + (error.message || error), 'error');
        });
};

// 绑定排班顺序相关事件
function bindShiftOrderEvents() {
    // 关闭排班顺序编辑模态框
    var closeBtn = document.querySelector('#shiftOrderEditModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('shiftOrderEditModal').style.display = 'none';
        });
    }
    
    // 取消按钮
    var cancelBtn = document.querySelector('#shiftOrderEditModal .btn-secondary');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            document.getElementById('shiftOrderEditModal').style.display = 'none';
        });
    }
}

// 监听员工添加事件，自动将新员工添加到对应岗位的排班顺序末尾
window.addEventListener('employeeAdded', function(e) {
    try {
        var employee = e.detail.employee;
        if (employee.position && employee.status === 0) {
            // 优先使用employee.number，如果没有则回退到employee.id
            var employeeNumber = employee.number || employee.id;
            window.shiftOrderManager.addEmployeeToShiftOrder(employeeNumber, employee.position).then(function() {
                console.log('已将员工' + employee.name + '添加到' + employee.position + '岗位的排班顺序末尾');
            }).catch(function(error) {
                console.error('自动添加员工到排班顺序失败:' + error);
            });
        }
    } catch (error) {
        console.error('自动添加员工到排班顺序失败:' + error);
    }
});

// 监听员工删除事件，自动从所有排班顺序中移除员工
window.addEventListener('employeeDeleted', function(e) {
    try {
        // 使用员工ID调用功能更完整的updateShiftOrderWhenEmployeeDeleted方法
        var employeeId = e.detail.employeeId;
        
        if (window.shiftOrderManager && window.shiftOrderManager.updateShiftOrderWhenEmployeeDeleted) {
            window.shiftOrderManager.updateShiftOrderWhenEmployeeDeleted(employeeId).then(function() {
                console.log(`已从所有排班顺序中移除员工ID: ${employeeId} 的数据`);
            }).catch(function(error) {
                console.error('自动从排班顺序中移除员工失败:' + error);
            });
        }
    } catch (error) {
        console.error('自动从排班顺序中移除员工失败:' + error);
    }
});

// 已移除：标识变更事件监听器（自动排序功能已完全禁用）
// 现在所有排班排序都将通过手动编辑完成

// 新增：监听所有标识重置事件
window.addEventListener('allIdentifiersReset', async function() {
    try {
        console.log('接收到所有标识重置事件');
        
        // 关键修复：当所有标识被重置时，清空所有排班顺序数据
        if (window.shiftOrderManager && window.shiftOrderManager.clearAllShiftOrders) {
            console.log('执行清空所有排班顺序数据操作');
            await window.shiftOrderManager.clearAllShiftOrders();
        }
        
        // 刷新当前显示的排班顺序
        if (window.shiftOrderManager) {
            window.loadShiftOrderData();
        }
    } catch (error) {
        console.error('处理所有标识重置事件失败:' + error);
    }
});

// 新增：监听班次状态变更事件
// 根据用户需求：仅记录日志，不再自动刷新表格
window.addEventListener('shiftStatusChanged', function(e) {
    try {
        var shiftCode = e.detail.shiftCode;
        var status = e.detail.status;
        console.log('接收到班次状态变更事件，班次代码: ' + shiftCode + ', 状态: ' + (status === 0 ? '启用' : '停用'));
        
        // 根据用户需求：不再自动刷新排班表格，仅记录日志
        if (status === 1 && window.shiftOrderManager) {
            console.log('班次被停用，但根据用户需求不再自动刷新排班表格');
        }
    } catch (error) {
        console.error('处理班次状态变更事件失败:' + error);
    }
});

// 新增：监听班次数据变更事件
// 根据用户需求：仅记录日志，不再自动刷新表格
window.addEventListener('shiftDataChanged', function(e) {
    try {
        var reason = e.detail.reason;
        var shiftId = e.detail.shiftId;
        var shiftCode = e.detail.shiftCode;
        console.log('接收到班次数据变更事件，原因: ' + reason + ', 班次ID: ' + shiftId + ', 班次代码: ' + shiftCode);
        
        // 根据用户需求：不再自动刷新排班表格，仅记录日志
        console.log('班次数据变更，但根据用户需求不再自动刷新排班表格');
    } catch (error) {
        console.error('处理班次数据变更事件失败:' + error);
    }
});

// 渲染排班顺序表格函数（来自shift-order-management-fixed.js）
async function renderShiftOrderTable(positions = new Set(), unusedShiftOrderMap = null, filteredEmployees = null, department = '') {
    // 先获取表格元素，确保在try-catch的任何地方都能访问到
    const tableBody = document.getElementById('shift-order-table-body');
    const table = document.getElementById('shift-order-table');
    
    // 添加重试计数器
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 500; // 500ms
    
    // 定义一个重试函数
    async function tryRender() {
        try {
            console.log(`renderShiftOrderTable函数开始执行（尝试${retryCount + 1}/${maxRetries}），参数检查...`);
            
            // 检查核心依赖是否已初始化
            if (!window.dbManager) {
                console.warn('dbManager尚未初始化，尝试等待...');
                throw new Error('dbManager尚未初始化');
            }
            
            if (!window.shiftOrderManager) {
                console.warn('shiftOrderManager尚未初始化，尝试等待...');
                throw new Error('shiftOrderManager尚未初始化');
            }
        
        // 确保positions始终是一个有效的可迭代对象
        if (!positions || typeof positions !== 'object' || typeof positions[Symbol.iterator] !== 'function') {
            positions = new Set();
            console.warn('positions参数无效，已重置为空Set');
        }
        
        if (!tableBody || !table) {
            console.error('排班顺序表格元素未找到');
            return;
        }
        
        // 检查并创建thead元素
        let thead = table.querySelector('thead');
        let tableHeader;
        
        if (!thead) {
            thead = document.createElement('thead');
            table.insertBefore(thead, table.firstChild);
            tableHeader = document.createElement('tr');
            thead.appendChild(tableHeader);
        } else {
            tableHeader = thead.querySelector('tr');
            if (!tableHeader) {
                tableHeader = document.createElement('tr');
                thead.appendChild(tableHeader);
            }
        }
        
        console.log('开始渲染排班顺序表格');
        
        // 安全地获取所有有效班次
        let activeShifts = [];
        if (window.shiftOrderManager && typeof window.shiftOrderManager.getAllActiveShifts === 'function') {
            try {
                activeShifts = await window.shiftOrderManager.getAllActiveShifts();
            } catch (error) {
                console.error('获取班次数据失败:', error);
                // 使用默认班次数据作为备选
                activeShifts = [{code: '早', name: '早班'}, {code: '中', name: '中班'}, {code: '晚', name: '晚班'}];
            }
        } else {
            console.warn('shiftOrderManager未初始化或getAllActiveShifts方法不存在，使用默认班次数据');
            // 使用默认班次数据作为备选
            activeShifts = [{code: '早', name: '早班'}, {code: '中', name: '中班'}, {code: '晚', name: '晚班'}];
        }
        
        // 更新表头，添加所有班次的列
        updateShiftOrderTableHeader(tableHeader, activeShifts);
        
        tableBody.innerHTML = '';
        
        // 如果没有提供筛选后的员工，获取所有员工
        let allEmployees = filteredEmployees;
        if (!allEmployees) {
            allEmployees = await window.dbManager.getAll('employees') || [];
        }
        
        // 确保allEmployees是数组
        if (!Array.isArray(allEmployees)) {
            allEmployees = [];
        }
        
        console.log(`获取到员工总数: ${allEmployees.length}`);
        
        // 创建员工ID到员工对象的映射，方便快速查找
        const employeeIdMap = new Map();
        allEmployees.forEach(emp => {
            employeeIdMap.set(emp.id, emp);
            // 同时保存员工号到员工对象的映射
            if (emp.number) {
                employeeIdMap.set(emp.number, emp);
            }
        });
        
        // 再次检查positions是否存在，确保它是一个有效的可迭代对象
        if (!positions || typeof positions !== 'object' || typeof positions[Symbol.iterator] !== 'function') {
            positions = new Set();
            console.warn('positions变量在执行过程中变为无效，已重置为空Set');
        }
        
        // 检查positions是否为空，如果为空则从数据库获取所有岗位
        if (positions.size === 0) {
            console.warn('未提供岗位信息，尝试从员工数据中提取所有岗位');
            // 从员工数据中提取所有唯一岗位
            const positionSet = new Set();
            allEmployees.forEach(emp => {
                if (emp.position && emp.status === 0) {
                    positionSet.add(emp.position);
                }
            });
            positions = positionSet;
            
            // 如果还是没有岗位信息，尝试从数据库获取所有岗位
            if (positions.size === 0 && window.dbManager) {
                try {
                    // 先检查positions对象存储是否存在
                    const positionsStoreExists = await window.dbManager.checkObjectStoreExists('positions');
                    if (positionsStoreExists) {
                        const allPositions = await window.dbManager.getAll('positions') || [];
                        allPositions.forEach(pos => positionSet.add(pos.name));
                        positions = positionSet;
                    } else {
                        console.warn('positions对象存储不存在，跳过从数据库获取岗位信息');
                    }
                } catch (dbError) {
                    console.warn('从数据库获取岗位信息失败:', dbError);
                }
            }
            
            console.log(`提取到的岗位数量: ${positions.size}`);
        }
        
        // 转换Set为数组，方便遍历，确保positions是有效的可迭代对象
        const positionArray = Array.from(positions || new Set()).sort();
        
        let rowIndex = 1;
        // 直接构建HTML字符串
        let tableHTML = '';
        
        // 预获取所有岗位和班次的排班顺序，避免在循环中使用await
        const shiftOrderCache = new Map();
        const positionShiftPairs = [];
        
        for (let i = 0; i < positionArray.length; i++) {
            const position = positionArray[i];
            for (let j = 0; j < activeShifts.length; j++) {
                const shift = activeShifts[j];
                positionShiftPairs.push({ position, shiftCode: shift.code, department });
            }
        }
        
        // 并行获取所有排班顺序数据
        const shiftOrderPromises = positionShiftPairs.map(pair => 
            window.shiftOrderManager.getShiftOrderByPositionAndShift(pair.position, pair.shiftCode, pair.department)
                .then(shiftOrder => ({ pair, shiftOrder }))
        );
        
        // 等待所有获取操作完成
        const shiftOrderResults = await Promise.all(shiftOrderPromises);
        
        // 将结果存入缓存，键包含部门信息以区分不同部门的相同岗位和班次
        shiftOrderResults.forEach(result => {
            const key = `${result.pair.department || 'all'}_${result.pair.position}_${result.pair.shiftCode}`;
            shiftOrderCache.set(key, result.shiftOrder);
        });
        
        // 创建规范化ID的函数
        const normalizeId = (id) => {
            if (id === null || id === undefined) return '';
            return String(id).toLowerCase().trim();
        };
        
        // 为每个岗位渲染员工行
        for (let i = 0; i < positionArray.length; i++) {
            const position = positionArray[i];
            console.log(`处理岗位: ${position}`);
            
            // 获取该岗位的员工
            const positionEmployees = allEmployees.filter(emp => emp.position === position && emp.status === 0);
            console.log(`该岗位员工数量: ${positionEmployees.length}`);
            
            // 对员工进行排序：先按主要班次的排班顺序，再按姓名
            // 优先使用TEST_SHIFT班次（测试用），如果存在
            let mainShiftCode = null;
            let mainShiftOrder = null;
            
            // 选择第一个有效班次作为主要排序依据
            mainShiftCode = activeShifts.length > 0 ? activeShifts[0].code : null;
            if (mainShiftCode) {
                const mainShiftKey = `${department || 'all'}_${position}_${mainShiftCode}`;
                mainShiftOrder = shiftOrderCache.get(mainShiftKey);
            }
            
            let sortedEmployees = [...positionEmployees];
            
            // 打印原始员工列表，用于调试
            console.log(`原始员工列表: ${positionEmployees.map(e => e.number).join(', ')}`);
            
            // 首先尝试使用指定的主班次进行排序
            if (mainShiftOrder) {
                try {
                    console.log(`使用班次 ${mainShiftCode} 的排班顺序对员工进行排序`);
                    
                    // 检查是否是多部门模式
                    if (mainShiftOrder.hasMultipleDepartments) {
                        console.log('检测到多部门模式，按部门分别处理排序');
                        
                        // 创建一个按部门分组的员工映射
                        const deptToEmployees = new Map();
                        const allDeptEmployees = new Set(positionEmployees); // 用于跟踪所有员工
                        
                        // 创建全局已处理员工集合，确保每个员工只处理一次
                        const processedEmployees = new Set();
                        
                        // 按部门分组员工
                        positionEmployees.forEach(emp => {
                            const deptName = emp.deptName || '未分配部门';
                            if (!deptToEmployees.has(deptName)) {
                                deptToEmployees.set(deptName, []);
                            }
                            deptToEmployees.get(deptName).push(emp);
                        });
                        
                        // 为每个部门分别应用其排班顺序
                        const deptSortedEmployees = [];
                        
                        // 按照部门在departmentOrders中的顺序处理
                        mainShiftOrder.departmentOrders.forEach(deptOrder => {
                            const deptName = deptOrder.department || '未分配部门';
                            const deptEmployees = deptToEmployees.get(deptName) || [];
                            
                            // 如果该部门有员工
                            if (deptEmployees.length > 0) {
                                console.log(`处理部门 ${deptName} 的员工排序`);
                                
                                // 创建员工映射
                                const empMap = new Map();
                                const empIdMap = new Map();
                                const empNumberMap = new Map();
                                
                                deptEmployees.forEach(emp => {
                                    const empId = String(emp.id);
                                    const empNumber = String(emp.number || '');
                                    
                                    empMap.set(empId, emp);
                                    empMap.set(normalizeId(empId), emp);
                                    if (empNumber) {
                                        empMap.set(empNumber, emp);
                                        empMap.set(normalizeId(empNumber), emp);
                                    }
                                    
                                    empIdMap.set(normalizeId(empId), emp);
                                    if (empNumber) {
                                        empNumberMap.set(normalizeId(empNumber), emp);
                                    }
                                });
                                
                                // 使用该部门的排班顺序进行排序
                                const orderedEmps = [];
                                const remainingEmps = new Set();
                                
                                // 只添加未处理过的员工到remainingEmps
                                deptEmployees.forEach(emp => {
                                    if (!processedEmployees.has(emp)) {
                                        remainingEmps.add(emp);
                                    }
                                });
                                
                                const hasEmployeeNumbers = deptOrder.employeeNumbers && Array.isArray(deptOrder.employeeNumbers) && deptOrder.employeeNumbers.length > 0;
                                const orderArray = hasEmployeeNumbers ? deptOrder.employeeNumbers : [];
                                
                                orderArray.forEach(empIdentifier => {
                                    const empIdentifierStr = String(empIdentifier);
                                    const normalizedIdentifier = normalizeId(empIdentifierStr);
                                    
                                    let foundEmployee = empMap.get(empIdentifierStr) || 
                                                       empMap.get(normalizedIdentifier) ||
                                                       empIdMap.get(normalizedIdentifier) ||
                                                       empNumberMap.get(normalizedIdentifier);
                                    
                                    if (foundEmployee && remainingEmps.has(foundEmployee)) {
                                        orderedEmps.push(foundEmployee);
                                        remainingEmps.delete(foundEmployee);
                                        processedEmployees.add(foundEmployee); // 标记为已处理，避免重复
                                        console.log(`匹配到员工: ${foundEmployee.name} (${foundEmployee.number || foundEmployee.id}) 在部门 ${deptName} 的排班顺序中`);
                                    }
                                });
                                
                                // 添加不在排序列表中且未处理过的部门员工，按姓名排序
                                const sortedRemaining = Array.from(remainingEmps).sort((a, b) => 
                                    a.name.localeCompare(b.name)
                                );
                                
                                sortedRemaining.forEach(emp => {
                                    processedEmployees.add(emp); // 标记为已处理
                                });
                                
                                // 将该部门的排序结果添加到总结果中
                                deptSortedEmployees.push(...orderedEmps, ...sortedRemaining);
                            }
                        });
                        
                        // 处理未分配到任何部门且未处理过的员工
                        const unassignedEmployees = [];
                        positionEmployees.forEach(emp => {
                            if (!processedEmployees.has(emp)) {
                                unassignedEmployees.push(emp);
                                processedEmployees.add(emp); // 标记为已处理
                            }
                        });
                        
                        if (unassignedEmployees.length > 0) {
                            unassignedEmployees.sort((a, b) => a.name.localeCompare(b.name));
                            deptSortedEmployees.push(...unassignedEmployees);
                        }
                        
                        sortedEmployees = deptSortedEmployees;
                        console.log(`多部门模式排序后员工数量: ${sortedEmployees.length}`);
                        console.log(`多部门模式排序后员工号顺序: ${sortedEmployees.map(e => e.number).join(', ')}`);
                    } else {
                        // 单部门模式，保持原有逻辑
                        // 只使用employeeNumbers数组
                        const hasEmployeeNumbers = mainShiftOrder.employeeNumbers && Array.isArray(mainShiftOrder.employeeNumbers) && mainShiftOrder.employeeNumbers.length > 0;
                        
                        if (hasEmployeeNumbers) {
                            console.log(`排班顺序员工号: ${JSON.stringify(mainShiftOrder.employeeNumbers)}`);
                        }
                        
                        // 创建一个包含所有员工的映射，使用多种键格式
                        const empMap = new Map();
                        const empIdMap = new Map(); // 用于ID到员工对象的映射
                        const empNumberMap = new Map(); // 用于员工号到员工对象的映射
                        
                        positionEmployees.forEach(emp => {
                            const empId = String(emp.id);
                            const empNumber = String(emp.number || '');
                            
                            // 存储多种格式的键，确保能匹配到
                            empMap.set(empId, emp);
                            empMap.set(normalizeId(empId), emp);
                            if (empNumber) {
                                empMap.set(empNumber, emp);
                                empMap.set(normalizeId(empNumber), emp);
                            }
                            
                            // 同时维护单独的映射，方便后续查找
                            empIdMap.set(normalizeId(empId), emp);
                            if (empNumber) {
                                empNumberMap.set(normalizeId(empNumber), emp);
                            }
                        });
                        
                        // 首先添加在排序列表中的员工，严格保持数据库中的顺序
                        const orderedEmps = [];
                        const remainingEmps = new Set(positionEmployees); // 使用Set存储剩余员工
                        
                        // 只遍历employeeNumbers数组
                        const orderArray = hasEmployeeNumbers ? mainShiftOrder.employeeNumbers : [];
                        
                        // 遍历排班顺序中的所有标识
                        orderArray.forEach(empIdentifier => {
                            const empIdentifierStr = String(empIdentifier);
                            const normalizedIdentifier = normalizeId(empIdentifierStr);
                            
                            // 尝试多种方式查找员工
                            let foundEmployee = empMap.get(empIdentifierStr) || 
                                               empMap.get(normalizedIdentifier) ||
                                               empIdMap.get(normalizedIdentifier) ||
                                               empNumberMap.get(normalizedIdentifier);
                            
                            // 如果找到了员工且还在剩余列表中
                            if (foundEmployee && remainingEmps.has(foundEmployee)) {
                                orderedEmps.push(foundEmployee);
                                remainingEmps.delete(foundEmployee);
                                console.log(`匹配到员工: ${foundEmployee.name} (${foundEmployee.number || foundEmployee.id}) 在排班顺序中的位置`);
                            } else {
                                console.log(`未能匹配排班顺序中的标识: ${empIdentifierStr}`);
                            }
                        });
                        
                        // 然后添加不在排序列表中的员工，按姓名排序
                        const sortedRemaining = Array.from(remainingEmps).sort((a, b) => 
                            a.name.localeCompare(b.name)
                        );
                        
                        sortedEmployees = [...orderedEmps, ...sortedRemaining];
                        console.log(`排序后员工数量: ${sortedEmployees.length}`);
                        console.log(`排序后员工号顺序: ${sortedEmployees.map(e => e.number).join(', ')}`);
                    }
                } catch (e) {
                    console.error('员工排序过程中发生错误:', e);
                    // 排序失败时使用原始顺序
                    sortedEmployees = [...positionEmployees];
                }
            } else if (activeShifts.length > 0) {
                // 如果没有主班次的排班顺序，尝试使用第一个有效班次的排班顺序
                const firstShiftCode = activeShifts[0].code;
                const firstShiftKey = `${department || 'all'}_${position}_${firstShiftCode}`;
                const firstShiftOrder = shiftOrderCache.get(firstShiftKey);
                
                if (firstShiftOrder) {
                    // 使用employeeNumbers数组
                    const useNumbers = firstShiftOrder.employeeNumbers && Array.isArray(firstShiftOrder.employeeNumbers) && firstShiftOrder.employeeNumbers.length > 0;
                    
                    if (useNumbers) {
                        console.log(`使用第一个有效班次 ${firstShiftCode} 的排班顺序对员工进行排序`);
                        
                        // 这里复用上面的排序逻辑，但简化处理
                        const orderedEmps = [];
                        const remainingEmps = new Set(positionEmployees);
                        
                        const orderArray = firstShiftOrder.employeeNumbers;
                        
                        orderArray.forEach(empIdentifier => {
                            const empIdentifierStr = String(empIdentifier);
                            const foundEmployee = positionEmployees.find(emp => 
                                String(emp.number) === empIdentifierStr ||
                                normalizeId(emp.number) === normalizeId(empIdentifierStr) ||
                                String(emp.id) === empIdentifierStr || 
                                normalizeId(emp.id) === normalizeId(empIdentifierStr)
                            );
                            
                            if (foundEmployee && remainingEmps.has(foundEmployee)) {
                                orderedEmps.push(foundEmployee);
                                remainingEmps.delete(foundEmployee);
                            }
                        });
                        
                        sortedEmployees = [...orderedEmps, ...Array.from(remainingEmps).sort((a, b) => 
                            a.name.localeCompare(b.name)
                        )];
                    }
                }
            }
            
            // 为每个员工创建表格行
            for (let j = 0; j < sortedEmployees.length; j++) {
                const employee = sortedEmployees[j];
                console.log(`处理员工: ${employee.name} (${employee.number})`);
                
                let rowHTML = `
                    <tr>
                        <td>${rowIndex++}</td>
                        <td>${employee.number}</td>
                        <td>${employee.name}</td>
                        <td>${employee.deptName || '-'}</td>
                        <td>${position}</td>`;
                
                // 为每个班次添加排班顺序列
                for (let k = 0; k < activeShifts.length; k++) {
                    const shift = activeShifts[k];
                    
                    console.log(`处理班次: ${shift.code}, 岗位: ${position}, 员工: ${employee.name}`);
                    
                    // 从缓存中获取该岗位和班次的排班顺序，包含部门信息
                    let shiftOrder = null;
                    
                    // 先尝试获取包含所有部门信息的排班顺序
                    const cacheKey = `${department || 'all'}_${position}_${shift.code}`;
                    shiftOrder = shiftOrderCache.get(cacheKey);
                    
                    // 如果是多部门模式，尝试为当前员工获取其所属部门的排班顺序
                    if (shiftOrder && shiftOrder.hasMultipleDepartments && employee.deptName) {
                        // 查找当前员工所属部门的排班顺序
                        const deptShiftOrder = shiftOrder.departmentOrders.find(order => 
                            order.department === employee.deptName
                        );
                        // 如果找到部门特定的排班顺序，使用它
                        if (deptShiftOrder) {
                            shiftOrder = deptShiftOrder;
                        }
                    }
                    
                    let orderNumber = '未设置';
                    
                    if (shiftOrder) {
                        // 检查是否是剔除列表
                        if (shiftOrder.excludeAllEmployees) {
                            console.log(`该班次已设置为剔除列表: position=${position}, shiftCode=${shift.code}`);
                            // 检查当前员工是否在剔除列表中
                            const normalizedEmployeeId = normalizeId(employee.id);
                            const normalizedEmployeeNumber = normalizeId(employee.number);
                            
                            // 只检查employeeNumbers数组
                            const isExcluded = (
                                shiftOrder.employeeNumbers && Array.isArray(shiftOrder.employeeNumbers) && 
                                shiftOrder.employeeNumbers.some(id => {
                                    const normalizedId = normalizeId(id);
                                    return normalizedId === normalizedEmployeeId || normalizedId === normalizedEmployeeNumber;
                                })
                            );
                            
                            if (isExcluded) {
                                console.log(`员工${employee.name}在剔除列表中，设置顺序为0`);
                                orderNumber = '0';
                            } else {
                                // 不在剔除列表中，继续使用原有的逻辑来获取顺序号
                                // 只使用employeeNumbers数组
                                const hasEmployeeNumbers = shiftOrder.employeeNumbers && Array.isArray(shiftOrder.employeeNumbers) && shiftOrder.employeeNumbers.length > 0;
                                
                                if (hasEmployeeNumbers) {
                                    console.log(`获取到排班顺序员工号: ${JSON.stringify(shiftOrder.employeeNumbers)}`);
                                }
                                
                                if (hasEmployeeNumbers) {
                                    // 规范化员工ID和员工号
                                    const normalizedEmployeeId = normalizeId(employee.id);
                                    const normalizedEmployeeNumber = normalizeId(employee.number);
                                    
                                    // 只使用employeeNumbers数组
                                    const orderArray = shiftOrder.employeeNumbers;
                                    
                                    // 尝试使用规范化格式查找员工号
                                    const index = orderArray.findIndex(id => {
                                        const normalizedId = normalizeId(id);
                                        return normalizedId === normalizedEmployeeNumber;
                                    });
                                    
                                    if (index !== -1) {
                                        orderNumber = (index + 1).toString();
                                        console.log(`匹配: 员工${employee.name}在${shift.code}班次的顺序是${orderNumber}`);
                                    } else {
                                        // 没有找到员工顺序，保持原有的orderNumber
                                    }
                                }
                            }
                        } else {
                            // 只使用employeeNumbers数组
                            const hasEmployeeNumbers = shiftOrder.employeeNumbers && Array.isArray(shiftOrder.employeeNumbers) && shiftOrder.employeeNumbers.length > 0;
                            
                            if (hasEmployeeNumbers) {
                                console.log(`获取到排班顺序员工号: ${JSON.stringify(shiftOrder.employeeNumbers)}`);
                            }
                            
                            if (hasEmployeeNumbers) {
                                // 规范化员工ID和员工号
                                const normalizedEmployeeId = normalizeId(employee.id);
                                const normalizedEmployeeNumber = normalizeId(employee.number);
                                
                                // 只使用employeeNumbers数组
                                const orderArray = shiftOrder.employeeNumbers;
                                
                                // 尝试使用规范化格式查找员工号
                                const index = orderArray.findIndex(id => {
                                    const normalizedId = normalizeId(id);
                                    return normalizedId === normalizedEmployeeNumber;
                                });
                                
                                if (index !== -1) {
                                    orderNumber = (index + 1).toString();
                                    console.log(`匹配: 员工${employee.name}在${shift.code}班次的顺序是${orderNumber}`);
                                } else {
                                    // 没有找到员工顺序，保持原有的orderNumber
                                }
                            }
                        }
                    }
                    else {
                        console.log(`未找到排班顺序或排班顺序为空: position=${position}, shiftCode=${shift.code}`);
                    }
                    
                    console.log(`员工${employee.name}在${shift.code}班次的最终显示顺序: ${orderNumber}`);
                    rowHTML += `<td class="shift-order-number">${orderNumber}</td>`;
                }
                
                rowHTML += '</tr>';
                tableHTML += rowHTML;
            }
        }
        
        // 一次性插入所有行，减少DOM操作
        if (tableHTML) {
            tableBody.innerHTML = tableHTML;
            console.log('排班顺序表格渲染完成');
        } else {
            // 如果没有数据，显示空状态
            const colSpan = 5 + activeShifts.length; // 基础列数(5) + 班次列数
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="text-align: center; padding: 40px;">暂无排班数据</td>
                </tr>
            `;
        }
    } catch (error) {
            console.error('渲染排班顺序表格失败:', error);
            
            // 如果是初始化相关错误且重试次数未用完，尝试重试
            if ((error.message && (error.message.includes('尚未初始化') || error.message.includes('not found'))) && retryCount < maxRetries) {
                retryCount++;
                console.log(`初始化错误，${retryDelay}ms后重试（${retryCount}/${maxRetries}）...`);
                
                // 显示加载中状态，而不是错误信息
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="100%" style="text-align: center; padding: 40px; color: #666;">
                            正在加载排班数据...
                        </td>
                    </tr>
                `;
                
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return tryRender();
            }
            
            // 显示错误信息（只在最终失败时显示）
            tableBody.innerHTML = `
                <tr>
                    <td colspan="100%" style="text-align: center; padding: 40px; color: red;">
                        渲染排班顺序表格失败，请刷新页面重试
                    </td>
                </tr>
            `;
            
            // 添加更详细的错误信息到控制台，方便调试
            console.error('详细错误信息:', error);
            console.error('错误堆栈:', error.stack);
        }
    }
    
    // 开始尝试渲染
    await tryRender();
}

// 更新排班顺序表格表头，添加班次列（来自shift-order-management-fixed.js）
function updateShiftOrderTableHeader(tableHeader, activeShifts) {
    // 清空表头
    tableHeader.innerHTML = '';
    
    // 添加基础列
    const baseColumns = ['序号', '员工号', '姓名', '所属部门', '岗位'];
    baseColumns.forEach(columnName => {
        const th = document.createElement('th');
        th.textContent = columnName;
        tableHeader.appendChild(th);
    });
    
    // 添加班次列，支持点击编辑
    activeShifts.forEach(shift => {
        const th = document.createElement('th');
        th.textContent = shift.code;
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.dataset.shiftCode = shift.code;
        th.addEventListener('click', async function() {
            // 获取当前选中的岗位
            const positionFilter = document.getElementById('shiftOrderPositionFilter');
            let selectedPosition = positionFilter && positionFilter.value ? positionFilter.value : null;
            
            // 如果没有选中岗位，则提示用户先选择岗位
            if (!selectedPosition) {
                showNotification('请先选择岗位，再点击班次列编辑排班顺序', 'info');
                return;
            }
            
            // 获取当前选中的部门
            const deptFilter = document.getElementById('shiftOrderDeptFilter');
            const selectedDept = deptFilter && deptFilter.value ? deptFilter.value : '';
            
            // 调用按岗位和班次编辑排班顺序的方法，添加部门参数
            await window.editShiftOrderByPositionAndShift(selectedPosition, shift.code, selectedDept);
        });
        
        // 添加悬停效果提示
        th.title = '点击编辑排班顺序';
        tableHeader.appendChild(th);
    });
}

// 将ShiftOrderManager类暴露到全局作用域，确保其他文件可以访问它
if (typeof window !== 'undefined') {
    window.ShiftOrderManager = ShiftOrderManager;
    console.log('ShiftOrderManager类已成功暴露到全局作用域');
    // 暴露渲染函数到全局，确保其他文件可以调用
    window.renderShiftOrderTable = renderShiftOrderTable;
    window.updateShiftOrderTableHeader = updateShiftOrderTableHeader;
    // 暴露重新加载数据函数，用于其他模块触发数据刷新
    window._reloadShiftOrderData = _reloadShiftOrderData;
    console.log('排班顺序表格渲染函数和刷新函数已成功暴露到全局作用域');
    
    // 响应标识导入事件，确保导入的标识能正确刷新排班编辑的模态框员工列表
    // 注意：已禁用自动排序功能，所有排序都将通过手动编辑完成
    window.addEventListener('allIdentifiersReimported', async function(event) {
        try {
            console.log(`接收到标识导入事件，导入了${event.detail?.count || 0}条标识数据`);
            
            // 创建一个新的ShiftOrderManager实例
            const manager = new ShiftOrderManager();
            
            // 重新初始化排班数据
            await manager.initializeStore();
            
            console.log('标识导入完成，刷新排班数据但不自动排序（所有排序都将通过手动编辑完成）');
            
            // 刷新排班顺序表格
            const shiftOrderTable = document.getElementById('shiftOrderTable');
            const shiftOrderTableHeader = document.getElementById('shiftOrderTableHeader');
            if (shiftOrderTable && shiftOrderTableHeader) {
                console.log('重新渲染排班顺序表格');
                
                // 重新获取活动班次
                const activeShifts = await manager.getAllActiveShifts();
                
                // 更新表头
                updateShiftOrderTableHeader(shiftOrderTableHeader, activeShifts);
                
                // 重新渲染表格
                renderShiftOrderTable(shiftOrderTable);
                
                // 如果有正在打开的排班编辑模态框，需要刷新其中的员工列表
                const editModal = document.getElementById('shiftOrderEditModal');
                if (editModal && !editModal.classList.contains('hidden')) {
                    console.log('刷新排班编辑模态框中的员工列表');
                    // 检查当前选中的岗位和班次代码
                    const positionFilter = document.getElementById('shiftOrderPositionFilter');
                    const selectedPosition = positionFilter ? positionFilter.value : null;
                    
                    // 获取模态框标题中的班次代码
                    const modalTitle = document.querySelector('#shiftOrderEditModal .modal-title');
                    if (modalTitle && selectedPosition) {
                        const titleText = modalTitle.textContent;
                        // 从标题中提取班次代码
                        const shiftCodeMatch = titleText.match(/班次：(\w+)/);
                        if (shiftCodeMatch && shiftCodeMatch[1]) {
                            const shiftCode = shiftCodeMatch[1];
                            // 重新加载编辑模态框中的员工列表
                            const editModalContent = document.getElementById('shiftOrderEditModalContent');
                            if (editModalContent) {
                                await window.editShiftOrderByPositionAndShift(selectedPosition, shiftCode);
                            }
                        }
                    }
                }
            }
            
            console.log('标识导入后排班数据已成功更新');
        } catch (error) {
            console.error('处理标识导入事件时发生错误:', error);
            showNotification('更新排班数据失败，请刷新页面重试', 'error');
        }
    });
    console.log('已添加标识导入事件监听器');
    
    // 响应单个标识变更事件，确保单次新增标识后能正确刷新排班编辑的模态框员工列表
    // 注意：已禁用自动排序功能，所有排序都将通过手动编辑完成
    window.addEventListener('identifierChanged', async function(event) {
        try {
            const { employeeId, employeeNumber, shiftId, shiftCode, canWork } = event.detail;
            console.log(`接收到标识变更事件：员工ID=${employeeId}，员工号=${employeeNumber}，班次ID=${shiftId}，班次代码=${shiftCode}，是否启用=${canWork}`);
            
            // 重新加载排班数据以确保最新状态
            if (window.shiftOrderManager) {
                await window.shiftOrderManager.initializeStore();
            }
            
            console.log('标识变更完成，刷新排班数据但不自动排序（所有排序都将通过手动编辑完成）');
            
            // 刷新排班顺序表格
            const shiftOrderTable = document.getElementById('shiftOrderTable');
            const shiftOrderTableHeader = document.getElementById('shiftOrderTableHeader');
            if (shiftOrderTable && shiftOrderTableHeader) {
                console.log('重新渲染排班顺序表格');
                
                // 重新获取活动班次
                const manager = new ShiftOrderManager();
                const activeShifts = await manager.getAllActiveShifts();
                
                // 更新表头
                updateShiftOrderTableHeader(shiftOrderTableHeader, activeShifts);
                
                // 重新渲染表格
                renderShiftOrderTable(shiftOrderTable);
                
                // 如果有正在打开的排班编辑模态框，需要刷新其中的员工列表
                const editModal = document.getElementById('shiftOrderEditModal');
                if (editModal && !editModal.classList.contains('hidden')) {
                    console.log('刷新排班编辑模态框中的员工列表');
                    // 检查当前选中的岗位和班次代码
                    const positionFilter = document.getElementById('shiftOrderPositionFilter');
                    const selectedPosition = positionFilter ? positionFilter.value : null;
                    
                    // 获取模态框标题中的班次代码
                    const modalTitle = document.querySelector('#shiftOrderEditModal .modal-title');
                    if (modalTitle && selectedPosition) {
                        const titleText = modalTitle.textContent;
                        // 从标题中提取班次代码
                        const shiftCodeMatch = titleText.match(/班次：(\w+)/);
                        if (shiftCodeMatch && shiftCodeMatch[1]) {
                            const shiftCodeFromTitle = shiftCodeMatch[1];
                            // 重新加载编辑模态框中的员工列表
                            const editModalContent = document.getElementById('shiftOrderEditModalContent');
                            if (editModalContent) {
                                // 获取当前选中的部门
                                const deptFilter = document.getElementById('shiftOrderDeptFilter');
                                const selectedDept = deptFilter && deptFilter.value ? deptFilter.value : '';
                                
                                await window.editShiftOrderByPositionAndShift(selectedPosition, shiftCodeFromTitle, selectedDept);
                            }
                        }
                    }
                }
            }
            
            console.log('标识变更后排班数据已成功更新');
        } catch (error) {
            console.error('处理标识变更事件时发生错误:', error);
            showNotification('更新排班数据失败，请刷新页面重试', 'error');
        }
    });
    console.log('已添加标识变更事件监听器');
}