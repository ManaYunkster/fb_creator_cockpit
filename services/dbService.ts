import { log } from './loggingService';

const DB_NAME = 'CreatorCockpitDB';
const DB_VERSION = 3;
const DB_EXPORT_VERSION = 1;

// Defines all object stores for the application.
// Key paths are specified for stores where records have a natural unique identifier.
const STORES_CONFIG: { name: string, keyPath?: string }[] = [
    { name: 'files', keyPath: 'name' }, // GeminiFile objects, keyed by their unique API name
    { name: 'posts', keyPath: 'post_id' }, // Post objects
    { name: 'subscribers', keyPath: 'email' }, // SubscriberRecord objects
    { name: 'opens' }, // OpenRecord objects, no natural key, use auto-increment
    { name: 'deliveries' }, // DeliveryRecord objects, use auto-increment
    { name: 'corpus_files', keyPath: 'path' }, // Raw file contents from ZIP: { path, content }
    { name: 'context_documents', keyPath: 'id' }, // ContextDocument objects, keyed by their unique filename
    { name: 'file_contents', keyPath: 'internalName' }, // Raw file content Blobs: { internalName, content, mimeType }
];

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and returns a memoized connection to the IndexedDB database.
 * Handles database creation and schema upgrades.
 */
const initDB = (): Promise<IDBDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            log.error('IndexedDB error:', request.error);
            dbPromise = null; // Reset promise on error to allow retries.
            reject(`Error opening database: ${request.error?.message}`);
        };

        request.onsuccess = () => {
            const db = request.result;
            
            // This event is fired when the database is deleted or modified from another tab/window.
            db.onversionchange = () => {
                log.info('IndexedDB version change detected. Closing connection to allow upgrade.');
                db.close();
                dbPromise = null; // Connection is now invalid, force re-initialization on next call.
            };

            // This event is fired when the connection is unexpectedly closed.
            db.onclose = () => {
                log.error('IndexedDB connection closed unexpectedly.');
                dbPromise = null; // Force re-initialization on next call.
            };
            
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            log.info('IndexedDB upgrade needed. Creating object stores...');
            const db = (event.target as IDBOpenDBRequest).result;
            STORES_CONFIG.forEach(storeConfig => {
                if (!db.objectStoreNames.contains(storeConfig.name)) {
                    const options: IDBObjectStoreParameters = {};
                    if (storeConfig.keyPath) {
                        options.keyPath = storeConfig.keyPath;
                    } else {
                        options.autoIncrement = true;
                    }
                    db.createObjectStore(storeConfig.name, options);
                    log.info(`- Created object store: ${storeConfig.name}`);
                }
            });
        };
    });
    return dbPromise;
};

/**
 * Retrieves a single record from a specified object store by its key.
 */
export const get = async <T>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Retrieves all records from a specified object store.
 */
export const getAll = async <T>(storeName: string): Promise<T[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Adds or updates a single record in a specified object store.
 */
export const put = async (storeName: string, item: any): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Adds or updates multiple records in a specified object store within a single transaction.
 */
export const bulkPut = async (storeName: string, items: any[]): Promise<void> => {
    if (!items || items.length === 0) return Promise.resolve();
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            log.error(`Bulk put transaction failed for store "${storeName}":`, transaction.error);
            reject(transaction.error);
        };
        
        items.forEach(item => store.put(item));
    });
};

/**
 * Deletes a single record from a specified object store by its key.
 */
export const del = async (storeName: string, key: IDBValidKey): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Deletes all records from a specified object store.
 */
export const clearStore = async (storeName: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --- Blob Serialization/Deserialization Helpers ---

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                // Result is "data:mime/type;base64,the_base64_string", we want only the latter part.
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            } else {
                reject(new Error("Failed to read blob as Base64."));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

/**
 * Exports the entire database content to a JSON Blob.
 */
export const exportDB = async (): Promise<Blob> => {
    log.info('dbService: Exporting database...');
    const db = await initDB();
    const exportObject: { [key: string]: any } = {
        __db_export_version__: DB_EXPORT_VERSION,
        __exported_at__: new Date().toISOString(),
    };

    const storeNames = Array.from(db.objectStoreNames);
    
    // Step 1: Fetch all data from all stores
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeNames, 'readonly');
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();

        storeNames.forEach(storeName => {
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => {
                exportObject[storeName] = request.result;
            };
        });
    });

    // Step 2: Serialize Blobs in file_contents to Base64
    if (exportObject.file_contents && Array.isArray(exportObject.file_contents)) {
        log.info('Serializing Blobs in file_contents to Base64...');
        const serializedContents = await Promise.all(
            exportObject.file_contents.map(async (record: any) => {
                if (record.content instanceof Blob) {
                    const base64Content = await blobToBase64(record.content);
                    return { ...record, content: base64Content }; // Replace Blob with Base64 string
                }
                return record;
            })
        );
        exportObject.file_contents = serializedContents;
    }

    log.info('dbService: Database export complete.', { stores: storeNames });
    const jsonString = JSON.stringify(exportObject, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
};

/**
 * Imports data from a JSON object using a single, atomic transaction to ensure data integrity.
 */
export const importDB = async (jsonData: { [key: string]: any }): Promise<void> => {
    log.info('dbService: Starting ATOMIC database import...');
    if (!jsonData.__db_export_version__) {
        throw new Error('Invalid backup file: missing export version identifier.');
    }

    // Step 1: Deserialize any Base64 content back to Blobs before writing to the DB.
    if (jsonData.file_contents && Array.isArray(jsonData.file_contents)) {
        log.info('Deserializing Base64 in file_contents to Blobs...');
        jsonData.file_contents = jsonData.file_contents.map((record: any) => {
            if (typeof record.content === 'string' && record.mimeType) {
                const blob = base64ToBlob(record.content, record.mimeType);
                return { ...record, content: blob }; // Replace Base64 string with Blob
            }
            return record;
        });
    }
    
    // Step 2: Open DB and perform a single transaction to clear all stores and then add new data.
    const db = await initDB();
    const storeNames = Array.from(db.objectStoreNames);
    
    log.info('dbService: Writing new data to database in a single transaction...');
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeNames, 'readwrite');
        
        transaction.oncomplete = () => {
            log.info('dbService: Database import transaction completed successfully.');
            resolve();
        };
        transaction.onerror = () => {
            log.error('Import transaction failed:', transaction.error);
            reject(transaction.error);
        };
        
        // Clear all stores first
        storeNames.forEach(storeName => {
            transaction.objectStore(storeName).clear();
        });
        
        // Then populate them with the backup data
        storeNames.forEach(storeName => {
            if (jsonData[storeName] && Array.isArray(jsonData[storeName])) {
                const store = transaction.objectStore(storeName);
                jsonData[storeName].forEach((item: any) => store.put(item));
            }
        });
    });
};