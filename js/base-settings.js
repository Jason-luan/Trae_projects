// 基础设置功能模块

// 存储当前编辑的机构ID
let currentOrganizationId = null;
// 存储当前编辑的员工ID
let currentEmployeeId = null;
// 分页和排序状态
let currentPage = 1;
const itemsPerPage = 10;
let sortField = 'code';
let sortDirection = 'asc';

// 显示通知 - 优化版
function showNotification(message, type = 'success') {
    // 移除已有的通知，避免堆叠
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        document.body.removeChild(notification);
    });

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加到文档
    document.body.appendChild(notification);
    
    // 触发重绘，然后显示通知（使用CSS动画）
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // 设置自动消失
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 切换状态 - 优化版，与编辑按钮样式保持一致
function toggleStatus(element, id, type, currentStatus, additionalInfo = null) {
    const newStatus = currentStatus === 0 ? 1 : 0;
    try {
        // 先禁用按钮防止重复点击
        element.disabled = true;
        
        if (type === 'organization') {
            dbManager.getById('organizations', parseInt(id))
                .then(org => {
                    if (org) {
                        org.status = newStatus;
                        org.updatedAt = new Date();
                        return dbManager.save('organizations', org);
                    }
                })
                .then(() => {
                    showNotification('机构状态更新成功');
                    // 重新加载列表以确保数据和UI完全同步
                    loadOrganizations(false);
                })
                .catch(error => {
                    showNotification('更新状态失败: ' + error.message, 'error');
                });
        } else if (type === 'employee') {
            dbManager.getById('employees', parseInt(id))
                .then(emp => {
                    if (emp) {
                        emp.status = newStatus;
                        emp.updatedAt = new Date();
                        return dbManager.save('employees', emp);
                    }
                })
                .then(() => {
                    showNotification('员工状态更新成功');
                })
                .catch(error => {
                    showNotification('更新状态失败: ' + error.message, 'error');
                });
        }
    } catch (error) {
        showNotification('更新状态失败: ' + error, 'error');
    }
}

// 检查并更新机构状态
function checkAndUpdateOrganizationStatus(orgId) {
    // 由于organizations现在没有departments字段，无需自动更新机构状态
    // 机构状态变更需要通过界面手动操作
    return Promise.resolve()
        .then(() => {
            // 无需通知，因为部门状态更新已有通知
        })
        .catch(error => {
            console.error('检查机构状态失败:', error);
        });
}

// 更新分页控件
function updatePagination(totalItems, containerId = 'org-pagination') {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.getElementById(containerId);
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    // 首页按钮
    const firstPageBtn = document.createElement('button');
    firstPageBtn.className = 'pagination-btn' + (currentPage === 1 ? ' disabled' : '');
    firstPageBtn.textContent = '首页';
    firstPageBtn.onclick = () => { 
        if (currentPage > 1) { 
            currentPage = 1; 
            // 根据容器ID决定调用哪个加载函数，机构列表翻页时不显示通知
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(false); 
        } 
    };
    paginationContainer.appendChild(firstPageBtn);

    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn' + (currentPage === 1 ? ' disabled' : '');
    prevBtn.textContent = '上一页';
    prevBtn.onclick = () => { 
        if (currentPage > 1) { 
            currentPage--; 
            // 根据容器ID决定调用哪个加载函数，机构列表翻页时不显示通知
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(false); 
        } 
    };
    paginationContainer.appendChild(prevBtn);

    // 页码按钮
    for (let i = 1; i <= totalPages; i++) {
        if (i > currentPage - 3 && i < currentPage + 3) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
            pageBtn.textContent = i;
            pageBtn.onclick = () => { 
                currentPage = i; 
                // 根据容器ID决定调用哪个加载函数，机构列表翻页时不显示通知
                containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(false); 
            };
            paginationContainer.appendChild(pageBtn);
        }
    }

    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn' + (currentPage === totalPages ? ' disabled' : '');
    nextBtn.textContent = '下一页';
    nextBtn.onclick = () => { 
        if (currentPage < totalPages) { 
            currentPage++; 
            // 根据容器ID决定调用哪个加载函数，机构列表翻页时不显示通知
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(false); 
        } 
    };
    paginationContainer.appendChild(nextBtn);

    // 末页按钮
    const lastPageBtn = document.createElement('button');
    lastPageBtn.className = 'pagination-btn' + (currentPage === totalPages ? ' disabled' : '');
    lastPageBtn.textContent = '末页';
    lastPageBtn.onclick = () => { 
        if (currentPage < totalPages) { 
            currentPage = totalPages; 
            // 根据容器ID决定调用哪个加载函数，机构列表翻页时不显示通知
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(false); 
        } 
    };
    paginationContainer.appendChild(lastPageBtn);
}

// 添加排序事件
function addSortEvents() {
    const headers = document.querySelectorAll('#organizationTable th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const field = header.dataset.field;
            if (sortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortDirection = 'asc';
            }
            currentPage = 1;
            loadOrganizations(false);
        });
    });
}

// 加载机构数据
// showNotificationFlag参数控制是否显示加载成功通知，默认为true
// 当从其他操作函数（如删除、添加、更新状态等）调用时，应设置为false
window.loadOrganizations = async function(showNotificationFlag = true) {
    try {
        let organizations = await dbManager.getAll('organizations');
        // 只有在showNotificationFlag为true时才显示加载通知
        if (showNotificationFlag) {
            showNotification(`已加载机构数量: ${organizations.length}`, 'info');
        }
        console.log('机构数据:', organizations);
        
        // 更新全局缓存，确保与数据库状态一致
        window.allOrganizations = organizations;
        
        // 排序
        organizations.sort((a, b) => {
            if (sortField === 'code') {
                // 确保机构号作为字符串正确比较，处理可能的空值
                const codeA = a.code || '';
                const codeB = b.code || '';
                return sortDirection === 'asc' ? codeA.localeCompare(codeB) : codeB.localeCompare(codeA);
            } else {
                // 其他字段的默认排序
                if (sortDirection === 'asc') {
                    return a[sortField] > b[sortField] ? 1 : -1;
                } else {
                    return a[sortField] < b[sortField] ? 1 : -1;
                }
            }
        });

        // 分页
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedOrganizations = organizations.slice(startIndex, startIndex + itemsPerPage);

        // 获取员工总数，用于计算每个机构的人数
        const allEmployees = await dbManager.getAll('employees');

        // 渲染表格
        const tableBody = document.querySelector('#org-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        paginatedOrganizations.forEach((org, index) => {
            const row = document.createElement('tr');
            row.className = 'hover-row';

            // 序号（所有数据连续排序）
            const indexCell = document.createElement('td');
            indexCell.textContent = (currentPage - 1) * itemsPerPage + index + 1;
            row.appendChild(indexCell);

            // 机构号
            const idCell = document.createElement('td');
            idCell.textContent = org.code || '-';
            row.appendChild(idCell);

            // 机构名称
            const nameCell = document.createElement('td');
            nameCell.textContent = org.name;
            row.appendChild(nameCell);

            // 部门名称（使用description字段）
            const deptCell = document.createElement('td');
            deptCell.textContent = org.description || '-';
            row.appendChild(deptCell);

            // 备注信息
            const remarkCell = document.createElement('td');
            remarkCell.textContent = org.remark || '-';
            row.appendChild(remarkCell);

            // 更新时间
            const updateTimeCell = document.createElement('td');
            updateTimeCell.textContent = org.updatedAt ? new Date(org.updatedAt).toLocaleString() : '-';
            row.appendChild(updateTimeCell);

            // 状态 - 现在显示的是部门状态
            const statusCell = document.createElement('td');
            const statusBtn = document.createElement('button');
            // 使用部门状态 (deptStatus)，默认为启用(0)
            const deptStatus = org.deptStatus !== undefined ? org.deptStatus : 0;
            statusBtn.textContent = deptStatus === 0 ? '停用' : '启用';
            
            // 使用CSS类
            statusBtn.className = deptStatus === 0 ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm';
            
            // 切换部门状态
            statusBtn.onclick = () => toggleOrganizationStatus(statusBtn, org.id, deptStatus);
            statusCell.appendChild(statusBtn);
            row.appendChild(statusCell);

            // 操作
            const actionCell = document.createElement('td');
            actionCell.className = 'action-buttons';
            
            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-primary btn-sm';
            editBtn.textContent = '编辑';
            editBtn.onclick = () => editOrganization(org.id);
            actionCell.appendChild(editBtn);
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = () => {
                let deleteOrgIdInput = document.getElementById('deleteOrganizationId');
                let deleteDeptNameInput = document.getElementById('deleteDepartmentName');
                
                if (!deleteOrgIdInput) {
                    deleteOrgIdInput = document.createElement('input');
                    deleteOrgIdInput.type = 'hidden';
                    deleteOrgIdInput.id = 'deleteOrganizationId';
                    document.body.appendChild(deleteOrgIdInput);
                }
                
                // 确保deleteDepartmentName输入框存在
                if (!deleteDeptNameInput) {
                    deleteDeptNameInput = document.createElement('input');
                    deleteDeptNameInput.type = 'hidden';
                    deleteDeptNameInput.id = 'deleteDepartmentName';
                    document.body.appendChild(deleteDeptNameInput);
                }
                
                // 设置机构名称+部门名称
                deleteOrgIdInput.value = org.name + ' - ' + (org.description || '');
                deleteDeptNameInput.value = org.description || '';
                
                // 显示删除确认信息
                document.getElementById('deleteInstitutionName').textContent = org.name + ' - ' + (org.description || '');
                document.getElementById('institutionDeleteModal').style.display = 'block';
            };
            actionCell.appendChild(deleteBtn);
            
            row.appendChild(actionCell);
            
            tableBody.appendChild(row);
        });

        // 更新分页
        updatePagination(organizations.length);

        // 添加排序事件
        addSortEvents();
    } catch (error) {
        showNotification('加载机构数据失败: ' + error.message, 'error');
    }
}

