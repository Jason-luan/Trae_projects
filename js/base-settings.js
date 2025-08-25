// 基础设置功能模块

// 存储当前编辑的机构ID
let currentOrganizationId = null;
// 存储当前编辑的员工ID
let currentEmployeeId = null;
// 分页和排序状态
let currentPage = 1;
const itemsPerPage = 5;
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
    
    // 添加固定样式，确保通知美观且显示在正确位置
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '6px';
    notification.style.color = 'white';
    notification.style.fontWeight = '500';
    notification.style.zIndex = '10000';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    notification.style.transform = 'translateX(100%)';
    notification.style.transition = 'all 0.3s ease-out';
    notification.style.minWidth = '250px';
    notification.style.textAlign = 'center';
    
    // 根据通知类型设置不同的背景色
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ff9800';
            break;
        case 'info':
            notification.style.backgroundColor = '#2196F3';
            break;
        default:
            notification.style.backgroundColor = '#4CAF50';
    }
    
    document.body.appendChild(notification);
    
    // 触发重绘，然后应用动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);

    // 设置自动消失
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 切换状态 - 优化版，与编辑按钮样式保持一致
function toggleStatus(element, id, type, currentStatus) {
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
                    loadOrganizations();
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
            // 根据容器ID决定调用哪个加载函数
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(); 
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
            // 根据容器ID决定调用哪个加载函数
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(); 
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
                // 根据容器ID决定调用哪个加载函数
                containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(); 
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
            // 根据容器ID决定调用哪个加载函数
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(); 
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
            // 根据容器ID决定调用哪个加载函数
            containerId === 'emp-pagination' ? loadEmployees() : loadOrganizations(); 
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
            loadOrganizations();
        });
    });
}

