// IndexedDB数据库管理类
class IndexedDBManager {
    constructor() {
        this.dbName = 'scheduleSystemDB';
        this.dbVersion = 7; // 增加版本号以强制升级并创建shiftOrders存储空间
        this.db = null;
        this.initialized = false;
        this.initPromise = this.initDB();
    }

    // 初始化数据库
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            // 数据库升级或首次创建
            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建机构对象存储空间
                if (!db.objectStoreNames.contains('organizations')) {
                    const organizationStore = db.createObjectStore('organizations', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 创建索引
                    organizationStore.createIndex('code', 'code', { unique: false });
                    organizationStore.createIndex('name', 'name', { unique: false });
                    organizationStore.createIndex('status', 'status', { unique: false });
                    organizationStore.createIndex('description', 'description', { unique: false });
                    organizationStore.createIndex('remark', 'remark', { unique: false });
                    organizationStore.createIndex('createdAt', 'createdAt', { unique: false });
                    organizationStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                // 创建班次对象存储空间
                if (!db.objectStoreNames.contains('shifts')) {
                    const shiftStore = db.createObjectStore('shifts', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 创建索引
                    shiftStore.createIndex('code', 'code', { unique: true });
                    shiftStore.createIndex('name', 'name', { unique: false });
                    shiftStore.createIndex('startTime', 'startTime', { unique: false });
                    shiftStore.createIndex('endTime', 'endTime', { unique: false });
                    shiftStore.createIndex('status', 'status', { unique: false });
                    shiftStore.createIndex('createdAt', 'createdAt', { unique: false });
                    shiftStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    console.log('班次存储空间和索引已创建');
                }

                // 创建员工对象存储空间
                let employeeStore;
                if (!db.objectStoreNames.contains('employees')) {
                    employeeStore = db.createObjectStore('employees', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    
                    // 创建索引
                    employeeStore.createIndex('number', 'number', { unique: true });
                    employeeStore.createIndex('name', 'name', { unique: false });
                    employeeStore.createIndex('status', 'status', { unique: false });
                    employeeStore.createIndex('orgId', 'orgId', { unique: false });
                    employeeStore.createIndex('deptName', 'deptName', { unique: false });
                    employeeStore.createIndex('position', 'position', { unique: false });
                    employeeStore.createIndex('createdAt', 'createdAt', { unique: false });
                    employeeStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    
                    console.log('员工存储空间和索引已创建');
                } else {
                    // 如果存储空间已存在，确保orgId索引存在
                    const transaction = event.target.transaction;
                    employeeStore = transaction.objectStore('employees');
                    
                    if (!employeeStore.indexNames.contains('orgId')) {
                        console.log('创建orgId索引...');
                        employeeStore.createIndex('orgId', 'orgId', { unique: false });
                        console.log('orgId索引创建成功');
                    } else {
                        console.log('orgId索引已存在');
                    }
                }
                
                // 确保其他索引存在
                if (!employeeStore.indexNames.contains('number')) {
                    employeeStore.createIndex('number', 'number', { unique: true });
                }
                if (!employeeStore.indexNames.contains('name')) {
                    employeeStore.createIndex('name', 'name', { unique: false });
                }
                if (!employeeStore.indexNames.contains('status')) {
                    employeeStore.createIndex('status', 'status', { unique: false });
                }
                if (!employeeStore.indexNames.contains('deptName')) {
                    employeeStore.createIndex('deptName', 'deptName', { unique: false });
                }
                if (!employeeStore.indexNames.contains('position')) {
                    employeeStore.createIndex('position', 'position', { unique: false });
                }
                if (!employeeStore.indexNames.contains('createdAt')) {
                    employeeStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!employeeStore.indexNames.contains('updatedAt')) {
                    employeeStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                // 创建排班数据对象存储空间
                if (!db.objectStoreNames.contains('schedules')) {
                    const scheduleStore = db.createObjectStore('schedules', {                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 创建索引
                    scheduleStore.createIndex('employeeId', 'employeeId', { unique: false });
                    scheduleStore.createIndex('date', 'date', { unique: false });
                    scheduleStore.createIndex('status', 'status', { unique: false });
                }
                
                // 创建标识数据对象存储空间
                if (!db.objectStoreNames.contains('identifiers')) {
                    const identifierStore = db.createObjectStore('identifiers', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 创建索引
                    identifierStore.createIndex('employeeId', 'employeeId', { unique: false });
                    identifierStore.createIndex('employeeNumber', 'employeeNumber', { unique: false });
                    identifierStore.createIndex('shiftId', 'shiftId', { unique: false });
                    identifierStore.createIndex('shiftCode', 'shiftCode', { unique: false });
                    identifierStore.createIndex('employeeId_shiftId', ['employeeId', 'shiftId'], { unique: true });
                    identifierStore.createIndex('employeeNumber_shiftCode', ['employeeNumber', 'shiftCode'], { unique: true });
                    identifierStore.createIndex('createdAt', 'createdAt', { unique: false });
                    identifierStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    console.log('标识数据存储空间和索引已创建');
                } else {
                    // 如果存储空间已存在，确保employeeNumber和shiftCode索引存在
                    const transaction = event.target.transaction;
                    const identifierStore = transaction.objectStore('identifiers');
                    
                    if (!identifierStore.indexNames.contains('employeeNumber')) {
                        console.log('创建employeeNumber索引...');
                        identifierStore.createIndex('employeeNumber', 'employeeNumber', { unique: false });
                        console.log('employeeNumber索引创建成功成功');
                    }
                    if (!identifierStore.indexNames.contains('shiftCode')) {
                        console.log('创建shiftCode索引...');
                        identifierStore.createIndex('shiftCode', 'shiftCode', { unique: false });
                        console.log('shiftCode索引创建成功');
                    }
                    if (!identifierStore.indexNames.contains('employeeNumber_shiftCode')) {
                        console.log('创建employeeNumber_shiftCode复合索引...');
                        identifierStore.createIndex('employeeNumber_shiftCode', ['employeeNumber', 'shiftCode'], { unique: true });
                        console.log('employeeNumber_shiftCode复合索引创建成功');
                    }
                }
                
                // 创建排班顺序数据对象存储空间
                if (!db.objectStoreNames.contains('shiftOrders')) {
                    const shiftOrderStore = db.createObjectStore('shiftOrders', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    // 创建索引
                    shiftOrderStore.createIndex('position', 'position', { unique: false });
                    shiftOrderStore.createIndex('shiftCode', 'shiftCode', { unique: false });
                    shiftOrderStore.createIndex('employeeNumbers', 'employeeNumbers', { unique: false, multiEntry: true });
                    shiftOrderStore.createIndex('departmentName', 'departmentName', { unique: false });
                    shiftOrderStore.createIndex('date', 'date', { unique: false });
                    shiftOrderStore.createIndex('createdAt', 'createdAt', { unique: false });
                    shiftOrderStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    console.log('排班顺序数据存储空间和索引已创建');
                }
            };

            // 数据库打开成功
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                resolve(this.db);
            };

            // 数据库打开失败
            request.onerror = (event) => {
                console.error('IndexedDB初始化失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 确保数据库已初始化
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initPromise;
        }
        return this.db;
    }

    // 通用事务处理函数
    async transaction(storeNames, mode, callback) {
        const db = await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            
            try {
                const result = callback(transaction);
                
                // 检查result是否是Promise
                if (result && typeof result.then === 'function') {
                    // 如果是Promise，等待它完成后再解决事务Promise
                    result.then(() => {
                        // 确保事务已经完成
                        if (transaction.db) {
                            resolve(result);
                        }
                    }).catch(reject);
                } else {
                    // 如果不是Promise，按照原来的方式处理
                    transaction.oncomplete = () => resolve(result);
                }
            } catch (error) {
                reject(error);
            }
            
            transaction.onerror = () => {
                console.error('事务错误:', transaction.error);
                reject(transaction.error);
            };
            
            transaction.onabort = () => {
                console.error('事务被中止:', transaction.error);
                reject(transaction.error);
            };
        });
    }

    // 保存数据到指定存储空间
    async save(storeName, data) {
        return this.transaction([storeName], 'readwrite', (transaction) => {
            const store = transaction.objectStore(storeName);
            const request = store.put(data); // put会根据keyPath更新或插入

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log(`数据保存成功到${storeName}:`, data);
                    
                    // 如果数据没有id字段（新创建的记录），则添加id字段
                    if (store.keyPath && !data[store.keyPath]) {
                        const savedData = { ...data };
                        savedData[store.keyPath] = request.result;
                        console.log(`返回包含ID的完整数据:`, savedData);
                        resolve(savedData);
                    } else {
                        // 对于已存在ID的记录，直接返回原数据
                        resolve(data);
                    }
                };

                request.onerror = (event) => {
                    console.error(`数据保存失败到${storeName}:`, event.target.error);
                    reject(event.target.error);
                };
            });
        });
    }

    // 批量保存数据
    async bulkSave(storeName, dataArray) {
        return this.transaction([storeName], 'readwrite', (transaction) => {
            const store = transaction.objectStore(storeName);
            
            // 为每个操作创建一个Promise
            const promises = dataArray.map(data => {
                return new Promise((resolve, reject) => {
                    const request = store.put(data);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (event) => reject(event.target.error);
                });
            });
            
            // 等待所有操作完成
            return Promise.all(promises);
        });
    }

    // 根据ID获取数据
    async getById(storeName, id) {
        return this.transaction([storeName], 'readonly', (transaction) => {
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });
        });
    }

