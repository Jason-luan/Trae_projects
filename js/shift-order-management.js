// 排班顺序管理功能

class ShiftOrderManager {
    constructor() {
        var self = this;
        this.initializeStore().catch(function(err) {
            console.error('初始化排班顺序存储空间失败: ' + err);
            // 创建一个临时的内存存储作为备选方案
            self.memoryStore = [];
        });
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

    // 内部辅助函数：清理并验证employeeIds数组
    async _cleanAndValidateEmployeeIds(employeeIds) {
        try {
            if (!employeeIds || !Array.isArray(employeeIds)) {
                return [];
            }
            
            // 获取所有员工数据
            const allEmployees = await window.dbManager.getAll('employees');
            
            // 创建员工号到员工ID的映射
            const employeeNumberToIdMap = {};
            allEmployees.forEach(emp => {
                if (emp.number) {
                    employeeNumberToIdMap[emp.number] = emp.id;
                }
            });
            
            // 创建有效的员工ID集合
            const validEmployeeIds = new Set(allEmployees.map(emp => emp.id));
            
            // 清理并验证employeeIds数组
            const cleanedIds = [];
            employeeIds.forEach(id => {
                // 如果是有效的员工ID，直接添加
                if (validEmployeeIds.has(id)) {
                    cleanedIds.push(id);
                }
                // 如果是员工号，尝试转换为员工ID后添加
                else if (employeeNumberToIdMap[id]) {
                    cleanedIds.push(employeeNumberToIdMap[id]);
                }
                // 否则忽略这个无效的ID
            });
            
            return cleanedIds;
        } catch (error) {
            console.error('清理员工ID数组失败:', error);
            return [];
        }
    }
    
    // 获取指定岗位和班次的排班顺序
    async getShiftOrderByPositionAndShift(position, shiftCode) {
        try {
            console.log(`尝试获取排班顺序: position=${position}, shiftCode=${shiftCode}`);
            
            let foundOrder = null;
            
            // 首先尝试从IndexedDB获取
            try {
                const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
                if (exists) {
                    // 直接使用getAll方法查询
                    const allOrders = await window.dbManager.getAll('shiftOrders');
                    console.log(`获取到所有排班顺序数量: ${allOrders ? allOrders.length : 0}`);
                    
                    foundOrder = allOrders.find(order => 
                        order.position === position && order.shiftCode === shiftCode
                    );
                    
                    if (foundOrder) {
                        console.log('从IndexedDB获取排班顺序成功, 原始顺序:', foundOrder.employeeIds);
                    }
                }
            } catch (dbError) {
                console.warn('IndexedDB获取失败，将从内存获取: ' + dbError);
            }
            
            // 如果IndexedDB没有找到，从内存存储中获取
            if (!foundOrder && this.memoryStore) {
                foundOrder = this.memoryStore.find(order => 
                    order.position === position && order.shiftCode === shiftCode
                );
                
                if (foundOrder) {
                    console.log('从内存获取排班顺序成功, 原始顺序:', foundOrder.employeeIds);
                }
            }
            
            if (foundOrder) {
                // 确保返回的是一个新对象，避免修改原始数据
                const result = { ...foundOrder };
                
                // 增强的employeeIds处理逻辑
                if (result.employeeIds && Array.isArray(result.employeeIds)) {
                    // 深度复制employeeIds数组
                    const rawIds = [...result.employeeIds];
                    console.log('原始employeeIds:', rawIds);
                    
                    // 清理并规范化employeeIds数组
                    result.employeeIds = [];
                    
                    for (const id of rawIds) {
                        // 处理null、undefined、空字符串
                        if (!id) continue;
                        
                        // 统一转换为字符串类型，确保类型一致性
                        const normalizedId = String(id).trim();
                        
                        // 只添加非空的ID
                        if (normalizedId) {
                            result.employeeIds.push(normalizedId);
                        }
                    }
                    
                    console.log('规范化后员工ID列表:', result.employeeIds);
                } else {
                    console.warn('排班顺序中的employeeIds不是有效数组');
                    result.employeeIds = [];
                }
                
                return result;
            }
            
            console.log(`未找到排班顺序: position=${position}, shiftCode=${shiftCode}`);
            return null;
        } catch (error) {
            console.error('获取排班顺序失败: ' + error);
            return null;
        }
    }

    // 获取指定岗位的排班顺序（兼容旧版方法）
    async getShiftOrderByPosition(position) {
        try {
            console.log(`尝试获取岗位排班顺序: position=${position}`);
            
            // 首先尝试从IndexedDB获取
            try {
                const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
                if (exists) {
                    const results = await window.dbManager.getByIndex('shiftOrders', 'position', position);
                    if (results && results.length > 0) {
                        console.log('从IndexedDB获取岗位排班顺序成功:', results[0]);
                        // 增强的employeeIds处理逻辑
                        const rawIds = results[0].employeeIds || [];
                        console.log('原始employeeIds:', rawIds);
                        
                        // 清理并规范化employeeIds数组
                        const cleanedIds = [];
                        if (Array.isArray(rawIds)) {
                            for (const id of rawIds) {
                                // 处理null、undefined、空字符串
                                if (!id) continue;
                                
                                // 统一转换为字符串类型，确保类型一致性
                                const normalizedId = String(id).trim();
                                
                                // 只添加非空的ID
                                if (normalizedId) {
                                    cleanedIds.push(normalizedId);
                                }
                            }
                        }
                        
                        console.log('规范化后员工ID列表:', cleanedIds);
                        // 返回带有清理后员工ID的排班顺序对象
                        return {
                            ...results[0],
                            employeeIds: cleanedIds
                        };
                    }
                }
            } catch (dbError) {
                console.warn('IndexedDB获取失败，将从内存获取: ' + dbError);
            }
            
            // 如果IndexedDB没有，从内存存储中获取
            if (this.memoryStore) {
                const memoryResults = this.memoryStore.filter(order => 
                    order.position === position && !order.shiftCode
                );
                
                if (memoryResults && memoryResults.length > 0) {
                    console.log('从内存获取岗位排班顺序成功:', memoryResults[0]);
                    // 清理并验证employeeIds数组
                    const rawIds = memoryResults[0].employeeIds || [];
                    const cleanedIds = [];
                    
                    if (Array.isArray(rawIds)) {
                        for (const id of rawIds) {
                            if (!id) continue;
                            const normalizedId = String(id).trim();
                            if (normalizedId) {
                                cleanedIds.push(normalizedId);
                            }
                        }
                    }
                    
                    return {
                        ...memoryResults[0],
                        employeeIds: cleanedIds
                    };
                }
            }
            
            console.log(`未找到岗位排班顺序: position=${position}`);
            return null;
        } catch (error) {
            console.error('获取岗位排班顺序失败: ' + error);
            return null;
        }
    }

    // 获取指定岗位的所有排班顺序
    async getShiftOrdersByPosition(position) {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('shiftOrders');
            if (!exists) {
                return [];
            }
            
            const allOrders = await window.dbManager.getAll('shiftOrders');
            const filteredOrders = allOrders.filter(order => order.position === position);
            
            // 对每个排班顺序清理并验证employeeIds数组
            const cleanedOrders = [];
            for (let i = 0; i < filteredOrders.length; i++) {
                const order = filteredOrders[i];
                const cleanedIds = await this._cleanAndValidateEmployeeIds(order.employeeIds);
                cleanedOrders.push({
                    ...order,
                    employeeIds: cleanedIds
                });
            }
            
            return cleanedOrders;
        } catch (error) {
            console.error('获取排班顺序失败:', error);
            return [];
        }
    }

