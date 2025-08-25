// 移除模块化导入，现在通过传统脚本加载

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
    // 初始化数据库
    console.log('开始初始化数据库...');
    // 确保dbManager作为全局变量存在
    if (!window.dbManager) {
        window.dbManager = new IndexedDBManager();
        console.log('已创建全局dbManager实例');
    }
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
        })
        .catch(error => {
            console.error('数据库初始化失败:', error);
            if (window.showNotification) {
                window.showNotification('数据库初始化失败: ' + error.message, 'error');
            }
        });
});

// 文件结束标记
