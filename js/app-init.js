// 移除模块化导入，现在通过传统脚本加载

// 自动选择部门并加载排班顺序数据
async function autoSelectDepartmentAndLoadData() {
    try {
        console.log('开始执行自动选择部门并加载数据函数');
        
        // 获取排班顺序管理的部门筛选框和岗位筛选框
        const deptFilter = document.getElementById('shiftOrderDeptFilter');
        const positionFilter = document.getElementById('shiftOrderPositionFilter');
        
        // 同时获取标识管理的筛选框
        const identifierDeptFilter = document.getElementById('identifierDeptFilter');
        const identifierPositionFilter = document.getElementById('identifierPositionFilter');
        
        // 获取排班顺序管理选项卡内容
        const shiftOrdersTab = document.getElementById('shiftOrders-tab');
        
        console.log('找到的筛选框:', {
            shiftOrderDeptFilter: !!deptFilter,
            shiftOrderPositionFilter: !!positionFilter,
            identifierDeptFilter: !!identifierDeptFilter,
            identifierPositionFilter: !!identifierPositionFilter,
            shiftOrdersTab: !!shiftOrdersTab,
            isShiftOrdersTabActive: shiftOrdersTab && shiftOrdersTab.classList.contains('active')
        });
        
        // 确保岗位筛选框默认选择为"全部岗位"
        if (positionFilter) {
            positionFilter.value = "";
            console.log('已设置排班顺序岗位筛选框默认值为全部岗位');
        }
        if (identifierPositionFilter) {
            identifierPositionFilter.value = "";
            console.log('已设置标识管理岗位筛选框默认值为全部岗位');
        }
        
        if (deptFilter && identifierDeptFilter) {
            // 不再自动选择部门，保持默认的"全部部门"状态
            deptFilter.value = "";
            console.log('保持部门筛选框为默认值（全部部门）');
            
            // 保持岗位筛选框为"全部岗位"
            if (positionFilter) {
                positionFilter.value = "";
                console.log('保持排班顺序岗位筛选框为默认值（全部岗位）');
            }
            
            // 同样保持标识管理筛选框为默认值
            identifierDeptFilter.value = "";
            if (identifierPositionFilter) {
                identifierPositionFilter.value = "";
            }
            
            // 根据用户需求：初始化后岗位筛选框只显示"全部岗位"，不加载具体岗位数据
            // 不再自动加载全部部门的岗位数据
            console.log('初始化完成，岗位筛选框保持为"全部岗位"，不加载具体岗位数据');
            
            // 确保在初始化完成后手动触发一次change事件，以确保数据正确加载
            if (identifierPositionFilter) {
                try {
                    identifierPositionFilter.dispatchEvent(new Event('change'));
                    console.log('手动触发标识管理岗位筛选框change事件');
                } catch (eventError) {
                    console.warn('手动触发标识管理岗位筛选框change事件失败:', eventError);
                }
            }
            if (positionFilter) {
                try {
                    positionFilter.dispatchEvent(new Event('change'));
                    console.log('手动触发排班顺序管理岗位筛选框change事件');
                } catch (eventError) {
                    console.warn('手动触发排班顺序管理岗位筛选框change事件失败:', eventError);
                }
            }
        }
    } catch (error) {
        console.error('自动选择部门并加载数据失败:', error);
        // 添加友好提示
        if (window.showNotification) {
            window.showNotification('加载部门和岗位数据时出现问题，请手动选择部门和岗位', 'warning');
        }
    }
}

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化数据库
    console.log('开始初始化数据库...');
    // 确保dbManager作为全局变量存在
    if (!window.dbManager) {
        window.dbManager = new IndexedDBManager();
        console.log('已创建全局dbManager实例');
    }
    
    // 将增强版loadPositionsForDepartment函数暴露为全局函数
    window.loadPositionsForDepartment = loadPositionsForDepartment;
    console.log('已将增强版loadPositionsForDepartment函数暴露为全局函数');
    const dbManager = window.dbManager;
    
    if (!dbManager) {
        console.error('dbManager未定义');
        return;
    }
    
    dbManager.ensureInitialized()
        .then(() => {
            console.log('数据库初始化成功');
            
            return Promise.resolve(false);
        })
        .then(() => {
            // 初始化选项卡
            if (window.initTabs) {
                window.initTabs();
                console.log('选项卡初始化完成');
            } else {
                console.error('initTabs函数未定义');
            }
            
            // 加载数据
            if (window.loadOrganizationsForSelect) {
                window.loadOrganizationsForSelect();
            } else {
                console.error('loadOrganizationsForSelect函数未定义');
            }
            
            if (window.loadOrganizations) {
                window.loadOrganizations();
            } else {
                console.error('loadOrganizations函数未定义');
            }
            
            if (window.loadEmployees) {
                window.loadEmployees();
            } else {
                console.error('loadEmployees函数未定义');
            }
            
            // 添加：加载班次数据
            if (window.loadShifts) {
                window.loadShifts();
                console.log('班次数据加载完成');
            } else {
                console.error('loadShifts函数未定义');
            }
            
            // 初始化导入导出事件
            if (window.initImportExportEvents) {
                window.initImportExportEvents();
            } else {
                console.log('initImportExportEvents函数未定义，跳过');
            }
            
            // 已移除示例数据添加功能
            if (window.showNotification) {
                window.showNotification('数据库初始化完成');
            }
            
            // 初始化搜索功能
            if (window.initSearchFunction) {
                window.initSearchFunction();
            } else {
                console.error('搜索功能初始化函数未定义');
            }

            // 初始化班次管理功能
            if (window.initShiftManagement) {
                window.initShiftManagement();
                console.log('班次管理功能初始化完成');
                
                // 添加：检查并手动初始化默认班次数据
                setTimeout(async function() {
                    try {
                        // 检查班次数据是否存在
                        if (window.shiftManager && typeof window.shiftManager.initializeDefaultShifts === 'function') {
                            console.log('尝试手动初始化默认班次数据...');
                            await window.shiftManager.initializeDefaultShifts();
                            // 重新加载班次数据
                            if (window.loadShifts) {
                                window.loadShifts();
                            }
                        }
                    } catch (error) {
                        console.error('手动初始化默认班次数据失败:', error);
                    }
                }, 1000);
            } else {
                console.error('班次管理功能初始化函数未定义');
            }
            
            // 初始化标识管理功能
            if (window.initIdentifierManagement) {
                // 延迟初始化标识管理功能，确保其他功能已加载完成
                setTimeout(async function() {
                    try {
                        window.initIdentifierManagement();
                        console.log('标识管理功能初始化完成');
                    } catch (error) {
                        console.error('标识管理功能初始化失败:', error);
                    }
                }, 1500);
            } else {
                console.error('标识管理功能初始化函数未定义');
            }
            
            // 初始化排班顺序管理功能
            if (window.initShiftOrderManagement) {
                // 延迟初始化排班顺序管理功能，确保标识管理功能已加载完成
                setTimeout(async function() {
                    try {
                        // 添加全局标志，防止重复加载
                        window.skipNextShiftOrderLoad = true;
                        window.initShiftOrderManagement();
                        console.log('排班顺序管理功能初始化完成');
                        
                        // 短暂延迟后清除标志，允许正常加载
                        setTimeout(() => {
                            window.skipNextShiftOrderLoad = false;
                        }, 300);
                    } catch (error) {
                        console.error('排班顺序管理功能初始化失败:', error);
                    }
                }, 2000);
            } else {
                console.error('排班顺序管理功能初始化函数未定义');
            }
            
            // 初始化员工号筛选功能
            const empNumberFilter = document.getElementById('empNumberFilter');
            if (empNumberFilter) {
                empNumberFilter.addEventListener('input', function() {
                    // 更新全局筛选值
                    currentEmployeeNumberFilter = this.value.trim();
                    // 重置当前页为第一页，重新加载数据
                    currentPage = 1;
                    // 重新加载员工数据以应用筛选
                    if (window.loadEmployees) {
                        window.loadEmployees();
                    }
                });
                console.log('员工号筛选功能已初始化');
            }

            // 初始化标识管理员工号筛选功能
            const identifierEmpNumberFilter = document.getElementById('identifierEmpNumberFilter');
            if (identifierEmpNumberFilter) {
                identifierEmpNumberFilter.addEventListener('input', function() {
                    // 重新加载标识数据以应用筛选
                    if (window.loadIdentifierData) {
                        window.loadIdentifierData();
                    }
                });
                console.log('标识管理员工号筛选功能已初始化');
            }
            
            // 初始化标识管理部门筛选功能
            
            // 初始化一键清除所有标识数据按钮
            const clearAllIdentifiersBtn = document.getElementById('clearAllIdentifiersBtn');
            if (clearAllIdentifiersBtn) {
                clearAllIdentifiersBtn.addEventListener('click', function() {
                    if (window.clearAllIdentifiers) {
                        window.clearAllIdentifiers();
                    } else {
                        console.error('一键清除所有标识数据函数未定义');
                    }
                });
                console.log('一键清除所有标识数据功能已初始化');
            }
            const identifierDeptFilter = document.getElementById('identifierDeptFilter');
            if (identifierDeptFilter) {
                identifierDeptFilter.addEventListener('change', async function() {
                    // 清空岗位筛选
                    const identifierPositionFilter = document.getElementById('identifierPositionFilter');
                    if (identifierPositionFilter) {
                        identifierPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                    }
                    
                    // 如果选择了特定部门，加载该部门的岗位
                    const selectedDept = this.value;
                    if (selectedDept && window.loadPositionsForDepartment) {
                        await window.loadPositionsForDepartment(selectedDept, 'identifier');
                    } else {
                        console.log('loadPositionsForDepartment函数未定义，无法加载岗位数据');
                    }
                    
                    // 重新加载标识数据以应用筛选
                    if (window.loadIdentifierData) {
                        window.loadIdentifierData();
                    }
                });
                console.log('标识管理部门筛选功能已初始化');
            }
            
            // 初始化标识管理岗位筛选功能
            const identifierPositionFilter = document.getElementById('identifierPositionFilter');
            if (identifierPositionFilter) {
                identifierPositionFilter.addEventListener('change', function() {
                    // 重新加载标识数据以应用筛选
                    if (window.loadIdentifierData) {
                        window.loadIdentifierData();
                    }
                });
                console.log('标识管理岗位筛选功能已初始化');
            }
            
            // 排班顺序管理部门筛选功能将在loadDepartmentsForFilter函数中统一初始化
            // 避免重复添加事件监听器
            
            // 初始化排班顺序管理岗位筛选功能
            const shiftOrderPositionFilter = document.getElementById('shiftOrderPositionFilter');
            if (shiftOrderPositionFilter) {
                shiftOrderPositionFilter.addEventListener('change', function() {
                    // 重新加载排班顺序数据以应用筛选
                    if (window.loadShiftOrderData) {
                        window.loadShiftOrderData();
                    }
                });
                console.log('排班顺序管理岗位筛选功能已初始化');
            }
            
            // 初始化排班顺序管理功能
            if (!window.shiftOrderManager) {
                // 使用setTimeout延迟初始化，确保shift-order-management.js文件有足够的时间加载和执行
                setTimeout(() => {
                    // 确保ShiftOrderManager类已加载
                    if (window.ShiftOrderManager) {
                        // 立即初始化
                        try {
                            window.shiftOrderManager = new window.ShiftOrderManager();
                            console.log('排班顺序管理功能初始化成功');
                        } catch (error) {
                            console.error('排班顺序管理功能初始化失败:', error);
                            // 尝试多次初始化
                            let retryCount = 0;
                            const maxRetries = 3;
                            const retryInterval = 500;
                            
                            const retryInitialization = () => {
                                retryCount++;
                                console.log(`尝试重新初始化排班顺序管理功能 (${retryCount}/${maxRetries})`);
                                
                                try {
                                    window.shiftOrderManager = new window.ShiftOrderManager();
                                    console.log('排班顺序管理功能重新初始化成功');
                                } catch (retryError) {
                                    console.error('排班顺序管理功能重新初始化失败:', retryError);
                                    if (retryCount < maxRetries) {
                                        setTimeout(retryInitialization, retryInterval);
                                    } else {
                                        console.error('多次尝试后仍无法初始化排班顺序管理功能');
                                    }
                                }
                            };
                            
                            setTimeout(retryInitialization, retryInterval);
                        }
                    } else {
                        console.error('ShiftOrderManager类未定义，尝试更晚初始化');
                        // 如果还是未定义，再延迟2秒后最后尝试一次
                        setTimeout(() => {
                            if (window.ShiftOrderManager) {
                                try {
                                    window.shiftOrderManager = new window.ShiftOrderManager();
                                    console.log('排班顺序管理功能最终初始化成功');
                                } catch (finalError) {
                                    console.error('排班顺序管理功能最终初始化失败:', finalError);
                                }
                            } else {
                                console.error('ShiftOrderManager类仍未定义，可能是脚本加载失败');
                                // 作为最后的备选方案，直接在全局作用域中创建一个基本的ShiftOrderManager类
                                window.ShiftOrderManager = class {
                                    constructor() {
                                        console.warn('使用备选ShiftOrderManager类');
                                    }
                                    
                                    async getAllActiveShifts() {
                                        // 返回空数组作为备选
                                        return [];
                                    }
                                    
                                    async getShiftOrderByPositionAndShift(position, shiftCode) {
                                        // 返回null作为备选
                                        return null;
                                    }
                                };
                                
                                try {
                                    window.shiftOrderManager = new window.ShiftOrderManager();
                                    console.log('备选ShiftOrderManager类初始化成功');
                                } catch (fallbackError) {
                                    console.error('备选ShiftOrderManager类初始化失败:', fallbackError);
                                }
                            }
                        }, 2000);
                    }
                }, 100); // 延迟100毫秒后再尝试初始化
            }
            
            // 初始化employeeManager
            if (!window.employeeManager) {
                // 使用setTimeout延迟初始化，确保相关依赖已加载
                setTimeout(() => {
                    try {
                        // 导入EmployeeManager类
                        if (window.EmployeeManager) {
                            // 使用已定义的EmployeeManager类创建实例
                            window.employeeManager = new window.EmployeeManager();
                            console.log('employeeManager类初始化成功');
                        } else {
                            // 如果没有定义EmployeeManager类，创建一个基本实现
                            console.warn('EmployeeManager类未定义，使用基本实现');
                            window.employeeManager = {
                                // 基本的getEmployeesByDepartmentId实现
                                getEmployeesByDepartmentId: async function(departmentName) {
                                    try {
                                        // 获取所有员工
                                        const allEmployees = await window.dbManager.getAll('employees');
                                        // 根据部门名称筛选员工
                                        const departmentEmployees = allEmployees.filter(emp => {
                                            return emp.deptName && 
                                                   typeof emp.deptName === 'string' && 
                                                   emp.deptName.toLowerCase().trim() === String(departmentName).toLowerCase().trim();
                                        });
                                        return departmentEmployees;
                                    } catch (error) {
                                        console.error('获取部门员工失败:', error);
                                        return [];
                                    }
                                },
                                
                                // 基本的getEmployeesByOrgAndDept实现
                                getEmployeesByOrgAndDept: async function(orgName, deptName) {
                                    try {
                                        // 获取所有员工
                                        const allEmployees = await window.dbManager.getAll('employees');
                                        // 根据机构名称和部门名称筛选员工
                                        const filteredEmployees = allEmployees.filter(emp => {
                                            return emp.orgName && typeof emp.orgName === 'string' && 
                                                   emp.deptName && typeof emp.deptName === 'string' && 
                                                   emp.orgName.toLowerCase().trim() === String(orgName).toLowerCase().trim() && 
                                                   emp.deptName.toLowerCase().trim() === String(deptName).toLowerCase().trim();
                                        });
                                        return filteredEmployees;
                                    } catch (error) {
                                        console.error('获取机构部门员工失败:', error);
                                        return [];
                                    }
                                }
                            };
                            console.log('employeeManager基本实现初始化成功');
                        }
                        
                        // 调用初始化方法（如果存在）
                        if (window.employeeManager.initialize) {
                            window.employeeManager.initialize().then(() => {
                                console.log('employeeManager初始化完成');
                            }).catch(error => {
                                console.error('employeeManager初始化失败:', error);
                            });
                        }
                    } catch (error) {
                        console.error('初始化employeeManager失败:', error);
                        // 备用实现
                        window.employeeManager = {
                            getEmployeesByDepartmentId: async function() {
                                return [];
                            },
                            getEmployeesByOrgAndDept: async function() {
                                return [];
                            }
                        };
                    }
                }, 300); // 比shiftOrderManager更早初始化
            }
            
            // 加载所有部门到部门筛选下拉框，使用Promise链式调用而不是await
        loadDepartmentsForFilter().then(() => {
            // 部门列表加载完成后，执行自动选择第一个部门并加载数据的逻辑
            autoSelectDepartmentAndLoadData().catch(error => {
                console.error('自动选择部门并加载数据过程中出现错误:', error);
            });
        }).catch(error => {
            console.error('加载部门列表失败:', error);
        });
        })
        .catch(error => {
            console.error('数据库初始化失败:', error);
            if (window.showNotification) {
                window.showNotification('数据库初始化失败: ' + error.message, 'error');
            }
        });
});

