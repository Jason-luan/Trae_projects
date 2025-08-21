// 移除模块化导入，现在通过传统脚本加载

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
    // 初始化数据库
    console.log('开始初始化数据库...');
    // 确保使用全局的dbManager
    const dbManager = window.dbManager;
    
    if (!dbManager) {
        console.error('dbManager未定义');
        return;
    }
    
    dbManager.ensureInitialized()
        .then(() => {
            console.log('数据库初始化成功');
            
            // 检查是否有机构数据
            return dbManager.getAll('organizations')
                .then(organizations => {
                    // 如果没有数据，添加示例数据
                    if (organizations.length === 0) {
                        const sampleOrgs = [
                            { code: '0001', name: '研发部', description: '负责产品研发', remark: '核心部门', createdAt: new Date(), updatedAt: new Date(), status: 'active' },
                            { code: '0002', name: '市场部', description: '负责市场推广', remark: '营销部门', createdAt: new Date(), updatedAt: new Date(), status: 'active' },
                            { code: '0003', name: '人力资源部', description: '负责人力资源管理', remark: '行政部门', createdAt: new Date(), updatedAt: new Date(), status: 'active' }
                        ];
                        
                        return dbManager.bulkSave('organizations', sampleOrgs)
                            .then(() => {
                                console.log('示例数据添加成功');
                                return true;
                            });


                    }
                    return false;
                });
        })
        .then(addedSampleData => {
            // 初始化选项卡
            if (window.initTabs) {
                window.initTabs();
                console.log('选项卡初始化完成');
            } else {
                console.error('initTabs函数未定义');
            }
            
            // 加载数据
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
            
            // 初始化导入导出事件
            if (window.initImportExportEvents) {
                window.initImportExportEvents();
            } else {
                console.log('initImportExportEvents函数未定义，跳过');
            }
            
            if (addedSampleData) {
                if (window.showNotification) {
                    window.showNotification('已添加示例机构数据');
                }
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
