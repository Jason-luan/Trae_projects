// 标识管理器类
class IdentifierManager {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    // 获取所有标识数据
    async getAllIdentifiers() {
        try {
            return await this.dbManager.getAllData('identifiers');
        } catch (error) {
            console.error('获取标识数据失败:', error);
            throw error;
        }
    }

    // 保存标识数据
    async saveIdentifier(identifierData) {
        try {
            // 检查是否已存在相同的标识
            const existing = await this.dbManager.getIdentifierByEmployeeAndShift(
                identifierData.employeeId,
                identifierData.shiftId
            );

            if (existing) {
                // 如果存在且enabled为false，则删除
                if (!identifierData.enabled) {
                    await this.dbManager.deleteData('identifiers', existing.id);
                    return true;
                } else {
                    // 如果存在且enabled为true，则更新
                    existing.enabled = identifierData.enabled;
                    existing.updateTime = new Date().toISOString();
                    return await this.dbManager.saveData('identifiers', existing);
                }
            } else if (identifierData.enabled) {
                // 如果不存在且enabled为true，则创建
                identifierData.createTime = new Date().toISOString();
                identifierData.updateTime = new Date().toISOString();
                return await this.dbManager.saveData('identifiers', identifierData);
            }
            return true;
        } catch (error) {
            console.error('保存标识数据失败:', error);
            throw error;
        }
    }

    // 批量保存标识数据
    async batchSaveIdentifiers(identifiers) {
        try {
            const promises = identifiers.map(identifier => this.saveIdentifier(identifier));
            await Promise.all(promises);
            return true;
        } catch (error) {
            console.error('批量保存标识数据失败:', error);
            throw error;
        }
    }

    // 根据员工ID和班次ID获取标识数据
    async getIdentifierByEmployeeAndShift(employeeId, shiftId) {
        try {
            return await this.dbManager.getIdentifierByEmployeeAndShift(employeeId, shiftId);
        } catch (error) {
            console.error('获取标识数据失败:', error);
            return null;
        }
    }

    // 导入标识数据
    async importIdentifiers(importData) {
        try {
            // 清空现有标识数据
            await this.dbManager.clearData('identifiers');
            
            // 过滤有效的标识数据
            const validIdentifiers = importData.filter(item => 
                item.employeeId && item.shiftId && item.enabled !== undefined
            );
            
            // 批量保存
            if (validIdentifiers.length > 0) {
                await this.dbManager.saveData('identifiers', validIdentifiers);
            }
            
            return {
                success: true,
                count: validIdentifiers.length
            };
        } catch (error) {
            console.error('导入标识数据失败:', error);
            throw error;
        }
    }

    // 导出标识数据
    async exportIdentifiers() {
        try {
            const identifiers = await this.getAllIdentifiers();
            const employees = await this.dbManager.getAllData('employees');
            const shifts = await this.dbManager.getAllData('shifts');

            // 创建员工ID到员工信息的映射
            const employeeMap = {};
            employees.forEach(emp => {
                employeeMap[emp.id] = emp;
            });

            // 创建班次ID到班次信息的映射
            const shiftMap = {};
            shifts.forEach(shift => {
                shiftMap[shift.id] = shift;
            });

            // 格式化导出数据
            const exportData = identifiers.map(identifier => ({
                '员工工号': employeeMap[identifier.employeeId]?.employeeId || '',
                '员工姓名': employeeMap[identifier.employeeId]?.name || '',
                '班次代码': shiftMap[identifier.shiftId]?.code || '',
                '班次名称': shiftMap[identifier.shiftId]?.name || '',
                '是否可值班': identifier.enabled ? '是' : '否',
                '创建时间': identifier.createTime || '',
                '更新时间': identifier.updateTime || ''
            }));

            return exportData;
        } catch (error) {
            console.error('导出标识数据失败:', error);
            throw error;
        }
    }
}

// 全局标识管理器实例
let identifierManager = null;

// 初始化标识管理功能
function initIdentifierManagement() {
    try {
        // 创建标识管理器实例
        identifierManager = new IdentifierManager(dbManager);

        // 创建导入按钮
        createImportButton();

        // 绑定选项卡切换事件
        const identifierTab = document.querySelector('.tab[data-tab="identifiers"]');
        if (identifierTab) {
            identifierTab.addEventListener('click', loadIdentifiers);
        }

        console.log('标识管理功能初始化成功');
    } catch (error) {
        console.error('标识管理功能初始化失败:', error);
        showNotification('标识管理功能初始化失败', 'error');
    }
}

