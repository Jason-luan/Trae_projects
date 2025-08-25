// 搜索功能模块

// 存储当前活动的搜索结果模态框
window.searchResultsModal = null;

// 初始化搜索功能
window.initSearchFunction = function() {
    const searchInput = document.querySelector('.search-box input');
    if (!searchInput) {
        console.error('搜索框未找到');
        return;
    }

    // 添加搜索功能到window对象，以便全局访问
    window.searchEntities = async function(keyword) {
        if (!keyword || keyword.trim() === '') {
            if (window.showNotification) {
                window.showNotification('请输入搜索关键词', 'warning');
            } else {
                alert('请输入搜索关键词');
            }
            return;
        }

        try {
            // 从数据库获取所有机构和人员
            const organizations = await window.dbManager.getAll('organizations');
            const employees = await window.dbManager.getAll('employees');

            // 搜索关键词转为小写
            const searchLower = keyword.toLowerCase().trim();

            // 过滤机构数据
            const matchedOrganizations = organizations.filter(org => 
                org.name.toLowerCase().includes(searchLower) ||
                (org.code && org.code.toLowerCase().includes(searchLower)) ||
                (org.description && org.description.toLowerCase().includes(searchLower))
            );

            // 过滤人员数据
            const matchedEmployees = employees.filter(emp => 
                emp.name.toLowerCase().includes(searchLower) ||
                (emp.number && String(emp.number).toLowerCase().includes(searchLower)) ||
                (emp.position && emp.position.toLowerCase().includes(searchLower)) ||
                (emp.deptName && emp.deptName.toLowerCase().includes(searchLower))
            );

            // 显示搜索结果
            showSearchResults(matchedOrganizations, matchedEmployees, keyword);

        } catch (error) {
            if (window.showNotification) {
                window.showNotification('搜索失败: ' + error.message, 'error');
            } else {
                alert('搜索失败: ' + error.message);
            }
        }
    };

    // 添加键盘事件监听
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            window.searchEntities(searchInput.value);
        }
    });

    // 添加输入事件监听（可选，用于实时反馈）
    searchInput.addEventListener('input', () => {
        // 可以添加搜索提示等功能
    });

    console.log('搜索功能已初始化');
};

