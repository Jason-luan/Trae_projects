// 初始化示例员工数据脚本
window.initSampleEmployeeData = async function() {
    try {
        console.log('开始初始化示例员工数据...');
        
        // 确保dbManager已初始化
        if (!window.dbManager) {
            console.log('dbManager尚未初始化，正在导入必要的脚本...');
            
            // 导入必要的脚本
            const script = document.createElement('script');
            script.src = 'js/indexed-db-manager.js';
            document.head.appendChild(script);
            
            // 等待脚本加载完成
            await new Promise(resolve => {
                script.onload = resolve;
            });
            
            // 初始化dbManager
            window.dbManager = new IndexedDBManager();
            await window.dbManager.ensureInitialized();
            console.log('dbManager初始化完成');
        }
        
        // 定义示例员工数据
        const sampleEmployees = [
            { number: '001', name: '张三', orgId: 1, deptName: '部门1', position: '员工', status: 0, createdAt: new Date(), updatedAt: new Date() },
            { number: '002', name: '李四', orgId: 1, deptName: '部门2', position: '管理员', status: 0, createdAt: new Date(), updatedAt: new Date() },
            { number: '003', name: '王五', orgId: 2, deptName: '部门3', position: '员工', status: 2, createdAt: new Date(), updatedAt: new Date() },
            { number: '004', name: '赵六', orgId: 1, deptName: '部门1', position: '员工', status: 0, createdAt: new Date(), updatedAt: new Date() },
            { number: '005', name: '孙七', orgId: 2, deptName: '部门2', position: '管理员', status: 0, createdAt: new Date(), updatedAt: new Date() }
        ];
        
        // 定义示例机构数据
        const sampleOrganizations = [
            { id: 1, name: '机构1', createdAt: new Date(), updatedAt: new Date() },
            { id: 2, name: '机构2', createdAt: new Date(), updatedAt: new Date() }
        ];
        
        // 保存示例机构数据
        for (const org of sampleOrganizations) {
            await window.dbManager.save('organizations', org);
        }
        console.log(`已保存 ${sampleOrganizations.length} 个示例机构数据`);
        
        // 保存示例员工数据并获取实际的ID
        const savedEmployees = [];
        for (const employee of sampleEmployees) {
            const savedEmployee = await window.dbManager.save('employees', employee);
            savedEmployees.push(savedEmployee);
        }
        console.log(`已保存 ${savedEmployees.length} 个示例员工数据`);
        
        // 定义示例班次数据
        const sampleShifts = [
            { id: 1, code: 'M', name: '早班', startTime: '08:00', endTime: '16:00', createdAt: new Date(), updatedAt: new Date() },
            { id: 2, code: 'A', name: '中班', startTime: '16:00', endTime: '00:00', createdAt: new Date(), updatedAt: new Date() },
            { id: 3, code: 'N', name: '夜班', startTime: '00:00', endTime: '08:00', createdAt: new Date(), updatedAt: new Date() }
        ];
        
        // 保存示例班次数据
        for (const shift of sampleShifts) {
            await window.dbManager.save('shifts', shift);
        }
        console.log(`已保存 ${sampleShifts.length} 个示例班次数据`);
        
        // 创建标识数据
        const identifiers = [];
        savedEmployees.forEach(emp => {
            sampleShifts.forEach(shift => {
                // 随机决定员工是否可以上某个班次（大多数可以）
                const canWork = Math.random() > 0.2; // 80%的概率可以上
                identifiers.push({
                    employeeId: emp.id,  // 使用保存后实际的ID
                    employeeNumber: emp.number,
                    shiftId: shift.id,
                    canWork: canWork,
                    createdAt: new Date()
                });
            });
        });
        
        // 保存标识数据
        for (const identifier of identifiers) {
            await window.dbManager.save('identifiers', identifier);
        }
        console.log(`已保存 ${identifiers.length} 个标识数据`);
        
        // 初始化排班顺序数据
        const today = new Date();
        const shiftOrders = [];
        
        // 为每个部门创建一个简单的排班顺序
        const departments = [...new Set(sampleEmployees.map(emp => emp.deptName))];
        
        departments.forEach(dept => {
            const deptEmployees = sampleEmployees.filter(emp => emp.deptName === dept && emp.status === 0);
            if (deptEmployees.length > 0) {
                sampleShifts.forEach(shift => {
                    // 为每个部门和班次创建一个排班顺序
                    shiftOrders.push({
                        department: dept,
                        position: '员工', // 使用统一的岗位名称
                        shiftId: shift.id,
                        employeeNumbers: deptEmployees.map(emp => emp.number), // 使用员工号作为排序依据
                        createdAt: today,
                        updatedAt: today
                    });
                });
            }
        });
        
        // 保存排班顺序数据
        for (const order of shiftOrders) {
            await window.dbManager.save('shiftOrders', order);
        }
        console.log(`已保存 ${shiftOrders.length} 个排班顺序数据`);
        
        console.log('示例数据初始化完成！请刷新页面查看效果。');
        alert('示例数据初始化成功！请刷新页面查看排班表。');
        
        // 尝试重新加载数据
        if (window.loadShiftOrderData) {
            window.loadShiftOrderData();
        }
        
    } catch (error) {
        console.error('初始化示例数据失败:', error);
        alert('初始化示例数据失败：' + error.message);
    }
};

// 自动执行初始化函数
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initSampleEmployeeData);
} else {
    window.initSampleEmployeeData();
}