// 创建导入按钮
function createImportButton() {
    const identifierTab = document.getElementById('identifiers-tab');
    if (identifierTab) {
        const cardHeader = identifierTab.querySelector('.card-header');
        if (cardHeader) {
            // 检查是否已存在导入按钮
            if (!cardHeader.querySelector('#importIdentifierBtn')) {
                // 创建按钮容器
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'card-header-actions';
                
                // 创建导入按钮
                const importBtn = document.createElement('button');
                importBtn.id = 'importIdentifierBtn';
                importBtn.className = 'btn btn-primary';
                importBtn.innerHTML = '<i class="fas fa-file-import"></i> 导入标识数据';
                
                // 添加点击事件
                importBtn.addEventListener('click', showImportModal);
                
                // 创建导出按钮
                const exportBtn = document.createElement('button');
                exportBtn.id = 'exportIdentifierBtn';
                exportBtn.className = 'btn btn-success';
                exportBtn.innerHTML = '<i class="fas fa-file-export"></i> 导出标识数据';
                exportBtn.style.marginLeft = '10px';
                
                // 添加点击事件
                exportBtn.addEventListener('click', exportIdentifierData);
                
                // 添加到容器
                buttonContainer.appendChild(importBtn);
                buttonContainer.appendChild(exportBtn);
                
                // 添加到卡片头部
                cardHeader.appendChild(buttonContainer);
            }
        }
    }
}

// 加载标识数据并渲染表格
async function loadIdentifiers() {
    try {
        // 获取在职员工和启用的班次
        const [activeEmployees, activeShifts] = await Promise.all([
            getActiveEmployees(),
            getActiveShifts()
        ]);

        // 获取所有标识数据
        const identifiers = await identifierManager.getAllIdentifiers();

        // 渲染标识管理表格
        renderIdentifierTable(activeEmployees, activeShifts, identifiers);

        console.log('加载标识数据成功');
    } catch (error) {
        console.error('加载标识数据失败:', error);
        showNotification('加载标识数据失败', 'error');
    }
}

// 获取在职员工
async function getActiveEmployees() {
    try {
        const allEmployees = await dbManager.getAllData('employees');
        // 筛选在职员工并按工号排序
        return allEmployees
            .filter(emp => emp.status === 1) // 1表示在职
            .sort((a, b) => a.employeeId.localeCompare(b.employeeId));
    } catch (error) {
        console.error('获取在职员工失败:', error);
        return [];
    }
}

// 获取启用的班次
async function getActiveShifts() {
    try {
        const allShifts = await dbManager.getAllData('shifts');
        // 筛选启用的班次并按代码排序
        return allShifts
            .filter(shift => shift.status === 1) // 1表示启用
            .sort((a, b) => a.code.localeCompare(b.code));
    } catch (error) {
        console.error('获取启用的班次失败:', error);
        return [];
    }
}

