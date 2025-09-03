class IdentifierManager {
    constructor() {
        // 初始化时确保标识存储空间存在
        this.initializeStore().catch(err => console.error('初始化标识存储空间失败:', err));
    }

    // 创建规范化ID的函数
    normalizeId(id) {
        if (id === null || id === undefined) return '';
        return String(id).toLowerCase().trim();
    }

    // 初始化标识存储空间
    async initializeStore() {
        try {
            const db = await window.dbManager.ensureInitialized();
        } catch (error) {
            console.error('初始化标识存储空间异常:', error);
        }
    }

    // 获取所有标识数据
    async getAllIdentifiers() {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                return [];
            }
            return await window.dbManager.getAll('identifiers');
        } catch (error) {
            console.error('获取标识数据失败:', error);
            return [];
        }
    }

    // 保存标识数据
    async saveIdentifier(identifierData) {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                console.error('标识存储空间不存在');
                throw new Error('标识存储空间不存在');
            }
            
            let data = { ...identifierData };
            
            // 如果提供了员工号但没有员工ID，查找对应的员工
            if (data.employeeNumber && !data.employeeId) {
                const employee = await this.findEmployeeByNumber(data.employeeNumber);
                if (employee) {
                    data.employeeId = employee.id;
                } else {
                    console.error('根据员工号找不到对应的员工:', data.employeeNumber);
                    throw new Error('根据员工号找不到对应的员工');
                }
            }
            
            // 如果提供了班次代码但没有班次ID，查找对应的班次
            if (data.shiftCode && !data.shiftId) {
                const shift = await this.findShiftByCode(data.shiftCode);
                if (shift) {
                    data.shiftId = shift.id;
                } else {
                    console.error('根据班次代码找不到对应的班次:', data.shiftCode);
                    throw new Error('根据班次代码找不到对应的班次');
                }
            }
            
            // 如果提供了员工ID但没有员工号，查找员工号
            if (data.employeeId && !data.employeeNumber) {
                const employee = await window.dbManager.getById('employees', data.employeeId);
                if (employee) {
                    data.employeeNumber = employee.number;
                }
            }
            
            // 如果提供了班次ID但没有班次代码，查找班次代码
            if (data.shiftId && !data.shiftCode) {
                const shift = await window.dbManager.getById('shifts', data.shiftId);
                if (shift) {
                    data.shiftCode = shift.code;
                }
            }
            
            // 添加更新时间
            data.updatedAt = new Date();
            
            const result = await window.dbManager.save('identifiers', data);
            
            // 添加标识联动排班人员列表的逻辑
            // 1. 保留原有的空方法调用（用于保持代码兼容性）
            this.notifyShiftOrderManagerAboutIdentifierChange(identifierData.employeeId, identifierData.shiftId, identifierData.canWork);
            
            // 2. 添加新的事件触发逻辑，与批量导入行为保持一致
            // 但不启用自动排序功能，只确保班次编辑的模态框员工列表能刷新数据库中的排班顺序
            try {
                if (window.shiftOrderManager) {
                    console.log('标识数据保存完成，触发标识变更事件以刷新员工列表');
                    const event = new CustomEvent('identifierChanged', {
                        detail: {
                            employeeId: identifierData.employeeId,
                            employeeNumber: data.employeeNumber,
                            shiftId: identifierData.shiftId,
                            shiftCode: data.shiftCode,
                            canWork: identifierData.canWork
                        }
                    });
                    window.dispatchEvent(event);
                }
            } catch (eventError) {
                console.error('触发标识变更事件失败:', eventError);
            }
            
            // 同步刷新岗位下拉框并传递员工岗位信息
            try {
                // 当标识被选中（canWork=true）时，将员工岗位传递给岗位下拉框
                if (identifierData.canWork) {
                    console.log('标识被选中，将员工岗位传递给岗位下拉框，员工ID:', identifierData.employeeId);
                    // 使用防抖机制避免短时间内多次触发岗位筛选
                    await this.propagateEmployeePositionToDropdown(identifierData.employeeId, true);
                }
                // 当标识未被选中时，不再重新加载所有岗位，以避免重复加载
            } catch (refreshError) {
                console.error('刷新岗位下拉框失败:', refreshError);
            }
            
            return result;
        } catch (error) {
            console.error('保存标识数据失败:', error);
            // 确保抛出的是字符串类型的错误信息，避免传递undefined或null
            throw new Error(error && error.message ? error.message : '未知的保存错误');
        }
    }

    // 根据员工ID获取标识数据
    async getIdentifiersByEmployeeId(employeeId) {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                return [];
            }
            
            return await window.dbManager.getByIndex('identifiers', 'employeeId', employeeId);
        } catch (error) {
            console.error('根据员工ID获取标识数据失败:', error);
            return [];
        }
    }
    
    // 根据员工号获取标识数据
    async getIdentifiersByEmployeeNumber(employeeNumber) {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                return [];
            }
            
            // 先尝试直接通过employeeNumber索引查找
            let identifiers = await window.dbManager.getByIndex('identifiers', 'employeeNumber', employeeNumber);
            
            // 如果没找到，可能是因为旧数据没有employeeNumber字段，尝试通过员工号查找员工ID，再通过员工ID查找标识
            if (identifiers.length === 0) {
                const employee = await this.findEmployeeByNumber(employeeNumber);
                if (employee) {
                    identifiers = await this.getIdentifiersByEmployeeId(employee.id);
                }
            }
            
            return identifiers;
        } catch (error) {
            console.error('根据员工号获取标识数据失败:', error);
            return [];
        }
    }
    
    // 根据员工号和班次代码获取标识数据
    async getIdentifierByEmployeeNumberAndShiftCode(employeeNumber, shiftCode) {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                return null;
            }
            
            // 先查找对应的员工和班次
            const employee = await this.findEmployeeByNumber(employeeNumber);
            const shift = await this.findShiftByCode(shiftCode);
            
            if (!employee || !shift) {
                return null;
            }
            
            // 尝试通过employeeId和shiftId查找
            const identifiers = await this.getAllIdentifiers();
            return identifiers.find(identifier => 
                identifier.employeeId === employee.id && 
                identifier.shiftId === shift.id
            ) || null;
        } catch (error) {
            console.error('根据员工号和班次代码获取标识数据失败:', error);
            return null;
        }
    }

    // 根据班次ID获取标识数据
    async getIdentifiersByShiftId(shiftId) {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                return [];
            }
            
            return await window.dbManager.getByIndex('identifiers', 'shiftId', shiftId);
        } catch (error) {
            console.error('根据班次ID获取标识数据失败:', error);
            return [];
        }
    }

    // 重置所有人的班次为空（不删除数据，而是将所有canWork设为false）
    async clearAllIdentifiers() {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                console.log('标识存储空间不存在');
                return true;
            }
            
            // 获取所有标识数据
            const identifiers = await this.getAllIdentifiers();
            
            if (identifiers.length === 0) {
                console.log('没有标识数据需要重置');
                return true;
            }
            
            // 将所有标识数据的canWork设为false
            const updatedIdentifiers = identifiers.map(identifier => ({
                ...identifier,
                canWork: false,
                updatedAt: new Date()
            }));
            
            // 批量更新
            const savePromises = updatedIdentifiers.map(identifier => 
                window.dbManager.save('identifiers', identifier)
            );
            
            await Promise.all(savePromises);
            
            // 添加标识联动排班人员列表的逻辑 - 当所有标识被重置时
            if (window.shiftOrderManager) {
                console.log('所有标识已重置，触发排班人员列表更新');
                // 触发一个全局事件，让shift-order-management.js监听并响应
                const event = new CustomEvent('allIdentifiersReset', {});
                window.dispatchEvent(event);
            }
            
            return true;
        } catch (error) {
            console.error('重置标识数据失败:', error);
            throw error;
        }
    }

    // 通知排班管理器关于标识变更 - 仅保留方法但不执行任何操作（完全禁用自动排序）
    notifyShiftOrderManagerAboutIdentifierChange(employeeId, shiftId, isAdded) {
        // 已完全禁用自动排序功能，所有排班排序都将通过手动编辑完成
        console.log(`标识变更已记录但不会自动更新排班顺序：员工ID ${employeeId} 的标识已变更，班次ID: ${shiftId}，是否添加: ${isAdded}`);
    }

    // 新增方法：将员工岗位传递给岗位下拉框并刷新
    async propagateEmployeePositionToDropdown(employeeId, useDebounce = false) {
        try {
            // 防抖处理
            if (this.positionFilterDebounceTimer) {
                clearTimeout(this.positionFilterDebounceTimer);
            }
            
            // 如果是批量操作，直接返回，不执行任何操作
            if (window.isBulkIdentifierOperation) {
                console.log('批量操作中，跳过岗位下拉框更新');
                return;
            }
            
            // 如果不需要防抖，则直接执行
            if (!useDebounce) {
                // 获取员工信息
                const employee = await window.dbManager.getById('employees', employeeId);
                if (!employee || !employee.position) {
                    console.warn('未找到员工或员工没有岗位信息:', employeeId);
                    return;
                }
                
                console.log(`获取到员工 ${employee.name} 的岗位信息: ${employee.position}`);
                
                // 将员工岗位设置到岗位下拉框（仅当当前不是全部岗位时）
                const positionFilter = document.getElementById('identifierPositionFilter');
                if (positionFilter) {
                    // 检查当前是否为全部岗位（空值）
                    const isAllPositions = positionFilter.value === '';
                    
                    // 先检查是否有对应的选项
                    const hasPosition = Array.from(positionFilter.options).some(option => option.value === employee.position);
                    
                    if (hasPosition && !isAllPositions && !window.isBulkIdentifierOperation) {
                        // 只有当当前不是全部岗位且不是批量操作时，才设置岗位下拉框
                        const oldValue = positionFilter.value;
                        positionFilter.value = employee.position;
                        console.log(`已将岗位下拉框设置为: ${employee.position}`);
                        
                        // 只有当值真正改变时且不在恢复滚动位置时才触发change事件
                        if (typeof Event !== 'undefined' && oldValue !== employee.position) {
                            if (window.isRestoringScrollPosition) {
                                console.log('正在恢复滚动位置，暂时不触发岗位筛选框change事件');
                            } else {
                                positionFilter.dispatchEvent(new Event('change'));
                            }
                        } else {
                            console.log(`岗位下拉框已经是: ${employee.position}，无需触发change事件`);
                        }
                    } else if (hasPosition && isAllPositions) {
                        console.log(`当前是全部岗位，保持不变，不自动设置为: ${employee.position}`);
                    } else {
                        console.warn(`岗位下拉框中未找到岗位: ${employee.position}`);
                        // 如果未找到对应的岗位选项，尝试重新从所有员工中加载岗位列表
                        if (window.loadPositionsForDepartment && typeof window.loadPositionsForDepartment === 'function') {
                            console.log('重新从所有员工中加载岗位列表');
                            await window.loadPositionsForDepartment('', 'identifier'); // 传入空字符串表示从所有部门加载
                        }
                        // 再次尝试设置岗位 - 优化为只在非批量操作时执行
                        if (!window.isBulkIdentifierOperation) {
                            setTimeout(() => {
                                if (positionFilter && Array.from(positionFilter.options).some(option => option.value === employee.position) && !isAllPositions) {
                                    // 只有当当前不是全部岗位时，才设置岗位下拉框
                                    positionFilter.value = employee.position;
                                    if (typeof Event !== 'undefined') {
                                        if (window.isRestoringScrollPosition) {
                                            console.log('正在恢复滚动位置，暂时不触发岗位筛选框change事件');
                                        } else {
                                            positionFilter.dispatchEvent(new Event('change'));
                                        }
                                    }
                                }
                            }, 100);
                        }
                    }
                }
            } else {
                // 启用防抖，延迟执行岗位筛选变更
                return new Promise((resolve) => {
                    this.positionFilterDebounceTimer = setTimeout(async () => {
                        try {
                            // 获取员工信息
                            const employee = await window.dbManager.getById('employees', employeeId);
                            if (!employee || !employee.position) {
                                console.warn('未找到员工或员工没有岗位信息:', employeeId);
                                resolve();
                                return;
                            }
                            
                            console.log(`获取到员工 ${employee.name} 的岗位信息: ${employee.position}`);
                            
                            // 将员工岗位设置到岗位下拉框（仅当当前不是全部岗位时）
                            const positionFilter = document.getElementById('identifierPositionFilter');
                            if (positionFilter) {
                                // 检查当前是否为全部岗位（空值）
                                const isAllPositions = positionFilter.value === '';
                                
                                // 先检查是否有对应的选项
                                const hasPosition = Array.from(positionFilter.options).some(option => option.value === employee.position);
                                
                                if (hasPosition && !isAllPositions) {
                                    // 只有当当前不是全部岗位时，才设置岗位下拉框
                                    const oldValue = positionFilter.value;
                                    positionFilter.value = employee.position;
                                    console.log(`已将岗位下拉框设置为: ${employee.position}`);
                                    
                                    // 只有当值真正改变时且不在恢复滚动位置时才触发change事件
                                    if (typeof Event !== 'undefined' && oldValue !== employee.position) {
                                        if (window.isRestoringScrollPosition) {
                                            console.log('正在恢复滚动位置，暂时不触发岗位筛选框change事件');
                                        } else {
                                            positionFilter.dispatchEvent(new Event('change'));
                                        }
                                    } else {
                                        console.log(`岗位下拉框已经是: ${employee.position}，无需触发change事件`);
                                    }
                                } else if (hasPosition && isAllPositions) {
                                    console.log(`当前是全部岗位，保持不变，不自动设置为: ${employee.position}`);
                                } else {
                                    console.warn(`岗位下拉框中未找到岗位: ${employee.position}`);
                                    // 不再重新加载岗位列表，因为会导致重复加载
                                    // 再次尝试设置岗位 - 优化为只在非批量操作时执行
                                    if (!window.isBulkIdentifierOperation) {
                                        setTimeout(() => {
                                            if (positionFilter && Array.from(positionFilter.options).some(option => option.value === employee.position) && !isAllPositions) {
                                            // 只有当当前不是全部岗位时，才设置岗位下拉框
                                            positionFilter.value = employee.position;
                                            if (typeof Event !== 'undefined') {
                                                if (window.isRestoringScrollPosition) {
                                                    console.log('正在恢复滚动位置，暂时不触发岗位筛选框change事件');
                                                } else {
                                                    positionFilter.dispatchEvent(new Event('change'));
                                                }
                                            }
                                        }
                                        }, 100);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('传递员工岗位信息失败:', error);
                        } finally {
                            resolve();
                        }
                    }, 200); // 200ms的防抖延迟
                });
            }
        } catch (error) {
            console.error('传递员工岗位信息失败:', error);
        }
    }

    // 批量保存标识数据
    async bulkSaveIdentifiers(identifiers) {
        try {
            const exists = await window.dbManager.checkObjectStoreExists('identifiers');
            if (!exists) {
                console.error('标识存储空间不存在');
                throw new Error('标识存储空间不存在');
            }
            
            // 首先处理每个标识数据，补充员工号和班次代码信息
            const processedIdentifiers = await Promise.all(
                identifiers.map(async (identifier) => {
                    let processed = { ...identifier };
                    
                    // 如果提供了员工号但没有员工ID，查找对应的员工
                    if (processed.employeeNumber && !processed.employeeId) {
                        const employee = await this.findEmployeeByNumber(processed.employeeNumber);
                        if (employee) {
                            processed.employeeId = employee.id;
                        }
                    }
                    
                    // 如果提供了班次代码但没有班次ID，查找对应的班次
                    if (processed.shiftCode && !processed.shiftId) {
                        const shift = await this.findShiftByCode(processed.shiftCode);
                        if (shift) {
                            processed.shiftId = shift.id;
                        }
                    }
                    
                    // 如果提供了员工ID但没有员工号，查找员工号
                    if (processed.employeeId && !processed.employeeNumber) {
                        const employee = await window.dbManager.getById('employees', processed.employeeId);
                        if (employee) {
                            processed.employeeNumber = employee.number;
                        }
                    }
                    
                    // 如果提供了班次ID但没有班次代码，查找班次代码
                    if (processed.shiftId && !processed.shiftCode) {
                        const shift = await window.dbManager.getById('shifts', processed.shiftId);
                        if (shift) {
                            processed.shiftCode = shift.code;
                        }
                    }
                    
                    return processed;
                })
            );
            
            // 添加去重逻辑，确保每个员工-班次组合唯一
            const uniqueCombinations = new Set();
            const uniqueIdentifiers = [];
            
            processedIdentifiers.forEach(identifier => {
                // 优先使用employeeId和shiftId进行去重，如果没有则使用employeeNumber和shiftCode
                const key = identifier.employeeId && identifier.shiftId 
                    ? `${identifier.employeeId}-${identifier.shiftId}` 
                    : identifier.employeeNumber && identifier.shiftCode 
                        ? `${identifier.employeeNumber}-${identifier.shiftCode}` 
                        : null;
                        
                if (key && !uniqueCombinations.has(key)) {
                    uniqueCombinations.add(key);
                    uniqueIdentifiers.push(identifier);
                }
            });
            
            // 为了避免重复导入时报错，先检查数据库中已有的记录
            // 获取所有已存在的标识数据
            const existingIdentifiers = await this.getAllIdentifiers();
            const existingKeyMap = new Map();
            
            existingIdentifiers.forEach(identifier => {
                // 为每个记录创建两个键：一个基于ID，一个基于编号/代码
                if (identifier.employeeId && identifier.shiftId) {
                    const idKey = `${identifier.employeeId}-${identifier.shiftId}`;
                    existingKeyMap.set(idKey, identifier.id);
                }
                if (identifier.employeeNumber && identifier.shiftCode) {
                    const codeKey = `${identifier.employeeNumber}-${identifier.shiftCode}`;
                    existingKeyMap.set(codeKey, identifier.id);
                }
            });
            
            // 准备最终要保存的数据
            const dataToSave = uniqueIdentifiers.map(identifier => {
                // 尝试通过两种方式查找现有ID
                let existingId = null;
                
                // 首先尝试通过ID查找
                if (identifier.employeeId && identifier.shiftId) {
                    const idKey = `${identifier.employeeId}-${identifier.shiftId}`;
                    existingId = existingKeyMap.get(idKey);
                }
                
                // 如果通过ID没找到，尝试通过编号/代码查找
                if (!existingId && identifier.employeeNumber && identifier.shiftCode) {
                    const codeKey = `${identifier.employeeNumber}-${identifier.shiftCode}`;
                    existingId = existingKeyMap.get(codeKey);
                }
                
                // 如果有现有ID，使用它；否则不设置id字段，让IndexedDB自动生成
                if (existingId) {
                    return {
                        ...identifier,
                        id: existingId,
                        updatedAt: new Date()
                    };
                } else {
                    // 不包含id字段，让IndexedDB自动生成
                    return {
                        ...identifier,
                        updatedAt: new Date()
                    };
                }
            });
            
            const result = await window.dbManager.bulkSave('identifiers', dataToSave);
            
            // 同步刷新岗位下拉框并传递员工岗位信息
            try {
                // 找出被选中的员工ID集合（去重）
                const selectedEmployeeIds = [...new Set(
                    uniqueIdentifiers
                        .filter(identifier => identifier.canWork)
                        .map(identifier => identifier.employeeId)
                )];

                if (selectedEmployeeIds.length > 0) {
                    // 如果有被选中的标识，传递第一个员工的岗位信息给下拉框
                    // 注意：在批量操作中，我们只能设置一个岗位作为当前选中值
                    console.log('批量保存标识中有被选中的标识，将第一个员工岗位传递给岗位下拉框，员工ID:', selectedEmployeeIds[0]);
                    await this.propagateEmployeePositionToDropdown(selectedEmployeeIds[0]);
                } else {
                    // 如果没有被选中的标识，从所有员工中加载岗位下拉框以确保显示所有可用岗位
                    if (window.loadPositionsForDepartment && typeof window.loadPositionsForDepartment === 'function') {
                        console.log('批量保存标识后没有被选中的标识，从所有员工中加载岗位下拉框');
                        await window.loadPositionsForDepartment('', 'identifier'); // 传入空字符串表示从所有部门加载
                    }
                }
            } catch (refreshError) {
                console.error('刷新岗位下拉框失败:', refreshError);
            }

            // 通知排班管理器标识变更，使批量操作与单点操作行为一致
            try {
                // 遍历所有唯一标识，通知排班管理器
                for (const identifier of uniqueIdentifiers) {
                    // isAdded 参数表示是否设置了标识（canWork=true）
                    this.notifyShiftOrderManagerAboutIdentifierChange(
                        identifier.employeeId,
                        identifier.shiftId,
                        identifier.canWork
                    );
                }
            } catch (notifyError) {
                console.error('通知排班管理器标识变更失败:', notifyError);
            }
            
            return result;
        } catch (error) {
            console.error('批量保存标识数据失败:', error);
            // 确保抛出的是字符串类型的错误信息，避免传递undefined或null
            throw new Error(error && error.message ? error.message : '未知的保存错误');
        }
    }

    // 导入标识数据
    async importIdentifiersFromExcel(data) {
        try {
            console.log('开始导入标识数据，数据量:', data.length);
            // 在导入数据前先清空原有标识数据
            console.log('清空原有标识数据...');
            await window.dbManager.clearStore('identifiers');
            console.log('原有标识数据已清空');
            
            // 这里需要根据Excel数据格式进行处理
            // 假设data是解析后的员工-班次关系数组
            const identifiers = [];
            
            // 记录有效的员工-班次组合
            const validCombinations = new Set();
            
            // 处理导入的数据
            for (const item of data) {
                // 优先使用员工号和班次代码
                    if (item.employeeNumber && item.shiftCode) {
                        // 查找对应的员工和班次
                        const employee = await this.findEmployeeByNumber(item.employeeNumber);
                        const shift = await this.findShiftByCode(item.shiftCode);
                        
                        if (employee && shift) {
                            // 检查是否重复
                            const key = `${employee.id}-${shift.id}`;
                            if (!validCombinations.has(key)) {
                                identifiers.push({
                                    employeeId: employee.id,
                                    employeeNumber: employee.number,  // 保存员工号
                                    shiftId: shift.id,
                                    shiftCode: shift.code,  // 保存班次代码
                                    canWork: item.canWork !== false, // 默认设为true，除非明确指定为false
                                    createdAt: new Date()
                                });
                                validCombinations.add(key);
                            }
                        }
                    } else if (item.employeeId && item.shiftId) {
                        // 兼容旧的数据格式，通过ID查找员工和班次信息以保存员工号和班次代码
                        const employee = await window.dbManager.getById('employees', item.employeeId);
                        const shift = await window.dbManager.getById('shifts', item.shiftId);
                        
                        // 检查是否重复
                        const key = `${item.employeeId}-${item.shiftId}`;
                        if (!validCombinations.has(key)) {
                            identifiers.push({
                                employeeId: item.employeeId,
                                employeeNumber: employee ? employee.number : '',  // 保存员工号
                                shiftId: item.shiftId,
                                shiftCode: shift ? shift.code : '',  // 保存班次代码
                                canWork: item.canWork !== false, // 默认设为true，除非明确指定为false
                                createdAt: new Date()
                            });
                            validCombinations.add(key);
                        }
                    }
            }
            
            // 批量保存处理后的数据
            if (identifiers.length > 0) {
                await this.bulkSaveIdentifiers(identifiers);
            }
            
            // 导入完成后，额外触发一个全局事件表示所有标识已重新导入
            // 这确保排班编辑器能完全重新加载标识数据，与单点操作保持一致
            try {
                if (window.shiftOrderManager) {
                    console.log('标识数据导入完成，触发全局标识重新加载事件');
                    const event = new CustomEvent('allIdentifiersReimported', {
                        detail: {
                            count: identifiers.length
                        }
                    });
                    window.dispatchEvent(event);
                }
            } catch (eventError) {
                console.error('触发全局标识重新加载事件失败:', eventError);
            }
            
            return identifiers.length;
        } catch (error) {
            console.error('导入标识数据失败:', error);
            // 确保抛出的是字符串类型的错误信息，避免传递undefined或null
            throw new Error(error && error.message ? error.message : '未知的导入错误');
        }
    }

    // 根据员工号查找员工
    async findEmployeeByNumber(employeeNumber) {
        try {
            const employees = await window.dbManager.getAll('employees');
            // 进行规范化比较，确保更精确的匹配
            const normalizedEmployeeNumber = this.normalizeId(String(employeeNumber));
            return employees.find(emp => 
                this.normalizeId(String(emp.number)) === normalizedEmployeeNumber
            );
        } catch (error) {
            console.error('查找员工失败:', error);
            return null;
        }
    }

    // 根据班次代码查找班次
    async findShiftByCode(shiftCode) {
        try {
            if (window.shiftManager) {
                const shifts = await window.shiftManager.getAllShifts();
                return shifts.find(shift => shift.code === shiftCode);
            }
            return null;
        } catch (error) {
            console.error('查找班次失败:', error);
            return null;
        }
    }

}

// 全局变量
let identifierManager = null;
let allEmployees = []; // 所有在职员工
let allActiveShifts = []; // 所有启用的班次
let allIdentifiers = {}; // 所有标识数据，格式: { 'employeeId-shiftId': canWork }

// 初始化标识管理
window.initIdentifierManagement = async function() {
    try {
        // 创建标识管理器实例
        identifierManager = new IdentifierManager();
        window.identifierManager = identifierManager;
        
        console.log('标识管理功能初始化完成');
        
        // 加载数据
        await loadIdentifierData();
    } catch (error) {
        console.error('初始化标识管理功能失败:', error);
        if (window.showNotification) {
            window.showNotification('初始化标识管理功能失败: ' + error.message, 'error');
        }
    }
};

// 加载标识管理数据
async function loadIdentifierData() {
    try {
        // 确保identifierManager已初始化
        if (!identifierManager) {
            await window.initIdentifierManagement();
        }
        
        // 获取所有在职员工（未删除且状态不为离职）
        const employees = await window.dbManager.getAll('employees');
        
        // 获取筛选条件
        let empNumberFilter = '';
        const filterInput = document.getElementById('identifierEmpNumberFilter');
        if (filterInput) {
            empNumberFilter = filterInput.value.trim().toLowerCase();
        }
        
        let deptFilter = '';
        const deptFilterSelect = document.getElementById('identifierDeptFilter');
        if (deptFilterSelect) {
            deptFilter = deptFilterSelect.value;
        }
        
        let positionFilter = '';
        const positionFilterSelect = document.getElementById('identifierPositionFilter');
        if (positionFilterSelect) {
            positionFilter = positionFilterSelect.value;
        }
        
        // 过滤员工数据：先过滤离职状态，再应用各项筛选条件
        allEmployees = employees.filter(emp => {
            // 检查是否为在职状态（0:在职, 1:离职, 2:休假）
            const isActive = emp.status !== 1;
            
            // 检查员工号是否匹配筛选条件
            // 确保emp.number是字符串类型
            const empNumberStr = emp.number ? String(emp.number) : '';
            const matchesNumberFilter = empNumberFilter ? 
                empNumberStr.toLowerCase().includes(empNumberFilter) : true;
            
            // 检查部门是否匹配筛选条件 - 仅使用部门名称进行匹配，不使用机构ID
            const matchesDeptFilter = deptFilter ? 
                (() => {
                    if (!emp.deptName) return false;
                    
                    // 仅使用部门名称进行匹配（不区分大小写）
                    const empDeptName = emp.deptName.toString().trim().toLowerCase();
                    const targetDeptName = deptFilter.toString().trim().toLowerCase();
                    
                    return empDeptName === targetDeptName;
                })() : true;
            
            // 检查岗位是否匹配筛选条件
            const matchesPositionFilter = positionFilter ? 
                (emp.position && emp.position === positionFilter) : true;
            
            return isActive && matchesNumberFilter && matchesDeptFilter && matchesPositionFilter;
        });
        
        // 获取所有启用的班次
        if (window.shiftManager) {
            const shifts = await window.shiftManager.getAllShifts();
            allActiveShifts = shifts.filter(shift => shift.status === 0); // 只显示启用状态的班次
        }
        
        // 获取所有标识数据
        const identifiers = await identifierManager.getAllIdentifiers();
        
        // 构建标识数据映射
        allIdentifiers = {};
        identifiers.forEach(identifier => {
            const key = `${identifier.employeeId}-${identifier.shiftId}`;
            allIdentifiers[key] = identifier.canWork;
        });
        
        // 渲染表格（处理异步函数）
        await renderIdentifierTable();
        
        console.log('已加载标识管理数据: 员工数=' + allEmployees.length + ', 班次数=' + allActiveShifts.length);
    } catch (error) {
        console.error('加载标识管理数据失败:', error);
        if (window.showNotification) {
            window.showNotification('加载标识管理数据失败: ' + error.message, 'error');
        }
    }
}

// 渲染标识管理表格
async function renderIdentifierTable() {
    try {
        const tableContainer = document.querySelector('#identifiers-tab .table-container');
        if (!tableContainer) {
            console.error('标识管理表格容器未找到');
            return;
        }
        
        // 创建表格HTML - 先创建一个带滚动的外层容器
        let tableHtml = `
        <div class="table-scroll-wrapper">
            <table id="identifier-table" class="scrollable-table">
                <thead>
                    <tr>
                        <th class="fixed-column">序号</th>
                        <th class="fixed-column" style="width: 120px;">员工号</th>
                        <th class="fixed-column">姓名</th>
                        <th class="fixed-column">所属机构</th>
                        <th class="fixed-column">所属部门</th>
                        <th class="fixed-column">岗位</th>`;
        
        // 添加班次列（只显示代码，不显示名称）
            allActiveShifts.forEach((shift, index) => {
                tableHtml += `<th>${shift.code}</th>`;
            });
        
        tableHtml += `</tr></thead><tbody>`;
        
        // 添加员工行
            allEmployees.forEach((employee, empIndex) => {
                const orgName = employee.orgName || '未知机构';
                
                // 使用div背景色
                const rowBgColor = 'background-color: var(--card-bg);';
                
                tableHtml += `
            <tr class="hover-row" style="${rowBgColor}">
                <td class="fixed-column" title="序号: ${empIndex + 1}">${empIndex + 1}</td>
                <td class="fixed-column" title="员工号: ${employee.number || '-'}">${employee.number || '-'}</td>
                <td class="fixed-column" title="姓名: ${employee.name || '-'}">${employee.name || '-'}</td>
                <td class="fixed-column" title="所属机构: ${orgName}">${orgName}</td>
                <td class="fixed-column" title="所属部门: ${employee.deptName || '-'}">${employee.deptName || '-'}</td>
                <td class="fixed-column" title="岗位: ${employee.position || '-'}">${employee.position || '-'}</td>`;
            
            // 添加每个班次的标识单元格
            allActiveShifts.forEach(shift => {
                const key = `${employee.id}-${shift.id}`;
                const canWork = allIdentifiers[key] || false;
                
                tableHtml += `
                <td class="identifier-cell" title="班次: ${shift.code}\n员工: ${employee.name}">
                    <label class="checkbox-label">
                        <input type="checkbox" 
                               class="identifier-checkbox" 
                               data-employee-id="${employee.id}"
                               data-shift-id="${shift.id}"
                               ${canWork ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                    </label>
                </td>`;
            });
            
            tableHtml += `</tr>`;
        });
        
        tableHtml += `</tbody></table>
        </div>`;
        
        // 添加样式
        tableHtml += `
        <style>
            /* 确保父容器有明确的宽度限制，不超过屏幕宽度 */
            #identifiers-tab {
                width: 100%;
                max-width: 100%;
                overflow: hidden;
                box-sizing: border-box;
                position: relative;
            }
            
            #identifiers-tab .card {
                overflow: hidden; /* 隐藏溢出内容 */
                position: relative; /* 相对定位，为子元素提供参考 */
                max-width: 100%; /* 确保卡片不超过屏幕宽度 */
                box-sizing: border-box; /* 盒模型包含边框和内边距 */
                width: 100%; /* 明确设置宽度为100% */
                margin: 0 !important;
            }
            
            #identifiers-tab .card-body {
                padding: 0 !important; /* 移除内边距，让表格充满容器 */
                max-width: 100%; /* 确保卡片内容区不超过屏幕宽度 */
                box-sizing: border-box; /* 盒模型包含边框和内边距 */
                overflow: hidden; /* 确保卡片内容区不会被撑大 */
                width: 100%; /* 明确设置宽度为100% */
                margin: 0 !important;
            }
            
            /* 表格滚动容器 - 合并所有样式 */
            .table-scroll-wrapper {
                width: 100%; /* 宽度充满父容器 */
                max-width: 100%; /* 确保表格容器不超过屏幕宽度 */
                height: 500px; /* 设置固定高度 */
                overflow-x: auto !important; /* 自动水平滚动 */
                overflow-y: auto !important; /* 自动垂直滚动 */
                border: 1px solid rgba(255, 255, 255, 0.1); /* 边框样式 */
                border-radius: 4px; /* 圆角 */
                box-sizing: border-box; /* 盒模型包含边框和内边距 */
                position: relative; /* 相对定位，为子元素提供参考 */
                display: block; /* 块级元素 */
                -ms-overflow-style: scrollbar; /* IE滚动条样式 */
            }
            
            /* 自定义滚动条样式 */
            .table-scroll-wrapper::-webkit-scrollbar {
                width: 8px; /* 垂直滚动条宽度 */
                height: 8px; /* 水平滚动条高度 */
            }
            
            .table-scroll-wrapper::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1); /* 滚动条轨道背景 */
                border-radius: 4px; /* 滚动条轨道圆角 */
            }
            
            .table-scroll-wrapper::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3); /* 滚动条滑块背景 */
                border-radius: 4px; /* 滚动条滑块圆角 */
            }
            
            .table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5); /* 滚动条滑块悬停背景 */
            }
            
            .scrollable-table {
                border-collapse: collapse; /* 合并边框 */
                table-layout: fixed; /* 固定列宽 */
                width: 100%; /* 表格宽度根据内容自动调整 */
                min-width: 100%; /* 确保表格至少填满容器 */
                margin: 0; /* 移除可能导致溢出的边距 */
                display: table; /* 保持表格布局 */
                position: relative; /* 相对定位 */
            }
            
            .scrollable-table thead {
                position: sticky; /* 表头粘性定位 */
                top: 0; /* 定位到容器顶部 */
                background-color: var(--card-bg); /* 背景色 */
                z-index: 10; /* 层级，确保在内容之上 */
            }
            
            /* 全局单元格样式 */
            .scrollable-table th,
            .scrollable-table td {
                padding: 8px 12px; /* 内边距 */
                text-align: center; /* 文本居中 */
                border: 1px solid rgba(255, 255, 255, 0.1); /* 边框样式 */
                background-color: var(--card-bg); /* 背景色 */
                box-sizing: border-box; /* 盒模型包含边框和内边距 */
                vertical-align: middle; /* 内容垂直居中 */
                white-space: nowrap; /* 不允许文本换行 */
                min-width: fit-content; /* 最小宽度适应内容 */
                width: auto; /* 宽度自动调整 */
            }

            /* 非固定列单元格 - 自适应内容 */
            .scrollable-table th:not(.fixed-column),
            .scrollable-table td:not(.fixed-column) {
                min-width: 80px; /* 非固定列最小宽度 */
                position: relative; /* 相对定位 */
                z-index: 1; /* 层级 */
                white-space: normal; /* 允许文本换行 */
                word-wrap: break-word; /* 长单词自动换行 */
                line-height: 1.4; /* 调整行高，提高可读性 */
            }

            /* 鼠标悬停显示完整内容 */
            .scrollable-table td[title]:hover::after {
                content: attr(title);
                position: absolute;
                background-color: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1000;
                max-width: 300px;
                left: 50%;
                transform: translateX(-50%);
                bottom: 100%;
                margin-bottom: 5px;
                pointer-events: none;
            }
            
            .scrollable-table thead th {
                background-color: var(--card-bg); /* 表头背景色 */
                border-bottom: 2px solid rgba(255, 255, 255, 0.2); /* 表头下边框 */
            }
            
            /* 固定列样式 - 确保不与非固定列重叠 */
            .fixed-column {
                position: sticky; /* 粘性定位 */
                left: 0; /* 定位到容器左侧 */
                background-color: var(--card-bg); /* 背景色 */
                z-index: 5; /* 层级，确保在非固定列之上 */
                border-right: 2px solid rgba(255, 255, 255, 0.1); /* 右侧边框 */
                box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1); /* 右侧阴影，增强层次感 */
                overflow: visible; /* 允许内容完整显示 */
                white-space: nowrap; /* 不允许文本换行 */
                vertical-align: middle; /* 内容垂直居中 */
            }
            
            /* 固定列的层级关系和精确宽度 */
            .fixed-column:nth-child(1) { left: 0; z-index: 10; min-width: 40px; width: 40px; } /* 第一列固定位置和宽度 */
            .fixed-column:nth-child(2) { left: 40px; z-index: 9; min-width: fit-content; width: auto; } /* 第二列固定位置和宽度 */
            .fixed-column:nth-child(3) { left: auto; z-index: 8; min-width: fit-content; width: auto; } /* 第三列固定位置和宽度 */
            .fixed-column:nth-child(4) { left: auto; z-index: 7; min-width: fit-content; width: auto; } /* 第四列固定位置和宽度 */
            .fixed-column:nth-child(5) { left: auto; z-index: 6; min-width: fit-content; width: auto; } /* 第五列固定位置和宽度 */
            .fixed-column:nth-child(6) { left: auto; z-index: 5; min-width: fit-content; width: auto; } /* 第六列固定位置和宽度 */
            
            /* 修复第一个非固定列的左边距 */
            .scrollable-table th:nth-child(7),
            .scrollable-table td:nth-child(7) {
                padding-left: 15px; /* 增加左内边距，避免被固定列遮挡 */
            }
            
            /* 固定列与滚动容器的协调 */
            .scrollable-table tbody {
                display: table-row-group; /* 恢复标准表格行组显示 */
            }
            
            .identifier-cell {
                padding: 4px; /* 标识单元格内边距 */
            }
            
            .checkbox-label {
                display: flex; /* 弹性布局 */
                align-items: center; /* 垂直居中 */
                justify-content: center; /* 水平居中 */
                cursor: pointer; /* 鼠标指针样式 */
            }
            
            .identifier-checkbox {
                display: none; /* 隐藏原生复选框 */
            }
            
            .checkbox-custom {
                width: 20px; /* 自定义复选框宽度 */
                height: 20px; /* 自定义复选框高度 */
                border: 2px solid #007bff; /* 边框样式 */
                border-radius: 4px; /* 圆角 */
                transition: all 0.3s ease; /* 过渡效果 */
                position: relative; /* 相对定位，为伪元素提供参考 */
            }
            
            .identifier-checkbox:checked + .checkbox-custom {
                background-color: #28a745; /* 选中状态背景色 */
                border-color: #28a745; /* 选中状态边框色 */
            }
            
            .identifier-checkbox:checked + .checkbox-custom::after {
                content: '✓'; /* 选中标记 */
                color: white; /* 标记颜色 */
                position: absolute; /* 绝对定位 */
                top: 50%; /* 垂直居中 */
                left: 50%; /* 水平居中 */
                transform: translate(-50%, -50%); /* 居中变换 */
                font-weight: bold; /* 字体加粗 */
            }
            
            .hover-row:hover {
                background: rgba(59, 130, 246, 0.2) !important; /* 更明显的蓝色行悬停背景色 */
            }
        </style>`;
        
        // 添加导入模态框
        tableHtml += `
        <div id="importIdentifierModal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>导入标识数据</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>请上传包含员工标识信息的Excel文件（.xlsx格式）。</p>
                    <div class="form-group">
                        <button type="button" class="btn btn-info" onclick="downloadIdentifierTemplate();">下载模板</button>
                    </div>
                    <p>文件格式要求：</p>
                    <ul>
                        <li>第一行既是班次代码也是表头</li>
                        <li>必须包含"员工号"列</li>
                        <li>除员工信息列（序号、员工号、员工姓名、所属机构、所属部门、岗位）外，其他列均为班次代码列</li>
                        <li>单元格值为'1'表示可值班</li>
                    </ul>
                    <div class="form-group">
                        <input type="file" id="identifierFileInput" accept=".xlsx">
                    </div>
                    <div id="importIdentifierStatus" style="margin-top: 10px;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeImportIdentifierModal();">取消</button>
                    <button type="button" class="btn btn-primary" onclick="importIdentifierData();">导入</button>
                </div>
            </div>
        </div>`;
        
        tableContainer.innerHTML = tableHtml;
        
        // 添加事件监听器
        addIdentifierEvents();
    } catch (error) {
        console.error('渲染标识管理表格失败:', error);
    }
}

// 添加标识管理相关事件
function addIdentifierEvents() {
    // 为复选框添加事件
    document.querySelectorAll('.identifier-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async function(e) {
            // 阻止事件冒泡，防止不必要的DOM操作
            e.stopPropagation();
            
            const employeeId = parseInt(this.getAttribute('data-employee-id'));
            const shiftId = parseInt(this.getAttribute('data-shift-id'));
            const canWork = this.checked;
            
            // 1. 关键改进：立即缓存滚动位置并设置固定恢复标志
            const tableScrollWrapper = document.querySelector('.table-scroll-wrapper');
            const scrollTop = tableScrollWrapper ? tableScrollWrapper.scrollTop : 0;
            const scrollLeft = tableScrollWrapper ? tableScrollWrapper.scrollLeft : 0;
            
            // 立即设置恢复标志 - 预防式解决方案
            window.isRestoringScrollPosition = true;
            
            // 2. 添加临时固定尺寸样式，防止重排
            if (tableScrollWrapper) {
                // 保存原始样式
                const originalStyle = tableScrollWrapper.style.cssText;
                // 添加固定尺寸
                tableScrollWrapper.style.overflow = 'hidden';
                tableScrollWrapper.style.width = tableScrollWrapper.offsetWidth + 'px';
                tableScrollWrapper.style.height = tableScrollWrapper.offsetHeight + 'px';
            }
            
            // 3. 封装滚动位置恢复逻辑为函数 - 增强版
            const restoreScrollPosition = () => {
                if (tableScrollWrapper) {
                    console.log(`准备恢复滚动位置: scrollTop=${scrollTop}, scrollLeft=${scrollLeft}`);
                    
                    // 立即使用requestAnimationFrame恢复滚动位置
                    requestAnimationFrame(() => {
                        const currentWrapper = document.querySelector('.table-scroll-wrapper');
                        if (currentWrapper) {
                            // 恢复滚动位置
                            currentWrapper.scrollTop = scrollTop;
                            currentWrapper.scrollLeft = scrollLeft;
                        }
                    });
                    
                    // 4. 使用强化的位置稳定检测机制
                    let stableCount = 0;
                    const maxStableCount = 8; // 增加连续稳定次数
                    let attemptCount = 0;
                    const maxAttempts = 50; // 最大尝试次数
                    
                    // 更激进的检查间隔
                    const checkAndRestoreScroll = () => {
                        attemptCount++;
                        if (attemptCount >= maxAttempts) {
                            console.log('已达到最大尝试次数，滚动位置恢复完成');
                            // 清除恢复标志
                            setTimeout(() => {
                                window.isRestoringScrollPosition = false;
                                // 恢复原始样式
                                if (tableScrollWrapper) {
                                    tableScrollWrapper.style.overflow = 'auto';
                                    tableScrollWrapper.style.width = '100%';
                                    tableScrollWrapper.style.height = '500px';
                                }
                            }, 50);
                            return;
                        }
                        
                        const currentWrapper = document.querySelector('.table-scroll-wrapper');
                        if (currentWrapper) {
                            // 轻微的位置容差，避免过度校正
                            const positionStable = Math.abs(currentWrapper.scrollTop - scrollTop) < 2 && 
                                                 Math.abs(currentWrapper.scrollLeft - scrollLeft) < 2;
                            
                            if (positionStable) {
                                stableCount++;
                                if (stableCount >= maxStableCount) {
                                    console.log('滚动位置已稳定保持多次，恢复完成');
                                    // 清除恢复标志
                                    setTimeout(() => {
                                        window.isRestoringScrollPosition = false;
                                        // 恢复原始样式
                                        if (tableScrollWrapper) {
                                            tableScrollWrapper.style.overflow = 'auto';
                                            tableScrollWrapper.style.width = '100%';
                                            tableScrollWrapper.style.height = '500px';
                                        }
                                    }, 50);
                                    return;
                                }
                            } else {
                                // 位置有偏差，立即校正
                                console.log(`滚动位置有偏差，重新校正: 目标scrollTop=${scrollTop}, 当前scrollTop=${currentWrapper.scrollTop}`);
                                requestAnimationFrame(() => {
                                    currentWrapper.scrollTop = scrollTop;
                                    currentWrapper.scrollLeft = scrollLeft;
                                });
                                stableCount = 0; // 重置稳定计数器
                            }
                        }
                        
                        // 增加检查频率
                        setTimeout(() => {
                            requestAnimationFrame(checkAndRestoreScroll);
                        }, 20); // 每20ms检查一次
                    };
                    
                    // 立即开始检查和恢复
                    checkAndRestoreScroll();
                } else {
                    console.warn('未找到表格滚动容器，无法保存滚动位置');
                    // 清除恢复标志
                    setTimeout(() => {
                        window.isRestoringScrollPosition = false;
                    }, 100);
                }
            };
            
            try {
                // 保存标识数据
                const key = `${employeeId}-${shiftId}`;
                allIdentifiers[key] = canWork;
                
                // 查找是否已存在该标识
                const existingIdentifiers = await identifierManager.getIdentifiersByEmployeeId(employeeId);
                const existingIdentifier = existingIdentifiers.find(id => id.shiftId === shiftId);
                
                if (existingIdentifier) {
                    // 更新现有标识
                    await identifierManager.saveIdentifier({
                        id: existingIdentifier.id,
                        employeeId,
                        shiftId,
                        canWork
                    });
                } else {
                    // 创建新标识
                    await identifierManager.saveIdentifier({
                        employeeId,
                        shiftId,
                        canWork,
                        createdAt: new Date()
                    });
                }
                
                // 关键改进：当班次标识变化时，同步更新排班顺序中的员工信息
                if (window.shiftOrderManager) {
                    try {
                        const employee = await window.dbManager.getById('employees', employeeId);
                        if (employee && employee.number) {
                            // 获取员工所属岗位
                            const employeePosition = employee.position;
                            
                            // 查找班次信息，获取班次代码
                            const shifts = await window.shiftManager.getAllShifts();
                            const shift = shifts.find(s => s.id === shiftId);
                            
                            if (shift && shift.code) {
                                if (canWork) {
                                    // 当班次勾选时，将员工添加到排班顺序
                                    await window.shiftOrderManager.addEmployeeToShiftOrder(
                                        employeePosition,
                                        shift.code,
                                        employee.number,
                                        employeeId
                                    );
                                    console.log(`已将员工${employee.number}添加到${employeePosition}岗位${shift.code}班次的排班顺序中`);
                                } else {
                                    // 当取消勾选时，从排班顺序中移除员工
                                    await window.shiftOrderManager.removeEmployeeFromShiftOrder(
                                        employeePosition,
                                        shift.code,
                                        employee.number,
                                        employeeId
                                    );
                                    console.log(`已从${employeePosition}岗位${shift.code}班次的排班顺序中移除员工${employee.number}`);
                                }
                            }
                        }
                    } catch (shiftOrderError) {
                        console.error('更新排班顺序失败:', shiftOrderError);
                        // 这里不抛出错误，避免影响标识的保存
                    }
                }
                
                // 保存成功后，启动滚动位置恢复机制
                restoreScrollPosition();
            } catch (error) {
                console.error('保存标识数据失败:', error);
                // 恢复复选框状态
                this.checked = !canWork;
                if (window.showNotification) {
                    window.showNotification('保存标识数据失败: ' + error.message, 'error');
                }
                
                // 出错时也启动滚动位置恢复
                restoreScrollPosition();
            }
        });
    });
    
    // 添加列全选功能 - 点击字段名称（班次代码）时全选该列
    const table = document.getElementById('identifier-table');
    if (table) {
        const headers = table.querySelectorAll('thead th');
        headers.forEach((header, index) => {
            // 跳过前6个固定列（序号、员工号、姓名、所属机构、所属部门、岗位）
            if (index >= 6) {
                header.style.cursor = 'pointer';
                header.addEventListener('click', function() {
                    // 获取当前列索引（从0开始）
                    const colIndex = Array.from(headers).indexOf(header);
                    
                    // 找出该列的所有复选框
                    const checkboxes = [];
                    table.querySelectorAll('tbody tr').forEach(row => {
                        const cell = row.querySelectorAll('td')[colIndex];
                        if (cell && cell.classList.contains('identifier-cell')) {
                            const checkbox = cell.querySelector('.identifier-checkbox');
                            if (checkbox) {
                                checkboxes.push(checkbox);
                            }
                        }
                    });
                    
                    // 判断是否所有复选框都已选中
                    const allChecked = checkboxes.every(cb => cb.checked);
                    
                    // 设置所有复选框的选中状态（与当前状态相反）
                    const newState = !allChecked;
                    // 标记为批量操作
                    window.isBulkIdentifierOperation = true;
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = newState;
                        // 触发change事件以保存数据
                        checkbox.dispatchEvent(new Event('change'));
                    });
                    // 延迟重置批量操作标记，确保所有change事件处理完成
                    setTimeout(() => {
                        window.isBulkIdentifierOperation = false;
                    }, 500);
                });
            }
        });
    }
    
    // 添加行全选功能 - 点击员工号时全选该行
    document.querySelectorAll('#identifier-table tbody tr td:nth-child(2)').forEach(cell => {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', function(e) {
            // 避免点击员工号时触发复选框的事件
            e.stopPropagation();
            
            // 获取当前行
            const row = this.parentElement;
            
            // 找出该行的所有复选框
            const checkboxes = row.querySelectorAll('.identifier-checkbox');
            
            // 判断是否所有复选框都已选中
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            
            // 设置所有复选框的选中状态（与当前状态相反）
            const newState = !allChecked;
            // 标记为批量操作
            window.isBulkIdentifierOperation = true;
            checkboxes.forEach(checkbox => {
                checkbox.checked = newState;
                // 触发change事件以保存数据
                checkbox.dispatchEvent(new Event('change'));
            });
            // 延迟重置批量操作标记，确保所有change事件处理完成
            setTimeout(() => {
                window.isBulkIdentifierOperation = false;
            }, 500);
        });
    });
    
    // 导入按钮事件
    const importBtn = document.getElementById('importIdentifierBtn');
    if (importBtn) {
        importBtn.addEventListener('click', function() {
            document.getElementById('importIdentifierModal').style.display = 'block';
        });
    }
    
    // 清空按钮事件已在app-init.js中添加，此处不再重复添加
    
    // 关闭模态框按钮
    const closeBtns = document.querySelectorAll('#importIdentifierModal .modal-close');
    closeBtns.forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('importIdentifierModal').style.display = 'none';
        });
    });
}

