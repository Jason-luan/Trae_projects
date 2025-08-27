class IdentifierManager {
    constructor() {
        // 初始化时确保标识存储空间存在
        this.initializeStore().catch(err => console.error('初始化标识存储空间失败:', err));
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
            
            const data = {
                ...identifierData,
                updatedAt: new Date()
            };
            
            const result = await window.dbManager.save('identifiers', data);
            
            // 添加标识联动排班人员列表的逻辑
            this.notifyShiftOrderManagerAboutIdentifierChange(identifierData.employeeId, identifierData.shiftId, identifierData.canWork);
            
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

    // 新增方法：通知排班管理器关于标识变更
    notifyShiftOrderManagerAboutIdentifierChange(employeeId, shiftId, isAdded) {
        if (window.shiftOrderManager) {
            try {
                // 触发标识变更事件，包含员工ID、班次ID和是否添加
                const event = new CustomEvent('identifierChanged', {
                    detail: {
                        employeeId: employeeId,
                        shiftId: shiftId,
                        isAdded: isAdded
                    }
                });
                window.dispatchEvent(event);
                
                console.log(`已通知排班管理器：员工ID ${employeeId} 的标识已变更，班次ID: ${shiftId}，是否添加: ${isAdded}`);
            } catch (error) {
                console.error('通知排班管理器关于标识变更失败:', error);
            }
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
            
            // 添加去重逻辑，确保每个员工-班次组合唯一
            const uniqueCombinations = new Set();
            const uniqueIdentifiers = [];
            
            identifiers.forEach(identifier => {
                const key = `${identifier.employeeId}-${identifier.shiftId}`;
                if (!uniqueCombinations.has(key)) {
                    uniqueCombinations.add(key);
                    uniqueIdentifiers.push(identifier);
                }
            });
            
            // 为了避免重复导入时报错，先检查数据库中已有的记录
            // 获取所有已存在的标识数据
            const existingIdentifiers = await this.getAllIdentifiers();
            const existingKeyMap = new Map();
            
            existingIdentifiers.forEach(identifier => {
                const key = `${identifier.employeeId}-${identifier.shiftId}`;
                existingKeyMap.set(key, identifier.id); // 保存现有的ID
            });
            
            // 准备最终要保存的数据
            const dataToSave = uniqueIdentifiers.map(identifier => {
                const key = `${identifier.employeeId}-${identifier.shiftId}`;
                const existingId = existingKeyMap.get(key);
                
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
            
            return await window.dbManager.bulkSave('identifiers', dataToSave);
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
                // 如果已经包含employeeId和shiftId，直接使用
                if (item.employeeId && item.shiftId) {
                    // 检查是否重复
                    const key = `${item.employeeId}-${item.shiftId}`;
                    if (!validCombinations.has(key)) {
                        identifiers.push({
                            employeeId: item.employeeId,
                            shiftId: item.shiftId,
                            canWork: item.canWork || false,
                            createdAt: new Date()
                        });
                        validCombinations.add(key);
                    }
                } else {
                    // 兼容旧的数据格式，需要查找ID
                    const employee = await this.findEmployeeByNumber(item.employeeNumber);
                    const shift = await this.findShiftByCode(item.shiftCode);
                    
                    if (employee && shift) {
                        // 检查是否重复
                        const key = `${employee.id}-${shift.id}`;
                        if (!validCombinations.has(key)) {
                            identifiers.push({
                                employeeId: employee.id,
                                shiftId: shift.id,
                                canWork: item.canWork || false,
                                createdAt: new Date()
                            });
                            validCombinations.add(key);
                        }
                    }
                }
            }
            
            // 批量保存处理后的数据
            if (identifiers.length > 0) {
                await this.bulkSaveIdentifiers(identifiers);
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
            // 进行宽松比较，将两边都转换为字符串后再比较
            return employees.find(emp => String(emp.number) === String(employeeNumber));
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
            
            // 检查部门是否匹配筛选条件
            const matchesDeptFilter = deptFilter ? 
                (emp.deptName && emp.deptName === deptFilter) : true;
            
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
        
        // 首先获取所有机构名称，避免在循环中多次调用异步函数
        const orgNames = new Map();
        try {
            const organizations = await window.dbManager.getAll('organizations');
            organizations.forEach(org => {
                orgNames.set(org.id, org.name);
            });
        } catch (error) {
            console.error('预加载机构名称失败:', error);
        }
        
        // 添加员工行
        allEmployees.forEach((employee, empIndex) => {
            const orgName = orgNames.get(employee.orgId) || `机构${employee.orgId}`;
            
            // 使用div背景色
            const rowBgColor = 'background-color: var(--card-bg);';
            
            tableHtml += `
            <tr class="hover-row" style="${rowBgColor}">
                <td class="fixed-column">${empIndex + 1}</td>
                <td class="fixed-column">${employee.number}</td>
                <td class="fixed-column">${employee.name}</td>
                <td class="fixed-column">${orgName}</td>
                <td class="fixed-column">${employee.deptName || '-'}</td>
                <td class="fixed-column">${employee.position || '-'}</td>`;
            
            // 添加每个班次的标识单元格
            allActiveShifts.forEach(shift => {
                const key = `${employee.id}-${shift.id}`;
                const canWork = allIdentifiers[key] || false;
                
                tableHtml += `
                <td class="identifier-cell">
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
            #identifiers-tab .card {
                overflow: hidden;
                position: relative;
                max-width: 100%; /* 确保卡片不超过屏幕宽度 */
                box-sizing: border-box;
            }
            
            #identifiers-tab .card-body {
                padding: 0 !important;
                max-width: 100%; /* 确保卡片内容区不超过屏幕宽度 */
                box-sizing: border-box;
            }
            
            .table-scroll-wrapper {
                width: 100%;
                max-width: 100%; /* 确保表格容器不超过屏幕宽度 */
                height: 500px; /* 设置固定高度，确保表格大小不变 */
                overflow: hidden; /* 初始隐藏溢出 */
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                /* 确保表格在主界面以内 */
                box-sizing: border-box;
                /* 确保容器定位正确 */
                position: relative;
                display: block;
            }
            
            /* 强制显示水平滚动条并控制溢出 */
            .table-scroll-wrapper {
                overflow-x: scroll !important;
                overflow-y: scroll !important;
                -ms-overflow-style: scrollbar;
                scrollbar-width: auto;
                /* 确保滚动容器在父容器内正常工作 */
                display: block;
                position: relative;
            }
            
            /* 自定义滚动条样式 */
            .table-scroll-wrapper::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            
            .table-scroll-wrapper::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .table-scroll-wrapper::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 4px;
            }
            
            .table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }
            
            .scrollable-table {
                border-collapse: collapse;
                table-layout: fixed; /* 保持固定布局 */
                width: fixed; 
                min-width: 100%; /* 至少占满容器宽度 */
                margin: 0; /* 移除可能导致溢出的边距 */
            }
            
            .scrollable-table thead {
                position: sticky;
                top: 0;
                background-color: var(--card-bg);
                z-index: 10;
            }
            
            /* 全局单元格样式 */
            .scrollable-table th,
            .scrollable-table td {
                padding: 8px 12px;
                text-align: center;
                border: 1px solid rgba(255, 255, 255, 0.1);
                min-width: 100px; /* 增加最小宽度，防止过度压缩 */
                background-color: var(--card-bg);
                white-space: nowrap;
                box-sizing: border-box;
            }

            /* 非固定列单元格 - 显示全部内容 */
            .scrollable-table th:not(.fixed-column),
            .scrollable-table td:not(.fixed-column) {
                overflow: visible;
                min-width: 120px; /* 非固定列设置更大的最小宽度 */
                position: relative;
                z-index: 1;
            }
            
            .scrollable-table thead th {
                background-color: var(--card-bg);
                border-bottom: 2px solid rgba(255, 255, 255, 0.2);
            }
            
            /* 固定列样式 - 确保不与非固定列重叠 */
            .fixed-column {
                position: sticky;
                left: 0;
                background-color: var(--card-bg);
                z-index: 5;
                border-right: 2px solid rgba(255, 255, 255, 0.1);
                box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
                /* 固定列内容限制 */
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* 固定列的层级关系和精确宽度 */
            .fixed-column:nth-child(1) { left: 0; z-index: 10; min-width: 40px; width: 40px; }
            .fixed-column:nth-child(2) { left: 40px; z-index: 9; min-width: 120px; width: 120px; }
            .fixed-column:nth-child(3) { left: 160px; z-index: 8; min-width: 80px; width: 80px; }
            .fixed-column:nth-child(4) { left: 240px; z-index: 7; min-width: 100px; width: 100px; }
            .fixed-column:nth-child(5) { left: 340px; z-index: 6; min-width: 100px; width: 100px; }
            .fixed-column:nth-child(6) { left: 440px; z-index: 5; min-width: 80px; width: 80px; }
            
            /* 修复第一个非固定列的左边距 */
            .scrollable-table th:nth-child(7),
            .scrollable-table td:nth-child(7) {
                padding-left: 15px;
            }
            
            /* 表格容器样式优化 */
            .table-scroll-wrapper {
                position: relative;
                overflow-x: auto !important;
                overflow-y: auto !important;
                display: block;
                contain: content;
            }
            
            .identifier-cell {
                padding: 4px;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            
            .identifier-checkbox {
                display: none;
            }
            
            .checkbox-custom {
                width: 20px;
                height: 20px;
                border: 2px solid #007bff;
                border-radius: 4px;
                transition: all 0.3s ease;
                position: relative;
            }
            
            .identifier-checkbox:checked + .checkbox-custom {
                background-color: #28a745;
                border-color: #28a745;
            }
            
            .identifier-checkbox:checked + .checkbox-custom::after {
                content: '✓';
                color: white;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-weight: bold;
            }
            
            .hover-row:hover {
                background: rgba(255, 255, 255, 0.05) !important;
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
        checkbox.addEventListener('change', async function() {
            const employeeId = parseInt(this.getAttribute('data-employee-id'));
            const shiftId = parseInt(this.getAttribute('data-shift-id'));
            const canWork = this.checked;
            
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
            } catch (error) {
                console.error('保存标识数据失败:', error);
                // 恢复复选框状态
                this.checked = !canWork;
                if (window.showNotification) {
                    window.showNotification('保存标识数据失败: ' + error.message, 'error');
                }
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
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = newState;
                        // 触发change事件以保存数据
                        checkbox.dispatchEvent(new Event('change'));
                    });
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
            checkboxes.forEach(checkbox => {
                checkbox.checked = newState;
                // 触发change事件以保存数据
                checkbox.dispatchEvent(new Event('change'));
            });
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

// 根据机构ID获取机构名称（已在renderIdentifierTable中优化处理）
async function getOrganizationNameById(orgId) {
    try {
        // 如果是字符串类型的orgId，转换为数字
        const id = typeof orgId === 'string' ? parseInt(orgId) : orgId;
        
        // 检查全局机构数据是否存在
        if (window.allOrganizations && window.allOrganizations.length > 0) {
            const organization = window.allOrganizations.find(org => org.id === id);
            if (organization) {
                return organization.name;
            }
        }
        
        // 如果没有全局数据，直接从数据库获取
        const organization = await window.dbManager.getById('organizations', id);
        if (organization) {
            return organization.name;
        }
        
        // 获取所有机构数据并缓存
        const organizations = await window.dbManager.getAll('organizations');
        window.allOrganizations = organizations;
        
        const cachedOrg = organizations.find(org => org.id === id);
        if (cachedOrg) {
            return cachedOrg.name;
        }
        
        return `机构${id}`;
    } catch (error) {
        console.error('获取机构名称失败:', error);
        return `机构${orgId}`;
    }
}

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
            const orgName = orgNames.get(employee.orgId) || `机构${employee.orgId}`;
            
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
                    
                    // 使用显式配置来处理表头，确保第一行被正确识别
                    // header: "A" 表示使用Excel的列名(A,B,C...)作为键，然后我们自己处理表头行
                    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: "A" });
                    
                    // 处理表头和数据
                    let jsonData = [];
                    if (rawData.length > 0) {
                        // 第一行作为表头行
                        const headerRow = rawData[0];
                        
                        // 从第二行开始处理数据行
                        for (let i = 1; i < rawData.length; i++) {
                            const dataRow = {};
                            // 将列名(A,B,C...)映射到表头值
                            for (const col in headerRow) {
                                const header = headerRow[col];
                                if (header !== undefined && header !== null) {
                                    dataRow[header] = rawData[i][col];
                                }
                            }
                            jsonData.push(dataRow);
                        }
                    }
                    
                    if (!jsonData || jsonData.length === 0) {
                        statusElement.innerHTML = '<span style="color: red;">导入失败: 文件内容为空</span>';
                        resolve();
                        return;
                    }
                    
                    // 处理数据并导入
                    await processAndImportData(jsonData, statusElement, file.name);
                    resolve();
                } catch (error) {
                    console.error('解析Excel文件失败:', error);
                    // 安全地获取错误信息
                    const errorMessage = error && error.message ? error.message : '未知错误';
                    statusElement.innerHTML = `<span style="color: red;">导入失败: 解析文件时出错</span>`;
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
        statusElement.innerHTML = '<span style="color: red;">导入失败: 无法处理Excel文件</span>';
    }
}

// 解析CSV文件
async function parseCsvFile(file, statusElement) {
    try {
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async function(e) {
                try {
                    const csvText = e.target.result;
                    const lines = csvText.split(/\r\n|\n/);
                    
                    if (lines.length < 2) {
                        statusElement.innerHTML = '<span style="color: red;">导入失败: CSV文件内容为空或格式不正确</span>';
                        resolve();
                        return;
                    }
                    
                    // 解析表头
                    const headers = lines[0].split(',').map(header => header.trim());
                    
                    // 解析数据行
                    const jsonData = [];
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue; // 跳过空行
                        
                        const values = parseCsvLine(lines[i]);
                        const row = {};
                        
                        headers.forEach((header, index) => {
                            row[header] = values[index] !== undefined ? values[index].trim() : '';
                        });
                        
                        jsonData.push(row);
                    }
                    
                    // 处理数据并导入
                    await processAndImportData(jsonData, statusElement, file.name);
                    resolve();
                } catch (error) {
                    console.error('解析CSV文件失败:', error);
                    statusElement.innerHTML = `<span style="color: red;">导入失败: 解析CSV文件时出错</span>`;
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
        statusElement.innerHTML = `<span style="color: red;">导入失败: ${error.message}</span>`;
    }
}

// 解析CSV行（处理包含逗号或引号的字段）
function parseCsvLine(line) {
    const result = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"' && line[i-1] !== '\\') {
            inQuotes = !inQuotes;
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
    
    // 去除引号
    return result.map(field => {
        if (field.startsWith('"') && field.endsWith('"')) {
            // 去除首尾引号，并处理转义引号
            return field.slice(1, -1).replace(/""/g, '"');
        }
        return field;
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
        
        // 直接使用原始数据（已在parseExcelFile中处理过表头）
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
        const shiftCodeColumns = headers.filter(header => !employeeInfoColumns.includes(header));
        
        // 检查是否存在员工号列（必需）
        if (!headers.some(header => header === '员工号')) {
            statusElement.innerHTML = '<span style="color: red;">导入失败: 未找到"员工号"列</span><br>' +
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
        
        for (const row of validDataRows) {
            processedRows++;
            
            // 更新进度
            const progress = Math.round((processedRows / totalRows) * 100);
            progressElement.textContent = `处理进度: ${progress}%`;
            
            const employeeNumber = row['员工号'];
            
            // 记录当前行的处理情况
            console.log('处理行数据:', { employeeNumber, rowData: row });
            
            // 宽松的员工号验证，只要不是null、undefined或空字符串就接受
            if (employeeNumber === null || employeeNumber === undefined || 
                (typeof employeeNumber === 'string' && employeeNumber.trim() === '')) {
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
                // 如果单元格值为'1'，表示可值班
                if (canWorkValue === '1' || canWorkValue === 1) {
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
                statusElement.innerHTML = `<span style="color: red;">导入失败: 保存数据时出错</span>`;
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
            closeImportIdentifierModal();
        }, 1000);
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
        
        // 创建映射以便快速查找
        const employeeMap = new Map();
        allEmployees.forEach(emp => employeeMap.set(emp.number, emp));
        
        const shiftMap = new Map();
        allShifts.forEach(shift => shiftMap.set(shift.code, shift));
        
        // 验证每一条数据
        for (const item of data) {
            const { employeeNumber, shiftCode } = item;
            const employee = employeeMap.get(employeeNumber);
            const shift = shiftMap.get(shiftCode);
            
            console.log('验证数据项:', { employeeNumber, shiftCode, employeeExists: !!employee, shiftExists: !!shift });
            
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
                    shiftId: shift.id
                });
            }
        }
        
        return {
            validData,
            validationInfo: {
                importedCount: validData.length,
                invalidRows: invalidCount,
                invalidReasons: invalidReasons.slice(0, 10) // 只显示前10个错误
            }
        };
    } catch (error) {
        console.error('验证数据失败:', error);
        // 如果验证出错，返回原始数据继续处理
        return {
            validData: data,
            validationInfo: {
                importedCount: data.length,
                invalidRows: 0,
                invalidReasons: []
            }
        };
    }
}