// 渲染标识管理表格
function renderIdentifierTable(employees, shifts, identifiers) {
    const tableContainer = document.querySelector('#identifiers-tab .table-container');
    if (!tableContainer) return;

    // 清空容器
    tableContainer.innerHTML = '';

    // 创建表格包装器（支持滚动）
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    tableWrapper.style.maxHeight = '600px';
    tableWrapper.style.overflowY = 'auto';
    tableWrapper.style.border = '1px solid #dee2e6';
    tableWrapper.style.borderRadius = '4px';

    // 创建表格
    const table = document.createElement('table');
    table.className = 'table table-bordered table-hover';

    // 创建表头
    const thead = document.createElement('thead');
    thead.style.backgroundColor = '#f8f9fa';
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.zIndex = '10';

    const headerRow = document.createElement('tr');

    // 添加固定列头
    const headers = ['序号', '工号', '姓名', '所属机构', '所属部门'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        th.style.minWidth = '100px';
        th.style.textAlign = 'center';
        th.style.verticalAlign = 'middle';
        headerRow.appendChild(th);
    });

    // 添加班次列头
    shifts.forEach(shift => {
        const th = document.createElement('th');
        th.innerHTML = `
            <div style="text-align: center;">
                <div>${shift.code}</div>
                <div style="font-size: 12px; color: #666;">${shift.name}</div>
            </div>
        `;
        th.style.minWidth = '80px';
        th.style.textAlign = 'center';
        th.style.verticalAlign = 'middle';
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 创建表格主体
    const tbody = document.createElement('tbody');

    // 创建标识数据映射，方便快速查找
    const identifierMap = new Map();
    identifiers.forEach(identifier => {
        const key = `${identifier.employeeId}_${identifier.shiftId}`;
        identifierMap.set(key, identifier);
    });

    // 添加员工行
    employees.forEach((employee, index) => {
        const row = document.createElement('tr');

        // 添加固定列数据
        const rowData = [
            index + 1,
            employee.employeeId,
            employee.name,
            employee.organizationName || '',
            employee.departmentName || ''
        ];

        rowData.forEach((data, colIndex) => {
            const td = document.createElement('td');
            td.textContent = data;
            td.style.textAlign = 'center';
            td.style.verticalAlign = 'middle';
            row.appendChild(td);
        });

        // 添加班次列数据
        shifts.forEach(shift => {
            const td = document.createElement('td');
            td.style.textAlign = 'center';
            td.style.verticalAlign = 'middle';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.style.width = '20px';
            checkbox.style.height = '20px';
            
            // 检查是否存在标识数据
            const key = `${employee.id}_${shift.id}`;
            const identifier = identifierMap.get(key);
            checkbox.checked = identifier && identifier.enabled;
            
            // 存储关联信息
            checkbox.dataset.employeeId = employee.id;
            checkbox.dataset.shiftId = shift.id;
            
            // 添加变更事件
            checkbox.addEventListener('change', handleCheckboxChange);
            
            td.appendChild(checkbox);
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    tableContainer.appendChild(tableWrapper);

    // 保存选择状态到本地存储
    saveSelectionState();
}

// 处理复选框变更事件
async function handleCheckboxChange(event) {
    const checkbox = event.target;
    const employeeId = parseInt(checkbox.dataset.employeeId);
    const shiftId = parseInt(checkbox.dataset.shiftId);
    const enabled = checkbox.checked;

    try {
        // 保存标识数据
        await identifierManager.saveIdentifier({
            employeeId,
            shiftId,
            enabled
        });

        // 保存选择状态到本地存储
        saveSelectionState();

        console.log(`更新标识数据: 员工ID=${employeeId}, 班次ID=${shiftId}, 启用=${enabled}`);
    } catch (error) {
        console.error('更新标识数据失败:', error);
        showNotification('更新标识数据失败', 'error');
        // 恢复复选框状态
        checkbox.checked = !enabled;
    }
}

// 保存选择状态到本地存储
function saveSelectionState() {
    try {
        const selections = [];
        const checkboxes = document.querySelectorAll('#identifiers-tab input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selections.push({
                    employeeId: parseInt(checkbox.dataset.employeeId),
                    shiftId: parseInt(checkbox.dataset.shiftId)
                });
            }
        });
        
        localStorage.setItem('identifierSelections', JSON.stringify(selections));
    } catch (error) {
        console.error('保存选择状态失败:', error);
    }
}

// 从本地存储恢复选择状态
function restoreSelectionState() {
    try {
        const savedSelections = localStorage.getItem('identifierSelections');
        if (savedSelections) {
            const selections = JSON.parse(savedSelections);
            const checkboxes = document.querySelectorAll('#identifiers-tab input[type="checkbox"]');
            
            checkboxes.forEach(checkbox => {
                const employeeId = parseInt(checkbox.dataset.employeeId);
                const shiftId = parseInt(checkbox.dataset.shiftId);
                
                const isSelected = selections.some(sel => 
                    sel.employeeId === employeeId && sel.shiftId === shiftId
                );
                
                if (isSelected && !checkbox.checked) {
                    checkbox.checked = true;
                    // 静默保存（不触发事件）
                    identifierManager.saveIdentifier({
                        employeeId,
                        shiftId,
                        enabled: true
                    }).catch(err => console.error('恢复选择状态失败:', err));
                }
            });
        }
    } catch (error) {
        console.error('恢复选择状态失败:', error);
    }
}

// 显示导入模态框
function showImportModal() {
    // 检查是否已存在导入模态框
    let modal = document.getElementById('identifierImportModal');
    
    if (!modal) {
        // 创建模态框
        modal = document.createElement('div');
        modal.id = 'identifierImportModal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.role = 'dialog';
        
        modal.innerHTML = `
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">导入标识数据</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="identifierImportFile">选择Excel文件</label>
                            <input type="file" class="form-control-file" id="identifierImportFile" accept=".xlsx,.xls">
                            <small class="form-text text-muted">请上传包含员工工号、班次代码和是否可值班信息的Excel文件。</small>
                        </div>
                        <div id="importStatus" style="display: none; margin-top: 15px;">
                            <div class="progress">
                                <div id="importProgressBar" class="progress-bar" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <p id="importMessage" class="mt-2"></p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
                        <button type="button" id="startImportBtn" class="btn btn-primary">开始导入</button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 绑定开始导入按钮事件
        document.getElementById('startImportBtn').addEventListener('click', startImport);
        
        // 绑定关闭事件
        modal.addEventListener('hidden.bs.modal', () => {
            // 清除文件选择
            document.getElementById('identifierImportFile').value = '';
            // 隐藏导入状态
            hideImportStatus();
        });
    }
    
    // 显示模态框
    $(modal).modal('show');
}

// 开始导入
async function startImport() {
    const fileInput = document.getElementById('identifierImportFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('请选择要导入的Excel文件', 'warning');
        return;
    }
    
    try {
        // 显示导入状态
        showImportStatus('正在解析文件...', 0);
        
        // 使用SheetJS解析Excel文件
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 获取第一个工作表
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // 转换为JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                // 更新进度
                showImportStatus('正在准备导入数据...', 30);
                
                // 获取员工和班次数据以进行映射
                const [employees, shifts] = await Promise.all([
                    dbManager.getAllData('employees'),
                    dbManager.getAllData('shifts')
                ]);
                
                // 创建映射
                const employeeMap = new Map();
                employees.forEach(emp => {
                    employeeMap.set(emp.employeeId, emp);
                });
                
                const shiftMap = new Map();
                shifts.forEach(shift => {
                    shiftMap.set(shift.code, shift);
                });
                
                // 转换导入数据
                const identifiers = [];
                jsonData.forEach(row => {
                    const employeeId = row['员工工号'] || row['工号'] || '';
                    const shiftCode = row['班次代码'] || row['班次'] || '';
                    const enabled = row['是否可值班'] === '是' || row['可值班'] === '是' || row['是否可值班'] === true;
                    
                    // 查找对应的员工和班次
                    const employee = employeeMap.get(employeeId);
                    const shift = shiftMap.get(shiftCode);
                    
                    if (employee && shift) {
                        identifiers.push({
                            employeeId: employee.id,
                            shiftId: shift.id,
                            enabled: enabled,
                            createTime: new Date().toISOString(),
                            updateTime: new Date().toISOString()
                        });
                    }
                });
                
                // 更新进度
                showImportStatus('正在导入数据...', 70);
                
                // 批量保存标识数据
                await identifierManager.batchSaveIdentifiers(identifiers);
                
                // 更新进度
                showImportStatus('导入完成', 100);
                
                // 刷新标识管理表格
                await loadIdentifiers();
                
                // 显示成功通知
                showNotification(`成功导入 ${identifiers.length} 条标识数据`, 'success');
                
                // 关闭模态框
                setTimeout(() => {
                    $('#identifierImportModal').modal('hide');
                }, 1500);
                
            } catch (error) {
                console.error('导入失败:', error);
                showImportStatus(`导入失败: ${error.message}`, 100, 'error');
                showNotification('导入失败: ' + error.message, 'error');
            }
        };
        
        reader.onerror = function() {
            showNotification('文件读取失败', 'error');
            hideImportStatus();
        };
        
        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('导入失败:', error);
        showNotification('导入失败: ' + error.message, 'error');
        hideImportStatus();
    }
}

// 显示导入状态
function showImportStatus(message, progress, type = 'info') {
    const statusElement = document.getElementById('importStatus');
    const messageElement = document.getElementById('importMessage');
    const progressBar = document.getElementById('importProgressBar');
    
    if (statusElement && messageElement && progressBar) {
        statusElement.style.display = 'block';
        messageElement.textContent = message;
        messageElement.className = `mt-2 text-${type}`;
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
        
        // 设置进度条颜色
        progressBar.className = 'progress-bar';
        if (type === 'error') {
            progressBar.classList.add('bg-danger');
        } else if (type === 'success') {
            progressBar.classList.add('bg-success');
        } else {
            progressBar.classList.add('bg-primary');
        }
    }
}

// 隐藏导入状态
function hideImportStatus() {
    const statusElement = document.getElementById('importStatus');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}

// 导出标识数据
async function exportIdentifierData() {
    try {
        // 显示加载状态
        showNotification('正在准备导出数据...', 'info');
        
        // 获取导出数据
        const exportData = await identifierManager.exportIdentifiers();
        
        // 创建工作簿和工作表
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '标识数据');
        
        // 生成Excel文件并下载
        const fileName = `人员值班标识_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        // 显示成功通知
        showNotification(`成功导出 ${exportData.length} 条标识数据`, 'success');
        
    } catch (error) {
        console.error('导出失败:', error);
        showNotification('导出失败: ' + error.message, 'error');
    }
}

// 全局加载标识数据函数，供app-init.js调用
window.loadIdentifiers = loadIdentifiers;

// 初始化函数，供app-init.js调用
window.initIdentifierManagement = initIdentifierManagement;