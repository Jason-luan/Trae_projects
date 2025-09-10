// 班次管理相关功能

// 班次数据模型
class ShiftManager {
    constructor() {
        // 初始化将在initShiftManagement中完成
    }

    // 初始化班次存储
    async initializeStore() {
        try {
            // 通过dbManager创建shifts存储空间
            const db = await dbManager.ensureInitialized();
            // 请求数据库升级
            const request = indexedDB.open(dbManager.dbName, dbManager.dbVersion + 1);
            
            return new Promise((resolve, reject) => {
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('shifts')) {
                        const shiftStore = db.createObjectStore('shifts', {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        // 创建索引
                        shiftStore.createIndex('code', 'code', { unique: true });
                        shiftStore.createIndex('name', 'name', { unique: false });
                        shiftStore.createIndex('startTime', 'startTime', { unique: false });
                        shiftStore.createIndex('endTime', 'endTime', { unique: false });
                        shiftStore.createIndex('status', 'status', { unique: false });
                        shiftStore.createIndex('priority', 'priority', { unique: false });
                        console.log('班次存储空间创建成功');
                    } else {
                        // 存储空间已存在，检查是否需要添加priority字段的索引
                        const shiftStore = event.target.transaction.objectStore('shifts');
                        if (!shiftStore.indexNames.contains('priority')) {
                            shiftStore.createIndex('priority', 'priority', { unique: false });
                            console.log('已添加priority字段索引');
                        }
                    }
                };
                
                request.onsuccess = () => {
                    dbManager.dbVersion = request.result.version;
                    dbManager.db = request.result;
                    resolve();
                };
                
                request.onerror = (event) => {
                    console.error('升级数据库创建班次存储空间失败:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('初始化班次存储空间失败:', error);
        }
    }
    
    // 添加priority字段到所有现有班次
    async addPriorityFieldToExistingShifts() {
        try {
            const shifts = await dbManager.getAll('shifts');
            const updatePromises = [];
            
            shifts.forEach(shift => {
                // 只有当班次没有priority字段时才添加
                if (shift.priority === undefined) {
                    shift.priority = 0; 
                    shift.updatedAt = new Date();
                    updatePromises.push(dbManager.save('shifts', shift));
                }
            });
            
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                console.log(`已为${updatePromises.length}个班次添加优先级字段`);
            } else {
                console.log('所有班次已经包含优先级字段');
            }
            
            return updatePromises.length;
        } catch (error) {
            console.error('添加优先级字段失败:', error);
            throw error;
        }
    }

    // 初始化默认班次数据
    async initializeDefaultShifts() {
        try {
            const existingShifts = await dbManager.getAll('shifts');
            if (existingShifts.length === 0) {
                // 默认班次数据
                const defaultShifts = [
                    { code: 'G', name: '白班', startTime: '08:50', endTime: '18:00', description: '正常白班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y0', name: '夜班00:00-08:00', startTime: '00:00', endTime: '08:00', description: '夜班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1030普', name: '中班10:20-19:30', startTime: '10:20', endTime: '19:30', description: '普通中班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1330普', name: '中班13:20-22:00', startTime: '13:20', endTime: '22:00', description: '普通中班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1330综', name: '中班13:20-22:00(综合)', startTime: '13:20', endTime: '22:00', description: '综合中班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1330贵', name: '中班13:20-22:00(贵宾)', startTime: '13:20', endTime: '22:00', description: '贵宾中班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y16综', name: '晚班15:50-次日00:00', startTime: '15:50', endTime: '23:59', description: '综合晚班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y18普', name: '晚班18:00-次日02:00', startTime: '18:00', endTime: '02:00', description: '普通晚班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y8普', name: '早班07:50-16:30', startTime: '07:50', endTime: '16:30', description: '普通早班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y8综', name: '早班07:50-16:30(综合)', startTime: '07:50', endTime: '16:30', description: '综合早班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9值', name: '值班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '值班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9公', name: '对公值班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '对公白班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9普', name: '普通班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '普通班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9综', name: '综合班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '综合班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'G值', name: '周末值班08:50-18:00', startTime: '08:50', endTime: '18:00', description: '周末值班', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: '休', name: '休息日', startTime: '', endTime: '', description: '当天休息', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'C', name: '产假', startTime: '', endTime: '', description: '产假', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'G值-A', name: '周末对公值班A岗08:50-18:00', startTime: '08:50', endTime: '18:00', description: '对公周末G班A岗', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'G值-B', name: '周末风险值班B岗08:50-18:00', startTime: '08:50', endTime: '18:00', description: '风险核查岗周末G班B岗', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'G值-C', name: '周末对公值班C岗08:50-18:00', startTime: '08:50', endTime: '18:00', description: '对公周末G班C岗', status: 0, priority: 0, createdAt: new Date(), updatedAt: new Date() }
                ];

                // 批量保存默认班次
                for (const shift of defaultShifts) {
                    await dbManager.save('shifts', shift);
                }
                console.log('默认班次数据已初始化');
                return defaultShifts;
            } else {
                console.log('班次数据已存在，无需初始化');
                return existingShifts;
            }
        } catch (error) {
            console.error('初始化默认班次数据失败:', error);
            throw error;
        }
    }

    // 获取所有班次
    async getAllShifts() {
        try {
            return await dbManager.getAll('shifts');
        } catch (error) {
            console.error('获取班次数据失败:', error);
            showNotification('获取班次数据失败: ' + error.message, 'error');
            return [];
        }
    }

    // 获取所有启用的班次
    async getActiveShifts() {
        try {
            const allShifts = await this.getAllShifts();
            // 在系统中status=0表示启用
            return allShifts.filter(shift => shift.status === 0);
        } catch (error) {
            console.error('获取启用的班次数据失败:', error);
            return [];
        }
    }

    // 保存班次
    async saveShift(shiftData) {
        try {
            // 检查班次代码是否重复（更新时排除自身）
            if (shiftData.code) {
                const existingShifts = await dbManager.getByIndex('shifts', 'code', shiftData.code);
                if (existingShifts && existingShifts.length > 0) {
                    if (!shiftData.id || existingShifts[0].id !== shiftData.id) {
                        throw new Error('班次代码已存在');
                    }
                }
            }

            // 创建班次对象并过滤无效的id
            const shift = {
                ...shiftData,
                priority: shiftData.priority !== undefined ? parseInt(shiftData.priority) : 0,
                updatedAt: new Date() // 设置当前时间为更新时间
            };
            
            // 如果id不是有效的数字，删除它，让IndexedDB自动生成
            if (shift.id !== null && (isNaN(shift.id) || !Number.isInteger(shift.id))) {
                delete shift.id;
            }

            // 如果没有id(新增班次)，设置创建时间为当前时间
            if (!shift.id && !shift.createdAt) {
                shift.createdAt = new Date();
            }
            
            // 确保createdAt是Date对象
            if (shift.createdAt && typeof shift.createdAt === 'string') {
                shift.createdAt = new Date(shift.createdAt);
            }

            const savedShift = await dbManager.save('shifts', shift);
            showNotification(shift.id ? '班次更新成功' : '班次添加成功');
            
            // 新增：通知排班管理刷新数据
            if (window.shiftOrderManager) {
                try {
                    // 触发班次数据变更事件
                    const event = new CustomEvent('shiftDataChanged', {
                        detail: {
                            reason: shift.id ? 'shiftUpdated' : 'shiftAdded',
                            shiftId: savedShift.id,
                            shiftCode: savedShift.code
                        }
                    });
                    window.dispatchEvent(event);
                    console.log('已触发shiftDataChanged事件通知排班管理刷新数据');
                } catch (error) {
                    console.error('触发shiftDataChanged事件失败:', error);
                    // 备用刷新方案：直接调用刷新函数
                    if (window.loadShiftOrderData) {
                        window.loadShiftOrderData();
                        console.log('通过备用方案刷新排班数据');
                    }
                }
            }
            
            return savedShift;
        } catch (error) {
            console.error('保存班次失败:', error);
            showNotification('保存班次失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 删除班次
    async deleteShift(id) {
        try {
            await dbManager.delete('shifts', id);
            showNotification('班次删除成功');
        } catch (error) {
            console.error('删除班次失败:', error);
            showNotification('删除班次失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 更新班次状态
    async updateShiftStatus(id, status) {
        try {
            const shift = await dbManager.getById('shifts', id);
            if (shift) {
                shift.status = status;
                shift.updatedAt = new Date();
                await dbManager.save('shifts', shift);
                showNotification('班次状态更新成功');
                
                // 重要：更新全局班次数据缓存，确保排班逻辑能正确识别停用的班次
                if (window.shiftDataCache) {
                    const cacheIndex = window.shiftDataCache.findIndex(s => s.id === id);
                    if (cacheIndex !== -1) {
                        window.shiftDataCache[cacheIndex] = {...shift};
                        console.log(`已更新全局班次数据缓存中的班次状态: ${shift.code} (状态: ${status})`);
                    } else {
                        // 如果在缓存中找不到对应班次，可能是缓存未初始化，添加日志
                        console.warn(`未在全局班次数据缓存中找到班次ID: ${id}，尝试重新加载缓存`);
                        // 尝试重新加载缓存
                        try {
                            const allShifts = await this.getAllShifts();
                            window.shiftDataCache = [...allShifts];
                            console.log('已重新创建全局班次数据缓存，包含', window.shiftDataCache.length, '个班次');
                        } catch (reloadError) {
                            console.error('重新加载班次数据缓存失败:', reloadError);
                        }
                    }
                } else {
                    // 如果缓存不存在，创建它
                    console.warn('全局班次数据缓存不存在，尝试创建');
                    try {
                        const allShifts = await this.getAllShifts();
                        window.shiftDataCache = [...allShifts];
                        console.log('已创建全局班次数据缓存，包含', window.shiftDataCache.length, '个班次');
                    } catch (createError) {
                        console.error('创建班次数据缓存失败:', createError);
                    }
                }
                
                // 添加班次状态变更时联动排班班次的逻辑
                if (window.shiftOrderManager) {
                    try {
                        const shiftCode = shift.code;
                        // 获取所有包含该班次的排班顺序
                        const allShiftOrders = await dbManager.getAll('shiftOrders');
                        const updatePromises = [];
                        
                        allShiftOrders.forEach(order => {
                            // 如果排班顺序包含该班次
                            if (order.shiftCode === shiftCode) {
                                // 如果班次被停用，从排班顺序中移除该班次的所有员工
                                if (status === 1) { // 1表示停用
                                    order.employeeNumbers = [];
                                    order.updatedAt = new Date();
                                    updatePromises.push(dbManager.save('shiftOrders', order));
                                    console.log(`已清空${order.position}岗位${order.shiftCode}班次的排班顺序，因为该班次已被停用`);
                                }
                                // 如果班次被启用，不需要特殊处理，让用户手动设置
                            }
                        });
                        
                        if (updatePromises.length > 0) {
                            await Promise.all(updatePromises);
                            console.log(`已更新${updatePromises.length}个排班顺序以响应班次状态变更`);
                        }
                        
                        // 触发班次状态变更事件，方便其他模块响应
                        const event = new CustomEvent('shiftStatusChanged', {
                            detail: {
                                shiftId: id,
                                shiftCode: shift.code,
                                status: status
                            }
                        });
                        window.dispatchEvent(event);
                    } catch (error) {
                        console.error('更新排班顺序以响应班次状态变更失败:', error);
                    }
                }
            }
        } catch (error) {
            console.error('更新班次状态失败:', error);
            showNotification('更新班次状态失败: ' + error.message, 'error');
            throw error;
        }
    }
}

// 班次管理实例
const shiftManager = new ShiftManager();

// 分页状态变量
let shiftCurrentPage = 1;
let shiftItemsPerPage = 10;
let allShifts = [];

// 加载班次数据
window.loadShifts = async function() {
    try {
        // 为优先级表头添加点击事件
        const priorityHeader = document.getElementById('priorityHeader');
        if (priorityHeader && typeof priorityHeader.onclick !== 'function') {
            priorityHeader.onclick = showShiftPriorityModal;
        }
        // 获取并保存所有班次数据
        allShifts = await shiftManager.getAllShifts();
        
        // 创建全局班次数据缓存，用于在排班时快速查找班次优先级信息
        window.shiftDataCache = [...allShifts];
        console.log('已创建全局班次数据缓存，包含', window.shiftDataCache.length, '个班次');
        
        // 排序 - 按班次代码
        allShifts.sort((a, b) => {
            const codeA = a.code || '';
            const codeB = b.code || '';
            return codeA.localeCompare(codeB);
        });

        // 分页处理
        const startIndex = (shiftCurrentPage - 1) * shiftItemsPerPage;
        const endIndex = startIndex + shiftItemsPerPage;
        const paginatedShifts = allShifts.slice(startIndex, endIndex);

        // 渲染表格
        const shiftTable = document.getElementById('shift-table');
        if (!shiftTable) {
            console.error('班次表格元素未找到');
            return;
        }
        const tableBody = document.getElementById('shift-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        paginatedShifts.forEach((shift, index) => {
            const row = document.createElement('tr');
            row.className = 'hover-row';

            // 序号（所有数据连续排序）
            const indexCell = document.createElement('td');
            indexCell.textContent = (shiftCurrentPage - 1) * shiftItemsPerPage + index + 1;
            row.appendChild(indexCell);

            // 班次代码
            const codeCell = document.createElement('td');
            codeCell.textContent = shift.code || '-';
            row.appendChild(codeCell);

            // 班次名称
            const nameCell = document.createElement('td');
            nameCell.textContent = shift.name || '-';
            row.appendChild(nameCell);

            // 开始时间
            const startTimeCell = document.createElement('td');
            startTimeCell.textContent = shift.startTime || '-';
            row.appendChild(startTimeCell);

            // 结束时间
            const endTimeCell = document.createElement('td');
            endTimeCell.textContent = shift.endTime || '-';
            row.appendChild(endTimeCell);

            // 描述
            const descCell = document.createElement('td');
            descCell.textContent = shift.description || '-';
            row.appendChild(descCell);

            // 优先级 - 显示数值，不再可点击
            const priorityCell = document.createElement('td');
            const priorityValue = shift.priority !== undefined ? shift.priority : '-';
            priorityCell.textContent = priorityValue;
            row.appendChild(priorityCell);

            // 更新时间（显示更新时间而不是创建时间）
            const updateTimeCell = document.createElement('td');
            updateTimeCell.textContent = shift.updatedAt ? new Date(shift.updatedAt).toLocaleString() : '-';
            row.appendChild(updateTimeCell);

            // 状态（包含状态切换按钮，参考机构部门管理样式）
            const statusCell = document.createElement('td');
            const statusBtn = document.createElement('button');
            // 当前状态为0(启用)时，显示'停用'按钮
            // 当前状态为1(停用)时，显示'启用'按钮
            const currentStatus = shift.status;
            statusBtn.textContent = currentStatus === 0 ? '停用' : '启用';
            
            // 使用机构部门管理中相同的按钮样式
            statusBtn.className = currentStatus === 0 ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm';
            
            statusBtn.onclick = () => toggleShiftStatus(shift.id, currentStatus === 0 ? 1 : 0);
            statusCell.appendChild(statusBtn);
            row.appendChild(statusCell);

            // 操作
            const actionCell = document.createElement('td');
            actionCell.className = 'action-buttons';

            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-primary btn-sm';
            editBtn.textContent = '编辑';
            editBtn.onclick = () => editShift(shift.id);
            actionCell.appendChild(editBtn);

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = () => deleteShiftConfirm(shift.id);
            actionCell.appendChild(deleteBtn);

            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });

        // 创建分页控件
        createShiftPagination(allShifts.length);
        
        console.log('已加载班次数据:', allShifts.length, '条，当前第', shiftCurrentPage, '页');
    } catch (error) {
        console.error('加载班次数据失败:', error);
        showNotification('加载班次数据失败: ' + error.message, 'error');
    }
};

// 显示添加班次模态框
window.showAddShiftModal = function() {
    document.getElementById('shiftModalTitle').textContent = '添加班次';
    document.getElementById('shiftIdInput').value = '';
    document.getElementById('shiftNameInput').value = '';
    document.getElementById('shiftCodeInput').value = '';
    document.getElementById('shiftStartTimeInput').value = '';
    document.getElementById('shiftEndTimeInput').value = '';
    document.getElementById('shiftDescriptionInput').value = '';
    document.getElementById('shiftStatusInput').value = 'active';
    
    // 设置创建日期为当天
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // 格式化为 YYYY-MM-DD
    document.getElementById('shiftCreatedAtInput').value = formattedDate;
    
    // 添加班次时显示创建日期，隐藏更新日期
    document.getElementById('shiftCreatedDateGroup').style.display = 'block';
    document.getElementById('shiftUpdateDateGroup').style.display = 'none';
    
    document.getElementById('shiftModal').style.display = 'block';
};

// 班次优先级管理相关变量
let sortedShifts = []; // 已排序的班次列表
let availableShifts = []; // 待排序的班次列表

// 显示班次优先级管理模态框
window.showShiftPriorityModal = async function() {
    try {
        // 获取所有班次数据
        const allShifts = await shiftManager.getAllShifts();
        
        // 初始化已排序和待排序列表
        sortedShifts = [];  // 已排序的班次列表
        availableShifts = [];  // 待排序的班次列表
        
        // 遍历所有班次，根据状态和优先级分类
        allShifts.forEach(shift => {
            // 确保班次有优先级字段，未设置的设为0
            if (shift.priority === undefined) {
                shift.priority = 0;
            }
            
            // 只处理启用状态的班次
            if (shift.status === 0) {
                // 对于启用的班次，优先级为0的放入待排序列表，优先级>0的放入已排序列表
                if (shift.priority > 0) {
                    sortedShifts.push(shift);
                } else {
                    shift.priority = 0;  // 确保未排序的启用班次优先级为0
                    availableShifts.push(shift);
                }
            } else {
                // 未启用的班次不放入任何列表，但确保它们的优先级为0
                shift.priority = 0;
            }
        });
        
        // 对已排序列表按优先级排序
        sortedShifts.sort((a, b) => {
            const priorityA = a.priority !== undefined ? a.priority : 0;
            const priorityB = b.priority !== undefined ? b.priority : 0;
            return priorityA - priorityB;
        });
        
        // 渲染两个列表
        renderShiftPriorityLists();
        
        // 显示模态框
        const shiftPriorityModal = document.getElementById('shiftPriorityModal');
        shiftPriorityModal.style.display = 'block';
        
        // 为取消按钮添加事件监听器
        const cancelButton = shiftPriorityModal.querySelector('.btn-secondary');
        if (cancelButton && typeof cancelButton.onclick !== 'function') {
            cancelButton.onclick = function() {
                closeShiftPriorityModal();
            };
        }
        
        // 绑定清空和保存按钮事件
        document.getElementById('clearSortedShiftsBtn').onclick = clearSortedShifts;
        document.getElementById('saveShiftPriorityBtn').onclick = saveShiftPriorities;
    } catch (error) {
        console.error('加载班次优先级数据失败:', error);
        showNotification('加载班次优先级数据失败: ' + error.message, 'error');
    }
};

// 渲染班次优先级列表
function renderShiftPriorityLists() {
    const sortedListElement = document.getElementById('sortedShiftsList');
    const availableListElement = document.getElementById('availableShiftsList');
    
    if (!sortedListElement || !availableListElement) return;
    
    // 清空列表
    sortedListElement.innerHTML = '';
    availableListElement.innerHTML = '';
    
    // 渲染已排序列表
    if (sortedShifts.length > 0) {
        sortedShifts.forEach((shift, index) => {
            const shiftItem = createShiftPriorityItem(shift, index + 1, true);
            sortedListElement.appendChild(shiftItem);
        });
    } else {
        sortedListElement.innerHTML = '<div class="no-data">暂无已排序的班次</div>';
    }
    
    // 渲染待排序列表
    if (availableShifts.length > 0) {
        availableShifts.forEach(shift => {
            const shiftItem = createShiftPriorityItem(shift, null, false);
            availableListElement.appendChild(shiftItem);
        });
    } else {
        availableListElement.innerHTML = '<div class="no-data">暂无待排序的班次</div>';
    }
}

// 创建班次优先级列表项
function createShiftPriorityItem(shift, priority, isInSortedList) {
    const item = document.createElement('div');
    item.className = 'shift-priority-item';
    item.style = `
        padding: 8px;
        margin-bottom: 5px;
        border-radius: 4px;
        background-color: ${isInSortedList ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
        cursor: pointer;
        transition: background-color 0.3s;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.width = '100%';
    
    if (priority) {
        const priorityBadge = document.createElement('span');
        priorityBadge.textContent = priority;
        priorityBadge.style = `
            display: inline-block;
            width: 24px;
            height: 24px;
            line-height: 24px;
            text-align: center;
            background-color: #3498db;
            color: white;
            border-radius: 50%;
            margin-right: 10px;
            font-size: 12px;
        `;
        content.appendChild(priorityBadge);
    }
    
    const shiftInfo = document.createElement('span');
    shiftInfo.textContent = `${shift.code} - ${shift.name}`;
    content.appendChild(shiftInfo);
    
    item.appendChild(content);
    
    // 添加移除按钮（仅已排序列表项显示）
    if (isInSortedList) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger btn-xs';
        removeBtn.textContent = '移除';
        removeBtn.style.marginLeft = '10px';
        removeBtn.onclick = (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            removeShiftFromSortedList(shift);
        };
        item.appendChild(removeBtn);
    }
    
    // 添加点击事件
    item.onclick = () => {
        if (isInSortedList) {
            // 从已排序列表移除到待排序列表
            removeShiftFromSortedList(shift);
        } else {
            // 从待排序列表添加到已排序列表末尾
            addShiftToSortedList(shift);
        }
    };
    
    return item;
}

// 从已排序列表移除班次到待排序列表
function removeShiftFromSortedList(shift) {
    sortedShifts = sortedShifts.filter(s => s.id !== shift.id);
    availableShifts.push(shift);
    renderShiftPriorityLists();
}

// 添加班次到已排序列表末尾
function addShiftToSortedList(shift) {
    availableShifts = availableShifts.filter(s => s.id !== shift.id);
    sortedShifts.push(shift);
    renderShiftPriorityLists();
}

// 清空所有已排序的班次
function clearSortedShifts() {
    if (confirm('确定要清空所有已排序的班次吗？')) {
        availableShifts = [...availableShifts, ...sortedShifts];
        sortedShifts = [];
        renderShiftPriorityLists();
    }
}

// 保存班次优先级设置
async function saveShiftPriorities() {
    try {
        // 创建一个保存所有班次优先级更新的Promise数组
        const updatePromises = [];
        
        // 为已排序列表中的班次设置新的优先级
        sortedShifts.forEach((shift, index) => {
            const updatedShift = {
                ...shift,
                priority: index + 1, // 优先级从1开始
                updatedAt: new Date()
            };
            updatePromises.push(shiftManager.saveShift(updatedShift));
        });
        
        // 为待排序列表中的班次设置默认优先级0
        availableShifts.forEach(shift => {
            const updatedShift = {
                ...shift,
                priority: 0,
                updatedAt: new Date()
            };
            updatePromises.push(shiftManager.saveShift(updatedShift));
        });
        
        // 等待所有更新完成
        await Promise.all(updatePromises);
        
        // 刷新班次数据和缓存
        loadShifts();
        if (window.refreshScheduleCache) {
            window.refreshScheduleCache();
        }
        
        // 关闭模态框并显示成功提示
        document.getElementById('shiftPriorityModal').style.display = 'none';
        showNotification('班次优先级设置保存成功');
    } catch (error) {
        console.error('保存班次优先级设置失败:', error);
        showNotification('保存班次优先级设置失败: ' + error.message, 'error');
    }
};

// 编辑班次
window.editShift = async function(id) {
    try {
        const shift = await dbManager.getById('shifts', id);
        if (shift) {
            document.getElementById('shiftModalTitle').textContent = '编辑班次';
            document.getElementById('shiftIdInput').value = shift.id;
            document.getElementById('shiftNameInput').value = shift.name || '';
            document.getElementById('shiftCodeInput').value = shift.code || '';
            document.getElementById('shiftStartTimeInput').value = shift.startTime || '';
            document.getElementById('shiftEndTimeInput').value = shift.endTime || '';
            document.getElementById('shiftDescriptionInput').value = shift.description || '';
            document.getElementById('shiftStatusInput').value = shift.status === 0 ? 'active' : 'inactive';
            
            // 编辑班次时隐藏创建日期，显示更新日期
            document.getElementById('shiftCreatedDateGroup').style.display = 'none';
            document.getElementById('shiftUpdateDateGroup').style.display = 'block';
            
            // 设置更新日期为当天
            const currentDate = new Date();
            const formattedDate = currentDate.toISOString().split('T')[0]; // 格式化为 YYYY-MM-DD
            document.getElementById('shiftUpdateDateInput').value = formattedDate;
            
            document.getElementById('shiftModal').style.display = 'block';
        }
    } catch (error) {
        console.error('获取班次数据失败:', error);
        showNotification('获取班次数据失败: ' + error.message, 'error');
    }
};

// 关闭班次优先级模态框
window.closeShiftPriorityModal = function() {
    document.getElementById('shiftPriorityModal').style.display = 'none';
    // 重置列表数据，避免下次打开时使用旧数据
    sortedShifts = [];
    availableShifts = [];
};

// 点击模态框外部关闭模态框
window.onclick = function(event) {
    const shiftModal = document.getElementById('shiftModal');
    const shiftPriorityModal = document.getElementById('shiftPriorityModal');
    
    if (shiftModal && event.target === shiftModal) {
        shiftModal.style.display = 'none';
    }
    
    if (shiftPriorityModal && event.target === shiftPriorityModal) {
        shiftPriorityModal.style.display = 'none';
        // 重置列表数据
        sortedShifts = [];
        availableShifts = [];
    }
};

// 保存班次
window.saveShift = async function(event) {
    event.preventDefault();
    
    try {
        // 获取id值，并确保它是有效的数字或null
        const idValue = document.getElementById('shiftIdInput').value;
        const id = idValue && !isNaN(parseInt(idValue)) ? parseInt(idValue) : null;
        // 获取表单中的班次信息
        const code = document.getElementById('shiftCodeInput').value.trim();
        const name = document.getElementById('shiftNameInput').value.trim();
        const startTime = document.getElementById('shiftStartTimeInput').value.trim();
        const endTime = document.getElementById('shiftEndTimeInput').value.trim();
        const description = document.getElementById('shiftDescriptionInput').value.trim();
        const status = document.getElementById('shiftStatusInput').value === 'active' ? 0 : 1;
        
        // 对于编辑的班次，保留原有优先级；对于新班次，使用默认优先级0
        let priority = 0;
        if (id) {
            // 尝试获取现有班次的优先级
            try {
                const existingShift = await shiftManager.getShiftById(id);
                if (existingShift && existingShift.priority !== undefined) {
                    priority = existingShift.priority;
                }
            } catch (error) {
                console.warn('获取现有班次优先级失败，使用默认值:', error);
            }
        }

        if (!name) {
            showNotification('班次名称不能为空', 'warning');
            return;
        }
        
        if (!code) {
            showNotification('班次代码不能为空', 'warning');
            return;
        }
        
        if (code.length > 20) {
            showNotification('班次代码不能超过20个字符', 'warning');
            return;
        }

        // 构建班次数据对象
        const shiftData = {
            code,
            name,
            startTime,
            endTime,
            description,
            priority,
            status,
            updatedAt: new Date() // 设置当前时间为更新时间
        };
        
        // 保留创建时间（编辑时也需要保留，即使不显示在界面上）
        const createdAtInput = document.getElementById('shiftCreatedAtInput');
        if (id && createdAtInput && createdAtInput.value) {
            // 编辑时保留原创建时间
            shiftData.createdAt = new Date(createdAtInput.value);
        } else if (!id) {
            // 新增班次时，设置为当前时间
            shiftData.createdAt = new Date();
        }
        
        // 只有当id是有效的数字时才添加到数据对象中
        if (id !== null) {
            shiftData.id = id;
        }

        await shiftManager.saveShift(shiftData);
        document.getElementById('shiftModal').style.display = 'none';
        
        // 延迟一小段时间确保数据完全保存
        setTimeout(() => {
            // 保持当前页码，不重置到第1页
            loadShifts();
            // 刷新排班计划相关的缓存数据
            if (window.refreshScheduleCache) {
                try {
                    window.refreshScheduleCache();
                    console.log('已刷新排班计划缓存');
                } catch (error) {
                    console.error('刷新排班计划缓存失败:', error);
                }
            }
        }, 300);
    } catch (error) {
        console.error('保存班次失败:', error);
    }
};

// 切换班次状态
window.toggleShiftStatus = async function(id, status) {
    try {
        await shiftManager.updateShiftStatus(id, status);
        loadShifts();
    } catch (error) {
        console.error('切换班次状态失败:', error);
    }
};

// 删除班次确认
window.deleteShiftConfirm = function(id) {
    if (confirm('确定要删除这个班次吗？删除后将无法恢复。')) {
        deleteShift(id);
    }
};

// 删除班次
window.deleteShift = async function(id) {
    try {
        await shiftManager.deleteShift(id);
        // 重置为第1页
        shiftCurrentPage = 1;
        loadShifts();
        // 刷新排班计划相关的缓存数据
        if (window.refreshScheduleCache) {
            try {
                window.refreshScheduleCache();
                console.log('已刷新排班计划缓存');
            } catch (error) {
                console.error('刷新排班计划缓存失败:', error);
            }
        }
    } catch (error) {
        console.error('删除班次失败:', error);
    }
};

// 创建一个全局函数，用于刷新排班计划缓存数据
window.refreshScheduleCache = function() {
    // 清空班次数据缓存，下次加载时会自动重建
    if (window.shiftDataCache) {
        window.shiftDataCache = null;
        console.log('已清空班次数据缓存');
    }
    
    // 触发排班计划模块的数据刷新
    if (window.loadScheduleData) {
        try {
            console.log('触发排班计划数据刷新...');
            // 不直接调用loadScheduleData，而是通过事件通知
            const event = new CustomEvent('scheduleDataNeedRefresh', {
                detail: {
                    reason: 'shiftDataChanged'
                }
            });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('触发排班数据刷新事件失败:', error);
        }
    }
};

// 创建班次分页控件
function createShiftPagination(totalItems, containerId = 'shift-pagination') {
    const paginationContainer = document.getElementById(containerId);
    if (!paginationContainer) {
        // 如果分页容器不存在，创建一个
        const tableContainer = document.querySelector('#shifts-tab .table-container');
        if (tableContainer) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination';
            paginationDiv.id = 'shift-pagination';
            tableContainer.appendChild(paginationDiv);
            return createShiftPagination(totalItems); // 递归调用以创建分页按钮
        }
        return;
    }
    
    paginationContainer.innerHTML = '';
    
    const totalPages = Math.ceil(totalItems / shiftItemsPerPage);
    
    // 首页按钮
    const firstPageBtn = document.createElement('button');
    firstPageBtn.className = 'pagination-btn' + (shiftCurrentPage === 1 ? ' disabled' : '');
    firstPageBtn.textContent = '首页';
    firstPageBtn.onclick = () => {
        if (shiftCurrentPage > 1) {
            shiftCurrentPage = 1;
            loadShifts();
        }
    };
    paginationContainer.appendChild(firstPageBtn);
    
    // 上一页按钮
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-btn' + (shiftCurrentPage === 1 ? ' disabled' : '');
    prevButton.textContent = '上一页';
    prevButton.onclick = () => {
        if (shiftCurrentPage > 1) {
            shiftCurrentPage--;
            loadShifts();
        }
    };
    paginationContainer.appendChild(prevButton);
    
    // 页码按钮 - 只显示当前页前后3页
    for (let i = 1; i <= totalPages; i++) {
        if (i > shiftCurrentPage - 3 && i < shiftCurrentPage + 3) {
            const pageButton = document.createElement('button');
            pageButton.className = 'pagination-btn' + (i === shiftCurrentPage ? ' active' : '');
            pageButton.textContent = i;
            pageButton.onclick = () => {
                shiftCurrentPage = i;
                loadShifts();
            };
            paginationContainer.appendChild(pageButton);
        }
    }
    
    // 下一页按钮
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn' + (shiftCurrentPage === totalPages ? ' disabled' : '');
    nextButton.textContent = '下一页';
    nextButton.onclick = () => {
        if (shiftCurrentPage < totalPages) {
            shiftCurrentPage++;
            loadShifts();
        }
    };
    paginationContainer.appendChild(nextButton);
    
    // 末页按钮
    const lastPageBtn = document.createElement('button');
    lastPageBtn.className = 'pagination-btn' + (shiftCurrentPage === totalPages ? ' disabled' : '');
    lastPageBtn.textContent = '末页';
    lastPageBtn.onclick = () => {
        if (shiftCurrentPage < totalPages) {
            shiftCurrentPage = totalPages;
            loadShifts();
        }
    };
    paginationContainer.appendChild(lastPageBtn);
}

// 关闭班次模态框
window.closeShiftModal = function() {
    document.getElementById('shiftModal').style.display = 'none';
};

// 初始化班次管理功能
window.initShiftManagement = async function() {
    try {
        // 确保数据库已初始化
        await dbManager.ensureInitialized();
        
        // 初始化班次存储空间
        await shiftManager.initializeStore();
        
        // 初始化默认班次数据（如果不存在）
        await shiftManager.initializeDefaultShifts();
        
        // 确保DOM已经加载完成后再加载和渲染数据
        const loadAndSetup = function() {
            // 加载班次数据
            loadShifts();
            
            // 添加事件监听器
            // 关闭模态框按钮
            const closeButtons = document.querySelectorAll('.modal-close');
            closeButtons.forEach(button => {
                button.onclick = function() {
                    this.parentElement.parentElement.parentElement.style.display = 'none';
                };
            });
        };
        
        // 如果DOM未加载完成，添加事件监听器
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadAndSetup);
        } else {
            // 如果DOM已加载完成，直接执行
            loadAndSetup();
        }
    } catch (error) {
        console.error('初始化班次管理功能失败:', error);
        if (window.showNotification) {
            window.showNotification('初始化班次管理功能失败: ' + error.message, 'error');
        }
    }
};

// 创建全局的shiftManager实例
console.log('正在创建全局shiftManager实例...');
window.shiftManager = new ShiftManager();
console.log('全局shiftManager实例已创建:', window.shiftManager);
console.log('shiftManager方法:', Object.getOwnPropertyNames(ShiftManager.prototype).filter(prop => typeof ShiftManager.prototype[prop] === 'function'));

// 手动绑定所有方法到window.shiftManager对象
// 确保方法在控制台日志中能够正确显示
window.shiftManager.getAllShifts = shiftManager.getAllShifts.bind(window.shiftManager);
window.shiftManager.saveShift = shiftManager.saveShift.bind(window.shiftManager);
window.shiftManager.deleteShift = shiftManager.deleteShift.bind(window.shiftManager);
window.shiftManager.updateShiftStatus = shiftManager.updateShiftStatus.bind(window.shiftManager);
window.shiftManager.initializeStore = shiftManager.initializeStore.bind(window.shiftManager);
window.shiftManager.initializeDefaultShifts = shiftManager.initializeDefaultShifts.bind(window.shiftManager);

console.log('shiftManager绑定方法后:', Object.keys(window.shiftManager));

// 当DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM加载完成，准备初始化班次管理功能...');
        initShiftManagement();
    });
} else {
    console.log('DOM已加载完成，立即初始化班次管理功能...');
    initShiftManagement();
}