// 不再需要通过orgId获取机构名称的函数，员工数据中直接存储orgName

// 关闭导入标识模态框
window.closeImportIdentifierModal = function() {
    document.getElementById('importIdentifierModal').style.display = 'none';
    document.getElementById('identifierFileInput').value = '';
    document.getElementById('importIdentifierStatus').innerHTML = '';
};

// 重置所有人的班次为空
window.clearAllIdentifiers = async function() {
    try {
        // 显示确认对话框
        if (!confirm('警告：此操作将把所有人的班次设置为空状态！\n\n确定要继续吗？')) {
            return;
        }
        
        // 确保identifierManager已初始化
        if (!window.identifierManager) {
            await window.initIdentifierManagement();
        }
        
        // 重置所有人的班次为空
        await window.identifierManager.clearAllIdentifiers();
        
        // 重新加载标识数据，刷新界面
        await loadIdentifierData();
        
        // 显示成功通知
        if (window.showNotification) {
            window.showNotification('所有人的班次已成功重置为空', 'success');
        } else {
            alert('所有人的班次已成功重置为空');
        }
    } catch (error) {
        console.error('重置班次数据失败:', error);
        
        // 显示错误通知
        if (window.showNotification) {
            window.showNotification('重置班次数据失败: ' + error.message, 'error');
        } else {
            alert('重置班次数据失败: ' + error.message);
        }
    }
};

