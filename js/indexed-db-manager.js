// IndexedDB数据库管理类
class IndexedDBManager {
    constructor() {
        this.dbName = 'scheduleSystemDB';
        this.dbVersion = 1;
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
                }

                // 创建员工对象存储空间
                if (!db.objectStoreNames.contains('employees')) {
                    const employeeStore = db.createObjectStore('employees', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 创建索引
                    employeeStore.createIndex('number', 'number', { unique: true });
                    employeeStore.createIndex('name', 'name', { unique: false });
                    employeeStore.createIndex('deptId', 'deptId', { unique: false });
                    employeeStore.createIndex('status', 'status', { unique: false });
                }

                // 创建排班数据对象存储空间
                if (!db.objectStoreNames.contains('schedules')) {
                    const scheduleStore = db.createObjectStore('schedules', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 创建索引
                    scheduleStore.createIndex('employeeId', 'employeeId', { unique: false });
                    scheduleStore.createIndex('date', 'date', { unique: false });
                    scheduleStore.createIndex('status', 'status', { unique: false });
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
            const result = callback(transaction);

            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // 保存数据到指定存储空间
    async save(storeName, data) {
        return this.transaction([storeName], 'readwrite', (transaction) => {
            const store = transaction.objectStore(storeName);
            const request = store.put(data); // put会根据keyPath更新或插入

            request.onsuccess = () => {
                console.log(`数据保存成功到${storeName}:`, data);
            };

            request.onerror = (event) => {
                console.error(`数据保存失败到${storeName}:`, event.target.error);
            };
        });
    }

    // 批量保存数据
    async bulkSave(storeName, dataArray) {
        return this.transaction([storeName], 'readwrite', (transaction) => {
            const store = transaction.objectStore(storeName);
            dataArray.forEach(data => {
                store.put(data);
            });
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
        return this.transaction([storeName], 'readonly', (transaction) => {
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve([]);
            });
        });
    }

    // 删除数据
    async delete(storeName, id) {
        return this.transaction([storeName], 'readwrite', (transaction) => {
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`数据删除成功从${storeName}, ID:`, id);
            };

            request.onerror = (event) => {
                console.error(`数据删除失败从${storeName}, ID:`, id, event.target.error);
            };
        });
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

        // 获取所有对象存储空间名称
        const storeNames = Array.from(db.objectStoreNames);

        // 遍历所有存储空间并获取数据
        for (const storeName of storeNames) {
            exportData[storeName] = await this.getAll(storeName);
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
                await this.bulkSave(storeName, data[storeName]);
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

            // 从institution-manager.js的localStorage中迁移
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
}

// 初始化IndexedDB管理器
window.dbManager = new IndexedDBManager();