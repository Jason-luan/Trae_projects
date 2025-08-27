// 排班顺序管理测试脚本
console.log('=== 开始测试排班顺序保存功能 ===');

// 创建测试环境
try {
    // 创建临时DOM元素
    const createTestElements = () => {
        const positionInput = document.createElement('input');
        positionInput.id = 'positionInput';
        positionInput.value = '测试岗位';
        document.body.appendChild(positionInput);
        
        const shiftCodeInput = document.createElement('input');
        shiftCodeInput.id = 'shiftCodeInput';
        shiftCodeInput.value = 'G';
        document.body.appendChild(shiftCodeInput);
        
        const employeeList = document.createElement('div');
        employeeList.id = 'employeeList';
        
        // 添加几个测试员工
        const createEmployeeItem = (id, name) => {
            const item = document.createElement('div');
            item.className = 'employee-item';
            item.dataset.employeeId = id;
            item.textContent = name;
            employeeList.appendChild(item);
        };
        
        createEmployeeItem('TEST001', '测试员工1');
        createEmployeeItem('TEST002', '测试员工2');
        createEmployeeItem('TEST999', '测试员工999');
        
        document.body.appendChild(employeeList);
    };
    
    // 清理测试环境
    const cleanupTestElements = () => {
        const elements = ['positionInput', 'shiftCodeInput', 'employeeList'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    };
    
    // 测试保存功能
    const testSaveFunction = async () => {
        try {
            console.log('1. 准备测试数据');
            const position = '测试岗位';
            const shiftCode = 'G';
            const employeeIds = ['TEST001', 'TEST002', 'TEST999'];
            
            console.log('2. 检查shiftOrderManager实例是否存在');
            if (window.shiftOrderManager) {
                console.log('   ✓ shiftOrderManager存在');
                
                console.log('3. 调用saveShiftOrderByShift方法');
                const result = await window.shiftOrderManager.saveShiftOrderByShift(position, shiftCode, employeeIds);
                console.log('   ✓ 保存结果:', result);
                
                console.log('4. 测试window.saveShiftOrderByShift全局函数');
                // 这个函数应该会从DOM获取数据
                // 但为了测试，我们直接调用它
                const globalResult = await window.saveShiftOrderByShift();
                console.log('   ✓ 全局函数结果:', globalResult);
            } else {
                console.log('   ⚠ shiftOrderManager不存在，尝试直接调用window.saveShiftOrderByShift');
                const globalResult = await window.saveShiftOrderByShift();
                console.log('   ✓ 全局函数结果:', globalResult);
            }
            
            console.log('=== 测试完成 ===');
        } catch (error) {
            console.error('测试出错:', error);
        } finally {
            console.log('清理测试环境');
            cleanupTestElements();
        }
    };
    
    // 如果DOM已加载，直接运行测试
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        createTestElements();
        setTimeout(testSaveFunction, 100);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            createTestElements();
            testSaveFunction();
        });
    }
} catch (error) {
    console.error('测试脚本初始化失败:', error);
}