    // 获取所有数据
    async getAll(storeName) {
        return this.transaction([storeName], 'readonly', (transaction) => {
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve([]);
            });
        });
    }

    // 根据索引查询数据
    async getByIndex(storeName, indexName, value) {
        console.log(`开始根据索引查询数据: 存储空间=${storeName}, 索引=${indexName}, 值=${value}`);
        try {
            // 确保数据库已初始化
            await this.ensureInitialized();
            console.log(`数据库已初始化，版本: ${this.dbVersion}`);
            
            return this.transaction([storeName], 'readonly', (transaction) => {
                const store = transaction.objectStore(storeName);
                
                // 列出所有可用索引
                const indexes = Array.from(store.indexNames);
                console.log(`存储空间 ${storeName} 可用索引:`, indexes);
                
                // 检查索引是否存在
                if (!store.indexNames.contains(indexName)) {
                    console.error(`索引不存在: ${indexName} 在存储空间 ${storeName}`);
                    // 无法在只读事务中创建索引
                    // 提示需要升级数据库版本
                    if (storeName === 'employees' && indexName === 'orgId') {
                        console.log('请升级数据库版本以创建缺失的orgId索引');
                        // 可以在这里触发数据库升级
                        // this.upgradeDatabase();
                    }
                    return Promise.resolve([]);
                }
                
                const index = store.index(indexName);
                const request = index.getAll(value);

                return new Promise((resolve, reject) => {
                    request.onsuccess = () => {
                        console.log(`索引查询成功: 找到 ${request.result.length} 条记录`);
                        resolve(request.result);
                    };
                    request.onerror = (event) => {
                        console.error(`索引查询失败: ${event.target.error.message}`, event.target.error);
                        reject(event.target.error);
                    };
                });
            });
        } catch (error) {
            console.error(`getByIndex方法异常:`, error);
            return Promise.resolve([]);
        }
    }

    // 删除数据
    async delete(storeName, id) {
        console.log(`开始删除数据: 存储空间=${storeName}, ID=${id}`);
        
        try {
            // 直接返回transaction的结果，避免嵌套Promise
            return await this.transaction([storeName], 'readwrite', (transaction) => {
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);

                return new Promise((resolve, reject) => {
                    request.onsuccess = () => {
                        console.log(`数据删除成功从${storeName}, ID:`, id);
                        resolve(true); // 成功时返回true
                    };

                    request.onerror = (event) => {
                        console.error(`数据删除失败从${storeName}, ID:`, id, event.target.error);
                        reject(event.target.error); // 失败时明确reject错误
                    };
                });
            });
        } catch (error) {
            // 捕获所有可能的错误
            console.error(`删除数据失败:`, error);
            throw error;
        }
    }

    // 清空存储空间
    async clearStore(storeName) {
        return this.transaction([storeName], 'readwrite', (transaction) => {
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log(`存储空间${storeName}已清空`);
            };

            request.onerror = (event) => {
                console.error(`清空存储空间${storeName}失败:`, event.target.error);
            };
        });
    }

    // 导出数据为JSON
    async exportDatabaseData() {
        const db = await this.ensureInitialized();
        const exportData = {};

        // 只导出指定的存储空间数据，包含班次数据、标识数据和排班顺序数据
        const storesToExport = ['organizations', 'employees', 'shifts', 'identifiers', 'shiftOrders'];

        // 初始化所有需要导出的存储为默认空数组
        for (const storeName of storesToExport) {
            exportData[storeName] = [];
        }

        // 遍历需要导出的存储空间并获取数据
        for (const storeName of storesToExport) {
            if (db.objectStoreNames.contains(storeName)) {
                if (storeName === 'organizations') {
                    // 导出organizations数据时过滤掉institutionNumber字段
                    const organizations = await this.getAll(storeName);
                    exportData[storeName] = organizations.map(org => {
                        const { institutionNumber, ...rest } = org;
                        return rest;
                    });
                } else if (storeName === 'identifiers') {
                    // 导出标识数据时，使用员工号和班次code而不是ID
                    const identifiers = await this.getAll(storeName);
                    const employees = await this.getAll('employees');
                    const shifts = await this.getAll('shifts');
                    
                    // 创建员工ID到员工号的映射
                    const employeeIdToNumberMap = {};
                    employees.forEach(emp => {
                        employeeIdToNumberMap[emp.id] = emp.number;
                    });
                    
                    // 创建班次ID到班次code的映射
                    const shiftIdToCodeMap = {};
                    shifts.forEach(shift => {
                        shiftIdToCodeMap[shift.id] = shift.code;
                    });
                    
                    // 转换identifiers数据，使用员工号和班次code替换ID
                    exportData[storeName] = identifiers.map(id => ({
                        ...id,
                        employeeNumber: employeeIdToNumberMap[id.employeeId] || '',
                        shiftCode: shiftIdToCodeMap[id.shiftId] || '',
                        // 删除原始ID字段，避免在导入时产生冲突
                        employeeId: undefined,
                        shiftId: undefined
                    }));
                } else if (storeName === 'shiftOrders') {
                    // 导出排班顺序数据，直接使用employeeNumbers和departmentName
                    const shiftOrders = await this.getAll(storeName);
                    
                    // 转换排班顺序数据，只导出有排序的数据（employeeNumbers数组不为空）
                    exportData[storeName] = shiftOrders
                        .filter(order => {
                            // 只处理包含shiftCode的新版排班顺序数据
                            return order.shiftCode && typeof order.shiftCode === 'string' && order.shiftCode.trim() !== '';
                        })
                        .map(order => {
                            // 确保position字段始终保留，避免数据丢失
                            if (!order.position || typeof order.position !== 'string' || order.position.trim() === '') {
                                console.warn('排班顺序记录缺少有效的position字段:', order);
                            }
                            
                            // 优先使用employeeNumbers字段，并确保只包含有效的员工号
                            let employeeNumbers = [];
                            if (order.employeeNumbers && Array.isArray(order.employeeNumbers) && order.employeeNumbers.length > 0) {
                                // 清理员工号数组，只保留有效的非空字符串
                                employeeNumbers = order.employeeNumbers
                                    .filter(num => num && typeof num === 'string' && num.trim() !== '')
                                    .map(num => num.trim());
                            }
                            
                            // 获取部门名称，直接使用order.departmentName
                            let departmentName = order.departmentName || '';
                            
                            return {
                                ...order,
                                // 确保position字段存在
                                position: order.position || '',
                                // 确保employeeNumbers是有效的数组
                                employeeNumbers: employeeNumbers,
                                // 直接使用存储的部门名称
                                departmentName: departmentName,
                                // 删除不需要的字段
                                employeeIds: undefined,
                                id: undefined
                            };
                        }).filter(order => {
                            // 只导出有排序的数据（即employeeNumbers数组不为空）
                            return order.employeeNumbers && order.employeeNumbers.length > 0;
                        });
                } else {
                    exportData[storeName] = await this.getAll(storeName);
                }
            }
        }

        // 添加导出时间戳
        exportData.exportTime = new Date().toISOString();

        return exportData;
    }

    // 导入JSON数据
    async importData(data) {
        // 验证数据格式
        if (!data || typeof data !== 'object') {
            throw new Error('导入数据格式无效');
        }

        // 遍历所有存储空间
        for (const storeName in data) {
            // 跳过非存储空间数据
            if (storeName === 'exportTime' || !Array.isArray(data[storeName])) {
                continue;
            }

            // 清空现有数据
            await this.clearStore(storeName);

            // 导入新数据
            if (data[storeName].length > 0) {
                let processedData = data[storeName];
                
                // 转换日期字段为Date对象，并处理机构号和部门描述
                if (storeName === 'organizations') {
                    processedData = processedData.map(item => {
                            // 创建新对象，不包含institutionNumber字段
                            const { institutionNumber, ...rest } = item;
                            return {
                                ...rest,
                                createdAt: new Date(item.createdAt),
                                updatedAt: new Date(item.updatedAt),
                                // 确保CODE字段映射到code
                                code: item.code || '-',
                                // 确保description字段存在，如果没有则设置为空字符串
                                description: item.description || ''
                            };
                        });
                } else if (storeName === 'employees') {
                    processedData = processedData.map(item => ({
                        ...item,
                        createdAt: new Date(item.createdAt),
                        updatedAt: new Date(item.updatedAt)
                    }));
                } else if (storeName === 'shifts') {
                    // 处理班次数据，转换日期字段
                    processedData = processedData.map(item => ({
                        ...item,
                        createdAt: new Date(item.createdAt),
                        updatedAt: new Date(item.updatedAt)
                    }));
                } else if (storeName === 'identifiers') {
                    // 处理标识数据，转换日期字段，并将employeeNumber和shiftCode转换为对应的ID
                    const employees = await this.getAll('employees');
                    const shifts = await this.getAll('shifts');
                    
                    // 创建员工号到员工ID的映射
                    const employeeNumberToIdMap = {};
                    employees.forEach(emp => {
                        if (emp.number) {
                            employeeNumberToIdMap[emp.number] = emp.id;
                        }
                    });
                    
                    // 创建班次code到班次ID的映射
                    const shiftCodeToIdMap = {};
                    shifts.forEach(shift => {
                        if (shift.code) {
                            shiftCodeToIdMap[shift.code] = shift.id;
                        }
                    });
                    
                    processedData = processedData.map(item => {
                        let processedItem = {
                            ...item,
                            createdAt: new Date(item.createdAt),
                            updatedAt: new Date(item.updatedAt)
                        };
                        
                        // 如果有employeeNumber字段但没有employeeId字段，查找对应的employeeId
                        if (item.employeeNumber && !item.employeeId) {
                            const employeeId = employeeNumberToIdMap[item.employeeNumber];
                            if (employeeId) {
                                processedItem.employeeId = employeeId;
                            } else {
                                console.warn(`未找到员工号为${item.employeeNumber}的员工，无法关联标识数据`);
                            }
                        }
                        
                        // 如果有shiftCode字段但没有shiftId字段，查找对应的shiftId
                        if (item.shiftCode && !item.shiftId) {
                            const shiftId = shiftCodeToIdMap[item.shiftCode];
                            if (shiftId) {
                                processedItem.shiftId = shiftId;
                            } else {
                                console.warn(`未找到班次编码为${item.shiftCode}的班次，无法关联标识数据`);
                            }
                        }
                        
                        // 删除员工号和班次code字段，避免数据冗余
                        delete processedItem.employeeNumber;
                        delete processedItem.shiftCode;
                        
                        return processedItem;
                    });
                } else if (storeName === 'shiftOrders') {
                    // 处理排班顺序数据，转换日期字段，并将employeeNumbers转换为对应的ID
                    const employees = await this.getAll('employees');
                    
                    // 创建员工号到员工ID的映射
                    const employeeNumberToIdMap = {};
                    employees.forEach(emp => {
                        if (emp.number) {
                            employeeNumberToIdMap[emp.number] = emp.id;
                        }
                    });
                    
                    processedData = processedData.map(item => {
                        let processedItem = {
                            ...item,
                            createdAt: new Date(item.createdAt || new Date()),
                            updatedAt: new Date(item.updatedAt || new Date())
                        };
                        
                        // 直接使用employeeNumbers字段
                        if (item.employeeNumbers && Array.isArray(item.employeeNumbers)) {
                            // 保留employeeNumbers字段
                            processedItem.employeeNumbers = item.employeeNumbers;
                        } else {
                            // 如果没有员工号数组，设置为空数组
                            processedItem.employeeNumbers = [];
                        }
                        
                        // 移除employeeIds字段，不再使用
                        processedItem.employeeIds = undefined;
                        
                        return processedItem;
                    });
                }
                
                await this.bulkSave(storeName, processedData);
            }
        }

        return true;
    }

    // 从localStorage迁移数据到IndexedDB
    async migrateFromLocalStorage() {
        try {
            // 检查是否已迁移
            if (localStorage.getItem('migratedToIndexedDB')) {
                console.log('数据已从localStorage迁移到IndexedDB');
                return false;
            }

            // 从index.html的localStorage中迁移
            const savedData = localStorage.getItem('scheduleSystemData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);

                // 还原日期对象
                if (parsedData.organizations) {
                    parsedData.organizations.forEach(org => {
                        org.createdAt = new Date(org.createdAt);
                        org.updatedAt = new Date(org.updatedAt);
                    });
                    await this.bulkSave('organizations', parsedData.organizations);
                }

                if (parsedData.employees) {
                    parsedData.employees.forEach(emp => {
                        emp.createdAt = new Date(emp.createdAt);
                        emp.updatedAt = new Date(emp.updatedAt);
                    });
                    await this.bulkSave('employees', parsedData.employees);
                }
            }

            const institutionsData = localStorage.getItem('institutions');
            if (institutionsData) {
                const parsedInstitutions = JSON.parse(institutionsData);
                // 这里可能需要数据转换，根据实际结构调整
                await this.bulkSave('organizations', parsedInstitutions);
            }

            // 标记为已迁移
            localStorage.setItem('migratedToIndexedDB', 'true');
            console.log('数据已成功从localStorage迁移到IndexedDB');
            return true;
        } catch (error) {
            console.error('从localStorage迁移数据到IndexedDB失败:', error);
            return false;
        }
    }

    // 检查对象存储空间是否存在
    async checkObjectStoreExists(storeName) {
        const db = await this.ensureInitialized();
        return db.objectStoreNames.contains(storeName);
    }

    // 检查索引是否存在
    async checkIndexExists(storeName, indexName) {
        const db = await this.ensureInitialized();
        if (!db.objectStoreNames.contains(storeName)) {
            return false;
        }

        // 需要开启一个事务来检查索引
        return this.transaction([storeName], 'readonly', (transaction) => {
            const store = transaction.objectStore(storeName);
            return store.indexNames.contains(indexName);
        });
    }

    // 清空所有数据库数据
    async clearAllData() {
        try {
            // 关闭当前数据库连接
            if (this.db) {
                this.db.close();
            }
            
            // 删除数据库
            await new Promise((resolve, reject) => {
                const request = indexedDB.deleteDatabase(this.dbName);
                request.onsuccess = () => {
                    console.log('数据库已成功删除');
                    resolve();
                };
                request.onerror = (event) => {
                    console.error('删除数据库失败:', event.target.error);
                    reject(event.target.error);
                };
            });
            
            // 重新初始化数据库
            this.db = null;
            this.initialized = false;
            this.initPromise = this.initDB();
            await this.initPromise;
            
            // 清除localStorage中的数据
            if (localStorage.getItem('migratedToIndexedDB')) {
                localStorage.removeItem('migratedToIndexedDB');
            }
            if (localStorage.getItem('scheduleSystemData')) {
                localStorage.removeItem('scheduleSystemData');
            }
            if (localStorage.getItem('institutions')) {
                localStorage.removeItem('institutions');
            }
            
            console.log('所有数据库数据已成功清空');
            return true;
        } catch (error) {
            console.error('清空数据库数据失败:', error);
            return false;
        }
    }


}

// 初始化IndexedDB管理器
window.dbManager = new IndexedDBManager();