// 下载标识数据模板
window.downloadIdentifierTemplate = async function() {
    try {
        const statusElement = document.getElementById('importIdentifierStatus');
        statusElement.innerHTML = '<span style="color: blue;">正在生成模板...</span>';
        
        // 确保identifierManager已初始化
        if (!identifierManager) {
            await window.initIdentifierManagement();
        }
        
        // 获取所有在职员工（未删除且状态不为离职）
        const employees = await window.dbManager.getAll('employees');
        const activeEmployees = employees.filter(emp => emp.status !== 1);
        
        // 获取所有启用的班次
        let activeShifts = [];
        if (window.shiftManager) {
            const shifts = await window.shiftManager.getAllShifts();
            activeShifts = shifts.filter(shift => shift.status === 0); // 只显示启用状态的班次
        }
        
        // 获取机构名称映射
        const orgNames = new Map();
        try {
            const organizations = await window.dbManager.getAll('organizations');
            organizations.forEach(org => {
                orgNames.set(org.id, org.name);
            });
        } catch (error) {
            console.error('获取机构名称失败:', error);
        }
        
        // 创建模板数据，按照界面表格的结构1:1调整
        const templateData = [];
        const headers = ['序号', '员工号', '员工姓名', '所属机构', '所属部门', '岗位'];
        
        // 添加班次代码作为表头
        activeShifts.forEach(shift => {
            headers.push(shift.code);
        });
        
        // 生成模板数据
        activeEmployees.forEach((employee, index) => {
            const orgName = employee.orgName || '未知机构';
            
            // 创建员工行数据
            const rowData = {
                '序号': index + 1,
                '员工号': employee.number,
                '员工姓名': employee.name,
                '所属机构': orgName,
                '所属部门': employee.deptName || '-',
                '岗位': employee.position || '-'
            };
            
            // 为每个班次列设置空值（表示不可值班）
            activeShifts.forEach(shift => {
                rowData[shift.code] = ''; // 空表示不可值班
            });
            
            templateData.push(rowData);
        });
        
        // 检查是否有XLSX库可用
        if (window.XLSX) {
            // 创建工作簿和工作表
            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '标识数据模板');
            
            // 生成Excel文件并下载
            const fileName = `标识数据导入模板_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            statusElement.innerHTML = '<span style="color: green;">模板下载成功</span>';
            
            // 3秒后清除状态信息
            setTimeout(() => {
                statusElement.innerHTML = '';
            }, 3000);
        } else {
            // 如果没有XLSX库，降级为CSV格式
            let csvContent = headers.join(',') + '\n';
            
            templateData.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    // 处理包含逗号或引号的值
                    return /[,"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
                });
                csvContent += values.join(',') + '\n';
            });
            
            // 创建Blob并下载
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `标识数据导入模板_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                statusElement.innerHTML = '<span style="color: green;">CSV模板下载成功</span>';
                
                // 3秒后清除状态信息
                setTimeout(() => {
                    statusElement.innerHTML = '';
                }, 3000);
            } else {
                statusElement.innerHTML = '<span style="color: red;">浏览器不支持文件下载</span>';
            }
        }
    } catch (error) {
        console.error('生成模板失败:', error);
        const statusElement = document.getElementById('importIdentifierStatus');
        statusElement.innerHTML = `<span style="color: red;">生成模板失败: ${error.message}</span>`;
    }
};

