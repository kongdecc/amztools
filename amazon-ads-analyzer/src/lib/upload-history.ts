export type HistoryMeta = {
  id: string;
  fileNames: string[];
  createdAt: number;
  currency: string | null;
  minYmd: string | null;
  maxYmd: string | null;
  total: number;
};

type HistoryMetaStore = {
  items?: HistoryMeta[];
};

function openDb(dbName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSetValue<T>(dbName: string, key: string, value: T) {
  const db = await openDb(dbName);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetValue<T>(dbName: string, key: string) {
  const db = await openDb(dbName);
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteValue(dbName: string, key: string) {
  const db = await openDb(dbName);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function createUploadHistoryStore(namespace: string) {
  const dbName = `${namespace}-history-db`;
  const metaKey = `${namespace}-history-meta`;
  const oldMetaKey = `${namespace}-history-meta-local`;
  const recordsPrefix = `${namespace}-history-records:`;
  const maxItems = 12;

  const setLsRecords = <T,>(id: string, records: T[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${recordsPrefix}${id}`, JSON.stringify(records));
  };
  const getLsRecords = <T,>(id: string) => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(`${recordsPrefix}${id}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      return null;
    }
  };
  const deleteLsRecords = (id: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${recordsPrefix}${id}`);
  };

  return {
    maxItems,
    async loadMeta() {
      if (typeof window === 'undefined') return [] as HistoryMeta[];
      try {
        const fromIdb = await idbGetValue<HistoryMetaStore>(dbName, metaKey);
        if (Array.isArray(fromIdb?.items)) return fromIdb.items;
      } catch {
        void 0;
      }
      try {
        const raw = localStorage.getItem(oldMetaKey);
        if (!raw) return [] as HistoryMeta[];
        const parsed = JSON.parse(raw) as HistoryMetaStore;
        return Array.isArray(parsed?.items) ? parsed.items : [];
      } catch {
        return [] as HistoryMeta[];
      }
    },
    async persistMeta(items: HistoryMeta[]) {
      if (typeof window === 'undefined') return;
      localStorage.setItem(oldMetaKey, JSON.stringify({ items }));
      try {
        await idbSetValue(dbName, metaKey, { items });
      } catch {
        void 0;
      }
    },
    async loadRecords<T>(id: string) {
      try {
        const fromIdb = await idbGetValue<T[]>(dbName, id);
        if (Array.isArray(fromIdb) && fromIdb.length) return fromIdb;
      } catch {
        void 0;
      }
      return getLsRecords<T>(id);
    },
    async saveRecords<T>(id: string, records: T[]) {
      let ok = false;
      try {
        await idbSetValue(dbName, id, records);
        ok = true;
      } catch {
        void 0;
      }
      if (!ok) {
        try {
          setLsRecords(id, records);
          ok = true;
        } catch {
          void 0;
        }
      }
      return ok;
    },
    async deleteRecord(id: string) {
      try {
        await idbDeleteValue(dbName, id);
      } catch {
        void 0;
      }
      deleteLsRecords(id);
    },
    async clearAll(items: HistoryMeta[]) {
      for (const item of items) {
        await this.deleteRecord(item.id);
      }
      await this.persistMeta([]);
    },
  };
}