// 编辑机构
function editOrganization(id) {
    try {
        currentOrganizationId = id;
        dbManager.getById('organizations', parseInt(id))
            .then(org => {
                if (org) {
                    // 修正ID：institutionName -> institutionNameInput
                    document.getElementById('institutionModalTitle').textContent = '编辑机构';
                        document.getElementById('institutionNameInput').value = org.name;
                        document.getElementById('institutionNumberInput').value = org.code || '';
                        // 直接使用description字段填充部门输入框
                        document.getElementById('departmentNameInput').value = org.description || '';
                        document.getElementById('remarkInput').value = org.remark || '';
                        document.getElementById('institutionIdInput').value = org.id;
                         
                        // 设置更新日期为当天
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        document.getElementById('institutionCreateDateInput').value = formattedDate;
                         
                        // 将日期标签改为更新日期
                        document.querySelector('label[for="institutionCreateDateInput"]').textContent = '更新日期 *';
                         
                        document.getElementById('institutionModal').style.display = 'block';
                }
            })
            .catch(error => {
                showNotification('获取机构信息失败: ' + error.message, 'error');
            });
    } catch (error) {
        showNotification('编辑机构失败: ' + error, 'error');
    }
}

// 显示添加机构模态框
function showAddOrganizationModal() {
    currentOrganizationId = null;
    document.getElementById('institutionForm').reset();
    // 修正ID：institutionId -> institutionIdInput
    document.getElementById('institutionIdInput').value = '';
    
    // 设置模态框标题为添加机构
    document.getElementById('institutionModalTitle').textContent = '添加机构';
    
    // 设置默认创建日期为当天
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    document.getElementById('institutionCreateDateInput').value = formattedDate;
    
    // 将日期标签改为创建日期
    document.querySelector('label[for="institutionCreateDateInput"]').textContent = '创建日期 *';
    
    document.getElementById('institutionModal').style.display = 'block';
}

// 保存机构
async function saveOrganization(e) {
    e.preventDefault();
    try {
        // 获取表单值
        const name = document.getElementById('institutionNameInput').value.trim();
        const idInput = document.getElementById('institutionIdInput');
        const id = idInput.value ? parseInt(idInput.value) : null;
        const numberInput = document.getElementById('institutionNumberInput');
        const CODE = numberInput ? numberInput.value.trim() : '';
        // 从表单获取部门信息
        const departmentInput = document.getElementById('departmentNameInput').value.trim();
        const remark = document.getElementById('remarkInput').value.trim();

        if (!name) {
            showNotification('机构名称不能为空', 'warning');
            return;
        }

        if (id) {
            // 更新现有机构
            const org = await dbManager.getById('organizations', id);
            if (org) {
                // 更新时进行防重检查
                const allOrgs = await dbManager.getAll('organizations');
                const hasDuplicate = allOrgs.some(existingOrg => 
                    existingOrg.id !== id && 
                    existingOrg.name === name && 
                    existingOrg.description === departmentInput
                );
                
                if (hasDuplicate) {
                    showNotification('已存在相同名称和部门的机构，请修改后重试', 'error');
                    return;
                }
                
                const updatedOrg = {
                        ...org,
                        name,
                        code: CODE,
                        description: departmentInput,
                        remark: remark,
                        updatedAt: new Date()
                    };
                await dbManager.save('organizations', updatedOrg);
                showNotification('机构更新成功');
            }
        } else {
            // 新增机构，添加防重检查
            const allOrgs = await dbManager.getAll('organizations');
            // 检查是否存在相同名称和描述的机构
            const hasDuplicate = allOrgs.some(existingOrg => 
                existingOrg.name === name && 
                existingOrg.description === departmentInput
            );
            
            if (hasDuplicate) {
                showNotification('已存在相同名称和描述的机构，请修改后重试', 'error');
                return;
            }
            
            // 获取表单中的创建日期
            const createDateInput = document.getElementById('institutionCreateDateInput');
            const createDate = createDateInput ? new Date(createDateInput.value) : new Date();
            
            const newOrg = {
                    name,
                    code: CODE,
                    status: 0,
                    deptStatus: 0, // 设置部门状态默认值为0（启用）
                    description: departmentInput,
                    remark: remark,
                    createdAt: createDate,
                    updatedAt: new Date()
                };
            await dbManager.save('organizations', newOrg);
            showNotification('机构添加成功');
        }

        document.getElementById('institutionModal').style.display = 'none';
            // 延迟一小段时间确保数据完全保存
            loadOrganizations(false);
    } catch (error) {
        showNotification('保存机构失败: ' + error.message, 'error');
    }
}

// 切换部门状态函数
function toggleOrganizationStatus(button, orgId, currentStatus) {
    try {
        // 切换状态
        const newStatus = currentStatus === 0 ? 1 : 0;
        
        dbManager.getById('organizations', parseInt(orgId))
            .then(org => {
                if (org) {
                    // 更新部门状态 (在单部门模式下，部门信息存储在description字段)
                    // 为每个机构添加deptStatus字段来管理部门状态
                    if (!org.hasOwnProperty('deptStatus')) {
                        org.deptStatus = 0; // 默认启用状态
                    }
                    org.deptStatus = newStatus;
                    org.updatedAt = new Date();
                    
                    // 保存更新后的机构
                    dbManager.save('organizations', org)
                        .then(() => {
                            // 更新按钮状态
                            button.textContent = newStatus === 0 ? '停用' : '启用';
                            button.className = newStatus === 0 ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm';
                            
                            showNotification('部门状态已更新');
                            
                            // 重新加载机构数据以反映变化
                            loadOrganizations(false);
                            
                            // 重新加载人员管理的机构下拉框，确保机构可见性根据部门状态更新
                            loadOrganizationsForSelect();
                        })
                        .catch(error => {
                            showNotification('更新部门状态失败: ' + error.message, 'error');
                        });
                } else {
                    showNotification('未找到该机构', 'error');
                }
            })
            .catch(error => {
                showNotification('获取机构信息失败: ' + error.message, 'error');
            });
    } catch (error) {
        showNotification('切换部门状态失败: ' + error, 'error');
    }
}

// 存储当前的员工号筛选值
let currentEmployeeNumberFilter = '';

