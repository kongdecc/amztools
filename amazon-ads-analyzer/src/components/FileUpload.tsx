import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { parseExcel } from '@/lib/excel';
import { toast } from 'sonner';
import type { AdRecord } from '@/types';

type UploadHistoryMeta = {
  id: string;
  fileNames: string[];
  createdAt: number;
  currency: string | null;
  minYmd: string | null;
  maxYmd: string | null;
  total: number;
};
type UploadHistoryStored = UploadHistoryMeta & {
  records?: AdRecord[] | null;
};

const HISTORY_KEY = 'ads-analyzer-upload-history-v1';
const HISTORY_DB = 'ads-analyzer-history-db';
const HISTORY_STORE = 'records';
const HISTORY_RECORDS_PREFIX = 'ads-analyzer-history-records:';
const HISTORY_META_KEY = 'ads-analyzer-upload-history-meta-v1';
const MAX_HISTORY_ITEMS = 12;

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getRangeSummary = (records: AdRecord[]) => {
  const dates = records.map((r) => r.date).filter((d) => isValidYmd(d));
  if (!dates.length) return { minYmd: null, maxYmd: null };
  const minYmd = dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]);
  const maxYmd = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
  return { minYmd, maxYmd };
};

const normalizeKeyPart = (value: string) => value.trim().toLowerCase();

const buildRowKey = (row: AdRecord) => {
  if (!isValidYmd(row.date)) return `no-date:${row.id}`;
  return [
    row.date,
    normalizeKeyPart(row.campaignName),
    normalizeKeyPart(row.adGroupName),
    normalizeKeyPart(row.matchType),
    normalizeKeyPart(row.searchTerm),
  ].join('|');
};

const mergeRecords = (base: AdRecord[], incoming: AdRecord[]) => {
  if (!base.length) {
    const unique = new Map<string, AdRecord>();
    for (const row of incoming) unique.set(buildRowKey(row), row);
    return Array.from(unique.values());
  }
  const map = new Map<string, AdRecord>();
  for (const row of base) map.set(buildRowKey(row), row);
  for (const row of incoming) map.set(buildRowKey(row), row);
  return Array.from(map.values());
};

const openHistoryDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idbSet = async (key: string, value: AdRecord[]) => {
  const db = await openHistoryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbSetValue = async (key: string, value: unknown) => {
  const db = await openHistoryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbGet = async (key: string) => {
  const db = await openHistoryDb();
  return new Promise<AdRecord[] | null>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as AdRecord[] | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const idbGetValue = async <T,>(key: string) => {
  const db = await openHistoryDb();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const idbDelete = async (key: string) => {
  const db = await openHistoryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const lsSetRecords = (key: string, value: AdRecord[]) => {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(value);
  localStorage.setItem(`${HISTORY_RECORDS_PREFIX}${key}`, payload);
};

const lsGetRecords = (key: string) => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`${HISTORY_RECORDS_PREFIX}${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdRecord[]) : null;
  } catch {
    return null;
  }
};

const lsDeleteRecords = (key: string) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${HISTORY_RECORDS_PREFIX}${key}`);
};

const loadHistoryStore = async () => {
  if (typeof window === 'undefined') return { items: [] as UploadHistoryStored[] };
  try {
    let parsed: { items?: UploadHistoryStored[] } | null = null;
    try {
      const fromIdb = await idbGetValue<{ items?: UploadHistoryStored[] }>(HISTORY_META_KEY);
      if (fromIdb?.items?.length) parsed = fromIdb;
    } catch {
      void 0;
    }
    if (!parsed) {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) parsed = JSON.parse(raw);
    }
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const meta = items.map((item) => ({
      id: String(item.id),
      fileNames: Array.isArray(item.fileNames) ? item.fileNames : [],
      createdAt: Number(item.createdAt ?? Date.now()),
      currency: item.currency ?? null,
      minYmd: item.minYmd ?? null,
      maxYmd: item.maxYmd ?? null,
      total: Number(item.total ?? 0),
      records: Array.isArray(item.records) ? (item.records as AdRecord[]) : null,
    }));
    return { items: meta };
  } catch {
    return { items: [] as UploadHistoryStored[] };
  }
};

export function FileUpload() {
  const { data, fileName, setLoading, setData, isLoading, updateSettings } = useStore();
  const [historyItems, setHistoryItems] = useState<UploadHistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyReadyRef = useRef(false);
  const historyErrorRef = useRef(false);
  const mergeEnabledRef = useRef(mergeEnabled);
  const dataRef = useRef(data);
  const mergeTargetIdRef = useRef(mergeTargetId);
  const historyItemsRef = useRef<UploadHistoryMeta[]>([]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const store = await loadHistoryStore();
      if (!alive) return;
      const normalizedItems = store.items.map((item) => ({
        id: item.id,
        fileNames: item.fileNames,
        createdAt: item.createdAt,
        currency: item.currency,
        minYmd: item.minYmd,
        maxYmd: item.maxYmd,
        total: item.total,
      }));
      historyItemsRef.current = normalizedItems;
      setHistoryItems(normalizedItems);
      historyReadyRef.current = true;
      const legacy = store.items.filter((item) => Array.isArray(item.records));
      if (legacy.length) {
        Promise.all(
          legacy.map((item) => {
            const records = item.records ?? [];
            return idbSet(item.id, records);
          })
        ).catch(() => {
          if (!historyErrorRef.current) {
            toast.error('本地历史记录迁移失败，可能是存储空间不足');
            historyErrorRef.current = true;
          }
        });
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    mergeEnabledRef.current = mergeEnabled;
  }, [mergeEnabled]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    mergeTargetIdRef.current = mergeTargetId;
  }, [mergeTargetId]);

  useEffect(() => {
    historyItemsRef.current = historyItems;
  }, [historyItems]);

  const persistHistory = useCallback((items: UploadHistoryMeta[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify({
          items,
        })
      );
      historyErrorRef.current = false;
    } catch {
      if (!historyErrorRef.current) {
        toast.error('本地历史记录保存失败，可能是空间不足');
        historyErrorRef.current = true;
      }
    }
    idbSetValue(HISTORY_META_KEY, { items }).catch(() => {
      if (!historyErrorRef.current) {
        toast.error('本地历史记录保存失败，可能是空间不足');
        historyErrorRef.current = true;
      }
    });
  }, []);

  const handleMergeToggle = useCallback((value: boolean) => {
    mergeEnabledRef.current = value;
    setMergeEnabled(value);
  }, []);

  useEffect(() => {
    if (!historyReadyRef.current) return;
    persistHistory(historyItems);
  }, [historyItems, persistHistory]);

  const clearHistory = useCallback(async () => {
    if (!historyItems.length) return;
    const confirmed = window.confirm(`确认清空全部历史记录吗？共 ${historyItems.length} 条记录，此操作不可恢复。`);
    if (!confirmed) return;
    const ids = historyItems.map((item) => item.id);
    historyItemsRef.current = [];
    setHistoryItems([]);
    setMergeTargetId(null);
    persistHistory([]);
    try {
      await idbDelete(HISTORY_META_KEY);
    } catch {
      void 0;
    }
    await Promise.all(
      ids.map(async (id) => {
        try {
          await idbDelete(id);
        } catch {
          void 0;
        }
        try {
          lsDeleteRecords(id);
        } catch {
          void 0;
        }
      })
    );
  }, [historyItems, persistHistory]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const files = acceptedFiles.filter(Boolean);
    if (!files.length) return;

    setLoading(true);
    try {
      const currentData = dataRef.current;
      const isMergeEnabled = mergeEnabledRef.current;
      const selectedTargetId = mergeTargetIdRef.current;
      let allRecords: AdRecord[] = [];
      let detectedCurrency: string | null = null;
      const fileNames: string[] = [];

      for (const file of files) {
        const { records, currency } = await parseExcel(file);
        allRecords = allRecords.concat(records);
        if (!detectedCurrency && currency) detectedCurrency = currency;
        fileNames.push(file.name);
      }

      const uniqueUploads = mergeRecords([], allRecords);
      let baseData: AdRecord[] = [];
      let targetLabel: string | null = null;
      if (selectedTargetId) {
        try {
          let records: AdRecord[] | null = null;
          try {
            records = await idbGet(selectedTargetId);
          } catch {
            void 0;
          }
          if (!records?.length) {
            records = lsGetRecords(selectedTargetId);
          }
          if (!records?.length) {
            toast.error('要合并的历史记录已损坏或被清理');
            setMergeTargetId(null);
          } else {
            baseData = records;
            const target = historyItemsRef.current.find((item) => item.id === selectedTargetId);
            targetLabel = target ? target.fileNames.join('、') : null;
          }
        } catch {
          toast.error('读取历史记录失败');
          setMergeTargetId(null);
        }
      } else if (isMergeEnabled && currentData?.length) {
        baseData = currentData;
      }
      const merged = isMergeEnabled ? mergeRecords(baseData, uniqueUploads) : uniqueUploads;
      const nextFileName =
        selectedTargetId
          ? `合并历史记录（新增${files.length}个文件）`
          : isMergeEnabled && currentData?.length
            ? `累计上传（新增${files.length}个文件）`
            : files.length === 1
              ? files[0].name
              : `批量上传（${files.length}个文件）`;

      setData(merged, nextFileName);
      if (detectedCurrency) updateSettings({ currency: detectedCurrency });

      const range = getRangeSummary(merged);
      const item: UploadHistoryMeta = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        fileNames: fileNames.length ? fileNames : [nextFileName],
        createdAt: Date.now(),
        currency: detectedCurrency,
        minYmd: range.minYmd,
        maxYmd: range.maxYmd,
        total: merged.length,
      };
      try {
        let stored = false;
        try {
          await idbSet(item.id, merged);
          stored = true;
        } catch {
          void 0;
        }
        if (!stored) {
          try {
            lsSetRecords(item.id, merged);
            stored = true;
          } catch {
            void 0;
          }
        }
        if (!stored) {
          toast.error('保存历史记录失败，可能是存储空间不足');
        }
        const prevItems = historyItemsRef.current;
        const nextItems = [item, ...prevItems];
        const removedIds = nextItems.slice(MAX_HISTORY_ITEMS).map((v) => v.id);
        const trimmedItems = nextItems.slice(0, MAX_HISTORY_ITEMS);
        historyItemsRef.current = trimmedItems;
        setHistoryItems(trimmedItems);
        persistHistory(trimmedItems);
        if (removedIds.length) {
          await Promise.all(
            removedIds.map(async (id) => {
              try {
                await idbDelete(id);
              } catch {
                void 0;
              }
              try {
                lsDeleteRecords(id);
              } catch {
                void 0;
              }
            })
          );
        }
      } catch {
        toast.error('保存历史记录失败，可能是存储空间不足');
      }

      const baseCount = baseData.length;
      const removed = allRecords.length - uniqueUploads.length;
      const rangeText =
        removed > 0
          ? `已解析 ${allRecords.length} 条，去重 ${removed} 条，当前 ${merged.length} 条`
          : `已解析 ${allRecords.length} 条，当前 ${merged.length} 条`;
      const mergeText =
        selectedTargetId && targetLabel
          ? `（合并：${targetLabel}）`
          : isMergeEnabled && baseCount > 0
            ? `（含原有 ${baseCount} 条）`
            : '';
      toast.success(`${rangeText}${mergeText}`);
    } catch (error) {
      console.error(error);
      toast.error('解析 Excel 文件失败');
    } finally {
      setLoading(false);
    }
  }, [persistHistory, setData, setLoading, updateSettings]);

  const dropzoneOptions = {
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: true
  } as unknown as DropzoneOptions;

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  const renderRange = (item: UploadHistoryMeta) => {
    if (item.minYmd && item.maxYmd) {
      return item.minYmd === item.maxYmd
        ? item.minYmd
        : `${item.minYmd} ~ ${item.maxYmd}`;
    }
    return '无日期';
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <Card
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full p-12 border-2 border-dashed transition-all cursor-pointer group",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          isLoading && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        
        <div className={cn(
          "p-4 rounded-full bg-secondary mb-4 transition-transform group-hover:scale-110",
          isDragActive && "bg-primary/10"
        )}>
          {isLoading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-primary" />
          )}
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {isLoading ? '正在处理报告…' : '上传广告报告'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            将亚马逊搜索词报告（.xlsx）拖拽到此处，或点击选择文件（支持批量上传）
          </p>
        </div>

        <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
          <FileSpreadsheet className="w-3 h-3" />
          <span>支持 .xlsx、.xls</span>
        </div>
      </Card>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={mergeEnabled} onCheckedChange={handleMergeToggle} />
            <span className="text-sm">自动累计并去重重叠日期</span>
          </div>
          <div className="text-xs text-muted-foreground">{fileName ? `当前：${fileName}` : '未加载报告'}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground">合并到历史记录</div>
          <Select
            value={mergeTargetId ?? "none"}
            onValueChange={(value) => setMergeTargetId(value === "none" ? null : value)}
          >
            <SelectTrigger size="sm" className="w-[240px]" disabled={!historyItems.length}>
              <SelectValue placeholder={historyItems.length ? "选择历史记录" : "暂无历史记录"} />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="none">不合并历史记录</SelectItem>
              {historyItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <span className="block max-w-[220px] truncate">
                    {item.fileNames.join('、')}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">历史记录自动保存到浏览器本地</div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">历史记录</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearHistory}
            disabled={!historyItems.length}
          >
            清空
          </Button>
        </div>
        {!historyItems.length ? (
          <div className="text-sm text-muted-foreground">暂无历史记录</div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 pr-2">
              {historyItems.map((item) => {
                const isSelected = mergeTargetId === item.id;
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-sm font-medium whitespace-normal break-all pr-2">
                        {item.fileNames.join('、')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {renderRange(item)} • {item.total.toLocaleString()} 条 •{' '}
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 max-w-[220px]">
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? 'secondary' : 'outline'}
                        onClick={() => setMergeTargetId(isSelected ? null : item.id)}
                      >
                        {isSelected ? '已选合并' : '合并'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            let records: AdRecord[] | null = null;
                            try {
                              records = await idbGet(item.id);
                            } catch {
                              void 0;
                            }
                            if (!records?.length) {
                              records = lsGetRecords(item.id);
                            }
                            if (!records?.length) {
                              toast.error('历史记录已损坏或被清理');
                              setHistoryItems((prev) => prev.filter((h) => h.id !== item.id));
                              if (mergeTargetId === item.id) setMergeTargetId(null);
                              return;
                            }
                            setData(records, item.fileNames.join('、'));
                            if (item.currency) updateSettings({ currency: item.currency });
                            toast.success(`已加载历史记录，共 ${item.total} 条`);
                          } catch {
                            toast.error('读取历史记录失败');
                          }
                        }}
                      >
                        加载
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const confirmed = window.confirm(`确认删除该历史记录吗？\n${item.fileNames.join('、')}`);
                          if (!confirmed) return;
                          setHistoryItems((prev) => prev.filter((h) => h.id !== item.id));
                          if (mergeTargetId === item.id) setMergeTargetId(null);
                          try {
                            await idbDelete(item.id);
                          } catch {
                            toast.error('删除历史记录失败');
                          }
                          try {
                            lsDeleteRecords(item.id);
                          } catch {
                            toast.error('删除历史记录失败');
                          }
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