// 导入标识数据
window.importIdentifierData = async function() {
    try {
        // 确保identifierManager已初始化
        if (!window.identifierManager) {
            await window.initIdentifierManagement();
            
            // 如果初始化后仍然没有identifierManager，显示错误
            if (!window.identifierManager) {
                const statusElement = document.getElementById('importIdentifierStatus');
                statusElement.innerHTML = '<span style="color: red;">初始化失败: 无法创建标识管理器</span>';
                return;
            }
        }
        
        const fileInput = document.getElementById('identifierFileInput');
        const statusElement = document.getElementById('importIdentifierStatus');
        
        if (!fileInput.files || fileInput.files.length === 0) {
            statusElement.innerHTML = '<span style="color: red;">请选择要导入的文件</span>';
            return;
        }
        
        const file = fileInput.files[0];
        const fileName = file.name;
        
        // 检查文件类型，支持xlsx和csv
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
            statusElement.innerHTML = '<span style="color: red;">请上传.xlsx或.csv格式的文件</span>';
            return;
        }
        
        // 显示加载状态
        statusElement.innerHTML = '<span style="color: blue;">正在导入数据...</span>';
        
        // 根据文件类型选择不同的解析方法
        if (fileName.endsWith('.xlsx')) {
            // Excel文件解析
            await parseExcelFile(file, statusElement);
        } else if (fileName.endsWith('.csv')) {
            // CSV文件解析
            await parseCsvFile(file, statusElement);
        }
    } catch (error) {
        console.error('导入标识数据失败:', error);
        const statusElement = document.getElementById('importIdentifierStatus');
        // 安全地获取错误信息
        const errorMessage = error && error.message ? error.message : '未知错误';
        statusElement.innerHTML = `<span style="color: red;">导入失败: ${errorMessage}</span>`;
    }
}