// 加载所有部门到部门筛选下拉框 - 部门信息现在存储在organizations的description字段
async function loadDepartmentsForFilter() {
    try {
        // 加载标识管理的部门筛选
        const identifierDeptFilter = document.getElementById('identifierDeptFilter');
        // 加载排班顺序管理的部门筛选
        const shiftOrderDeptFilter = document.getElementById('shiftOrderDeptFilter');
        
        // 如果两个筛选框都不存在，则返回
        if (!identifierDeptFilter && !shiftOrderDeptFilter) return;
        
        // 获取所有员工数据
        const employees = await window.dbManager.getAll('employees');
        
        // 收集所有部门名称
        const departments = new Set();
        employees.forEach(emp => {
            if (emp.deptName) {
                departments.add(emp.deptName);
            }
        });
        
        // 为标识管理筛选框加载部门列表
        if (identifierDeptFilter) {
            // 清空现有选项，保留默认选项
            identifierDeptFilter.innerHTML = '<option value="">全部部门</option>';
            
            // 添加部门选项
            Array.from(departments).sort().forEach(deptName => {
                const option = document.createElement('option');
                option.value = deptName;
                option.textContent = deptName;
                identifierDeptFilter.appendChild(option);
            });
        }
        
        // 为排班顺序管理筛选框加载部门列表
        if (shiftOrderDeptFilter) {
            // 清空现有选项，保留默认选项
            shiftOrderDeptFilter.innerHTML = '<option value="">全部部门</option>';
            
            // 添加部门选项
            Array.from(departments).sort().forEach(deptName => {
                const option = document.createElement('option');
                option.value = deptName;
                option.textContent = deptName;
                shiftOrderDeptFilter.appendChild(option);
            });
        }
        
        // 增强版：在部门加载完成后，添加事件监听器确保部门切换时能正确加载岗位
        if (shiftOrderDeptFilter && !shiftOrderDeptFilter.hasOwnProperty('__enhancedListener')) {
            // 移除可能存在的旧监听器
            const newDeptFilter = shiftOrderDeptFilter.cloneNode(true);
            shiftOrderDeptFilter.parentNode.replaceChild(newDeptFilter, shiftOrderDeptFilter);
            
            // 添加增强的change事件监听器
            newDeptFilter.addEventListener('change', async function() {
                // 清空岗位筛选
                const shiftOrderPositionFilter = document.getElementById('shiftOrderPositionFilter');
                if (shiftOrderPositionFilter) {
                    shiftOrderPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                }
                
                // 不再同步清空标识管理的岗位筛选
                
                // 如果选择了特定部门，加载该部门的岗位
                const selectedDept = this.value;
                if (selectedDept) {
                    console.log('部门筛选框变化，重新加载岗位数据:', selectedDept);
                    // 为了避免重复加载导致的选项重复问题，添加简单的防重复机制
                    if (!this.lastLoadTime || Date.now() - this.lastLoadTime > 300) {
                        this.lastLoadTime = Date.now();
                        await loadPositionsForDepartment(selectedDept, 'shiftOrder');
                    }
                }
                
                // 重新加载排班顺序数据以应用筛选
                if (window.loadShiftOrderData) {
                    window.loadShiftOrderData();
                }
            });
            
            // 标记已添加增强监听器
            newDeptFilter.__enhancedListener = true;
            console.log('已添加增强版排班顺序管理部门筛选框change事件监听器');
        }
        
        // 同样为标识管理部门筛选框添加增强的事件监听器
        if (identifierDeptFilter && !identifierDeptFilter.hasOwnProperty('__enhancedListener')) {
            // 移除可能存在的旧监听器
            const newIdentifierDeptFilter = identifierDeptFilter.cloneNode(true);
            identifierDeptFilter.parentNode.replaceChild(newIdentifierDeptFilter, identifierDeptFilter);
            
            // 添加增强的change事件监听器
            newIdentifierDeptFilter.addEventListener('change', async function() {
                // 清空岗位筛选
                const identifierPositionFilter = document.getElementById('identifierPositionFilter');
                if (identifierPositionFilter) {
                    identifierPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                }
                
                // 不再同步更新排班顺序管理的部门选择
                
                // 如果选择了特定部门，加载该部门的岗位
                const selectedDept = this.value;
                if (selectedDept) {
                    console.log('标识管理部门筛选框变化，重新加载岗位数据:', selectedDept);
                    // 为了避免重复加载导致的选项重复问题，添加简单的防重复机制
                    if (!this.lastLoadTime || Date.now() - this.lastLoadTime > 300) {
                        this.lastLoadTime = Date.now();
                        if (window.loadPositionsForDepartment) {
                            await window.loadPositionsForDepartment(selectedDept, 'identifier');
                        }
                    }
                }
                
                // 重新加载标识数据以应用筛选
                if (window.loadIdentifierData) {
                    window.loadIdentifierData();
                }
            });
            
            // 标记已添加增强监听器
            newIdentifierDeptFilter.__enhancedListener = true;
            console.log('已添加增强版标识管理部门筛选框change事件监听器');
        }
    } catch (error) {
        console.error('加载部门列表失败:', error);
    }
}

