class IndexedDBManager {
    constructor() {
        this.dbName = 'scheduleSystemDB';
        this.dbVersion = 5;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建机构数据存储空间
                if (!db.objectStoreNames.contains('organizations')) {
                    const orgStore = db.createObjectStore('organizations', { keyPath: 'id', autoIncrement: true });
                    orgStore.createIndex('name', 'name', { unique: true });
                    orgStore.createIndex('code', 'code', { unique: true });
                }

                // 创建员工数据存储空间
                if (!db.objectStoreNames.contains('employees')) {
                    const empStore = db.createObjectStore('employees', { keyPath: 'id', autoIncrement: true });
                    empStore.createIndex('employeeId', 'employeeId', { unique: true });
                    empStore.createIndex('name', 'name', { unique: false });
                    empStore.createIndex('organizationId', 'organizationId', { unique: false });
                    empStore.createIndex('departmentId', 'departmentId', { unique: false });
                    empStore.createIndex('status', 'status', { unique: false });
                }

                // 创建班次数据存储空间
                if (!db.objectStoreNames.contains('shifts')) {
                    const shiftStore = db.createObjectStore('shifts', { keyPath: 'id', autoIncrement: true });
                    shiftStore.createIndex('code', 'code', { unique: true });
                    shiftStore.createIndex('name', 'name', { unique: false });
                    shiftStore.createIndex('status', 'status', { unique: false });
                }

                // 创建标识数据存储空间
                if (!db.objectStoreNames.contains('identifiers')) {
                    const identifierStore = db.createObjectStore('identifiers', { keyPath: 'id', autoIncrement: true });
                    identifierStore.createIndex('employeeId', 'employeeId', { unique: false });
                    identifierStore.createIndex('shiftId', 'shiftId', { unique: false });
                    identifierStore.createIndex('employeeId_shiftId', ['employeeId', 'shiftId'], { unique: true });
                }

                // 创建排班数据存储空间
                if (!db.objectStoreNames.contains('schedules')) {
                    const scheduleStore = db.createObjectStore('schedules', { keyPath: 'id', autoIncrement: true });
                    scheduleStore.createIndex('date', 'date', { unique: false });
                    scheduleStore.createIndex('employeeId', 'employeeId', { unique: false });
                    scheduleStore.createIndex('shiftId', 'shiftId', { unique: false });
                    scheduleStore.createIndex('date_employeeId', ['date', 'employeeId'], { unique: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 保存数据
    async saveData(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            let request;

            if (Array.isArray(data)) {
                // 批量保存
                const requests = data.map(item => store.put(item));
                Promise.all(requests.map(req => new Promise((res, rej) => {
                    req.onsuccess = res;
                    req.onerror = rej;
                }))).then(() => resolve(true)).catch(reject);
            } else {
                // 单条保存
                request = store.put(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }

            transaction.onerror = () => reject(transaction.error);
        });
    }

    // 获取所有数据
    async getAllData(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 根据ID获取数据
    async getDataById(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 根据索引获取数据
    async getDataByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 删除数据
    async deleteData(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // 清空数据
    async clearData(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // 批量删除数据
    async bulkDeleteData(storeName, ids) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            ids.forEach(id => store.delete(id));

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // 导出数据
    async exportData() {
        const exportData = {};
        
        try {
            exportData.organizations = await this.getAllData('organizations');
            exportData.employees = await this.getAllData('employees');
            exportData.shifts = await this.getAllData('shifts');
            exportData.identifiers = await this.getAllData('identifiers');
            exportData.schedules = await this.getAllData('schedules');
            
            return exportData;
        } catch (error) {
            console.error('导出数据失败:', error);
            throw error;
        }
    }

    // 导入数据
    async importData(data) {
        try {
            if (data.organizations) {
                await this.clearData('organizations');
                await this.saveData('organizations', data.organizations);
            }
            
            if (data.employees) {
                await this.clearData('employees');
                await this.saveData('employees', data.employees);
            }
            
            if (data.shifts) {
                await this.clearData('shifts');
                await this.saveData('shifts', data.shifts);
            }
            
            if (data.identifiers) {
                await this.clearData('identifiers');
                await this.saveData('identifiers', data.identifiers);
            }
            
            if (data.schedules) {
                await this.clearData('schedules');
                await this.saveData('schedules', data.schedules);
            }
            
            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            throw error;
        }
    }

    // 根据员工ID和班次ID获取标识数据
    async getIdentifierByEmployeeAndShift(employeeId, shiftId) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['identifiers'], 'readonly');
                const store = transaction.objectStore('identifiers');
                const index = store.index('employeeId_shiftId');
                const key = [employeeId, shiftId];
                const request = index.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // 批量获取员工的标识数据
    async getEmployeeIdentifiers(employeeIds) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['identifiers'], 'readonly');
                const store = transaction.objectStore('identifiers');
                const index = store.index('employeeId');
                const results = [];
                
                const getAllPromises = employeeIds.map(employeeId => {
                    return new Promise((res, rej) => {
                        const request = index.getAll(employeeId);
                        request.onsuccess = () => res(request.result);
                        request.onerror = () => rej(request.error);
                    });
                });
                
                Promise.all(getAllPromises)
                    .then(resultsArray => {
                        resultsArray.forEach(results => {
                            results.forEach(result => {
                                results.push(result);
                            });
                        });
                        resolve(results);
                    })
                    .catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}