// 加载机构数据
window.loadOrganizations = async function() {
    try {
        let organizations = await dbManager.getAll('organizations');
        showNotification(`已加载机构数量: ${organizations.length}`, 'info');
        console.log('机构数据:', organizations);
    

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

        paginatedOrganizations.forEach(org => {
            const row = document.createElement('tr');
            row.className = 'hover-row';

            // 机构号
            const idCell = document.createElement('td');
            idCell.textContent = org.code || '-';
            row.appendChild(idCell);

            // 机构名称
            const nameCell = document.createElement('td');
            nameCell.textContent = org.name;
            row.appendChild(nameCell);

            // 部门名称
            const deptCell = document.createElement('td');
            // 部门是机构的一个字段，使用org.description作为部门名称
            deptCell.textContent = org.description || '-';
            row.appendChild(deptCell);

            // 备注信息
            const remarkCell = document.createElement('td');
            remarkCell.textContent = org.remark || '-';
            row.appendChild(remarkCell);

            // 创建时间
            const createTimeCell = document.createElement('td');
            createTimeCell.textContent = org.createdAt ? new Date(org.createdAt).toLocaleString() : '-';
            row.appendChild(createTimeCell);

            // 状态
            const statusCell = document.createElement('td');
            const statusBtn = document.createElement('button');
            // 当前状态为0(启用)时，显示'停用'按钮
            // 当前状态为1(停用)时，显示'启用'按钮
            const currentStatus = org.status;
            statusBtn.textContent = currentStatus === 0 ? '停用' : '启用';
            
            // 只使用CSS类，与编辑按钮保持一致的样式
            statusBtn.className = currentStatus === 0 ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm';
            
            statusBtn.onclick = () => toggleStatus(statusBtn, org.id, 'organization', currentStatus);
            statusCell.appendChild(statusBtn);
            row.appendChild(statusCell);

            // 操作
            const actionCell = document.createElement('td');
            actionCell.className = 'action-buttons';

            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-primary btn-sm'; // 恢复原样式类
            editBtn.textContent = '编辑';
            editBtn.onclick = () => editOrganization(org.id);
            actionCell.appendChild(editBtn);

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm'; // 恢复原样式类
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = () => {
                // 创建隐藏输入字段存储要删除的机构ID
                let deleteIdInput = document.getElementById('deleteOrganizationId');
                if (!deleteIdInput) {
                    deleteIdInput = document.createElement('input');
                    deleteIdInput.type = 'hidden';
                    deleteIdInput.id = 'deleteOrganizationId';
                    document.body.appendChild(deleteIdInput);
                }
                deleteIdInput.value = org.id;
                document.getElementById('deleteInstitutionName').textContent = org.name;
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

// 删除机构
window.deleteOrganization = function() {
    const id = document.getElementById('deleteOrganizationId').value;
    if (!id) return;

    try {
        const orgId = parseInt(id);
        dbManager.delete('organizations', orgId)
            .then(() => {
                // 同时删除关联的员工
                return dbManager.getByIndex('employees', 'orgId', orgId)
                    .then(employees => {
                        const deletePromises = employees.map(emp => dbManager.delete('employees', emp.id));
                        return Promise.all(deletePromises);
                    });
            })
            .then(() => {
                document.getElementById('institutionDeleteModal').style.display = 'none';
                showNotification('机构删除成功');
                loadOrganizations();
            })
            .catch(error => {
                showNotification('删除机构失败: ' + error.message, 'error');
            });
    } catch (error) {
        showNotification('删除机构失败: ' + error, 'error');
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
                    document.getElementById('institutionNameInput').value = org.name;
                        document.getElementById('institutionNumberInput').value = org.code || '';
                        document.getElementById('departmentNameInput').value = org.description || '';
                        document.getElementById('remarkInput').value = org.remark || '';
                        document.getElementById('institutionIdInput').value = org.id;
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
    
    // 设置默认创建日期为当天
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    document.getElementById('institutionCreateDateInput').value = formattedDate;
    
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
        // 从表单获取部门信息（支持逗号分隔多个部门）
        const departmentInput = document.getElementById('departmentNameInput').value.trim();
        const departments = departmentInput ? departmentInput.split(',').map(dept => dept.trim()) : [];
        const remark = document.getElementById('remarkInput').value.trim();

        if (!name) {
            showNotification('机构名称不能为空', 'warning');
            return;
        }

        if (id) {
            // 更新现有机构
            const org = await dbManager.getById('organizations', id);
            if (org) {
                const updatedOrg = {
                        ...org,
                        name,
                        code: CODE,
                        description: departments[0] || '', // 保留description字段以兼容旧数据
                        departments: departments,
                        remark: remark,
                        updatedAt: new Date()
                    };
                await dbManager.save('organizations', updatedOrg);
                showNotification('机构更新成功');
            }
        } else {
            // 新增机构
            // 获取表单中的创建日期
            const createDateInput = document.getElementById('institutionCreateDateInput');
            const createDate = createDateInput ? new Date(createDateInput.value) : new Date();
            
            const newOrg = {
                    name,
                    code: CODE,
                    status: 0,
                    description: departments[0] || '', // 保留description字段以兼容旧数据
                    departments: departments,
                    remark: remark,
                    createdAt: createDate,
                    updatedAt: new Date()
                };
            await dbManager.save('organizations', newOrg);
            showNotification('机构添加成功');
        }

        document.getElementById('institutionModal').style.display = 'none';
            // 延迟一小段时间确保数据完全保存
            loadOrganizations();
    } catch (error) {
        showNotification('保存机构失败: ' + error.message, 'error');
    }
}

// 加载员工数据
window.loadEmployees = async function() {
    try {
        let employees = await dbManager.getAll('employees');
        const organizations = await dbManager.getAll('organizations');

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

        paginatedEmployees.forEach(emp => {
            const row = document.createElement('tr');
            row.className = 'hover-row';

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
            const org = organizations.find(o => o.id === emp.orgId);
            orgCell.textContent = org ? org.name : '-';
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
            
            // 将状态数字转换为文本 - 根据用户要求：0是在职，1是离职，2是休假
            let statusDisplay = '-';
            switch(emp.status) {
                case 0: statusDisplay = '在职'; break;
                case 1: statusDisplay = '离职'; break;
                case 2: statusDisplay = '休假'; break;
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
                document.getElementById('employeeOrgIdInput').value = emp.orgId;
                // 根据orgId查找机构名称
                const org = organizations.find(o => o.id === emp.orgId);
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
                document.getElementById('employeeIdInput').value = emp.id;
                document.getElementById('employeeModal').style.display = 'block';
                
                // 延迟加载部门，确保模态框已显示
                setTimeout(() => {
                    loadDepartmentsForSelect(org ? org.name : '', emp.deptName);
                }, 50);
            };
            actionCell.appendChild(editBtn);

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = () => deleteEmployee(emp.id);
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
function deleteEmployee(id) {
    try {
        const empId = parseInt(id);
        dbManager.delete('employees', empId)
            .then(() => {
                showNotification('员工删除成功');
                loadEmployees();
                loadOrganizations(); // 更新部门人数
            })
            .catch(error => {
                showNotification('删除员工失败: ' + error.message, 'error');
            });
    } catch (error) {
        showNotification('删除员工失败: ' + error, 'error');
    }
}

// 机构下拉框变化事件
function onOrgChange() {
    const selectedOption = this.options[this.selectedIndex];
    const selectedOrgId = selectedOption.value;
    const deptSelect = document.getElementById('employeeDeptNameInput');
    if (deptSelect) {
        // 启用部门选择框
        deptSelect.disabled = false;
        if (selectedOrgId) {
            // 根据selectedOrgId查找机构名称
            // 使用全局变量查找机构
            const org = window.allOrganizations.find(o => o.id === parseInt(selectedOrgId));
            loadDepartmentsForSelect(org ? org.name : '');
        } else {
            deptSelect.innerHTML = '<option value="">请选择部门</option>';
        }
    }
}

// 加载机构数据到下拉框
function loadOrganizationsForSelect(selectedOrgId = null) {
    try {
        dbManager.getAll('organizations')
            .then(organizations => {
                // 保存到全局变量供onOrgChange使用
                window.allOrganizations = organizations;
                const select = document.getElementById('employeeOrgIdInput');
                if (!select) {
                    console.error('未找到employeeOrgIdInput元素');
                    return;
                }

                select.innerHTML = '<option value="">请选择机构</option>';
                // 使用Set来跟踪已添加的机构名称，避免重复
                const addedOrganizations = new Set();

                // 只加载启用状态的机构
                organizations.forEach(org => {
                    if (org.name && !addedOrganizations.has(org.name) && org.status === 0) {
                        const option = document.createElement('option');
                        option.value = org.id;
                        option.textContent = org.name;
                        if (selectedOrgId !== null && org.id === selectedOrgId) {
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
                if (selectedOrgId !== null) {
                    // 根据selectedOrgId查找机构名称
                    const org = organizations.find(o => o.id === selectedOrgId);
                    loadDepartmentsForSelect(org ? org.name : '');
                    // 启用部门选择框
                    const deptSelect = document.getElementById('employeeDeptNameInput');
                    if (deptSelect) {
                        deptSelect.disabled = false;
                    }
                } else if (select.options.length > 1) {  // 大于1是因为有"请选择机构"选项
                    // 默认选择第一个机构
                    select.selectedIndex = 1;
                    const firstOrgId = parseInt(select.options[1].value);
                    // 根据firstOrgId查找机构名称
                    const org = organizations.find(o => o.id === firstOrgId);
                    loadDepartmentsForSelect(org ? org.name : '');
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

// 查找匹配的机构
function findMatchingOrganization(organizations, orgId) {
    return organizations.find(org => org.id === orgId) || null;
}

// 处理机构部门数据
function processOrganizationDepartments(org) {
    return org.departments || [];
}

// 加载部门数据到下拉框
function loadDepartmentsForSelect(orgName, selectedDept = '') {
    try {
        // 获取所有机构，找到名称匹配的所有机构
        dbManager.getAll('organizations')
            .then(allOrganizations => {
                const deptSelect = document.getElementById('employeeDeptNameInput');
                if (!deptSelect) {
                    console.error('未找到employeeDeptNameInput元素');
                    return;
                }

                // 查找所有名称匹配的机构
                const matchingOrgs = allOrganizations.filter(o => o.name === orgName);
                if (!matchingOrgs || matchingOrgs.length === 0) {
                    deptSelect.innerHTML = '<option value="">请选择部门</option>';
                    // 如果有选中的部门但没有匹配的机构，手动添加该部门选项
                    if (selectedDept) {
                        const customOption = document.createElement('option');
                        customOption.value = selectedDept;
                        customOption.textContent = selectedDept;
                        customOption.selected = true;
                        deptSelect.appendChild(customOption);
                    }
                    return;
                }

                // 加载所有匹配机构的部门并去重
                deptSelect.innerHTML = '<option value="">请选择部门</option>';
                
                // 使用Set进行部门去重
                const uniqueDepartments = new Set();
                
                // 收集所有匹配机构的部门
                matchingOrgs.forEach(org => {
                    // 检查机构是否有departments字段，如果没有则使用description作为单个部门
                    const departments = org.departments && Array.isArray(org.departments) ? org.departments : [org.description];
                    
                    departments.forEach(dept => {
                        if (dept) {
                            uniqueDepartments.add(dept);
                        }
                    });
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
        button.addEventListener('click', () => {
            // 移除所有活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 添加活动状态到当前按钮
            button.classList.add('active');

            // 显示对应内容
            const target = button.dataset.tab + '-tab';
            document.getElementById(target).classList.add('active');
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
                                loadOrganizations();
                                loadEmployees();
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

// 删除部门
window.deleteDepartment = function() {
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
        document.getElementById('employeeImportModal').style.display = 'none';
    };

    // 下载模板
    document.getElementById('downloadTemplateBtn').addEventListener('click', function(e) {
        e.preventDefault();
        // 创建一个临时链接指向模板文件
        const link = document.createElement('a');
        link.href = 'employee_template.csv';
        link.download = 'employee_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 导入员工
    window.importEmployees = function() {
        const fileInput = document.getElementById('employeeFileInput');
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('请选择Excel文件');
            return;
        }

        const file = fileInput.files[0];
        // 检查文件类型
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            alert('请选择.xlsx或.xls格式的Excel文件');
            return;
        }

        // 这里只是一个示例，实际项目中需要后端处理文件
        alert('员工导入功能将在后端实现后可用');
        document.getElementById('employeeImportModal').style.display = 'none';
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
        loadOrganizationsForSelect();
        document.getElementById('employeeModal').style.display = 'flex';
    });

    // 绑定员工表单提交事件
    document.getElementById('employeeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const number = document.getElementById('employeeNumberInput').value.trim();
            const name = document.getElementById('employeeNameInput').value.trim();
            const orgId = document.getElementById('employeeOrgIdInput').value;
            const position = document.getElementById('employeePositionInput').value.trim();
            const statusSelect = document.getElementById('employeeStatusInput');
            let status = 0;
            if (statusSelect) {
                status = statusSelect.value === 'active' ? 0 : (statusSelect.value === 'inactive' ? 1 : 2);
            }
            const idInput = document.getElementById('employeeIdInput');
            const id = idInput.value ? parseInt(idInput.value) : null;

            if (!number || !name || !orgId) {
                showNotification('工号、姓名和所属机构不能为空', 'warning');
                return;
            }

            // 验证机构状态
            const org = await dbManager.getById('organizations', parseInt(orgId));
            if (!org || org.status !== 0) {
                showNotification('所选机构未启用，无法添加员工', 'warning');
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
                    orgId,
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
                    orgId,
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
            }, 300);
        } catch (error) {
            showNotification('保存员工失败: ' + error.message, 'error');
        }
    });

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

    // 删除机构
    window.deleteOrganization = async function() {
        try {
            const deleteIdInput = document.getElementById('deleteOrganizationId');
            if (!deleteIdInput) {
                showNotification('未找到要删除的机构ID', 'error');
                return;
            }
            const orgId = parseInt(deleteIdInput.value);
            if (isNaN(orgId)) {
                showNotification('无效的机构ID', 'error');
                return;
            }

            // 先删除该机构下的所有员工
            const employees = await dbManager.getAll('employees');
            const orgEmployees = employees.filter(emp => emp.orgId === orgId);
            for (const emp of orgEmployees) {
                await dbManager.delete('employees', emp.id);
            }

            // 再删除机构
            await dbManager.delete('organizations', orgId);

            showNotification('机构删除成功');
            document.getElementById('institutionDeleteModal').style.display = 'none';
            loadOrganizations();
        } catch (error) {
            showNotification('删除机构失败: ' + error.message, 'error');
        }
    };

    // 绑定删除确认按钮事件
    const deleteModal = document.getElementById('institutionDeleteModal');
    if (deleteModal) {
        const deleteBtn = deleteModal.querySelector('.btn-danger');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteOrganization);
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