// 执行锁，防止重复调用loadPositionsForDepartment函数
let loadingPositions = false;

// 根据部门加载岗位列表
async function loadPositionsForDepartment(deptName, targetFilter, isInitialization = false, forceTriggerChange = false) {
    // 防止重复调用
    if (loadingPositions) {
        console.log('岗位列表加载正在进行中，取消重复调用');
        return;
    }
    loadingPositions = true;
    
    try {
        // 添加重试机制，最多尝试3次
        const maxRetries = 3;
        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                console.log(`开始加载部门岗位列表(尝试${retries + 1}/${maxRetries})，部门名称:`, deptName);
                
                // 确保DOM元素加载完成
                await new Promise(resolve => setTimeout(resolve, 100));
            
                // 如果指定了目标筛选框，只更新该筛选框；否则更新所有筛选框
                let identifierPositionFilter = null;
                let shiftOrderPositionFilter = null;
                let identifierPositionValue = '';
                let shiftOrderPositionValue = '';
                
                // 重复尝试获取筛选框元素，确保它们已加载
                let attempts = 0;
                while (!identifierPositionFilter && !shiftOrderPositionFilter && attempts < 5) {
                    if (targetFilter === 'identifier' || !targetFilter) {
                        identifierPositionFilter = document.getElementById('identifierPositionFilter');
                        identifierPositionValue = identifierPositionFilter ? identifierPositionFilter.value : '';
                        // 清空现有选项，只保留默认选项
                        if (identifierPositionFilter) {
                            // 直接清空，避免异步操作导致的问题
                            identifierPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                        }
                    }
                    
                    if (targetFilter === 'shiftOrder' || !targetFilter) {
                        shiftOrderPositionFilter = document.getElementById('shiftOrderPositionFilter');
                        shiftOrderPositionValue = shiftOrderPositionFilter ? shiftOrderPositionFilter.value : '';
                        // 清空现有选项，只保留默认选项
                        if (shiftOrderPositionFilter) {
                            // 直接清空，避免异步操作导致的问题
                            shiftOrderPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                        }
                    }
                    
                    if (!identifierPositionFilter && !shiftOrderPositionFilter) {
                        attempts++;
                        console.log(`未找到筛选框，等待并重试(${attempts}/5)...`);
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                
                console.log('找到的岗位筛选框:', {identifierPositionFilter: !!identifierPositionFilter, shiftOrderPositionFilter: !!shiftOrderPositionFilter});
                
                // 如果两个筛选框都不存在，则返回
                if (!identifierPositionFilter && !shiftOrderPositionFilter) {
                    console.warn('未找到岗位筛选框，放弃加载');
                    return;
                }
                
                // 检查dbManager是否可用，添加等待逻辑
                let dbReady = false;
                let dbAttempts = 0;
                while (!dbReady && dbAttempts < 5) {
                    if (window.dbManager && window.dbManager.getAll) {
                        dbReady = true;
                    } else {
                        dbAttempts++;
                        console.log(`数据库管理器未就绪，等待并重试(${dbAttempts}/5)...`);
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
                
                if (!dbReady) {
                    console.error('数据库管理器未初始化或不具备getAll方法');
                    // 添加错误提示到下拉框
                    const errorOption = document.createElement('option');
                    errorOption.value = '';
                    errorOption.textContent = '数据库未就绪，请稍后重试';
                    errorOption.disabled = true;
                    
                    if (identifierPositionFilter) {
                        identifierPositionFilter.appendChild(errorOption.cloneNode(true));
                    }
                    if (shiftOrderPositionFilter) {
                        shiftOrderPositionFilter.appendChild(errorOption);
                    }
                    
                    // 如果是初始化过程且数据库未就绪，尝试延迟后重试
                    if (isInitialization && retries < maxRetries - 1) {
                        retries++;
                        console.log(`数据库未就绪，${retries}秒后重试...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                        continue;
                    }
                    
                    return;
                }
                
                // 获取员工和机构数据
                let employees, organizations;
                try {
                    employees = await window.dbManager.getAll('employees');
                    organizations = await window.dbManager.getAll('organizations');
                } catch (dbError) {
                    console.error('从数据库获取数据失败:', dbError);
                    // 如果是初始化过程，尝试重试
                    if (isInitialization && retries < maxRetries - 1) {
                        retries++;
                        console.log(`数据库查询失败，${retries}秒后重试...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                        continue;
                    }
                    
                    // 添加错误提示
                    const errorOption = document.createElement('option');
                    errorOption.value = '';
                    errorOption.textContent = '获取数据失败，请稍后重试';
                    errorOption.disabled = true;
                    
                    if (identifierPositionFilter) {
                        identifierPositionFilter.appendChild(errorOption.cloneNode(true));
                    }
                    if (shiftOrderPositionFilter) {
                        shiftOrderPositionFilter.appendChild(errorOption);
                    }
                    return;
                }
                
                console.log('总共获取到员工数:', employees ? employees.length : 0);
                
                // 安全检查：确保employees和organizations是数组
                if (!Array.isArray(employees)) {
                    console.error('获取的员工数据不是数组');
                    employees = [];
                }
                if (!Array.isArray(organizations)) {
                    console.error('获取的机构数据不是数组');
                    organizations = [];
                }
                
                // 确定要处理的员工集合：如果部门为空，则使用所有员工；否则筛选特定部门的员工
                let targetEmployees;
                if (!deptName) {
                    console.log('部门为空（全部部门），加载所有员工的岗位数据');
                    targetEmployees = employees;
                } else {
                    console.log(`筛选部门：${deptName} 的员工`);
                    // 优化：仅使用部门名称进行匹配，不使用机构ID，不区分大小写
                    targetEmployees = employees.filter(emp => {
                        if (!emp.deptName) return false;
                        
                        const empDeptName = String(emp.deptName).toLowerCase().trim();
                        const deptNameLower = String(deptName).toLowerCase().trim();
                        
                        // 精确匹配部门名称
                        const deptMatch = empDeptName === deptNameLower;
                        
                        // 记录匹配情况用于调试
                        if (deptMatch) {
                            console.log(`员工 ${emp.name} (${emp.deptName}) 匹配部门 ${deptName}`);
                        }
                        
                        return deptMatch;
                    });
                }
                
                console.log(`部门内员工数: ${targetEmployees.length}`);
                
                // 收集岗位
                const positions = new Set();
                targetEmployees.forEach(emp => {
                    if (emp.position && emp.position.trim() !== '') {
                        positions.add(emp.position.trim());
                        console.log(`收集岗位: ${emp.position} 来自员工: ${emp.name}`);
                    }
                });
                
                console.log('部门内岗位数:', positions.size, '岗位列表:', Array.from(positions));
                
                // 如果没有岗位数据，添加一个提示选项
                if (positions.size === 0) {
                    const noPositionOption = document.createElement('option');
                    noPositionOption.value = '';
                    noPositionOption.textContent = '该部门暂无岗位数据';
                    noPositionOption.disabled = true;
                    
                    if (identifierPositionFilter) {
                        identifierPositionFilter.appendChild(noPositionOption.cloneNode(true));
                    }
                    if (shiftOrderPositionFilter) {
                        shiftOrderPositionFilter.appendChild(noPositionOption);
                    }
                    
                    console.log('未找到岗位数据，已添加提示选项');
                    return;
                }
                
                // 添加岗位选项到指定的筛选框
                const sortedPositions = Array.from(positions).sort();
                sortedPositions.forEach(position => {
                    // 为标识管理的岗位筛选框创建选项
                    if (identifierPositionFilter && (targetFilter === 'identifier' || !targetFilter)) {
                        const option1 = document.createElement('option');
                        option1.value = position;
                        option1.textContent = position;
                        identifierPositionFilter.appendChild(option1);
                        console.log(`添加岗位 ${position} 到标识管理筛选框`);
                    }
                    
                    // 为排班顺序管理的岗位筛选框创建选项
                    if (shiftOrderPositionFilter && (targetFilter === 'shiftOrder' || !targetFilter)) {
                        const option2 = document.createElement('option');
                        option2.value = position;
                        option2.textContent = position;
                        shiftOrderPositionFilter.appendChild(option2);
                        console.log(`添加岗位 ${position} 到排班顺序管理筛选框`);
                    }
                });
                
                // 恢复之前选中的值（如果存在）
                if (identifierPositionFilter && (targetFilter === 'identifier' || !targetFilter)) {
                    if (identifierPositionValue && Array.from(identifierPositionFilter.options).some(opt => opt.value === identifierPositionValue)) {
                        identifierPositionFilter.value = identifierPositionValue;
                        console.log('已恢复标识管理岗位筛选框选中值:', identifierPositionValue);
                    } else {
                        console.log('未找到匹配的岗位值，保持默认选中（全部岗位）');
                    }
                }
                
                if (shiftOrderPositionFilter && (targetFilter === 'shiftOrder' || !targetFilter)) {
                    if (shiftOrderPositionValue && Array.from(shiftOrderPositionFilter.options).some(opt => opt.value === shiftOrderPositionValue)) {
                        shiftOrderPositionFilter.value = shiftOrderPositionValue;
                        console.log('已恢复排班顺序管理岗位筛选框选中值:', shiftOrderPositionValue);
                    } else {
                        console.log('未找到匹配的岗位值，保持默认选中（全部岗位）');
                    }
                }
                
                console.log('岗位列表加载完成，已添加到下拉框');
                
                // 确保在初始化过程中触发change事件，用于网页刷新后的首次加载
                if ((isInitialization || forceTriggerChange) && typeof Event !== 'undefined') {
                    // 创建可冒泡的自定义事件，确保所有监听器都能接收到
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    
                    if (identifierPositionFilter && (targetFilter === 'identifier' || !targetFilter)) {
                        try {
                            identifierPositionFilter.dispatchEvent(changeEvent);
                            console.log('初始化过程中触发标识管理岗位筛选框change事件');
                        } catch (eventError) {
                            console.warn('触发标识管理岗位筛选框change事件失败:', eventError);
                            // 备选方案：直接调用相关的数据加载函数
                            if (window.loadIdentifierData) {
                                console.log('备选方案：直接调用loadIdentifierData函数');
                                window.loadIdentifierData();
                            }
                        }
                    }
                    if (shiftOrderPositionFilter && (targetFilter === 'shiftOrder' || !targetFilter)) {
                        try {
                            shiftOrderPositionFilter.dispatchEvent(changeEvent);
                            console.log('初始化过程中触发排班顺序管理岗位筛选框change事件');
                            // 事件触发成功，不再直接调用loadShiftOrderData
                        } catch (eventError) {
                            console.warn('触发排班顺序管理岗位筛选框change事件失败:', eventError);
                            // 备选方案：直接调用相关的数据加载函数
                            if (window.loadShiftOrderData) {
                                console.log('备选方案：直接调用loadShiftOrderData函数');
                                window.loadShiftOrderData();
                            }
                        }
                    }
                }
                
                // 成功加载，跳出重试循环
                return;
            } catch (error) {
                console.error('加载岗位列表失败:', error);
            }
            
            // 重试逻辑
            if (retries < maxRetries) {
                console.log(`加载失败，${retries}秒后重试(${retries}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            } else {
                // 所有重试都失败，显示错误信息
                console.error('所有重试都失败，无法加载岗位列表');
                
                // 添加错误提示到下拉框
                const errorOption = document.createElement('option');
                errorOption.value = '';
                errorOption.textContent = '加载岗位失败，请刷新页面重试';
                errorOption.disabled = true;
                
                // 重新获取筛选框元素
                const identifierPositionFilter = document.getElementById('identifierPositionFilter');
                const shiftOrderPositionFilter = document.getElementById('shiftOrderPositionFilter');
                
                if (identifierPositionFilter) {
                    identifierPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                    identifierPositionFilter.appendChild(errorOption.cloneNode(true));
                }
                if (shiftOrderPositionFilter) {
                    shiftOrderPositionFilter.innerHTML = '<option value="">全部岗位</option>';
                    shiftOrderPositionFilter.appendChild(errorOption);
                }
            }
        }
    } finally {
        // 重置执行锁，确保后续调用能正常进行
        loadingPositions = false;
        console.log('岗位列表加载函数执行完成，重置执行锁');
    }
}

// 文件结束标记
