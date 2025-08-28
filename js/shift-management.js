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
                        console.log('班次存储空间创建成功');
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

    // 初始化默认班次数据
    async initializeDefaultShifts() {
        try {
            const existingShifts = await dbManager.getAll('shifts');
            if (existingShifts.length === 0) {
                // 默认班次数据
                const defaultShifts = [
                    { code: 'G', name: '白班', startTime: '08:50', endTime: '18:00', description: '正常白班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y0', name: '夜班00:00-08:00', startTime: '00:00', endTime: '08:00', description: '夜班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1030普', name: '中班10:20-19:30', startTime: '10:20', endTime: '19:30', description: '普通中班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1330普', name: '中班13:20-22:00', startTime: '13:20', endTime: '22:00', description: '普通中班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1330综', name: '中班13:20-22:00(综合)', startTime: '13:20', endTime: '22:00', description: '综合中班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y1330贵', name: '中班13:20-22:00(贵宾)', startTime: '13:20', endTime: '22:00', description: '贵宾中班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y16综', name: '晚班15:50-次日00:00', startTime: '15:50', endTime: '24:00', description: '综合晚班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y18普', name: '晚班18:00-次日02:00', startTime: '18:00', endTime: '02:00', description: '普通晚班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y8普', name: '早班07:50-16:30', startTime: '07:50', endTime: '16:30', description: '普通早班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y8综', name: '早班07:50-16:30(综合)', startTime: '07:50', endTime: '16:30', description: '综合早班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9值', name: '值班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '值班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9公', name: '公休班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '公休班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9普', name: '普通班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '普通班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'Y9综', name: '综合班08:50-17:30', startTime: '08:50', endTime: '17:30', description: '综合班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'G值', name: '周末值班08:50-18:00', startTime: '08:50', endTime: '18:00', description: '周末值班', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: '休', name: '休息日', startTime: '', endTime: '', description: '当天休息', status: 0, createdAt: new Date(), updatedAt: new Date() },
                    { code: 'C', name: '产假', startTime: '', endTime: '', description: '产假', status: 0, createdAt: new Date(), updatedAt: new Date() }
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
                                    order.employeeIds = [];
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
        // 获取并保存所有班次数据
        allShifts = await shiftManager.getAllShifts();
        
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

// 编辑班次
window.editShift = async function(id) {
    try {
        const shift = await dbManager.getById('shifts', id);
        if (shift) {
            document.getElementById('shiftModalTitle').textContent = '编辑班次';
            document.getElementById('shiftIdInput').value = shift.id;
            document.getElementById('shiftNameInput').value = shift.name || '';
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

// 保存班次
window.saveShift = async function(event) {
    event.preventDefault();
    
    try {
        // 获取id值，并确保它是有效的数字或null
        const idValue = document.getElementById('shiftIdInput').value;
        const id = idValue && !isNaN(parseInt(idValue)) ? parseInt(idValue) : null;
        // 使用班次名称的缩写作为默认代码
        const name = document.getElementById('shiftNameInput').value.trim();
        const code = id ? (await dbManager.getById('shifts', id))?.code || 'DEFAULT' : 'DEFAULT';
        const startTime = document.getElementById('shiftStartTimeInput').value.trim();
        const endTime = document.getElementById('shiftEndTimeInput').value.trim();
        const description = document.getElementById('shiftDescriptionInput').value.trim();
        const status = document.getElementById('shiftStatusInput').value === 'active' ? 0 : 1;

        if (!name) {
            showNotification('班次名称不能为空', 'warning');
            return;
        }

        // 构建班次数据对象
        const shiftData = {
            code,
            name,
            startTime,
            endTime,
            description,
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
    } catch (error) {
        console.error('删除班次失败:', error);
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