// 显示搜索结果
function showSearchResults(organizations, employees, keyword) {
    // 移除已存在的搜索结果模态框
    if (window.searchResultsModal) {
        document.body.removeChild(window.searchResultsModal);
    }

    // 创建新的搜索结果模态框
    window.searchResultsModal = document.createElement('div');
    window.searchResultsModal.className = 'search-results-modal';
    window.searchResultsModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    `;

    // 搜索结果容器
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results-container';
    resultsContainer.style.cssText = `
        background: var(--primary);
        border-radius: 12px;
        padding: 24px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    `;

    // 搜索结果标题
    const title = document.createElement('h2');
    title.textContent = `搜索结果: "${keyword}"`;
    title.style.cssText = `
        margin-bottom: 20px;
        color: var(--text-primary);
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 20px;
        cursor: pointer;
        padding: 5px;
    `;
    closeBtn.onclick = () => {
        document.body.removeChild(window.searchResultsModal);
        window.searchResultsModal = null;
    };

    title.appendChild(closeBtn);
    resultsContainer.appendChild(title);

    // 搜索统计信息
    const stats = document.createElement('div');
    stats.className = 'search-stats';
    stats.textContent = `找到 ${organizations.length} 个机构和 ${employees.length} 个人员`;
    stats.style.cssText = `
        margin-bottom: 20px;
        color: var(--text-secondary);
        font-size: 14px;
    `;
    resultsContainer.appendChild(stats);

    // 如果没有结果
    if (organizations.length === 0 && employees.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = `<i class="fas fa-search"></i> 未找到匹配的结果`;
        noResults.style.cssText = `
            text-align: center;
            padding: 40px 0;
            color: var(--text-secondary);
        `;
        resultsContainer.appendChild(noResults);
    } else {
        // 机构结果
        if (organizations.length > 0) {
            const orgSection = createSearchSection('机构', organizations, 'org');
            resultsContainer.appendChild(orgSection);
        }

        // 人员结果
        if (employees.length > 0) {
            const empSection = createSearchSection('人员', employees, 'emp');
            resultsContainer.appendChild(empSection);
        }
    }

    // 添加底部关闭按钮
    const bottomCloseContainer = document.createElement('div');
    bottomCloseContainer.className = 'bottom-close-container';
    bottomCloseContainer.style.cssText = `
        margin-top: 24px;
        text-align: center;
    `;

    const bottomCloseBtn = document.createElement('button');
    bottomCloseBtn.className = 'bottom-close-btn';
    bottomCloseBtn.textContent = '关闭';
    bottomCloseBtn.style.cssText = `
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px 24px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.3s;
    `;
    bottomCloseBtn.onmouseover = () => {
        bottomCloseBtn.style.background = 'var(--accent-light)';
    };
    bottomCloseBtn.onmouseout = () => {
        bottomCloseBtn.style.background = 'var(--accent)';
    };
    bottomCloseBtn.onclick = () => {
        document.body.removeChild(window.searchResultsModal);
        window.searchResultsModal = null;
    };

    bottomCloseContainer.appendChild(bottomCloseBtn);
    resultsContainer.appendChild(bottomCloseContainer);

    window.searchResultsModal.appendChild(resultsContainer);
    document.body.appendChild(window.searchResultsModal);
}

// 创建搜索结果区域
function createSearchSection(title, items, type) {
    const section = document.createElement('div');
    section.className = `search-section search-${type}-section`;
    section.style.cssText = `
        margin-bottom: 24px;
    `;

    // 区域标题
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = title;
    sectionTitle.style.cssText = `
        margin-bottom: 12px;
        color: var(--accent-light);
        font-size: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 8px;
    `;
    section.appendChild(sectionTitle);

    // 结果列表
    const list = document.createElement('div');
    list.className = 'search-results-list';

    items.forEach(item => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.style.cssText = `
            background: var(--card-bg);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s;
        `;
        resultItem.onmouseover = () => {
            resultItem.style.background = 'rgba(255, 255, 255, 0.1)';
        };
        resultItem.onmouseout = () => {
            resultItem.style.background = 'var(--card-bg)';
        };

        // 根据类型显示不同内容
        if (type === 'org') {
            resultItem.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 5px;">${highlightText(item.name)}</div>
                <div style="color: var(--text-secondary); font-size: 14px;">机构号: ${item.code || '-'}</div>
                <div style="color: var(--text-secondary); font-size: 14px;">部门: ${item.description || '-'}</div>
                <div style="color: var(--text-secondary); font-size: 14px;">备注: ${item.remark || '-'}</div>
            `;
            resultItem.onclick = async () => {
                // 点击机构，跳转到机构详情或编辑页面
                document.body.removeChild(window.searchResultsModal);
                window.searchResultsModal = null;
                // 这里可以添加跳转到机构编辑的逻辑
                // 先找到机构标签页
                const orgTab = document.querySelector('.nav-item[data-target="organizations"]');
                if (orgTab) {
                    orgTab.click();
                    // 延迟执行编辑，确保标签页已切换
                    setTimeout(() => {
                        if (window.editOrganization) {
                            window.editOrganization(item.id);
                        }
                    }, 300);
                }
            };
        } else if (type === 'emp') {
            resultItem.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 5px;">${highlightText(item.name)}</div>
                <div style="color: var(--text-secondary); font-size: 14px;">工号: ${item.number}</div>
                <div style="color: var(--text-secondary); font-size: 14px;">职位: ${item.position || '-'}</div>
                <div style="color: var(--text-secondary); font-size: 14px;">部门: ${item.deptName || '-'}</div>
            `;
            resultItem.onclick = async () => {
                // 点击人员，跳转到人员详情或编辑页面
                document.body.removeChild(window.searchResultsModal);
                window.searchResultsModal = null;
                // 这里可以添加跳转到人员编辑的逻辑
                // 先找到人员标签页
                const empTab = document.querySelector('.nav-item[data-target="employees"]');
                if (empTab) {
                    empTab.click();
                    // 延迟执行编辑，确保标签页已切换
                    setTimeout(() => {
                        if (window.editEmployee) {
                            window.editEmployee(item.id);
                        }
                    }, 300);
                }
            };
        }

        list.appendChild(resultItem);
    });

    section.appendChild(list);
    return section;
}

// 高亮搜索文本
function highlightText(text) {
    // 这里简单返回原文本，可以根据需要实现高亮功能
    return text;
}