// 解析Excel文件
async function parseExcelFile(file, statusElement) {
    try {
        // 检查是否有XLSX库可用
        if (!window.XLSX) {
            statusElement.innerHTML = '<span style="color: red;">导入失败: 缺少XLSX库</span>';
            return;
        }
        
        // 使用XLSX库解析文件
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // 使用更简单直接的方式解析Excel文件，让XLSX库自动处理表头
                    // header: 1 表示将第一行作为表头
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1, // 使用第一行作为数据行索引
                        blankrows: false // 忽略空行
                    });
                    
                    if (!jsonData || jsonData.length <= 1) {
                        statusElement.innerHTML = '<span style="color: red;">导入失败: 文件内容为空或只有表头</span>';
                        resolve();
                        return;
                    }
                    
                    console.log('Excel原始数据:', jsonData);
                    
                    // 构建标准格式的数据
                    const headers = jsonData[0]; // 第一行是表头
                    const formattedData = [];
                    
                    for (let i = 1; i < jsonData.length; i++) {
                        const rowData = jsonData[i];
                        const formattedRow = {};
                        
                        for (let j = 0; j < headers.length; j++) {
                            // 确保表头是字符串类型
                            const header = typeof headers[j] === 'string' ? headers[j].trim() : String(headers[j]);
                            // 处理单元格值
                            const cellValue = rowData[j];
                            
                            // 将Excel的数值转换为字符串（特别是员工号）
                            formattedRow[header] = typeof cellValue === 'number' ? String(cellValue) : cellValue;
                        }
                        
                        formattedData.push(formattedRow);
                    }
                    
                    console.log('格式化后的数据:', formattedData);
                    
                    // 处理数据并导入
                    await processAndImportData(formattedData, statusElement, file.name);
                    resolve();
                } catch (error) {
                    console.error('解析Excel文件失败:', error);
                    // 安全地获取错误信息
                    const errorMessage = error && error.message ? error.message : '未知错误';
                    statusElement.innerHTML = `<span style="color: red;">导入失败: 解析文件时出错</span><br><span>${errorMessage}</span>`;
                    reject(error);
                }
            };
            
            reader.onerror = function() {
                statusElement.innerHTML = '<span style="color: red;">导入失败: 读取文件时出错</span>';
                reject(new Error('读取文件时出错'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    } catch (error) {
        console.error('使用XLSX库导入失败:', error);
        statusElement.innerHTML = '<span style="color: red;">导入失败: 无法处理Excel文件</span><br><span>' + (error.message || '未知错误') + '</span>';
    }
}

// 解析CSV文件
async function parseCsvFile(file, statusElement) {
    try {
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async function(e) {
                try {
                    let csvText = e.target.result;
                    
                    // 处理BOM标记（常见于从Excel导出的CSV文件）
                    if (csvText.charCodeAt(0) === 0xFEFF) {
                        csvText = csvText.slice(1);
                    }
                    
                    const lines = csvText.split(/\r\n|\n/);
                    
                    // 过滤掉全空的行
                    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
                    
                    if (nonEmptyLines.length < 2) {
                        statusElement.innerHTML = '<span style="color: red;">导入失败: CSV文件内容为空或格式不正确</span>';
                        resolve();
                        return;
                    }
                    
                    // 解析表头
                    const headers = parseCsvLine(nonEmptyLines[0]).map(header => {
                        // 处理可能的BOM标记和空白字符
                        const cleanHeader = header.replace(/^\uFEFF/, '').trim();
                        return cleanHeader;
                    });
                    
                    // 解析数据行
                    const jsonData = [];
                    for (let i = 1; i < nonEmptyLines.length; i++) {
                        if (!nonEmptyLines[i].trim()) continue; // 跳过空行
                        
                        const values = parseCsvLine(nonEmptyLines[i]);
                        const row = {};
                        
                        headers.forEach((header, index) => {
                            const value = values[index] !== undefined ? values[index].trim() : '';
                            // 确保所有值都是字符串类型，便于后续处理
                            row[header] = String(value);
                        });
                        
                        jsonData.push(row);
                    }
                    
                    // 处理数据并导入
                    await processAndImportData(jsonData, statusElement, file.name);
                    resolve();
                } catch (error) {
                    console.error('解析CSV文件失败:', error);
                    // 安全地获取错误信息
                    const errorMessage = error && error.message ? error.message : '未知错误';
                    statusElement.innerHTML = `<span style="color: red;">导入失败: 解析CSV文件时出错</span><br><span>${errorMessage}</span>`;
                    reject(error);
                }
            };
            
            reader.onerror = function() {
                statusElement.innerHTML = '<span style="color: red;">导入失败: 读取CSV文件时出错</span>';
                reject(new Error('读取CSV文件时出错'));
            };
            
            reader.readAsText(file);
        });
    } catch (error) {
        console.error('解析CSV文件失败:', error);
        // 安全地获取错误信息
        const errorMessage = error && error.message ? error.message : '未知错误';
        statusElement.innerHTML = `<span style="color: red;">导入失败: ${errorMessage}</span>`;
    }
}

