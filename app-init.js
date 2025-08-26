// 全局数据库管理器实例
let dbManager = null;

// DOM加载完成后执行初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 创建并初始化数据库管理器
        dbManager = new IndexedDBManager();
        await dbManager.init();
        
        console.log('数据库初始化成功');
        
        // 初始化选项卡
        initTabs();
        
        // 加载机构数据
        loadOrganizations();
        
        // 加载员工数据
        loadEmployees();
        
        // 加载班次数据
        loadShifts();
        
        // 初始化导入导出事件
        initImportExportEvents();
        
        // 初始化搜索功能
        initSearchFunctions();
        
        // 初始化班次管理
        initShiftManagement();
        
        // 初始化标识管理
        initIdentifierManagement();
        
        // 设置员工号筛选器
        document.getElementById('employeeId-filter').addEventListener('input', filterEmployees);
        
        // 显示成功通知
        showNotification('系统初始化成功', 'success');
        
    } catch (error) {
        console.error('初始化失败:', error);
        showNotification('系统初始化失败: ' + error.message, 'error');
    }
});

// 初始化选项卡
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有选项卡的活动状态
            tabs.forEach(t => t.classList.remove('active'));
            
            // 添加当前选项卡的活动状态
            this.classList.add('active');
            
            // 隐藏所有内容区域
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.style.display = 'none');
            
            // 显示对应的内容区域
            const tabId = this.getAttribute('data-tab') + '-tab';
            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                activeContent.style.display = 'block';
            }
            
            // 特殊处理：当切换到班次管理选项卡时，重新加载班次数据
            if (tabId === 'shifts-tab') {
                loadShifts();
            }
            
            // 特殊处理：当切换到标识管理选项卡时，重新加载标识数据
            if (tabId === 'identifiers-tab') {
                loadIdentifiers();
            }
        });
    });
    
    // 默认显示第一个选项卡
    const firstTab = document.querySelector('.tab');
    if (firstTab) {
        firstTab.click();
    }
}

// 加载机构数据
async function loadOrganizations() {
    try {
        const organizations = await dbManager.getAllData('organizations');
        console.log('加载机构数据:', organizations);
        
        // 更新机构下拉框
        updateOrganizationDropdown(organizations);
        
        // 初始化机构管理表格
        initOrganizationTable(organizations);
        
    } catch (error) {
        console.error('加载机构数据失败:', error);
        showNotification('加载机构数据失败', 'error');
    }
}

// 加载员工数据
async function loadEmployees() {
    try {
        const employees = await dbManager.getAllData('employees');
        console.log('加载员工数据:', employees);
        
        // 初始化员工管理表格
        initEmployeeTable(employees);
        
    } catch (error) {
        console.error('加载员工数据失败:', error);
        showNotification('加载员工数据失败', 'error');
    }
}

// 加载班次数据
async function loadShifts() {
    try {
        const shifts = await dbManager.getAllData('shifts');
        console.log('加载班次数据:', shifts);
        
        // 更新班次管理表格
        updateShiftTable(shifts);
        
    } catch (error) {
        console.error('加载班次数据失败:', error);
        showNotification('加载班次数据失败', 'error');
    }
}

// 加载标识数据
async function loadIdentifiers() {
    try {
        // 调用标识管理模块的加载函数
        if (window.loadIdentifiers) {
            await window.loadIdentifiers();
        }
    } catch (error) {
        console.error('加载标识数据失败:', error);
        showNotification('加载标识数据失败', 'error');
    }
}

// 初始化导入导出事件
function initImportExportEvents() {
    // 这里可以添加全局的导入导出事件处理
    // 各个模块会有自己特定的导入导出实现
}

// 初始化搜索功能
function initSearchFunctions() {
    // 这里可以添加全局的搜索功能初始化
    // 各个模块会有自己特定的搜索实现
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 自动关闭
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 员工筛选函数
function filterEmployees() {
    // 获取筛选值
    const filterValue = document.getElementById('employeeId-filter').value.toLowerCase();
    
    // 获取所有员工行
    const rows = document.querySelectorAll('#employee-table tbody tr');
    
    // 筛选行
    rows.forEach(row => {
        const employeeId = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        if (employeeId.includes(filterValue)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// 更新机构下拉框
function updateOrganizationDropdown(organizations) {
    // 更新员工管理中的机构下拉框
    const orgSelect = document.getElementById('organization-select');
    if (orgSelect) {
        // 清空现有选项
        orgSelect.innerHTML = '<option value="">请选择机构</option>';
        
        // 添加机构选项
        organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = org.name;
            orgSelect.appendChild(option);
        });
    }
}

// 初始化机构管理表格
function initOrganizationTable(organizations) {
    // 这里由base-settings.js实现
}

// 初始化员工管理表格
function initEmployeeTable(employees) {
    // 这里由base-settings.js实现
}

// 更新班次管理表格
function updateShiftTable(shifts) {
    // 这里由shift-management.js实现
}