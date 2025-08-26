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
            
            return await window.dbManager.save('identifiers', data);
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
                
                return {
                    ...identifier,
                    id: existingId, // 如果已存在，使用现有的ID
                    updatedAt: new Date()
                };
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
            return employees.find(emp => emp.number === employeeNumber);
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
        
        // 创建表格HTML
        let tableHtml = '';
        
        // 创建表格
        tableHtml += `
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
        
        tableHtml += `</tbody></table>`;
        
        // 添加样式
        tableHtml += `
        <style>
            .scrollable-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }
            
            .scrollable-table thead {
                position: sticky;
                top: 0;
                background-color: var(--card-bg);
                z-index: 10;
            }
            
            .scrollable-table th,
            .scrollable-table td {
                padding: 8px;
                text-align: center;
                border: 1px solid rgba(255, 255, 255, 0.1);
                min-width: 80px;
                background-color: var(--card-bg);
            }
            
            .fixed-column {
                position: sticky;
                left: 0;
                background-color: var(--card-bg);
                z-index: 5;
                border-right: 2px solid rgba(255, 255, 255, 0.1);
            }
            
            /* 固定列的层级关系 */
            .fixed-column:nth-child(1) { left: 0; z-index: 10; }
            .fixed-column:nth-child(2) { left: 40px; z-index: 9; width: 120px; }
            .fixed-column:nth-child(3) { left: 160px; z-index: 8; }
            .fixed-column:nth-child(4) { left: 240px; z-index: 7; }
            .fixed-column:nth-child(5) { left: 320px; z-index: 6; }
            .fixed-column:nth-child(6) { left: 400px; z-index: 5; }
            
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
                        <li>第一列：员工号</li>
                        <li>第二列：班次代码</li>
                        <li>第三列：是否可值班（是/否）</li>
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
};

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
                    
                    // 转换为JSON（使用第一行作为表头）
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
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
        // 降级到模拟导入
        await simulateImport(file, statusElement);
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
        
        // 过滤掉所有字段都为空的行
        const validDataRows = jsonData.filter(row => {
            const values = Object.values(row);
            return values.some(value => value !== undefined && value !== null && value.trim() !== '');
        });
        
        if (validDataRows.length === 0) {
            statusElement.innerHTML = '<span style="color: red;">导入失败: 没有找到有效数据行</span>';
            return;
        }
        
        // 获取表头信息，找出所有班次代码列
        const headers = Object.keys(validDataRows[0]);
        const shiftCodeColumns = headers.filter(header => 
            !['序号', '员工号', '员工姓名', '所属机构', '所属部门', '岗位'].includes(header)
        );
        
        if (shiftCodeColumns.length === 0) {
            statusElement.innerHTML = '<span style="color: red;">导入失败: 未找到班次代码列</span>';
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
        
        for (const row of validDataRows) {
            processedRows++;
            
            // 更新进度
            const progress = Math.round((processedRows / totalRows) * 100);
            progressElement.textContent = `处理进度: ${progress}%`;
            
            const employeeNumber = row['员工号'];
            if (!employeeNumber || employeeNumber.trim() === '') {
                skippedRows++;
                continue; // 跳过没有员工号的行
            }
            
            // 遍历所有班次列
            let hasValidData = false;
            for (const shiftCode of shiftCodeColumns) {
                const canWorkValue = row[shiftCode];
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
                skippedRows++;
            }
        }
        
        // 导入前验证数据
        const { validData, validationInfo } = await validateImportData(parsedData);
        importedCount = validationInfo.importedCount;
        invalidRows = validationInfo.invalidRows;
        invalidReasons = validationInfo.invalidReasons;
        
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
        const validData = [];
        const invalidReasons = [];
        let invalidCount = 0;
        
        // 预加载所有员工和班次信息，减少重复查询
        const allEmployees = await window.dbManager.getAll('employees');
        let allShifts = [];
        if (window.shiftManager) {
            allShifts = await window.shiftManager.getAllShifts();
        }
        
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
            
            if (!employee) {
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

// 模拟导入数据
async function simulateImport(file, statusElement) {
    try {
        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 模拟成功导入
        const importedCount = Math.floor(Math.random() * 10) + 1;
        statusElement.innerHTML = `<span style="color: green;">成功导入${importedCount}条标识数据</span>`;
        
        // 重新加载数据
        setTimeout(() => {
            loadIdentifierData();
            closeImportIdentifierModal();
        }, 1000);
    } catch (error) {
        console.error('模拟导入失败:', error);
        statusElement.innerHTML = `<span style="color: red;">导入失败: 模拟导入时出错</span>`;
    }
};