// 解析CSV行（处理包含逗号或引号的字段）
function parseCsvLine(line) {
    const result = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            // 处理引号
            if (i + 1 < line.length && line[i + 1] === '"') {
                // 处理转义引号（两个连续的引号）
                currentField += '"';
                i++; // 跳过下一个引号
            } else {
                // 切换引号状态
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // 字段结束
            result.push(currentField);
            currentField = '';
        } else {
            // 普通字符
            currentField += char;
        }
    }
    
    // 添加最后一个字段
    result.push(currentField);
    
    // 处理可能的BOM标记和空白字符
    return result.map(field => {
        // 移除可能的BOM标记并去除首尾空白
        let cleanField = field.replace(/^\uFEFF/, '').trim();
        
        return cleanField;
    });
}

// 处理数据并导入
async function processAndImportData(jsonData, statusElement, fileName) {
    try {
        // 记录统计信息
        let totalRows = jsonData.length;
        let processedRows = 0;
        let importedCount = 0;
        let skippedRows = 0;
        let invalidRows = 0;
        let invalidReasons = [];
        
        // 直接使用原始数据（已在parseExcelFile中处理过表头和格式化）
        const validDataRows = [...jsonData];
        
        if (validDataRows.length === 0) {
            statusElement.innerHTML = '<span style="color: red;">导入失败: 没有找到有效数据行</span>';
            return;
        }
        
        // 从第一行数据中获取表头信息
        const headers = Object.keys(validDataRows[0]);
        
        // 定义员工标识列，这些列不应作为班次代码列
        const employeeInfoColumns = ['序号', '员工号', '员工姓名', '所属机构', '所属部门', '岗位'];
        
        // 识别班次代码列（过滤掉员工标识列）
        const shiftCodeColumns = headers.filter(header => 
            !employeeInfoColumns.includes(header) && 
            header.trim() !== '' // 忽略空的表头
        );
        
        // 检查是否存在员工号列（必需）
        const hasEmployeeNumberColumn = headers.some(header => 
            header.includes('员工号') || header.includes('员工编号')
        );
        
        if (!hasEmployeeNumberColumn) {
            statusElement.innerHTML = '<span style="color: red;">导入失败: 未找到"员工号"相关列</span><br>' +
                                     '<span>请确保您的导入文件包含"员工号"列</span>';
            return;
        }
        
        // 强制要求存在班次代码列
        if (shiftCodeColumns.length === 0) {
            statusElement.innerHTML = '<span style="color: red;">导入失败: 未找到班次代码列</span><br>' +
                                     '<span>根据模板格式，第一行既是班次代码也是表头</span><br>' +
                                     '<span>请确保您的导入文件中包含除以下列之外的其他列作为班次代码列：</span><br>' +
                                     '<span>序号、员工号、员工姓名、所属机构、所属部门、岗位</span>';
            return;
        }
        
        // 重新设置总行数为有效数据行数
        totalRows = validDataRows.length;
        
        // 显示处理进度
        const progressElement = document.createElement('div');
        progressElement.style.marginTop = '5px';
        statusElement.appendChild(progressElement);
        
        // 处理数据
        const parsedData = [];
        
        console.log('Excel解析后的数据:', validDataRows);
        console.log('表头信息:', headers);
        console.log('识别的班次代码列:', shiftCodeColumns);
        
        // 找出员工号列的实际名称（考虑可能的变体）
        let employeeNumberColumn = headers.find(header => 
            header.includes('员工号') || header.includes('员工编号')
        );
        
        for (const row of validDataRows) {
            processedRows++;
            
            // 更新进度
            const progress = Math.round((processedRows / totalRows) * 100);
            progressElement.textContent = `处理进度: ${progress}%`;
            
            let employeeNumber = row[employeeNumberColumn];
            
            // 确保员工号是字符串类型并去除空白字符
            employeeNumber = employeeNumber !== undefined && employeeNumber !== null ? 
                String(employeeNumber).trim() : '';
            
            // 记录当前行的处理情况
            console.log('处理行数据:', { employeeNumber, rowData: row });
            
            // 宽松的员工号验证，只要不是null、undefined或空字符串就接受
            if (!employeeNumber) {
                console.log('跳过行 - 无员工号:', row);
                skippedRows++;
                continue; // 跳过没有员工号的行
            }
            
            // 遍历所有班次列
            let hasValidData = false;
            for (const shiftCode of shiftCodeColumns) {
                const canWorkValue = row[shiftCode];
                // 记录班次列的值
                console.log('班次列数据:', { shiftCode, canWorkValue });
                // 接受多种格式的"1"值
                const isCanWork = canWorkValue === '1' || 
                                 canWorkValue === 1 || 
                                 String(canWorkValue).toLowerCase() === 'true' || 
                                 String(canWorkValue).toLowerCase() === 'yes';
                                 
                if (isCanWork) {
                    parsedData.push({
                        employeeNumber: employeeNumber,
                        shiftCode: shiftCode,
                        canWork: true
                    });
                    hasValidData = true;
                }
            }
            
            if (!hasValidData) {
                console.log('跳过行 - 无有效班次数据:', { employeeNumber });
                skippedRows++;
            } else {
                console.log('成功解析行数据:', { employeeNumber, parsedCount: parsedData.length });
            }
        }
        
        console.log('解析后的数据量:', parsedData.length);
        
        // 导入前验证数据
        const { validData, validationInfo } = await validateImportData(parsedData);
        importedCount = validationInfo.importedCount;
        invalidRows = validationInfo.invalidRows;
        invalidReasons = validationInfo.invalidReasons;
        
        console.log('验证后的数据量:', validData.length);
        console.log('验证信息:', validationInfo);
        
        // 调用导入方法
        if (validData.length > 0) {
            try {
                importedCount = await window.identifierManager.importIdentifiersFromExcel(validData);
            } catch (error) {
                console.error('调用导入方法失败:', error);
                // 安全地获取错误信息
                const errorMessage = error && error.message ? error.message : '未知错误';
                statusElement.innerHTML = `<span style="color: red;">导入失败: 保存数据时出错</span><br><span>${errorMessage}</span>`;
                return;
            }
        }
        
        // 构建导入结果消息
        let resultMessage = `<span style="color: green;">成功导入${importedCount}条标识数据</span>`;
        if (skippedRows > 0) {
            resultMessage += `<br><span style="color: orange;">跳过${skippedRows}行（缺少员工号或没有可值班数据）</span>`;
        }
        if (invalidRows > 0) {
            resultMessage += `<br><span style="color: red;">${invalidRows}行数据无效（员工号或班次代码不存在）</span>`;
        }
        
        statusElement.innerHTML = resultMessage;
        
        // 如果有无效数据，显示详细信息
        if (invalidReasons.length > 0) {
            const detailsElement = document.createElement('div');
            detailsElement.style.marginTop = '5px';
            detailsElement.style.fontSize = '12px';
            detailsElement.style.color = '#666';
            detailsElement.innerHTML = '<strong>无效数据详情:</strong><br>' + invalidReasons.join('<br>');
            statusElement.appendChild(detailsElement);
        }
        
        // 重新加载数据
        setTimeout(() => {
            loadIdentifierData();
            
            // 导入成功后自动刷新排班数据，增加延迟确保数据完全保存
            setTimeout(() => {
                console.log('----------------------------------------');
                console.log('[标识导入后] 尝试自动刷新排班数据');
                console.log('[标识导入后] window._reloadShiftOrderData 存在:', !!window._reloadShiftOrderData);
                console.log('[标识导入后] _reloadShiftOrderData 存在:', typeof _reloadShiftOrderData === 'function');
                
                if (window._reloadShiftOrderData) {
                    console.log('[标识导入后] 调用window._reloadShiftOrderData()');
                    window._reloadShiftOrderData().then(() => {
                        console.log('[标识导入后] 排班数据刷新完成');
                        // 刷新后关闭模态框
                        closeImportIdentifierModal();
                    }).catch(error => {
                        console.error('[标识导入后] 排班数据刷新失败:', error);
                        // 即使失败也关闭模态框
                        closeImportIdentifierModal();
                    });
                } else if (typeof _reloadShiftOrderData === 'function') {
                    console.log('[标识导入后] 调用_reloadShiftOrderData()');
                    try {
                        const result = _reloadShiftOrderData();
                        if (result && typeof result.then === 'function') {
                            result.then(() => {
                                console.log('[标识导入后] 排班数据刷新完成');
                                // 刷新后关闭模态框
                                closeImportIdentifierModal();
                            }).catch(error => {
                                console.error('[标识导入后] 排班数据刷新失败:', error);
                                // 即使失败也关闭模态框
                                closeImportIdentifierModal();
                            });
                        } else {
                            console.log('[标识导入后] 排班数据刷新完成');
                            // 刷新后关闭模态框
                            closeImportIdentifierModal();
                        }
                    } catch (error) {
                        console.error('[标识导入后] 排班数据刷新失败:', error);
                        // 即使失败也关闭模态框
                        closeImportIdentifierModal();
                    }
                } else {
                    console.error('[标识导入后] 错误: 未找到_reloadShiftOrderData函数');
                    // 即使未找到函数也关闭模态框
                    closeImportIdentifierModal();
                }
            }, 300);
        }, 800);
    } catch (error) {
        console.error('处理数据时出错:', error);
        // 安全地获取错误信息
        const errorMessage = error && error.message ? error.message : '未知错误';
        statusElement.innerHTML = `<span style="color: red;">导入失败: ${errorMessage}</span>`;
    }
}