// 加载员工数据
window.loadEmployees = async function() {
    try {
        let employees = await dbManager.getAll('employees');
        const organizations = await dbManager.getAll('organizations');

        // 应用员工号筛选
        if (currentEmployeeNumberFilter) {
            const filterLower = currentEmployeeNumberFilter.toLowerCase();
            employees = employees.filter(emp => 
                emp.number && String(emp.number).toLowerCase().includes(filterLower)
            );
        }

        // 排序
        employees.sort((a, b) => {
            if (sortDirection === 'asc') {
                return a[sortField] > b[sortField] ? 1 : -1;
            } else {
                return a[sortField] < b[sortField] ? 1 : -1;
            }
        });

        // 分页
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedEmployees = employees.slice(startIndex, startIndex + itemsPerPage);

        // 渲染表格
        const tableBody = document.getElementById('emp-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        paginatedEmployees.forEach((emp, index) => {
            const row = document.createElement('tr');
            row.className = 'hover-row';

            // 序号（所有数据连续排序）
            const indexCell = document.createElement('td');
            indexCell.textContent = (currentPage - 1) * itemsPerPage + index + 1;
            row.appendChild(indexCell);

            // 工号
            const numberCell = document.createElement('td');
            numberCell.textContent = emp.number;
            row.appendChild(numberCell);

            // 姓名
            const nameCell = document.createElement('td');
            nameCell.textContent = emp.name;
            row.appendChild(nameCell);

            // 所属机构
        const orgCell = document.createElement('td');
        // 现在直接使用存储的机构名称
        orgCell.textContent = emp.orgName || '-';
        row.appendChild(orgCell);

            // 部门
            const deptCell = document.createElement('td');
            deptCell.textContent = emp.deptName || '-';
            row.appendChild(deptCell);

            // 职位
            const positionCell = document.createElement('td');
            positionCell.textContent = emp.position || '-';
            row.appendChild(positionCell);

            // 状态
            const statusCell = document.createElement('td');
            const statusText = document.createElement('span');
            
            // 将状态值转换为数字类型，确保正确处理不同类型的状态值
            // 根据用户要求：0是在职，1是离职，2是休假
            let statusDisplay = '-';
            const statusNumber = parseInt(emp.status);
            switch(statusNumber) {
                case 0: 
                    statusDisplay = '在职'; 
                    statusText.className = 'status-active';
                    break;
                case 1: 
                    statusDisplay = '离职'; 
                    statusText.className = 'status-inactive';
                    break;
                case 2: 
                    statusDisplay = '休假'; 
                    statusText.className = 'status-vacation';
                    break;
                default: statusDisplay = '-';
            }
            
            statusText.textContent = statusDisplay;
            statusCell.appendChild(statusText);
            row.appendChild(statusCell);

            // 操作
            const actionCell = document.createElement('td');
            actionCell.className = 'action-buttons';

            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-primary btn-sm';
            editBtn.textContent = '编辑';
            editBtn.onclick = () => {
                currentEmployeeId = emp.id;
                document.getElementById('employeeNumberInput').value = emp.number;
                document.getElementById('employeeNameInput').value = emp.name;
                document.getElementById('employeePositionInput').value = emp.position || '';
                // 状态选择 - 根据用户要求：0是在职，1是离职，2是休假
                const statusSelect = document.getElementById('employeeStatusInput');
                if (statusSelect) {
                    if (emp.status === 0) {
                        statusSelect.value = 'active'; // 在职
                    } else if (emp.status === 1) {
                        statusSelect.value = 'inactive'; // 离职
                    } else if (emp.status === 2) {
                        statusSelect.value = 'vacation'; // 休假
                    }
                }
                document.getElementById('employeeModalTitle').textContent = '编辑员工';
                document.getElementById('employeeIdInput').value = emp.id;
                  
                // 设置更新日期为当天
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`;
                document.getElementById('employeeCreateDateInput').value = formattedDate;
                  
                // 将日期标签改为更新日期
                document.querySelector('label[for="employeeCreateDateInput"]').textContent = '更新日期 *';
                  
                // 先刷新机构选择框，确保获取最新的机构状态
                loadOrganizationsForSelect(emp.orgName);
                
                document.getElementById('employeeModal').style.display = 'block';
                
                // 延迟加载部门，确保模态框已显示且机构选择框已刷新
                setTimeout(() => {
                    // 直接使用存储的机构名称
                    loadDepartmentsForSelect(emp.orgName, emp.deptName);
                }, 100);
            };
            actionCell.appendChild(editBtn);

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = () => deleteEmployee(emp.number);
            actionCell.appendChild(deleteBtn);

            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });

        // 更新分页
        updatePagination(employees.length, 'emp-pagination');
        
        console.log('已加载员工数据:', employees.length, '条');
    } catch (error) {
        showNotification('加载员工数据失败: ' + error.message, 'error');
    }
}

// 删除员工
// 重构为async/await版本以更好地处理Promise链和错误
async function deleteEmployee(employeeNumber) {
    try {
        // 验证员工号是否为空
        if (!employeeNumber) {
            throw new Error('无效的员工号');
        }
        
        // 将员工号统一转换为字符串类型
        employeeNumber = String(employeeNumber);
        
        // 步骤1: 通过员工号查找员工
        const employee = await window.identifierManager.findEmployeeByNumber(employeeNumber);
        
        if (!employee) {
            throw new Error('未找到员工号为 ' + employeeNumber + ' 的员工');
        }
        
        const empId = employee.id;
        console.log('找到员工:', employee.name, '员工ID:', empId);
        
        // 步骤2: 通过员工ID获取所有相关标识数据
        const identifiers = await window.identifierManager.getIdentifiersByEmployeeId(empId);
        
        // 步骤3: 逐个删除找到的标识数据
        if (identifiers.length > 0) {
            console.log('找到标识数据数量:', identifiers.length);
            
            // 为每个标识数据创建一个删除Promise
            const deletePromises = identifiers.map(identifier => {
                return window.dbManager.delete('identifiers', identifier.id)
                    .catch(err => {
                        console.error('删除标识数据失败:', identifier.id, err);
                        // 即使单个标识删除失败，也要继续尝试删除其他标识
                    });
            });
            
            // 等待所有标识数据删除操作完成
            await Promise.allSettled(deletePromises);
        } else {
            console.log('未找到员工相关的标识数据，跳过标识删除步骤');
        }
        
        // 步骤4: 先从排班顺序中移除员工
        if (window.shiftOrderManager && window.shiftOrderManager.removeEmployeeFromShiftOrder) {
            try {
                await window.shiftOrderManager.removeEmployeeFromShiftOrder(employeeNumber);
                console.log(`已从所有排班顺序中移除员工${employee.name}(${employeeNumber})`);
            } catch (shiftOrderErr) {
                console.error('从排班顺序中移除员工失败:', shiftOrderErr);
                // 即使移除失败，也继续删除员工数据
            }
        }
        
        // 步骤5: 删除员工数据
        try {
            await window.dbManager.delete('employees', employee.id);
            
            // 显示成功通知并刷新列表
            showNotification('员工 ' + employee.name + ' 删除成功');
            
            // 刷新相关数据列表，每个操作都有单独的错误处理
            try {
                loadEmployees();
            } catch (loadErr) {
                console.error('刷新员工列表失败:', loadErr);
            }
            
            try {
                loadOrganizations(false); // 更新部门人数
            } catch (loadOrgErr) {
                console.error('刷新部门列表失败:', loadOrgErr);
            }
            
            // 直接刷新排班表数据，确保排班表显示最新状态
            try {
                if (window.loadShiftOrderData) {
                    window.loadShiftOrderData();
                } else if (window.loadAllShiftOrders) {
                    window.loadAllShiftOrders();
                }
            } catch (loadScheduleErr) {
                console.error('刷新排班表数据失败:', loadScheduleErr);
            }
        } catch (deleteEmpErr) {
            console.error('删除员工数据失败:', deleteEmpErr);
            throw new Error('删除员工数据失败: ' + deleteEmpErr.message);
        }
        
    } catch (error) {
        console.error('删除员工过程中发生错误:', error);
        showNotification('删除员工失败: ' + (error.message || '未知错误'), 'error');
    }
}

// 机构下拉框变化事件
function onOrgChange() {
    const selectedOption = this.options[this.selectedIndex];
    const selectedOrgName = selectedOption.value;
    const deptSelect = document.getElementById('employeeDeptNameInput');
    if (deptSelect) {
        // 启用部门选择框
        deptSelect.disabled = false;
        if (selectedOrgName) {
            // 直接使用选中的机构名称
            loadDepartmentsForSelect(selectedOrgName);
        } else {
            deptSelect.innerHTML = '<option value="">请选择部门</option>';
        }
    }
}

// 加载机构数据到下拉框
function loadOrganizationsForSelect(selectedOrgName = null) {
    try {
        dbManager.getAll('organizations')
            .then(organizations => {
                // 不再使用全局缓存，直接从数据库获取机构信息
                const select = document.getElementById('employeeOrgIdInput');
                if (!select) {
                    console.error('未找到employeeOrgIdInput元素');
                    return;
                }

                select.innerHTML = '<option value="">请选择机构</option>';
                // 使用Set来跟踪已添加的机构名称，避免重复
                const addedOrganizations = new Set();

                // 加载部门状态为启用的机构，或者是员工所属的机构
                // 根据需求：当机构下所有部门都是停用状态时，该机构不出现在人员管理的下拉框中
                organizations.forEach(org => {
                    if (org.name && !addedOrganizations.has(org.name) && 
                        // 只显示部门状态为启用的机构，或者是员工当前所属的机构
                        ((org.deptStatus === undefined || org.deptStatus === 0) || 
                         (selectedOrgName !== null && org.name === selectedOrgName))) {
                        const option = document.createElement('option');
                        option.value = org.name;
                        option.textContent = org.name;
                        if (selectedOrgName !== null && org.name === selectedOrgName) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                        addedOrganizations.add(org.name);
                    }
                });

                // 移除可能存在的旧监听器
                select.removeEventListener('change', onOrgChange);
                // 添加新的监听器
                select.addEventListener('change', onOrgChange);

                // 如果有选中的机构，加载部门
                if (selectedOrgName !== null) {
                    // 直接使用选中的机构名称
                    loadDepartmentsForSelect(selectedOrgName);
                    // 启用部门选择框
                    const deptSelect = document.getElementById('employeeDeptNameInput');
                    if (deptSelect) {
                        deptSelect.disabled = false;
                    }
                } else if (select.options.length > 1) {  // 大于1是因为有"请选择机构"选项
                    // 默认选择第一个机构
                    select.selectedIndex = 1;
                    // 直接使用选中的机构名称
                    const firstOrgName = select.options[1].value;
                    loadDepartmentsForSelect(firstOrgName);
                    // 启用部门选择框
                    const deptSelect = document.getElementById('employeeDeptNameInput');
                    if (deptSelect) {
                        deptSelect.disabled = false;
                    }
                }
            })
            .catch(error => {
                showNotification('加载机构数据失败: ' + error.message, 'error');
            });
    } catch (error) {
        showNotification('加载机构数据失败: ' + error, 'error');
    }
}

// 加载部门数据到下拉框 - 仅使用description字段
function loadDepartmentsForSelect(orgName, selectedDept = '') {
    try {
        // 获取所有机构，找到名称匹配的所有机构，并且部门状态为启用
        dbManager.getAll('organizations')
            .then(allOrganizations => {
                const deptSelect = document.getElementById('employeeDeptNameInput');
                if (!deptSelect) {
                    console.error('未找到employeeDeptNameInput元素');
                    return;
                }

                // 查找所有名称匹配的机构，并且部门状态为启用（deptStatus为0或未定义）
                // 或者是员工当前所属的部门，即使其部门状态已禁用（用于编辑员工场景）
                let matchingOrgs = allOrganizations.filter(o => o.name === orgName && 
                                                                 (o.deptStatus === undefined || o.deptStatus === 0));
                
                // 如果有选中的部门，且该部门不存在于matchingOrgs中，需要单独处理
                if (selectedDept) {
                    const selectedOrg = allOrganizations.find(o => o.name === orgName && o.description === selectedDept);
                    if (selectedOrg && !matchingOrgs.some(o => o.description === selectedDept)) {
                        // 将该特定机构添加到matchingOrgs中，确保编辑现有员工时能看到其所属部门
                        matchingOrgs.push(selectedOrg);
                    }
                }
                
                deptSelect.innerHTML = '<option value="">请选择部门</option>';
                
                // 使用Set进行部门去重
                const uniqueDepartments = new Set();
                
                // 收集所有匹配机构的部门（仅使用description字段）
                matchingOrgs.forEach(org => {
                    if (org.description) {
                        uniqueDepartments.add(org.description);
                    }
                });
                
                // 将去重后的部门添加到下拉框
                uniqueDepartments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    // 确保部门选中逻辑正确
                    if (dept === selectedDept) {
                        option.selected = true;
                    }
                    deptSelect.appendChild(option);
                });
                
                // 检查是否有部门
                if (deptSelect.options.length <= 1) {
                    // 如果没有部门，添加一个提示选项
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = '该机构下暂无部门';
                    option.disabled = true;
                    deptSelect.appendChild(option);
                }
                
                // 如果提供了selectedDept但没有匹配的选项，手动设置选中
                if (selectedDept && !Array.from(uniqueDepartments).includes(selectedDept)) {
                    // 添加自定义部门选项
                    const customOption = document.createElement('option');
                    customOption.value = selectedDept;
                    customOption.textContent = selectedDept;
                    customOption.selected = true;
                    deptSelect.appendChild(customOption);
                }
                
                // 强制触发change事件，确保表单状态正确更新
                if (typeof Event === 'function') {
                    deptSelect.dispatchEvent(new Event('change'));
                } else {
                    // IE兼容模式
                    const event = document.createEvent('Event');
                    event.initEvent('change', true, true);
                    deptSelect.dispatchEvent(event);
                }
            })
            .catch(error => {
                showNotification('加载部门数据失败: ' + error.message, 'error');
            });
    } catch (error) {
        showNotification('加载部门数据失败: ' + error, 'error');
    }
}

// 初始化选项卡函数
window.initTabs = function() {
    const tabButtons = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            // 移除所有活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 添加活动状态到当前按钮
            button.classList.add('active');

            // 显示对应内容
            const target = button.dataset.tab + '-tab';
            document.getElementById(target).classList.add('active');
            
            // 添加：当切换到班次管理选项卡时，重新加载班次数据
            if (button.dataset.tab === 'shifts' && window.loadShifts) {
                console.log('切换到班次管理选项卡，正在加载班次数据...');
                window.loadShifts();
            }
            
            // 添加：当切换到标识管理选项卡时，重新初始化筛选框
            if (button.dataset.tab === 'identifiers') {
                console.log('切换到标识管理选项卡，正在初始化筛选框并加载数据...');
                // 保存当前选中的部门值
                const identifierDeptFilterBefore = document.getElementById('identifierDeptFilter');
                const selectedDept = identifierDeptFilterBefore ? identifierDeptFilterBefore.value : '';
                
                // 初始化部门和岗位筛选框
                if (window.loadDepartmentsForFilter) {
                    await window.loadDepartmentsForFilter();
                }
                
                // 初始化岗位筛选框，只显示"全部岗位"
                const identifierPositionFilter = document.getElementById('identifierPositionFilter');
                if (identifierPositionFilter) {
                    identifierPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                }
                // 不再加载具体岗位数据，只有当用户明确选择部门时才加载
                // 添加：在筛选框初始化后调用loadIdentifierData加载数据
                if (window.loadIdentifierData) {
                    window.loadIdentifierData();
                }
            }
            
            // 添加：当切换到排班顺序管理选项卡时，重新初始化筛选框
            if (button.dataset.tab === 'shiftOrders') {
                console.log('切换到排班顺序管理选项卡，正在初始化筛选框并加载数据...');
                // 保存当前选中的部门值
                const shiftOrderDeptFilterBefore = document.getElementById('shiftOrderDeptFilter');
                const selectedDept = shiftOrderDeptFilterBefore ? shiftOrderDeptFilterBefore.value : '';
                
                // 初始化部门和岗位筛选框
                if (window.loadDepartmentsForFilter) {
                    await window.loadDepartmentsForFilter();
                }
                
                // 初始化岗位筛选框，只显示"全部岗位"
                const shiftOrderPositionFilter = document.getElementById('shiftOrderPositionFilter');
                if (shiftOrderPositionFilter) {
                    shiftOrderPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                }
                // 不再加载具体岗位数据，只有当用户明确选择部门时才加载
                // 添加：在筛选框初始化后调用loadShiftOrderData加载数据
                if (window.loadShiftOrderData) {
                    window.loadShiftOrderData();
                }
            }
        });
    });
}

// 导入导出功能初始化
window.initImportExportEvents = function() {
    // 检查是否已经存在导入导出按钮容器
    let buttonContainer = document.querySelector('.import-export-container');
    
    // 如果不存在，创建新容器
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'import-export-container';
        buttonContainer.style.margin = '20px 0';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';

        // 导出数据按钮
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-primary';
        exportBtn.textContent = '导出数据';
        exportBtn.onclick = function() {
            // 导出数据前先刷新缓存
            console.log('导出数据前刷新缓存...');
            
            // 检查并调用ShiftOrderManager的clearCache方法
            if (window.shiftOrderManager && typeof window.shiftOrderManager.clearCache === 'function') {
                try {
                    window.shiftOrderManager.clearCache();
                    console.log('排班顺序管理器缓存已清除');
                } catch (err) {
                    console.warn('清除缓存时出错:', err);
                }
            } else {
                // 如果没有clearCache方法，尝试直接清空可能存在的缓存对象
                if (window.shiftOrderManager) {
                    window.shiftOrderManager.cache = {};
                    window.shiftOrderManager.shiftOrdersCache = {};
                    window.shiftOrderManager.employeeCache = {};
                    console.log('已尝试清空可能存在的缓存对象');
                }
            }
            
            // 执行数据导出
            dbManager.exportDatabaseData()
                .then(data => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'schedule_data_' + new Date().toISOString().slice(0, 10) + '.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showNotification('数据导出成功');
                })
                .catch(error => {
                    showNotification('数据导出失败: ' + error.message, 'error');
                });
        };

        // 导入数据按钮
        const importBtn = document.createElement('button');
        importBtn.className = 'btn btn-primary';
        importBtn.textContent = '导入数据';
        importBtn.onclick = function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const data = JSON.parse(event.target.result);
                        dbManager.importData(data)
                            .then(() => {
                                showNotification('数据导入成功');
                                // 延迟一小段时间确保数据完全保存
                                setTimeout(() => {
                                    loadOrganizations();
                                    loadEmployees();
                                    if (window.loadShifts) {
                                        window.loadShifts();
                                    }
                                }, 500);
                            })
                            .catch(error => {
                                showNotification('数据导入失败: ' + error.message, 'error');
                            });
                    } catch (error) {
                        showNotification('文件解析失败: ' + error.message, 'error');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        // 添加按钮到容器
        buttonContainer.appendChild(exportBtn);
        buttonContainer.appendChild(importBtn);

        // 添加到页面的content-header中
        const contentHeader = document.querySelector('.content-header');
        if (contentHeader) {
            contentHeader.appendChild(buttonContainer);
        } else {
            // 如果没找到content-header，回退到main-content
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.insertBefore(buttonContainer, mainContent.firstChild);
            }
        }

        // 添加小号文本注释说明导入导出功能
        let usageNote = document.querySelector('.import-export-note');
        if (!usageNote) {
            usageNote = document.createElement('div');
            usageNote.className = 'import-export-note';
            usageNote.style.fontSize = '12px';
            usageNote.style.color = '#666';
            usageNote.style.marginTop = '5px';
            usageNote.style.marginLeft = '10px';
            usageNote.textContent = '导出数据：备份当前系统中的所有基础设置数据；导入数据：从备份文件恢复基础设置数据（会覆盖现有数据）。';
            
            // 将注释添加到按钮容器的后面
            if (buttonContainer.parentNode) {
                buttonContainer.parentNode.insertBefore(usageNote, buttonContainer.nextSibling);
            }
        }
    }
}

// 部门管理功能（已移除）
// 加载部门数据
window.loadDepartments = function() {
    showNotification('部门管理功能已移除', 'warning');
}

// 切换部门状态
window.toggleDepartmentStatus = function() {
    showNotification('部门管理功能已移除', 'warning');
}

// 编辑部门
function editDepartment() {
    showNotification('部门管理功能已移除', 'warning');
}



// 显示添加部门模态框
function showAddDepartmentModal() {
    showNotification('部门管理功能已移除', 'warning');
}

// 加载机构数据到部门表单的下拉框
function loadOrganizationsForDepartmentSelect() {
    showNotification('部门管理功能已移除', 'warning');
}

// 保存部门
async function saveDepartment(e) {
    e.preventDefault();
    showNotification('部门管理功能已移除', 'warning');
}

// 设置创建日期默认值为当前日期
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('institutionCreateDateInput').value = today;
    document.getElementById('employeeCreateDateInput').value = today;
}

// 导入员工相关功能
function initImportEmployeeEvents() {
    // 导入员工按钮点击事件
    document.getElementById('importEmployeeBtn').addEventListener('click', function() {
        document.getElementById('employeeImportModal').style.display = 'flex';
    });

    // 关闭员工导入模态框
    window.closeEmployeeImportModal = function() {
        // 清空文件选择
        const fileInput = document.getElementById('employeeFileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        // 隐藏模态框
        document.getElementById('employeeImportModal').style.display = 'none';
    };

    // 下载模板 - 动态生成Excel文件
    document.getElementById('downloadTemplateBtn').addEventListener('click', function(e) {
        e.preventDefault();
        
        console.log('开始动态生成员工导入模板');
        
        try {
            // 定义Excel文件的表头字段（根据导入函数的要求）
            const headers = ['员工号', '姓名', '所属机构', '所属部门', '岗位'];
            
            // 创建工作簿
            const wb = XLSX.utils.book_new();
            
            // 创建工作表数据（包含表头和一行示例数据）
            const wsData = [
                headers, // 表头行
                ['EMP001', '张三', '示例机构', '示例部门', '示例岗位'] // 示例数据行
            ];
            
            // 创建工作表
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // 设置列宽
            const colWidths = [
                {wch: 12}, // 员工号
                {wch: 10}, // 姓名
                {wch: 15}, // 所属机构
                {wch: 15}, // 所属部门
                {wch: 15} // 岗位
            ];
            ws['!cols'] = colWidths;
            
            // 将工作表添加到工作簿
            XLSX.utils.book_append_sheet(wb, ws, '员工信息');
            
            // 生成Excel文件并下载
            XLSX.writeFile(wb, '员工导入模板.xlsx');
            
            console.log('员工导入模板生成并下载成功');
        } catch (error) {
            console.error('生成模板时出错:', error);
            showNotification('生成模板失败，请重试', 'error');
        }
    });

    // 导入状态显示函数
    function showImportStatus(type, message) {
        const statusContainer = document.getElementById('importStatusContainer');
        const statusElement = document.getElementById('importStatus');
        
        // 设置状态类型和消息
        statusElement.className = 'import-status ' + type;
        
        if (type === 'loading') {
            statusElement.innerHTML = '<div class="loading-spinner"></div>' + message;
        } else {
            let icon = '';
            switch(type) {
                case 'success':
                    icon = '<i class="fas fa-check-circle"></i> ';
                    break;
                case 'error':
                    icon = '<i class="fas fa-exclamation-circle"></i> ';
                    break;
                case 'info':
                    icon = '<i class="fas fa-info-circle"></i> ';
                    break;
            }
            statusElement.innerHTML = icon + message;
        }
        
        // 显示状态容器
        statusContainer.style.display = 'block';
    }

    // 隐藏导入状态
    function hideImportStatus() {
        const statusContainer = document.getElementById('importStatusContainer');
        statusContainer.style.display = 'none';
    }

    // 导入员工
    window.importEmployees = function() {
        const fileInput = document.getElementById('employeeFileInput');
        if (!fileInput.files || fileInput.files.length === 0) {
            showImportStatus('error', '请选择Excel文件');
            setTimeout(hideImportStatus, 3000);
            return;
        }

        const file = fileInput.files[0];
        // 检查文件类型
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            showImportStatus('error', '请选择.xlsx或.xls格式的Excel文件');
            setTimeout(hideImportStatus, 3000);
            return;
        }

        // 显示加载状态
        showImportStatus('loading', '正在导入员工数据，请稍候...');

        // 使用SheetJS (xlsx) 库解析Excel文件
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // 获取系统中的所有机构
                const organizations = await dbManager.getAll('organizations');
                
                let successCount = 0;
                let errorCount = 0;
                const errorMessages = [];

                // 处理每一行数据
                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const rowNum = i + 2; // 表格从第2行开始是数据行
                    
                    try {
                        // 检查必要字段
                        if (!row['员工号'] || !row['姓名'] || !row['所属机构'] || !row['所属部门'] || !row['岗位']) {
                            throw new Error(`第${rowNum}行缺少必要字段（员工号、姓名、所属机构、所属部门、岗位）`);
                        }

                        // 检查员工号是否重复
                        const existingEmployees = await dbManager.getByIndex('employees', 'number', row['员工号']);
                        if (existingEmployees && existingEmployees.length > 0) {
                            throw new Error(`第${rowNum}行：员工号"${row['员工号']}"重复，该员工已存在`);
                        }

                        // 获取机构名称和部门名称
                        const orgName = row['所属机构'];
                        const deptName = row['所属部门'];
                        
                        // 检查机构是否存在
                        const matchingOrg = organizations.find(org => org.name === orgName);
                        if (!matchingOrg) {
                            throw new Error(`第${rowNum}行：机构"${orgName}"不存在`);
                        }
                        
                        // 检查部门是否存在
                        const matchingDept = organizations.find(org => 
                            org.name === orgName && 
                            org.description === deptName &&
                            (org.deptStatus === undefined || org.deptStatus === 0)
                        );
                        
                        if (!matchingDept) {
                            // 尝试查找是否存在该部门，即使它被停用了
                            const deactivatedDept = organizations.find(org => 
                                org.name === orgName && 
                                org.description === deptName
                            );
                            
                            if (deactivatedDept && deactivatedDept.deptStatus === 1) {
                                throw new Error(`第${rowNum}行：部门"${deptName}"已被停用`);
                            } else {
                                throw new Error(`第${rowNum}行：机构"${orgName}"下不存在部门"${deptName}"`);
                            }
                        }

                        // 构建员工对象
                        const employee = {
                            number: row['员工号'] || '',
                            name: row['姓名'],
                            orgName: row['所属机构'], // 使用机构名称而不是ID
                            deptName: row['所属部门'],
                            position: row['岗位'],
                            status: row['状态'] !== undefined && row['状态'] !== null && row['状态'] !== '' ? row['状态'] : 0, // 模板没有状态字段时默认设置为0-在职状态
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        // 保存到IndexedDB
                        await dbManager.save('employees', employee);
                        successCount++;
                    } catch (error) {
                        errorCount++;
                        // 安全地获取错误信息，避免null对象错误
                        const errorMsg = error && error.message ? error.message : '未知错误';
                        errorMessages.push(errorMsg);
                        // 继续处理下一行，不中断整个导入过程
                    }
                }

                // 刷新员工列表
                loadEmployees();
                
                // 导入成功后自动刷新排班数据，添加延迟确保数据完全保存
                setTimeout(() => {
                    if (window._reloadShiftOrderData) {
                        window._reloadShiftOrderData();
                    } else if (typeof _reloadShiftOrderData === 'function') {
                        _reloadShiftOrderData();
                    }
                }, 300);
                
                // 导入完成后显示结果弹窗
                if (errorCount === 0) {
                    if (confirm(`成功导入${successCount}名员工！`)) {
                        // 清空文件选择并关闭模态框
                        const fileInput = document.getElementById('employeeFileInput');
                        if (fileInput) {
                            fileInput.value = '';
                        }
                        document.getElementById('employeeImportModal').style.display = 'none';
                        hideImportStatus();
                    }
                } else {
                    // 如果有错误，在控制台显示详细错误信息
                    console.error('员工导入错误：', errorMessages);
                    if (confirm(`成功导入${successCount}名员工，${errorCount}条记录导入失败！\n点击确定查看详情。`)) {
                        alert(errorMessages.join('\n'));
                        // 清空文件选择并关闭模态框
                        const fileInput = document.getElementById('employeeFileInput');
                        if (fileInput) {
                            fileInput.value = '';
                        }
                        document.getElementById('employeeImportModal').style.display = 'none';
                        hideImportStatus();
                    }
                }

            } catch (error) {
                // 显示错误信息，安全地处理可能的null错误对象
                const errorMsg = error && error.message ? error.message : '未知错误';
                showImportStatus('error', '导入失败：' + errorMsg);
                setTimeout(() => {
                    hideImportStatus();
                    document.getElementById('employeeImportModal').style.display = 'none';
                }, 3000);
            }
        };

        reader.onerror = function() {
            showImportStatus('error', '文件读取失败，请重试');
            setTimeout(() => {
                hideImportStatus();
            }, 3000);
        };

        reader.readAsArrayBuffer(file);
    };
}

// 初始化函数
window.initBaseSettings = function() {
    // 设置默认日期
    setDefaultDates();

    // 初始化导入员工事件
    initImportEmployeeEvents();
    // 绑定添加机构按钮事件
    // 注意：页面上没有id为'addInstitutionBtn'的元素，而是使用了onclick事件
    // 这里保留代码但添加检查，防止报错
    const addInstitutionBtn = document.getElementById('addInstitutionBtn');
    if (addInstitutionBtn) {
        addInstitutionBtn.addEventListener('click', showAddOrganizationModal);
    } else {
        console.log('未找到addInstitutionBtn元素，使用内联onclick事件');
    }

    // 绑定添加员工按钮事件
    document.getElementById('addEmployeeBtn').addEventListener('click', function() {
        currentEmployeeId = null;
        document.getElementById('employeeForm').reset();
    // 修正ID：employeeId -> employeeIdInput
    document.getElementById('employeeIdInput').value = '';
        document.getElementById('employeeModalTitle').textContent = '添加员工';
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('employeeCreateDateInput').value = today;
        // 将日期标签改为创建日期
        document.querySelector('label[for="employeeCreateDateInput"]').textContent = '创建日期 *';
        loadOrganizationsForSelect();
        document.getElementById('employeeModal').style.display = 'flex';
    });

    // 绑定员工表单提交事件
    document.getElementById('employeeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const number = document.getElementById('employeeNumberInput').value.trim();
            const name = document.getElementById('employeeNameInput').value.trim();
            const orgName = document.getElementById('employeeOrgIdInput').value;
            const position = document.getElementById('employeePositionInput').value.trim();
            const statusSelect = document.getElementById('employeeStatusInput');
            let status = 0;
            if (statusSelect) {
                status = statusSelect.value === 'active' ? 0 : (statusSelect.value === 'inactive' ? 1 : 2);
            }
            const idInput = document.getElementById('employeeIdInput');
            const id = idInput.value ? parseInt(idInput.value) : null;

            if (!number || !name || !orgName) {
                showNotification('工号、姓名和所属机构不能为空', 'warning');
                return;
            }

            // 验证机构状态
            const allOrgs = await dbManager.getAll('organizations');
            const org = allOrgs.find(o => o.name === orgName);
            if (!org) {
                showNotification('所选机构不存在', 'warning');
                return;
            }
            
            // 只有在添加新员工时才验证机构是否启用
            // 编辑现有员工时允许在停用机构中更新
            if (!id && org.status !== 0) {
                showNotification('所选机构未启用，无法添加新员工', 'warning');
                return;
            }

            if (id) {
                // 更新现有员工
                const emp = await dbManager.getById('employees', parseInt(id));
                if (emp) {
                    const updatedEmp = {
                        ...emp,
                        number,
                        name,
                        orgName: orgName, // 直接存储机构名称
                        deptName: document.getElementById('employeeDeptNameInput').value, // 注意：这里使用的是机构的description值
                        position,
                        status,
                        updatedAt: new Date()
                    };
                    await dbManager.save('employees', updatedEmp);
                    showNotification('员工更新成功');
                }
            } else {
                // 新增员工
                const newEmp = {
                    number,
                    name,
                    orgName: orgName, // 直接存储机构名称
                    deptName: document.getElementById('employeeDeptNameInput').value,
                    position,
                    status,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await dbManager.save('employees', newEmp);
                showNotification('员工添加成功');
            }

            document.getElementById('employeeModal').style.display = 'none';
            // 延迟一小段时间确保数据完全保存
            setTimeout(() => {
                loadEmployees();
                
                // 如果是新增员工，刷新排班顺序
                if (!id) {
                    // 重新获取刚保存的员工完整信息（包含ID）
                    dbManager.getAll('employees')
                        .then(employees => {
                            // 查找最新添加的员工（按创建时间排序）
                            const newEmployee = employees
                                .filter(emp => emp.number === number && emp.name === name)
                                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                            
                            if (newEmployee) {
                                // 参考identifier-management.js中的事件驱动方式
                                notifyShiftOrderManagerAboutEmployeeChange({
                                    id: newEmployee.id,
                                    number: newEmployee.number,
                                    name: newEmployee.name,
                                    position: newEmployee.position,
                                    status: newEmployee.status
                                }, 'added');
                            } else {
                                console.error('未找到刚添加的员工信息');
                                // 作为备用方案，直接刷新排班表
                                if (window.loadShiftOrderData) {
                                    window.loadShiftOrderData();
                                }
                            }
                        })
                        .catch(error => {
                            console.error('获取员工信息失败:', error);
                            // 作为备用方案，直接刷新排班表
                            if (window.loadShiftOrderData) {
                                window.loadShiftOrderData();
                            }
                        });
                }
            }, 300);
        } catch (error) {
            showNotification('保存员工失败: ' + error.message, 'error');
        }
    });

    // 新增方法：通知排班管理器关于员工变更
    function notifyShiftOrderManagerAboutEmployeeChange(employee, changeType) {
        try {
            // 触发员工变更事件，包含员工信息和变更类型
            const event = new CustomEvent('employeeAdded', {
                detail: {
                    employee: employee,
                    changeType: changeType
                }
            });
            window.dispatchEvent(event);
            
            console.log(`已通知排班管理器：员工${employee.name}已${changeType === 'added' ? '添加' : '修改'}`);
            
            // 延迟一小段时间后触发排班数据刷新事件，确保员工ID完全生成
            setTimeout(() => {
                try {
                    const refreshEvent = new CustomEvent('shiftDataChanged', { 
                        detail: { 
                            reason: 'employeeAdded',
                            employeeId: employee.id,
                            employeeNumber: employee.number
                        } 
                    });
                    window.dispatchEvent(refreshEvent);
                    console.log('已触发shiftDataChanged事件通知排班数据刷新');
                } catch (refreshError) {
                    console.error('触发shiftDataChanged事件失败:', refreshError);
                }
            }, 500);
        } catch (error) {
            console.error('通知排班管理器关于员工变更失败:', error);
            
            // 如果事件触发失败，作为备用方案直接调用刷新函数
            try {
                setTimeout(() => {
                    if (window._reloadShiftOrderData) {
                        window._reloadShiftOrderData().catch(err => console.error('备用方案刷新失败:', err));
                    } else if (window.loadShiftOrderData) {
                        window.loadShiftOrderData().catch(err => console.error('备用方案刷新失败:', err));
                    } else if (window.loadAllShiftOrders) {
                        window.loadAllShiftOrders().catch(err => console.error('备用方案刷新失败:', err));
                    }
                }, 500);
            } catch (fallbackError) {
                console.error('备用刷新方案执行失败:', fallbackError);
            }
        }
    }

    // 关闭员工模态框
    document.querySelector('#employeeModal .modal-close').addEventListener('click', function() {
        document.getElementById('employeeModal').style.display = 'none';
    });

    // 取消按钮
    document.querySelector('#employeeForm .btn-secondary').addEventListener('click', function() {
        document.getElementById('employeeModal').style.display = 'none';
    });

    // 机构下拉框变化事件
    const employeeOrgIdInput = document.getElementById('employeeOrgIdInput');
    if (employeeOrgIdInput) {
        employeeOrgIdInput.addEventListener('change', onOrgChange);
    } else {
        console.log('未找到employeeOrgIdInput元素');
    }

    // 关闭模态框（包括员工导入模态框）
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    document.querySelectorAll('.btn-secondary').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    // 点击模态框外部关闭模态框
    document.querySelectorAll('.modal').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // 绑定表单提交事件
    document.getElementById('institutionForm').addEventListener('submit', saveOrganization);

    // 删除部门（按机构名称+部门名称匹配）
    window.deleteOrganization = async function() {
        try {
            // 获取表单数据 - 注意：deleteOrganizationId存储的是"机构名称 - 部门名称"格式
            const deleteOrganizationIdInput = document.getElementById('deleteOrganizationId');
            const fullName = deleteOrganizationIdInput ? deleteOrganizationIdInput.value : '';
            
            console.log(`从隐藏输入框获取到完整名称: ${fullName}`);
            
            // 验证完整名称
            if (!fullName.trim()) {
                console.error('未获取到有效的机构和部门信息');
                showNotification('请选择有效的机构和部门', 'error');
                return;
            }
            
            // 解析机构名称和部门名称
            const parts = fullName.split(' - ');
            let orgName = parts[0] || '';
            let deptName = parts.length > 1 ? parts[1] : '';
            
            console.log(`解析得到：机构名称=${orgName}, 部门名称=${deptName}`);
            
            // 验证机构名称和部门名称
            if (!orgName.trim()) {
                console.error('未获取到有效的机构名称');
                showNotification('请选择有效的机构', 'error');
                return;
            }
            
            if (!deptName) {
                showNotification('请指定要删除的部门', 'error');
                return;
            }
            
            // 通过机构名称获取所有匹配的机构信息 - 注意：一个机构名称可能对应多个机构ID
            const allOrganizations = await window.dbManager.getAll('organizations');
            const matchedOrganizations = allOrganizations.filter(org => org.name === orgName);
            
            if (matchedOrganizations.length === 0) {
                showNotification('未找到指定的机构', 'error');
                return;
            }
            
            // 计算符合条件的部门记录数量（机构名称+部门名称都匹配）
            const matchingDepartmentCount = matchedOrganizations.filter(org => org.description === deptName).length;
            console.log(`执行部门删除操作: 机构名称=${orgName}, 部门名称=${deptName}, 匹配到${matchedOrganizations.length}个机构记录，其中符合条件的部门记录有${matchingDepartmentCount}个`);
            
            // 第一步：获取所有员工信息
            const employees = await window.dbManager.getAll('employees');
            
            // 严格的员工筛选逻辑，确保精确匹配该机构名称+部门名称的员工
            const deptEmployees = employees.filter(emp => {
                // 检查员工对象是否有效
                if (!emp) {
                    return false;
                }
                
                // 员工部门名称处理，保持与其他地方一致的比较逻辑
                const empDeptName = emp.deptName ? emp.deptName.toString().trim() : '';
                const targetDeptName = deptName.toString().trim();
                
                // 从预加载的机构映射表中获取机构名称
                // 直接使用员工数据中存储的机构名称
                const empOrgName = emp.orgName || '';
                
                // 检查员工是否属于该机构（通过机构名称匹配）
                const isCorrectOrg = empOrgName === orgName;
                
                // 检查员工是否属于该部门（严格精确匹配）
                const isCorrectDept = empDeptName === targetDeptName;
                
                // 详细的调试日志，记录所有员工的筛选过程
                console.log(`[员工筛选调试] 员工: ${emp.name || '未知'}, 机构: ${empOrgName}, 部门: ${empDeptName}, 目标机构: ${orgName}, 目标部门: ${targetDeptName}, 机构匹配: ${isCorrectOrg}, 部门匹配: ${isCorrectDept}`);
                
                return isCorrectOrg && isCorrectDept;
            });
            
            // 额外的调试信息
            console.log(`[部门匹配调试] 目标部门名称: "${deptName}", 转义后: "${JSON.stringify(deptName)}", 长度: ${deptName.length}`);
            
            // 计算机构匹配的员工数量（使用预加载的机构映射表）
            const orgMatchingEmployees = [];
            
            for (const emp of employees) {
                if (!emp) continue;
                try {
                    // 直接使用员工数据中存储的机构名称
                    const empOrgName = emp.orgName || '';
                    if (empOrgName === orgName) {
                        orgMatchingEmployees.push(emp);
                    }
                } catch (error) {
                    console.error('获取员工所属机构信息失败:', error);
                }
            }
            
            console.log(`[部门匹配调试] 员工总数: ${employees.length}, 其中机构匹配的员工数量: ${orgMatchingEmployees.length}`);
        
        console.log(`获取到部门 ${deptName} 的员工数量: ${deptEmployees.length}`);
        
        // 第二步：强制删除该部门下的所有员工，确保联动删除
        let allEmployeesDeleted = true;
        
        if (deptEmployees.length > 0) {
            console.log(`开始强制删除部门(${deptName})下的所有员工...`);
            
            // 使用for循环按顺序删除，确保每个员工都被正确处理
            for (const emp of deptEmployees) {
                try {
                    console.log(`正在删除部门员工: ${emp.name || '未知'} (${emp.number || '无编号'}), 员工ID: ${emp.id}, 部门: ${emp.deptName}, 机构: ${emp.orgName || '未知'}`);
                    
                    // 1. 验证员工信息完整性（增加容错性）
                    if (!emp) {
                        console.warn(`跳过删除: 员工信息不完整`);
                        allEmployeesDeleted = false;
                        continue;
                    }
                    
                    // 2. 通过员工号获取所有相关标识数据
                    if (emp.number) {
                        try {
                            const identifiers = await window.identifierManager.getIdentifiersByEmployeeNumber(emp.number);
                            
                            // 3. 逐个删除找到的标识数据
                            if (identifiers.length > 0) {
                                for (const identifier of identifiers) {
                                    try {
                                        await window.dbManager.delete('identifiers', identifier.id);
                                        console.log(`成功删除员工 ${emp.name} 的标识数据: ${identifier.id}`);
                                    } catch (idErr) {
                                        console.error(`删除标识数据失败:`, identifier.id, idErr);
                                        // 继续尝试删除其他数据
                                    }
                                }
                            }
                        } catch (idMgrErr) {
                            console.error(`获取员工标识数据时出错:`, idMgrErr);
                            // 继续尝试删除员工数据
                        }
                    }
                    
                    // 4. 直接删除员工数据（使用更健壮的方式）
                    if (emp.id) {
                        try {
                            await window.dbManager.delete('employees', emp.id);
                            console.log(`员工 ${emp.name || '未知'} (${emp.number || '无编号'}) 删除成功`);
                        } catch (deleteErr) {
                            console.error(`删除员工失败:`, emp.id, deleteErr);
                            allEmployeesDeleted = false;
                        }
                    } else {
                        console.warn(`无法删除员工 ${emp.name || '未知'}: 员工ID不存在`);
                        allEmployeesDeleted = false;
                    }
                } catch (err) {
                    console.error(`处理员工删除时发生异常:`, err);
                    allEmployeesDeleted = false;
                }
                }
                
                console.log(`部门员工删除操作完成，所有员工已${allEmployeesDeleted ? '成功' : '部分'}删除`);
            }
            
            // 第三步：删除部门前，先清空该部门在排班顺序中的员工数据
            if (window.shiftOrderManager) {
                try {
                    console.log(`开始清空排班顺序中的部门(${deptName})员工数据...`);
                    // 只使用专门的部门删除函数，避免影响同一机构下的其他部门
                    if (window.shiftOrderManager.updateShiftOrderWhenDepartmentDeleted) {
                        // 只对部门名称也匹配的机构清空排班数据
                        const matchingDepartments = matchedOrganizations.filter(org => org.description === deptName);
                        for (const org of matchingDepartments) {
                            try {
                                await window.shiftOrderManager.updateShiftOrderWhenDepartmentDeleted(org.id);
                                console.log(`已清空机构ID=${org.id}（部门=${deptName}）的排班顺序数据`);
                            } catch (singleShiftOrderError) {
                                console.error(`清空单个机构排班顺序数据时出错:`, org.id, singleShiftOrderError);
                                // 继续处理其他机构
                            }
                        }
                        console.log(`已对${matchingDepartments.length}个符合条件的部门(${deptName})清空排班顺序数据`);
                        console.log(`部门(${deptName})删除前已清空所有匹配机构的排班顺序数据`);
                    } else {
                        console.warn('排班顺序管理器中未找到专门的部门删除函数，但不会使用机构删除函数作为替代');
                        console.warn('这可能导致排班数据未被正确清理，但不会影响其他部门的员工');
                    }
                } catch (shiftOrderError) {
                    console.error('清空排班顺序数据时出错:', shiftOrderError);
                    // 即使清空排班顺序失败，也要继续删除流程，但不会使用机构删除函数
                }
            }
            
            // 第四步：处理机构部门记录
            let allRecordsProcessed = true;
            
            try {
                console.log(`准备处理机构(${orgName})下的部门(${deptName})记录`);
                
                // 遍历所有匹配的机构记录，但只处理部门名称匹配的记录
                for (const org of matchedOrganizations) {
                    // 只处理部门名称匹配的记录
                    if (org.description === deptName) {
                        try {
                            console.log(`处理机构(${orgName})下的部门(${deptName})记录，ID=${org.id}`);
                            // 根据用户需求，直接删除这条部门记录
                            await window.dbManager.delete('organizations', org.id);
                            console.log(`成功删除部门(${deptName})记录，ID=${org.id}`);
                        } catch (singleProcessError) {
                            console.error(`处理部门记录失败:`, org.id, singleProcessError);
                            allRecordsProcessed = false;
                            // 继续尝试处理其他记录
                        }
                    } else {
                        console.log(`跳过处理：机构(${orgName})下的记录，但部门名称(${org.description})与目标(${deptName})不匹配`);
                    }
                }
                
                // 关闭模态框并刷新数据
                const notificationMessage = allRecordsProcessed && allEmployeesDeleted 
                    ? '部门删除成功，相关员工数据已同步清理' 
                    : (allRecordsProcessed ? '部门记录已删除，但部分员工数据可能未完全清理' : '部分部门记录删除失败');
                
                showNotification(notificationMessage);
                document.getElementById('institutionDeleteModal').style.display = 'none';
                loadOrganizations();
                
                // 刷新人员列表，确保删除部门后的员工列表也是最新的
                try {
                    if (window.loadEmployees) {
                        console.log('刷新人员列表...');
                        window.loadEmployees();
                    }
                } catch (loadEmpErr) {
                    console.error('刷新人员列表时出错:', loadEmpErr);
                }
            } catch (orgDeleteError) {
                console.error(`删除部门记录失败:`, orgDeleteError);
                // 即使删除失败，也要隐藏模态框并刷新列表
                document.getElementById('institutionDeleteModal').style.display = 'none';
                loadOrganizations();
                
                // 即使删除失败，也刷新人员列表以确保显示最新状态
                try {
                    if (window.loadEmployees) {
                        console.log('刷新人员列表...');
                        window.loadEmployees();
                    }
                } catch (loadEmpErr) {
                    console.error('刷新人员列表时出错:', loadEmpErr);
                }
                
                showNotification('部门删除失败: ' + orgDeleteError.message, 'error');
            }
        } catch (error) {
            console.error('删除操作捕获到异常:', error);
            showNotification('删除失败: ' + error, 'error');
        }
    };

    // 绑定删除确认按钮事件（确保使用window对象）
    const deleteModal = document.getElementById('institutionDeleteModal');
    if (deleteModal) {
        const deleteBtn = deleteModal.querySelector('.btn-danger');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', window.deleteOrganization);
        }
    }

    // 初始化选项卡
    initTabs();

    // 初始化导入导出功能
    initImportExportEvents();

    // 加载初始数据
    loadOrganizations();
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 等待dbManager初始化完成
    const checkDbManager = setInterval(function() {
        if (window.dbManager) {
            clearInterval(checkDbManager);
            initBaseSettings();
        }
    }, 100);
});