    // 保存指定岗位和班次的排班顺序
    async saveShiftOrderByShift(position, shiftCode, employeeIds) {
        try {
            console.log('尝试保存排班顺序: ' + JSON.stringify({position: position, shiftCode: shiftCode, employeeIds: employeeIds}));
            
            // 创建保存数据
            const data = {
                position: position,
                shiftCode: shiftCode,
                employeeIds: employeeIds,
                updatedAt: new Date()
            };
            
            // 首选：尝试使用全局dbManager保存
            try {
                if (window.dbManager && typeof window.dbManager.save === 'function') {
                    // 先查找是否已存在相同岗位和班次的记录
                    const allOrders = await window.dbManager.getAll('shiftOrders');
                    const existingOrder = allOrders.find(order => 
                        order.position === position && order.shiftCode === shiftCode
                    );
                    
                    if (existingOrder) {
                        data.id = existingOrder.id;
                    }
                    
                    // 使用全局dbManager保存数据
                    const result = await window.dbManager.save('shiftOrders', data);
                    console.log('全局dbManager保存成功: ' + JSON.stringify(data));
                    return result;
                } else {
                    throw new Error('全局dbManager不可用');
                }
            } catch (dbError) {
                console.warn('全局dbManager保存失败，使用内存存储: ' + dbError);
                
                // 降级到内存存储
                this._saveToMemory(data);
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
        
        // 增强employeeIds数据处理
        const dataToSave = { ...data };
        
        // 处理employeeIds，确保它是一个有效的数组
        if (data.employeeIds) {
            console.log('原始保存的employeeIds:', data.employeeIds);
            
            // 确保employeeIds是数组
            const rawIds = Array.isArray(data.employeeIds) ? data.employeeIds : [data.employeeIds];
            
            // 清理并规范化employeeIds数组
            const cleanedIds = [];
            for (const id of rawIds) {
                // 处理null、undefined、空字符串
                if (!id) continue;
                
                // 统一转换为字符串类型，确保类型一致性
                const normalizedId = String(id).trim();
                
                // 只添加非空的ID
                if (normalizedId) {
                    cleanedIds.push(normalizedId);
                }
            }
            
            dataToSave.employeeIds = cleanedIds;
            console.log('规范化后保存的employeeIds:', cleanedIds);
        } else {
            // 如果没有提供employeeIds，设置为空数组
            dataToSave.employeeIds = [];
        }
        
        // 查找是否已存在相同岗位和班次的记录
        var existingIndex = -1;
        for (var i = 0; i < this.memoryStore.length; i++) {
            if (this.memoryStore[i].position === dataToSave.position && this.memoryStore[i].shiftCode === dataToSave.shiftCode) {
                existingIndex = i;
                break;
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

    // 保存指定岗位的排班顺序（兼容旧版方法）
    async saveShiftOrder(position, employeeIds) {
        try {
            console.log('尝试保存排班顺序: ' + JSON.stringify({position: position, employeeIds: employeeIds}));
            
            // 创建保存数据
            const data = {
                position: position,
                employeeIds: employeeIds,
                updatedAt: new Date()
            };
            
            // 首选：尝试使用全局dbManager保存
            try {
                if (window.dbManager && typeof window.dbManager.save === 'function') {
                    // 先查找是否已存在相同岗位的记录
                    const allOrders = await window.dbManager.getAll('shiftOrders');
                    const existingOrder = allOrders.find(order => 
                        order.position === position && !order.shiftCode
                    );
                    
                    if (existingOrder) {
                        data.id = existingOrder.id;
                    }
                    
                    // 使用全局dbManager保存数据
                    const result = await window.dbManager.save('shiftOrders', data);
                    console.log('全局dbManager保存成功: ' + JSON.stringify(data));
                    return result;
                } else {
                    throw new Error('全局dbManager不可用');
                }
            } catch (dbError) {
                console.warn('全局dbManager保存失败，使用内存存储: ' + dbError);
                
                // 降级到内存存储
                this._saveToMemory(data);
                return 'memory_backup';
            }
        } catch (error) {
            console.error('保存排班顺序失败: ' + error);
            throw error;
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
                // 创建一个合并结果的Map，使用position和shiftCode作为唯一键
                const mergedResultsMap = new Map();
                
                // 先添加IndexedDB的结果
                for (const order of dbResults) {
                    const key = `${order.position}_${order.shiftCode || ''}`;
                    mergedResultsMap.set(key, order);
                }
                
                // 再添加内存存储的结果，覆盖相同键的记录（优先使用更新的数据）
                for (const order of this.memoryStore) {
                    const key = `${order.position}_${order.shiftCode || ''}`;
                    mergedResultsMap.set(key, order);
                }
                
                // 将Map转换为数组
                allResults = Array.from(mergedResultsMap.values());
            } else {
                // 如果没有内存存储，直接使用IndexedDB的结果
                allResults = dbResults;
            }
            
            // 对所有结果进行员工ID清理和验证，确保数据一致性
            const cleanedResults = [];
            for (const order of allResults) {
                try {
                    // 清理并验证employeeIds数组
                    const cleanedIds = await this._cleanAndValidateEmployeeIds(order.employeeIds || []);
                    // 添加清理后的排班顺序对象
                    cleanedResults.push({
                        ...order,
                        employeeIds: cleanedIds
                    });
                } catch (cleanError) {
                    console.warn('清理排班顺序员工ID失败:', cleanError);
                    // 即使清理失败，也添加原始数据，避免数据丢失
                    cleanedResults.push(order);
                }
            }
            
            return cleanedResults;
        } catch (error) {
            console.error('获取所有排班顺序失败: ' + error);
            // 如果发生错误，尝试返回内存存储中的数据
            if (this.memoryStore) {
                console.log('返回内存存储中的排班顺序数据');
                return this.memoryStore;
            }
            return [];
        }
    }

    // 添加新员工到对应岗位和班次的排班顺序末尾
    async addEmployeeToShiftOrderByShift(employeeId, position, shiftCode) {
        try {
            // 获取当前岗位和班次的排班顺序
            let shiftOrder = await this.getShiftOrderByPositionAndShift(position, shiftCode);
            
            if (!shiftOrder) {
                // 如果该岗位和班次还没有排班顺序，创建一个新的
                shiftOrder = {
                    position: position,
                    shiftCode: shiftCode,
                    employeeIds: []
                };
            }
            
            // 检查员工是否已在排班顺序中
            var employeeExists = false;
            for (var i = 0; i < shiftOrder.employeeIds.length; i++) {
                if (shiftOrder.employeeIds[i] === employeeId) {
                    employeeExists = true;
                    break;
                }
            }
            
            if (!employeeExists) {
                // 将新员工添加到排班顺序末尾
                shiftOrder.employeeIds.push(employeeId);
                shiftOrder.updatedAt = new Date();
                
                // 保存更新后的排班顺序
                return await window.dbManager.save('shiftOrders', shiftOrder);
            }
            
            return shiftOrder;
        } catch (error) {
            console.error('添加员工到排班顺序失败: ' + error);
            throw error;
        }
    }

    // 添加新员工到对应岗位的排班顺序末尾（兼容旧版方法）
    async addEmployeeToShiftOrder(employeeId, position) {
        try {
            // 获取当前岗位的排班顺序
            let shiftOrder = await this.getShiftOrderByPosition(position);
            
            if (!shiftOrder) {
                // 如果该岗位还没有排班顺序，创建一个新的
                shiftOrder = {
                    position: position,
                    employeeIds: []
                };
            }
            
            // 检查员工是否已在排班顺序中
            var employeeFound = false;
            for (var i = 0; i < shiftOrder.employeeIds.length; i++) {
                if (shiftOrder.employeeIds[i] === employeeId) {
                    employeeFound = true;
                    break;
                }
            }
            
            if (!employeeFound) {
                // 将新员工添加到排班顺序末尾
                shiftOrder.employeeIds.push(employeeId);
                shiftOrder.updatedAt = new Date();
                
                // 保存更新后的排班顺序
                return await window.dbManager.save('shiftOrders', shiftOrder);
            }
            
            return shiftOrder;
        } catch (error) {
            console.error('添加员工到排班顺序失败:', error);
            throw error;
        }
    }

    // 从排班顺序中移除员工
    async removeEmployeeFromShiftOrder(employeeId) {
        try {
            // 获取所有排班顺序
            const allShiftOrders = await this.getAllShiftOrders();
            
            // 检查并更新每个排班顺序
            for (const shiftOrder of allShiftOrders) {
                // 确保employeeIds是数组
                if (!Array.isArray(shiftOrder.employeeIds)) {
                    shiftOrder.employeeIds = [];
                }
                
                const index = shiftOrder.employeeIds.indexOf(employeeId);
                if (index > -1) {
                    // 移除员工
                    shiftOrder.employeeIds.splice(index, 1);
                    shiftOrder.updatedAt = new Date();
                    
                    // 保存更新后的排班顺序
                    await window.dbManager.save('shiftOrders', shiftOrder);
                }
            }
        } catch (error) {
            console.error('从排班顺序中移除员工失败:', error);
            throw error;
        }
    }

    // 更新指定班次的排班顺序
    async updateShiftOrderPositionByShift(shiftOrderId, employeeIds) {
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
            
            // 更新员工ID顺序
            shiftOrder.employeeIds = employeeIds;
            shiftOrder.updatedAt = new Date();
            
            return await window.dbManager.save('shiftOrders', shiftOrder);
        } catch (error) {
            console.error('更新排班顺序失败:', error);
            throw error;
        }
    }

    // 更新排班顺序（兼容旧版方法）
    async updateShiftOrderPosition(shiftOrderId, employeeIds) {
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
            
            // 更新员工ID顺序
            shiftOrder.employeeIds = employeeIds;
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
            
            // 为新员工添加到对应岗位的所有班次的排班顺序末尾
            var promises = [];
            var self = this;
            for (var i = 0; i < activeShifts.length; i++) {
                var shift = activeShifts[i];
                promises.push(
                    self.addEmployeeToShiftOrderByShift(newEmployee.id, newEmployee.position, shift.code)
                        .catch(function(error) {
                            console.error('添加员工到' + newEmployee.position + '岗位' + shift.code + '班次排班顺序失败:', error);
                            // 继续处理其他班次，不中断流程
                            return Promise.resolve();
                        })
                );
            }
            
            // 也为兼容旧版添加到没有班次的排班顺序
            promises.push(
                this.addEmployeeToShiftOrder(newEmployee.id, newEmployee.position)
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
    
    // 当员工删除时更新排班顺序
    async updateShiftOrderWhenEmployeeDeleted(employeeId) {
        try {
            // 获取所有排班顺序
            const shiftOrders = await window.dbManager.getAll('shiftOrders');
            const updatePromises = [];
            
            // 遍历所有排班顺序（包括按班次的排班顺序）
            shiftOrders.forEach(order => {
                // 确保employeeIds是数组
                if (!Array.isArray(order.employeeIds)) {
                    order.employeeIds = [];
                }
                
                // 过滤掉已删除的员工
                const originalLength = order.employeeIds.length;
                order.employeeIds = order.employeeIds.filter(id => 
                    id !== employeeId
                );
                
                // 如果有员工被移除，保存更新后的排班顺序
                if (order.employeeIds.length < originalLength) {
                    order.updatedAt = new Date();
                    updatePromises.push(window.dbManager.save('shiftOrders', order));
                    
                    // 输出详细日志，包括班次信息
                    if (order.shiftCode) {
                        console.log(`已从${order.position}岗位${order.shiftCode}班次的排班顺序中移除员工ID:${employeeId}`);
                    } else {
                        console.log(`已从${order.position}岗位的排班顺序中移除员工ID:${employeeId}`);
                    }
                }
            });
            
            await Promise.all(updatePromises);
        } catch (error) {
            console.error('删除员工时更新排班顺序出错:', error);
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
        
        // 加载所有岗位的排班顺序
        await loadAllShiftOrders();
        
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
    try {
        // 获取部门和岗位筛选值
        const deptFilter = document.getElementById('shiftOrderDeptFilter');
        const positionFilter = document.getElementById('shiftOrderPositionFilter');
        
        const selectedDept = deptFilter ? deptFilter.value : '';
        const selectedPosition = positionFilter ? positionFilter.value : '';
        
        // 获取所有员工
        const employees = await window.dbManager.getAll('employees');
        
        // 根据筛选条件过滤员工
        let filteredEmployees = employees;
        if (selectedDept) {
            filteredEmployees = filteredEmployees.filter(emp => emp.deptName === selectedDept);
        }
        
        // 获取岗位
        let positions = new Set(filteredEmployees.map(emp => emp.position).filter(pos => pos));
        if (selectedPosition) {
            positions = new Set([selectedPosition]);
        }
        
        // 渲染排班顺序表格
        await renderShiftOrderTable(positions, null, filteredEmployees);
    } catch (error) {
        console.error('加载排班顺序数据失败:', error);
        showNotification('加载排班顺序数据失败: ' + error.message, 'error');
    }
};

// 渲染排班顺序表格
async function renderShiftOrderTable(positions, unusedShiftOrderMap = null, filteredEmployees = null) {
    const tableBody = document.getElementById('shift-order-table-body');
    const table = document.getElementById('shift-order-table');
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
    
    try {
        console.log('开始渲染排班顺序表格');
        // 获取所有有效班次
        const activeShifts = await window.shiftOrderManager.getAllActiveShifts();
        
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
        
        // 转换Set为数组，方便遍历
        const positionArray = Array.from(positions).sort();
        
        // 预编译模板片段，提高HTML渲染效率
        const rowTemplates = [];
        
        let rowIndex = 1;
        
        // 预获取所有岗位和班次的排班顺序，避免在循环中使用await
        const shiftOrderCache = new Map();
        const positionShiftPairs = [];
        
        for (let i = 0; i < positionArray.length; i++) {
            const position = positionArray[i];
            for (let j = 0; j < activeShifts.length; j++) {
                const shift = activeShifts[j];
                positionShiftPairs.push({ position, shiftCode: shift.code });
            }
        }
        
        // 并行获取所有排班顺序数据
        const shiftOrderPromises = positionShiftPairs.map(pair => 
            window.shiftOrderManager.getShiftOrderByPositionAndShift(pair.position, pair.shiftCode)
                .then(shiftOrder => ({ pair, shiftOrder }))
        );
        
        // 等待所有获取操作完成
        const shiftOrderResults = await Promise.all(shiftOrderPromises);
        
        // 将结果存入缓存
        shiftOrderResults.forEach(result => {
            const key = `${result.pair.position}_${result.pair.shiftCode}`;
            shiftOrderCache.set(key, result.shiftOrder);
        });
        
        // 为每个岗位渲染员工行
        for (let i = 0; i < positionArray.length; i++) {
            const position = positionArray[i];
            console.log(`处理岗位: ${position}`);
            
            // 获取该岗位的员工
            const positionEmployees = allEmployees.filter(emp => emp.position === position && emp.status === 0);
            console.log(`该岗位员工数量: ${positionEmployees.length}`);
            
            // 为每个员工创建表格行
            for (let j = 0; j < positionEmployees.length; j++) {
                const employee = positionEmployees[j];
                console.log(`处理员工: ${employee.name} (${employee.id})`);
                
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
                    
                    // 从缓存中获取该岗位和班次的排班顺序
                    const cacheKey = `${position}_${shift.code}`;
                    const shiftOrder = shiftOrderCache.get(cacheKey);
                    
                    let orderNumber = '未设置';
                    if (shiftOrder && shiftOrder.employeeIds && Array.isArray(shiftOrder.employeeIds) && shiftOrder.employeeIds.length > 0) {
                        console.log(`获取到排班顺序: ${JSON.stringify(shiftOrder.employeeIds)}`);
                        
                        // 尝试使用ID直接查找（忽略大小写）
                        const indexById = shiftOrder.employeeIds.findIndex(id => 
                            id && typeof id === 'string' && 
                            employee.id && typeof employee.id === 'string' && 
                            id.toLowerCase() === employee.id.toLowerCase()
                        );
                        
                        if (indexById !== -1) {
                            orderNumber = (indexById + 1).toString();
                            console.log(`通过ID匹配: 员工${employee.name}在${shift.code}班次的顺序是${orderNumber}`);
                        } else {
                            // 尝试使用员工号查找（忽略大小写）
                            const indexByNumber = shiftOrder.employeeIds.findIndex(id => 
                                id && typeof id === 'string' && 
                                employee.number && typeof employee.number === 'string' && 
                                id.toLowerCase() === employee.number.toLowerCase()
                            );
                            
                            if (indexByNumber !== -1) {
                                orderNumber = (indexByNumber + 1).toString();
                                console.log(`通过员工号匹配: 员工${employee.name}在${shift.code}班次的顺序是${orderNumber}`);
                            } else {
                                // 尝试通过employeeIdMap查找
                                let foundIndex = -1;
                                for (let l = 0; l < shiftOrder.employeeIds.length; l++) {
                                    const storedId = shiftOrder.employeeIds[l];
                                    const storedEmployee = employeeIdMap.get(storedId);
                                    if (storedEmployee && storedEmployee.id === employee.id) {
                                        foundIndex = l;
                                        break;
                                    }
                                }
                                
                                if (foundIndex !== -1) {
                                    orderNumber = (foundIndex + 1).toString();
                                    console.log(`通过employeeIdMap匹配: 员工${employee.name}在${shift.code}班次的顺序是${orderNumber}`);
                                }
                            }
                        }
                    } else {
                        console.log(`未找到排班顺序或排班顺序为空: position=${position}, shiftCode=${shift.code}`);
                    }
                    
                    console.log(`员工${employee.name}在${shift.code}班次的最终显示顺序: ${orderNumber}`);
                    rowHTML += `<td class="shift-order-number">${orderNumber}</td>`;
                }
                
                rowHTML += '</tr>';
                rowTemplates.push(rowHTML);
            }
        }
        
        // 一次性插入所有行，减少DOM操作
        if (rowTemplates.length > 0) {
            tableBody.innerHTML = rowTemplates.join('');
            console.log('排班顺序表格渲染完成');
        } else {
            // 如果没有数据，显示空状态
            const colSpan = 5 + activeShifts.length; // 基础列数(5) + 班次列数
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="text-align: center; padding: 40px;">
                        暂无排班顺序数据，请选择岗位后点击班次列标题设置排班顺序
                    </td>
                </tr>
            `;
            console.log('排班顺序表格无数据');
        }
    } catch (error) {
        console.error('渲染排班顺序表格失败: ' + error);
        // 显示错误信息
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
            
            // 调用按岗位和班次编辑排班顺序的方法
            await window.editShiftOrderByPositionAndShift(selectedPosition, shift.code);
        });
        
        // 添加悬停效果提示
        th.title = '点击编辑排班顺序';
        tableHeader.appendChild(th);
    });
    

}

// 内部辅助函数：通用的员工排序逻辑
function sortEmployeesByOrder(employees, orderedEmployeeIds) {
    return [...employees].sort((a, b) => {
        // 使用字符串比较来避免类型不匹配问题
        const indexA = orderedEmployeeIds.findIndex(id => String(id) === String(a.id));
        const indexB = orderedEmployeeIds.findIndex(id => String(id) === String(b.id));
        
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

// 内部辅助函数：加载并准备编辑排班顺序
async function _prepareEditShiftOrder(position, shiftCode = null) {
    try {
        // 获取该岗位的所有员工
        const allEmployees = await window.dbManager.getAll('employees');
        let positionEmployees = allEmployees.filter(emp => emp.position === position && emp.status === 0);
        
        // 如果提供了班次代码，过滤只显示在该班次有标识的员工
        if (shiftCode && window.identifierManager) {
            // 获取当前选中的班次ID
            const shifts = await window.dbManager.getAll('shifts');
            const selectedShift = shifts.find(shift => shift.code === shiftCode);
            
            if (selectedShift) {
                // 获取该班次的所有标识
                const shiftIdentifiers = await window.identifierManager.getIdentifiersByShiftId(selectedShift.id);
                
                // 提取有标识的员工ID列表
                const identifiedEmployeeIds = shiftIdentifiers.map(identifier => identifier.employeeId);
                
                // 过滤只保留在该班次有标识的员工
                positionEmployees = positionEmployees.filter(emp => {
                    // 确保使用字符串比较，避免类型不匹配问题
                    return identifiedEmployeeIds.some(identifiedId => String(identifiedId) === String(emp.id));
                });
            }
        }
        
        // 获取当前排班顺序
        let shiftOrder;
        let orderedEmployeeIds = [];
        
        if (shiftCode) {
            shiftOrder = await window.shiftOrderManager.getShiftOrderByPositionAndShift(position, shiftCode);
        } else {
            shiftOrder = await window.shiftOrderManager.getShiftOrderByPosition(position);
        }
        
        if (shiftOrder) {
            orderedEmployeeIds = shiftOrder.employeeIds;
        }
        
        // 严格按照数据库中的orderedEmployeeIds顺序来准备员工列表
        const orderedEmployees = [];
        const employeeMap = new Map();
        
        // 创建员工ID到员工对象的映射
        positionEmployees.forEach(emp => {
            employeeMap.set(String(emp.id), emp);
        });
        
        // 首先添加在排序列表中的员工，保持数据库中的顺序
        orderedEmployeeIds.forEach(empId => {
            const emp = employeeMap.get(String(empId));
            if (emp) {
                orderedEmployees.push(emp);
                employeeMap.delete(String(empId));
            }
        });
        
        // 然后添加不在排序列表中的员工，按姓名排序
        const remainingEmployees = Array.from(employeeMap.values()).sort((a, b) => 
            a.name.localeCompare(b.name)
        );
        orderedEmployees.push(...remainingEmployees);
        
        // 显示编辑模态框，传递原始的orderedEmployeeIds以确保顺序一致性
        showShiftOrderEditModal(position, orderedEmployees, orderedEmployeeIds, shiftCode);
    } catch (error) {
        console.error('编辑排班顺序失败:', error);
        showNotification('编辑排班顺序失败: ' + error.message, 'error');
    }
}

// 按岗位编辑排班顺序（兼容旧版方法）
window.editShiftOrder = function(position) {
    return _prepareEditShiftOrder(position);
};

// 按岗位编辑排班顺序
window.editShiftOrderByPosition = function(position) {
    return _prepareEditShiftOrder(position);
};

// 按岗位和班次编辑排班顺序
window.editShiftOrderByPositionAndShift = function(position, shiftCode) {
    return _prepareEditShiftOrder(position, shiftCode);
};

// 显示排班顺序编辑模态框
function showShiftOrderEditModal(position, employees, orderedEmployeeIds, shiftCode = null) {
    const modal = document.getElementById('shiftOrderEditModal');
    const title = document.getElementById('shiftOrderModalTitle');
    const employeeList = document.getElementById('shiftOrderEmployeeList');
    const positionInput = document.getElementById('shiftOrderPositionInput');
    const shiftCodeInput = document.getElementById('shiftOrderShiftCodeInput');
    
    if (!modal || !title || !employeeList || !positionInput) return;
    
    // 设置标题和岗位
    if (shiftCode) {
        title.textContent = `编辑${position}岗位${shiftCode}班次排班顺序`;
        // 如果存在班次代码输入框，设置其值
        if (shiftCodeInput) {
            shiftCodeInput.value = shiftCode;
            shiftCodeInput.style.display = 'block';
        }
    } else {
        title.textContent = `编辑${position}岗位排班顺序`;
        // 如果存在班次代码输入框，隐藏它
        if (shiftCodeInput) {
            shiftCodeInput.style.display = 'none';
        }
    }
    
    positionInput.value = position;
    
    // 清空并填充员工列表
    employeeList.innerHTML = '';
    
    // 创建被剔除的员工容器
    let excludedEmployeesContainer = document.getElementById('excludedEmployeesContainer');
    if (!excludedEmployeesContainer) {
        excludedEmployeesContainer = document.createElement('div');
        excludedEmployeesContainer.id = 'excludedEmployeesContainer';
        excludedEmployeesContainer.style.display = 'none';
        excludedEmployeesContainer.innerHTML = `
            <h4 style="margin-top: 20px; margin-bottom: 10px;">已剔除人员（点击可重新添加）</h4>
            <div id="excludedEmployeesList" style="
                max-height: 150px;
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
        const item = document.createElement('div');
        item.className = 'shift-order-employee-item';
        item.draggable = true;
        item.dataset.employeeId = employee.id;
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
            if (item.dataset.employeeId === String(employee.id)) {
                item.remove();
            }
        });
        
        // 添加到被剔除列表
        const excludedItem = document.createElement('div');
        excludedItem.className = 'shift-order-employee-item';
        excludedItem.dataset.employeeId = employee.id;
        excludedItem.innerHTML = `
            <span class="shift-order-employee-handle">+</span>
            <div class="employee-info">
                <span class="employee-name">${employee.name}</span>
                <span class="employee-detail">${employee.number}</span>
            </div>
        `;
        excludedItem.style.cursor = 'pointer';
        excludedItem.style.background = 'rgba(255, 0, 0, 0.1)';
        
        // 添加点击事件，重新添加到拖拽列表
        excludedItem.addEventListener('click', function() {
            this.remove();
            addEmployeeToDraggableList(employee);
            updateExcludedContainerVisibility();
        });
        
        excludedEmployeesList.appendChild(excludedItem);
        updateEmployeeNumbers();
        updateExcludedContainerVisibility();
    }
    
    // 更新被剔除容器的可见性
    function updateExcludedContainerVisibility() {
        if (excludedEmployeesList.children.length > 0) {
            excludedEmployeesContainer.style.display = 'block';
        } else {
            excludedEmployeesContainer.style.display = 'none';
        }
    }
    
    // 直接使用传入的员工列表，这个列表已经在_prepareEditShiftOrder函数中按照数据库顺序排序好了
    employees.forEach(employee => {
        addEmployeeToDraggableList(employee);
    });
    
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
                    // 如果有shiftCode，调用按班次保存的方法
                    window.saveShiftOrderByShift();
                } else {
                    // 否则调用默认保存方法
                    window.saveShiftOrder();
                }
            });
        })(shiftCode);
    } else {
        console.error('未找到保存按钮！选择器: #shiftOrderEditModal .modal-footer .btn-primary');
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

// 内部辅助函数：重新加载排班顺序数据
function _reloadShiftOrderData() {
    return new Promise(function(resolve, reject) {
        try {
            // 先确保shiftOrderManager实例已经初始化
            if (window.shiftOrderManager) {
                // 先清除缓存，确保获取最新数据
                window.shiftOrderManager.clearCache && window.shiftOrderManager.clearCache();
            }
            
            if (window.loadShiftOrderData) {
                var result = window.loadShiftOrderData();
                if (result && typeof result.then === 'function') {
                    result.then(function() {
                        console.log('排班数据重新加载成功，准备刷新表格显示');
                        // 确保表格重新渲染
                        _refreshShiftOrderTable();
                        resolve();
                    }).catch(reject);
                } else {
                    console.log('直接调用loadShiftOrderData，准备刷新表格显示');
                    // 确保表格重新渲染
                    _refreshShiftOrderTable();
                    resolve();
                }
            } else {
                var result = loadAllShiftOrders();
                if (result && typeof result.then === 'function') {
                    result.then(function() {
                        console.log('调用loadAllShiftOrders成功，准备刷新表格显示');
                        // 确保表格重新渲染
                        _refreshShiftOrderTable();
                        resolve();
                    }).catch(reject);
                } else {
                    console.log('直接调用loadAllShiftOrders，准备刷新表格显示');
                    // 确保表格重新渲染
                    _refreshShiftOrderTable();
                    resolve();
                }
            }
        } catch (e) {
            console.error('重新加载排班数据时发生错误:', e);
            reject(e);
        }
    });
}

// 内部辅助函数：强制刷新排班顺序表格
function _refreshShiftOrderTable() {
    try {
        const tableBody = document.getElementById('shift-order-table-body');
        const positionFilter = document.getElementById('shiftOrderPositionFilter');
        const selectedPosition = positionFilter && positionFilter.value ? positionFilter.value : null;
        
        if (tableBody) {
            console.log('执行排班表格强制刷新，选中的岗位:', selectedPosition);
            
            // 获取所有员工并渲染表格
            window.dbManager.getAll('employees').then(function(allEmployees) {
                // 根据选中的岗位筛选员工
                let filteredEmployees = allEmployees || [];
                if (selectedPosition) {
                    filteredEmployees = filteredEmployees.filter(emp => emp.position === selectedPosition);
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
function _saveShiftOrderInternal(position, employeeIds, shiftCode = null) {
    // 关闭模态框
    document.getElementById('shiftOrderEditModal').style.display = 'none';
    
    // 保存排班顺序并重新加载数据
    return _reloadShiftOrderData()
        .then(function() {
            showNotification('排班顺序保存成功');
        })
        .catch(function(error) {
            console.error('保存排班顺序失败: ' + error);
            showNotification('保存排班顺序失败: ' + error.message, 'error');
        });
}

// 保存排班顺序（兼容旧版）
window.saveShiftOrder = function() {
    var position = document.getElementById('shiftOrderPositionInput').value;
    var employeeItems = document.querySelectorAll('#shiftOrderEmployeeList .shift-order-employee-item');
    
    // 获取员工ID，不使用Array.from和map方法
    var employeeIds = [];
    for (var i = 0; i < employeeItems.length; i++) {
        employeeIds.push(employeeItems[i].dataset.employeeId);
    }
    
    if (!position || employeeIds.length === 0) {
        showNotification('请选择岗位并添加员工', 'error');
        return;
    }
    
    // 保存排班顺序
    window.shiftOrderManager.saveShiftOrder(position, employeeIds)
        .then(function() {
            return _saveShiftOrderInternal(position, employeeIds);
        });
};

// 按班次保存排班顺序
window.saveShiftOrderByShift = function() {
    var position = document.getElementById('shiftOrderPositionInput').value;
    var shiftCodeInput = document.getElementById('shiftOrderShiftCodeInput');
    var shiftCode = shiftCodeInput ? shiftCodeInput.value : null;
    var employeeItems = document.querySelectorAll('#shiftOrderEmployeeList .shift-order-employee-item');
    
    // 获取员工ID，不使用Array.from和map方法
    var employeeIds = [];
    for (var i = 0; i < employeeItems.length; i++) {
        employeeIds.push(employeeItems[i].dataset.employeeId);
    }
    
    if (!position || !shiftCode || employeeIds.length === 0) {
        showNotification('请选择岗位、班次并添加员工', 'error');
        return;
    }
    
    // 保存排班顺序
    window.shiftOrderManager.saveShiftOrderByShift(position, shiftCode, employeeIds)
        .then(function() {
            return _saveShiftOrderInternal(position, employeeIds, shiftCode);
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
            window.shiftOrderManager.addEmployeeToShiftOrder(employee.id, employee.position).then(function() {
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
        var employeeId = e.detail.employeeId;
        window.shiftOrderManager.removeEmployeeFromShiftOrder(employeeId).then(function() {
            console.log('已从所有排班顺序中移除员工ID: ' + employeeId);
        }).catch(function(error) {
            console.error('自动从排班顺序中移除员工失败:' + error);
        });
    } catch (error) {
        console.error('自动从排班顺序中移除员工失败:' + error);
    }
});

// 监听员工岗位变更事件，更新排班顺序
window.addEventListener('employeePositionChanged', function(e) {
    try {
        var employeeId = e.detail.employeeId;
        var oldPosition = e.detail.oldPosition;
        var newPosition = e.detail.newPosition;
        
        // 从原岗位的排班顺序中移除
        if (oldPosition) {
            window.shiftOrderManager.removeEmployeeFromShiftOrder(employeeId).then(function() {
                // 添加到新岗位的排班顺序末尾
                if (newPosition) {
                    window.shiftOrderManager.addEmployeeToShiftOrder(employeeId, newPosition).then(function() {
                        console.log('已更新员工ID: ' + employeeId + '的排班顺序（从' + (oldPosition || '无') + '到' + (newPosition || '无') + '）');
                    }).catch(function(error) {
                        console.error('更新员工排班顺序失败:' + error);
                    });
                }
            }).catch(function(error) {
                console.error('更新员工排班顺序失败:' + error);
            });
        } else if (newPosition) {
            // 如果没有旧岗位，直接添加到新岗位
            window.shiftOrderManager.addEmployeeToShiftOrder(employeeId, newPosition).then(function() {
                console.log('已更新员工ID: ' + employeeId + '的排班顺序（从无到' + newPosition + '）');
            }).catch(function(error) {
                console.error('更新员工排班顺序失败:' + error);
            });
        }
    } catch (error) {
        console.error('更新员工排班顺序失败:' + error);
    }
});