// 验证导入数据
async function validateImportData(data) {
    try {
        console.log('开始验证导入数据，数据量:', data.length);
        const validData = [];
        const invalidReasons = [];
        let invalidCount = 0;
        
        // 预加载所有员工和班次信息，减少重复查询
        const allEmployees = await window.dbManager.getAll('employees');
        let allShifts = [];
        if (window.shiftManager) {
            allShifts = await window.shiftManager.getAllShifts();
        }
        
        console.log('系统中存在的员工数量:', allEmployees.length);
        console.log('系统中存在的班次数量:', allShifts.length);
        
        // 创建映射以便快速查找，支持宽松匹配
        const employeeMap = new Map();
        const employeeMapLoose = new Map(); // 用于宽松匹配的映射
        allEmployees.forEach(emp => {
            // 精确匹配
            employeeMap.set(emp.number, emp);
            // 宽松匹配 - 转换为字符串
            const numberStr = String(emp.number).trim();
            employeeMapLoose.set(numberStr, emp);
        });
        
        const shiftMap = new Map();
        const shiftMapLoose = new Map(); // 用于宽松匹配的映射
        allShifts.forEach(shift => {
            // 精确匹配
            shiftMap.set(shift.code, shift);
            // 宽松匹配 - 转换为字符串并去除空白字符
            const codeStr = String(shift.code).trim();
            shiftMapLoose.set(codeStr, shift);
        });
        
        // 验证每一条数据
        for (const item of data) {
            // 确保数据结构正确
            if (!item || typeof item !== 'object') {
                invalidReasons.push('无效的数据项');
                invalidCount++;
                continue;
            }
            
            // 获取员工号和班次代码，进行类型处理
            let employeeNumber = item.employeeNumber;
            let shiftCode = item.shiftCode;
            
            // 确保员工号和班次代码都是字符串类型
            employeeNumber = employeeNumber !== undefined && employeeNumber !== null ? String(employeeNumber).trim() : '';
            shiftCode = shiftCode !== undefined && shiftCode !== null ? String(shiftCode).trim() : '';
            
            // 基本验证
            if (!employeeNumber) {
                invalidReasons.push('缺少员工号');
                invalidCount++;
                continue;
            }
            
            if (!shiftCode) {
                invalidReasons.push(`员工号 ${employeeNumber} 缺少班次代码`);
                invalidCount++;
                continue;
            }
            
            console.log('验证数据项:', { employeeNumber, shiftCode });
            
            // 查找员工，先精确匹配，再宽松匹配
            let employee = employeeMap.get(employeeNumber) || 
                          employeeMapLoose.get(employeeNumber);
            
            // 查找班次，先精确匹配，再宽松匹配
            let shift = shiftMap.get(shiftCode) || 
                       shiftMapLoose.get(shiftCode);
            
            // 如果没有找到，尝试忽略大小写匹配
            if (!employee) {
                const lowerEmpNum = employeeNumber.toLowerCase();
                for (const [key, emp] of employeeMapLoose.entries()) {
                    if (key.toLowerCase() === lowerEmpNum) {
                        employee = emp;
                        break;
                    }
                }
            }
            
            if (!shift) {
                const lowerShiftCode = shiftCode.toLowerCase();
                for (const [key, s] of shiftMapLoose.entries()) {
                    if (key.toLowerCase() === lowerShiftCode) {
                        shift = s;
                        break;
                    }
                }
            }
            
            console.log('匹配结果:', { employeeExists: !!employee, shiftExists: !!shift });
            
            if (!employee) {
                console.log('验证失败 - 员工不存在:', employeeNumber);
                invalidReasons.push(`员工号 ${employeeNumber} 不存在`);
                invalidCount++;
            } else if (!shift) {
                invalidReasons.push(`员工 ${employeeNumber} (${employee.name}) 的班次 ${shiftCode} 不存在`);
                invalidCount++;
            } else {
                validData.push({
                    ...item,
                    // 直接使用ID，避免导入时重复查询
                    employeeId: employee.id,
                    shiftId: shift.id,
                    // 确保employeeNumber和shiftCode是字符串类型
                    employeeNumber: String(employee.number),
                    shiftCode: String(shift.code)
                });
            }
        }
        
        // 去重，避免重复导入相同的员工-班次组合
        const uniqueData = [];
        const seen = new Set();
        for (const item of validData) {
            const key = `${item.employeeId}-${item.shiftId}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueData.push(item);
            }
        }
        
        return {
            validData: uniqueData,
            validationInfo: {
                importedCount: uniqueData.length,
                invalidRows: invalidCount,
                invalidReasons: invalidReasons.slice(0, 15) // 显示更多错误信息，帮助用户排查问题
            }
        };
    } catch (error) {
        console.error('验证数据失败:', error);
        // 显示错误信息，不再继续处理
        return {
            validData: [],
            validationInfo: {
                importedCount: 0,
                invalidRows: data.length,
                invalidReasons: [`数据验证失败: ${error.message || '未知错误'}`]
            }
        };
    }
}