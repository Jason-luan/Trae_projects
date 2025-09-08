// 排班计划管理
class SchedulePlanning {
    constructor() {
        // 初始化数据库管理器
        this.dbManager = new IndexedDBManager();
        this.scheduleManager = new ScheduleManager();
        
        // 当前选中的年份和月份
        this.currentYear = parseInt(document.getElementById('scheduleYearInput').value);
        this.currentMonth = parseInt(document.getElementById('scheduleMonthInput').value);
        
        // 初始化事件监听器
        this.initEventListeners();
        
        // 加载机构数据
        this.loadOrganizations();
    }
    
    // 初始化事件监听器
    initEventListeners() {
        // 侧边栏导航点击事件 - 使用JavaScript遍历的方式查找
        let scheduleNavItem = null;
        const navItems = document.querySelectorAll('.nav-item');
        
        // 遍历所有导航项，找到包含"排班计划"文本的项
        navItems.forEach(item => {
            const span = item.querySelector('span');
            if (span && span.textContent.trim() === '排班计划') {
                scheduleNavItem = item;
            }
        });
        
        // 如果找不到，回退到nth-child选择器
        if (!scheduleNavItem) {
            scheduleNavItem = document.querySelector('.nav-item:nth-child(3)');
        }
        
        if (scheduleNavItem) {
            scheduleNavItem.addEventListener('click', () => {
                this.showSchedulePlanning();
            });
        } else {
            console.warn('未找到排班计划导航项，将尝试在页面加载完成后重新查找');
            // 延迟查找，确保DOM完全加载
            setTimeout(() => {
                let retryScheduleNavItem = null;
                const retryNavItems = document.querySelectorAll('.nav-item');
                retryNavItems.forEach(item => {
                    const span = item.querySelector('span');
                    if (span && span.textContent.trim() === '排班计划') {
                        retryScheduleNavItem = item;
                    }
                });
                
                if (!retryScheduleNavItem) {
                    retryScheduleNavItem = document.querySelector('.nav-item:nth-child(3)');
                }
                
                if (retryScheduleNavItem) {
                    retryScheduleNavItem.addEventListener('click', () => {
                        this.showSchedulePlanning();
                    });
                    console.log('延迟查找排班计划导航项成功');
                }
            }, 1000);
        }
        
        // 年份和月份选择事件
        document.getElementById('scheduleYearInput').addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.updateDateRange();
            this.generateCalendarHeaders();
            this.loadScheduleData();
        });
        
        document.getElementById('scheduleMonthInput').addEventListener('change', (e) => {
            this.currentMonth = parseInt(e.target.value);
            this.updateDateRange();
            this.generateCalendarHeaders();
            this.loadScheduleData();
        });
        
        // 机构、部门、岗位筛选事件
        document.getElementById('scheduleOrganizationSelect').addEventListener('change', () => {
            this.loadDepartmentsByOrganization();
            // 不再显式清空岗位选择，让loadDepartmentsByOrganization方法内部处理
            this.loadScheduleData();
        });
        
        document.getElementById('scheduleDepartmentSelect').addEventListener('change', () => {
            this.loadPositionsByDepartment();
            this.loadScheduleData();
        });
        
        document.getElementById('schedulePositionSelect').addEventListener('change', () => {
            this.loadScheduleData();
        });
        
        // 操作按钮事件
        document.getElementById('generateScheduleBtn').addEventListener('click', () => {
            this.generateSchedule();
        });
        
        document.getElementById('exportScheduleBtn').addEventListener('click', () => {
            this.exportSchedule();
        });
        
        document.getElementById('refreshScheduleBtn').addEventListener('click', () => {
            this.loadScheduleData();
        });
    }
    
    // 显示排班计划内容
    showSchedulePlanning() {
        // 隐藏所有内容区域
        const allContentSections = document.querySelectorAll('.content-section');
        allContentSections.forEach(section => {
            section.style.display = 'none';
        });
        
        // 显示排班计划内容
        const scheduleContent = document.getElementById('schedule-planning-content');
        if (scheduleContent) {
            scheduleContent.style.display = 'block';
        }
        
        // 更新活动的导航项 - 使用更可靠的方式查找排班计划导航项
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // 查找排班计划导航项的更兼容方式
        let scheduleNavItem = null;
        navItems.forEach(item => {
            const span = item.querySelector('span');
            if (span && span.textContent.trim() === '排班计划') {
                scheduleNavItem = item;
            }
        });
        
        // 如果上述方式找不到，回退到nth-child选择器
        if (!scheduleNavItem) {
            scheduleNavItem = document.querySelector('.nav-item:nth-child(3)');
        }
        
        if (scheduleNavItem) {
            scheduleNavItem.classList.add('active');
        } else {
            console.warn('未找到排班计划导航项，无法设置激活状态');
        }
        
        // 初始化数据显示
        this.updateDateRange();
        this.generateCalendarHeaders();
        // 关键修复：确保在显示排班计划页面时加载数据
        this.loadScheduleData();
    }
    
    // 加载机构数据
    async loadOrganizations() {
        try {
            const organizations = await this.dbManager.getAll('organizations');
            const organizationSelect = document.getElementById('scheduleOrganizationSelect');
            
            // 清空选择框
            organizationSelect.innerHTML = '<option value="全部机构">全部机构</option>';
            
            // 使用Set来避免重复选项
            const organizationNames = new Set();
            
            // 添加机构选项，避免重复
            organizations.forEach(org => {
                if (!organizationNames.has(org.name)) {
                    const option = document.createElement('option');
                    option.value = org.name;  // 将value设置为机构名称，而不是ID
                    option.textContent = org.name;
                    organizationSelect.appendChild(option);
                    organizationNames.add(org.name);
                }
            });
        } catch (error) {
            console.error('加载机构数据失败:', error);
        }
    }
    
    // 根据选择的机构加载部门
    async loadDepartmentsByOrganization() {
        const organizationSelect = document.getElementById('scheduleOrganizationSelect');
        const organizationValue = organizationSelect.value;  // 直接使用value而不是textContent
        const departmentSelect = document.getElementById('scheduleDepartmentSelect');
        const positionSelect = document.getElementById('schedulePositionSelect');
        
        // 保存用户之前选择的岗位值
        const previousPositionValue = positionSelect.value;
        
        // 清空部门和岗位选择框
        departmentSelect.innerHTML = '<option value="全部部门">全部部门</option>';
        positionSelect.innerHTML = '<option value="全部岗位">全部岗位</option>';
        
        // 记录添加的部门名称，避免重复
        const departmentNames = new Set();
        
        try {
            if (organizationValue && organizationValue !== '全部机构') {
                // 如果选择了具体机构，加载该机构下的部门
                // 根据organizations表结构，每个记录代表一个"机构-部门"组合
                // name字段是机构名称，description字段是部门名称
                const organizations = await this.dbManager.getAll('organizations');
                
                // 筛选出该机构名称下的所有部门记录
                // 然后按部门名称去重
                const departments = organizations
                    .filter(org => org.name === organizationValue && org.description) // 按机构名称筛选
                    .map(org => ({ id: org.id, name: org.description }))
                    .filter((dept, index, self) => 
                        self.findIndex(d => d.name === dept.name) === index // 按部门名称去重
                    );
                
                departments.forEach(dept => {
                    if (!departmentNames.has(dept.name)) {
                        const option = document.createElement('option');
                        option.value = dept.name.toLowerCase().trim();  // 存储为小写并去除空格
                        option.textContent = dept.name;
                        departmentSelect.appendChild(option);
                        departmentNames.add(dept.name);
                    }
                });
                
                // 如果之前有选择部门，尝试选择第一个部门
                if (departments.length > 0) {
                    departmentSelect.value = departments[0].name.toLowerCase().trim();  // 使用小写并去除空格的名称
                    // 加载该部门下的岗位
                    await this.loadPositionsByDepartment();
                    
                    // 尝试恢复之前选择的岗位值（如果存在）
                    if (previousPositionValue) {
                        for (let i = 0; i < positionSelect.options.length; i++) {
                            if (positionSelect.options[i].value === previousPositionValue) {
                                positionSelect.value = previousPositionValue;
                                break;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('加载部门数据失败:', error);
        }
    }
    
    // 根据选择的部门加载岗位
    async loadPositionsByDepartment() {
        const departmentSelect = document.getElementById('scheduleDepartmentSelect');
        const departmentValue = departmentSelect.value;  // 直接使用value获取部门名称（已经是小写并去除空格的）
        const positionSelect = document.getElementById('schedulePositionSelect');
        
        // 清空岗位选择框，确保默认选项文本和值一致
        positionSelect.innerHTML = '<option value="全部岗位">全部岗位</option>';
        
        try {
            if (departmentValue && departmentValue !== '全部部门') {
                // 如果选择了部门，加载该部门下的岗位
                // 注意：员工数据中存储的是部门名称(deptName)而不是部门ID
                const employees = await this.dbManager.getAll('employees');
                const positions = [...new Set(
                    employees
                        .filter(emp => {
                            // 由于departmentValue已经是小写并去除空格的，这里直接比较
                            const empDeptName = emp.deptName ? emp.deptName.toLowerCase().trim() : '';
                            return empDeptName === departmentValue;
                        })
                        .map(emp => emp.position)
                        .filter(pos => pos)
                )];
                
                positions.forEach(pos => {
                    const option = document.createElement('option');
                    option.value = pos;
                    option.textContent = pos;
                    positionSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载岗位数据失败:', error);
        }
    }
    
    // 更新日期范围显示
    updateDateRange() {
        const dateRangeElement = document.getElementById('scheduleDateRange');
        if (dateRangeElement) {
            dateRangeElement.textContent = `${this.currentYear}年${this.currentMonth}月`;
        }
        
        const scheduleTitleElement = document.getElementById('scheduleTitle');
        if (scheduleTitleElement) {
            scheduleTitleElement.textContent = `${this.currentYear}年${this.currentMonth}月排班计划`;
        }
    }
    
    // 生成日历表头
    generateCalendarHeaders() {
        const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth, 0);
        const daysInMonth = lastDay.getDate();
        
        // 生成日期列头
        const dateHeaderRow = document.querySelector('#scheduleTable thead tr:first-child');
        
        // 清除现有的日期列（保留前4个固定列）
        const existingDateCells = dateHeaderRow.querySelectorAll('th:not(.fixed-column)');
        existingDateCells.forEach(cell => cell.remove());
        
        // 生成星期表头
        const weekdayHeaderRow = document.getElementById('weekdayHeader');
        weekdayHeaderRow.innerHTML = '';
        
        // 添加日期列
        for (let i = 1; i <= daysInMonth; i++) {
            // 添加日期表头
            const dateCell = document.createElement('th');
            dateCell.textContent = i;
            // 设置最小宽度，确保表格能够水平滚动
            dateCell.style.minWidth = '60px';
            dateCell.style.whiteSpace = 'nowrap';
            
            // 检查是否是周末
            const currentDate = new Date(this.currentYear, this.currentMonth - 1, i);
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                dateCell.style.backgroundColor = '#fff3cd';
            }
            
            dateHeaderRow.appendChild(dateCell);
            
            // 添加星期表头
            const weekdayCell = document.createElement('th');
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            weekdayCell.textContent = weekdays[dayOfWeek];
            // 设置最小宽度，确保表格能够水平滚动
            weekdayCell.style.minWidth = '60px';
            weekdayCell.style.whiteSpace = 'nowrap';
            
            // 周末样式
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                weekdayCell.style.backgroundColor = '#fff3cd';
            }
            
            weekdayHeaderRow.appendChild(weekdayCell);
        }
        
        // 确保表格容器有水平滚动功能
            const tableWrapper = document.querySelector('.table-wrapper');
            if (tableWrapper) {
                tableWrapper.style.overflowX = 'auto';
                // 移除minWidth设置，让CSS样式生效
            }
        
        // 移除JavaScript设置的宽度，让CSS样式生效
        const scheduleTable = document.getElementById('scheduleTable');
        if (scheduleTable) {
            scheduleTable.style.width = ''; // 移除内联样式
            scheduleTable.style.minWidth = ''; // 移除内联样式
        }
    }
    
    // 加载排班数据
    async loadScheduleData() {
        console.log('开始加载排班数据');
        
        // 注意：员工数据中存储的是orgName而不是organizationId
        const organizationSelect = document.getElementById('scheduleOrganizationSelect');
        console.log('机构选择框:', organizationSelect);
        const organizationValue = organizationSelect.value;
        console.log('选中的机构值:', organizationValue);
        
        // 获取部门选择框的值
        const departmentSelect = document.getElementById('scheduleDepartmentSelect');
        console.log('部门选择框:', departmentSelect);
        const departmentValue = departmentSelect.value;
        console.log('选中的部门值:', departmentValue);
        
        const position = document.getElementById('schedulePositionSelect').value;
        console.log('选中的岗位:', position);
        
        try {
            // 显示加载状态
            this.showLoading(true);
            
            // 加载员工数据
            let employees = await this.dbManager.getAll('employees');
            console.log('原始员工数据数量:', employees.length);
            console.log('原始员工数据示例:', employees.slice(0, 2));
            
            // 检查数据库是否为空
            if (employees.length === 0) {
                console.log('数据库中没有员工数据。请先导入员工数据。');
                // 更新员工数量统计
                const scheduleStatistics = document.getElementById('scheduleStatistics');
                if (scheduleStatistics) {
                    scheduleStatistics.innerHTML = '共 <strong>0</strong> 人 <span class="text-info">（请先在基础设置中导入员工数据）</span>';
                }
                // 渲染空表格
                this.renderScheduleTable([], []);
                // 隐藏加载状态
                this.showLoading(false);
                return;
            }
            
            // 应用筛选条件
            if (organizationValue && organizationValue !== '全部机构' && organizationValue !== '') {
                const filteredByOrg = employees.filter(emp => 
                    emp.orgName && emp.orgName.toLowerCase().trim() === organizationValue.toLowerCase().trim()
                );
                console.log(`机构筛选后员工数量: ${filteredByOrg.length} (机构: ${organizationValue})`);
                employees = filteredByOrg;
            }
            
            if (departmentValue && departmentValue !== '全部部门' && departmentValue !== '') {
                // 使用部门名称而不是部门ID来筛选员工
                console.log('执行部门筛选:', departmentValue);
                console.log('筛选前的员工数量:', employees.length);
                
                const filteredByDept = employees.filter(emp => {
                    // 由于选项的value已经是小写并去除空格的，这里可以直接比较
                    const empDeptName = emp.deptName ? emp.deptName.toLowerCase().trim() : '';
                    console.log(`比较: ${empDeptName} === ${departmentValue} ? ${empDeptName === departmentValue}`);
                    return empDeptName === departmentValue;
                });
                
                console.log(`部门筛选后员工数量: ${filteredByDept.length} (部门: ${departmentValue})`);
                employees = filteredByDept;
            }
            
            if (position && position !== "全部岗位") {
                const filteredByPosition = employees.filter(emp => 
                    emp.position && emp.position.toLowerCase().trim() === position.toLowerCase().trim()
                );
                console.log(`岗位筛选后员工数量: ${filteredByPosition.length} (岗位: ${position})`);
                employees = filteredByPosition;
            } else {
                console.log('未执行岗位筛选（选择了全部岗位）');
            }
            
            console.log('最终筛选后的员工数据数量:', employees.length);
            
            // 加载排班数据
            const scheduleData = await this.scheduleManager.getScheduleByMonth(this.currentYear, this.currentMonth);
            console.log('排班数据:', scheduleData);
            // 确保scheduleData始终是一个对象（getScheduleByMonth返回的是以员工号为键的对象）
            const safeScheduleData = scheduleData && typeof scheduleData === 'object' ? scheduleData : {};
            
            // 更新员工数量统计
            const scheduleStatistics = document.getElementById('scheduleStatistics');
            if (scheduleStatistics) {
                if (employees.length === 0) {
                    scheduleStatistics.innerHTML = '共 <strong>0</strong> 人 <span class="text-info">（当前筛选条件下没有匹配的员工）</span>';
                } else {
                    // 正常更新员工数量统计
                    scheduleStatistics.innerHTML = '共 <strong>' + employees.length + '</strong> 人';
                }
            }
            
            // 渲染排班表
            this.renderScheduleTable(employees, safeScheduleData);
        } catch (error) {
            console.error('加载排班数据失败:', error);
            // 即使出错也要尝试渲染员工列表
            try {
                const employees = await this.dbManager.getAll('employees');
                this.renderScheduleTable(employees || [], []);
            } catch (innerError) {
                console.error('再次尝试加载员工数据失败:', innerError);
                this.renderScheduleTable([], []);
            }
            // 显示错误信息
            const scheduleStatistics = document.getElementById('scheduleStatistics');
            if (scheduleStatistics) {
                scheduleStatistics.innerHTML = '共 <strong>0</strong> 人 <span class="text-danger">（加载数据时出错）</span>';
            }
        } finally {
            // 隐藏加载状态
            this.showLoading(false);
        }
    }

    // 渲染排班表
    renderScheduleTable(employees, scheduleData) {
        const tableBody = document.getElementById('scheduleTableBody');
        tableBody.innerHTML = '';
        
        console.log('渲染表格的员工数据数量:', employees.length);
        
        // 如果没有员工数据，显示空数据提示
        if (employees.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = tableBody.parentElement.querySelectorAll('th').length;
            emptyCell.className = 'no-data';
            emptyCell.innerHTML = '<i class="fas fa-users-slash" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>暂无符合条件的员工数据';
            emptyCell.style.textAlign = 'center';
            emptyCell.style.padding = '40px';
            emptyCell.style.color = '#9ca3af';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }

        // 为每个员工创建一行
        employees.forEach((employee, index) => {
            const row = document.createElement('tr');
            
            // 添加序号列
            const serialCell = document.createElement('td');
            serialCell.className = 'fixed-column';
            serialCell.textContent = index + 1; // 序号从1开始
            serialCell.style.whiteSpace = 'nowrap';
            serialCell.style.overflow = 'visible';
            serialCell.style.minWidth = '60px'; // 设置最小宽度
            serialCell.style.textAlign = 'center'; // 居中显示
            row.appendChild(serialCell);
            
            // 添加员工基本信息列（固定列）
            const idCell = document.createElement('td');
            idCell.className = 'fixed-column';
            idCell.textContent = employee.number || '无员工号'; // 显示员工号而不是ID
            // 添加样式使单元格宽度按内容适应
            idCell.style.whiteSpace = 'nowrap';
            idCell.style.overflow = 'visible';
            idCell.style.minWidth = '100px'; // 设置最小宽度
            row.appendChild(idCell);
            
            const nameCell = document.createElement('td');
            nameCell.className = 'fixed-column';
            nameCell.textContent = employee.name;
            nameCell.style.whiteSpace = 'nowrap';
            nameCell.style.overflow = 'visible';
            nameCell.style.minWidth = '100px'; // 设置最小宽度
            row.appendChild(nameCell);
            
            const departmentCell = document.createElement('td');
            departmentCell.className = 'fixed-column';
            departmentCell.textContent = employee.deptName || '未知部门';
            departmentCell.style.whiteSpace = 'nowrap';
            departmentCell.style.overflow = 'visible';
            departmentCell.style.minWidth = '120px'; // 设置最小宽度
            row.appendChild(departmentCell);
            
            const positionCell = document.createElement('td');
            positionCell.className = 'fixed-column';
            positionCell.textContent = employee.position || '未知岗位';
            positionCell.style.whiteSpace = 'nowrap';
            positionCell.style.overflow = 'visible';
            positionCell.style.minWidth = '120px'; // 设置最小宽度
            row.appendChild(positionCell);
            
            // 获取该员工的排班记录 - 注意scheduleData是以员工号为键的对象
            const employeeSchedule = (scheduleData && typeof scheduleData === 'object') ? 
                scheduleData[employee.number] || {} : {};
            
            // 获取当月天数
            const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
            
            // 添加每天的排班单元格
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('td');
                
                // 获取当天的排班班次
                let shift = '';
                if (employeeSchedule.schedule && Array.isArray(employeeSchedule.schedule)) {
                    // 查找对应日期的排班信息
                    const daySchedule = employeeSchedule.schedule.find(s => s.day === day);
                    if (daySchedule && daySchedule.shiftCode) {
                        shift = daySchedule.shiftCode;
                    }
                }
                
                // 设置单元格内容和样式
                cell.textContent = shift;
                
                // 根据班次类型添加样式类
                if (shift.includes('G') || shift.includes('g')) {
                    cell.className = 'shift-g';
                } else if (shift.includes('休')) {
                    cell.className = 'shift-xiu';
                } else if (shift.includes('Y') || shift.includes('y')) {
                    cell.className = 'shift-y';
                }
                
                // 添加样式使单元格宽度按内容适应
                cell.style.whiteSpace = 'nowrap';
                cell.style.overflow = 'visible';
                cell.style.minWidth = '60px'; // 设置最小宽度，确保表格能够水平滚动
                
                row.appendChild(cell);
            }
            
            tableBody.appendChild(row);
        });
        
        // 确保表格容器有水平滚动功能
        const tableWrapper = document.querySelector('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.style.overflowX = 'auto';
            tableWrapper.style.minWidth = ''; // 移除minWidth设置，让CSS样式生效
        }
        
        // 移除JavaScript设置的宽度，让CSS样式生效
        const scheduleTable = document.getElementById('scheduleTable');
        if (scheduleTable) {
            scheduleTable.style.width = ''; // 移除内联样式
            scheduleTable.style.minWidth = ''; // 移除内联样式
        }
        
        // 强制容器重排，确保水平滚动正常工作
        setTimeout(() => {
            const container = document.getElementById('schedule-planning-content');
            if (container && tableWrapper) {
                // 触发强制重排
                container.offsetHeight;
                tableWrapper.offsetHeight;
                
                // 确保表格容器能够正确滚动
                tableWrapper.style.width = '100%';
                tableWrapper.style.overflowX = 'auto';
                
                // 确保主容器不会被撑破
                container.style.width = '100%';
                container.style.maxWidth = '100%';
                container.style.overflowX = 'hidden';
            }
        }, 10);
    }
    
    // 生成排班计划
    async generateSchedule() {
        const organization = document.getElementById('scheduleOrganizationSelect').value;
        
        // 获取部门选择框的值
        const departmentSelect = document.getElementById('scheduleDepartmentSelect');
        const department = departmentSelect.value;
        
        const position = document.getElementById('schedulePositionSelect').value;
        
        try {
            // 显示加载状态
            this.showLoading(true);
            
            // 生成排班计划 - 注意参数顺序是(month, year, organization, department, position)
            await this.scheduleManager.generateSchedule(
                this.currentMonth, 
                this.currentYear, 
                organization, 
                department, 
                position
            );
            
            // 重新加载排班数据
            this.loadScheduleData();
            this.loadHistoryRecords();
            
            // 显示成功提示
            alert(`${this.currentYear}年${this.currentMonth}月排班计划生成成功！`);
        } catch (error) {
            console.error('生成排班计划失败:', error);
            alert('生成排班计划失败，请重试！');
        } finally {
            // 隐藏加载状态
            this.showLoading(false);
        }
    }
    
    // 导出排班表
    async exportSchedule() {
        try {
            // 显示加载状态
            this.showLoading(true);
            
            // 导出排班表为Excel
            await this.scheduleManager.exportSchedule(
                this.currentYear, 
                this.currentMonth
            );
            
            // 隐藏加载状态
            this.showLoading(false);
        } catch (error) {
            console.error('导出排班表失败:', error);
            alert('导出排班表失败，请重试！');
            this.showLoading(false);
        }
    }
    
    // 加载历史排班记录
    async loadHistoryRecords() {
        try {
            const historyRecords = await this.scheduleManager.getHistoryRecords();
            const historyContainer = document.getElementById('historyListContainer');
            
            // 清空容器
            historyContainer.innerHTML = '';
            
            // 如果没有历史记录
            if (historyRecords.length === 0) {
                const noDataElement = document.createElement('div');
                noDataElement.className = 'no-data';
                noDataElement.textContent = '暂无历史排班记录';
                historyContainer.appendChild(noDataElement);
                return;
            }
            
            // 创建历史记录项
            historyRecords.forEach(record => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                const dateElement = document.createElement('div');
                dateElement.className = 'date';
                dateElement.textContent = `${record.year}年${record.month}月`;
                
                const detailsElement = document.createElement('div');
                detailsElement.className = 'details';
                detailsElement.textContent = `创建时间: ${new Date(record.createdAt).toLocaleString()}`;
                
                const actionsElement = document.createElement('div');
                actionsElement.className = 'actions';
                
                const viewBtn = document.createElement('button');
                viewBtn.className = 'btn btn-secondary';
                viewBtn.innerHTML = '<i class="fas fa-eye"></i> 查看';
                viewBtn.addEventListener('click', () => {
                    // 切换到该月份的排班记录
                    document.getElementById('scheduleYearInput').value = record.year;
                    document.getElementById('scheduleMonthInput').value = record.month;
                    this.currentYear = record.year;
                    this.currentMonth = record.month;
                    this.updateDateRange();
                    this.generateCalendarHeaders();
                    this.loadScheduleData();
                });
                
                const exportBtn = document.createElement('button');
                exportBtn.className = 'btn btn-secondary';
                exportBtn.innerHTML = '<i class="fas fa-file-export"></i> 导出';
                exportBtn.addEventListener('click', () => {
                    this.scheduleManager.exportSchedule(record.year, record.month);
                });
                
                actionsElement.appendChild(viewBtn);
                actionsElement.appendChild(exportBtn);
                
                historyItem.appendChild(dateElement);
                historyItem.appendChild(detailsElement);
                historyItem.appendChild(actionsElement);
                
                historyContainer.appendChild(historyItem);
            });
        } catch (error) {
            console.error('加载历史记录失败:', error);
        }
    }
    
    // 显示/隐藏加载状态
    showLoading(show) {
        // 这里可以添加一个加载遮罩层
        // 为了简化，暂时不实现具体UI
        document.body.style.cursor = show ? 'wait' : 'default';
    }
}

// 初始化排班计划模块
function initSchedulePlanning() {
    const schedulePlanning = new SchedulePlanning();
}

// 当页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSchedulePlanning);
} else {
    initSchedulePlanning();
}