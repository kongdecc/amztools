import { useCallback } from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { parseExcel } from '@/lib/excel';
import { toast } from 'sonner';

export function FileUpload() {
  const { setLoading, setData, isLoading, updateSettings } = useStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    try {
      const { records, currency } = await parseExcel(file);
      setData(records, file.name);
      if (currency) updateSettings({ currency });
      toast.success(`已成功解析 ${records.length} 条记录`);
    } catch (error) {
      console.error(error);
      toast.error('解析 Excel 文件失败');
    } finally {
      setLoading(false);
    }
  }, [setData, setLoading, updateSettings]);

  const dropzoneOptions = {
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  } as unknown as DropzoneOptions;

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  return (
    <Card
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center w-full max-w-xl mx-auto p-12 border-2 border-dashed transition-all cursor-pointer group",
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
          将亚马逊搜索词报告（.xlsx）拖拽到此处，或点击选择文件
        </p>
      </div>

      <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
        <FileSpreadsheet className="w-3 h-3" />
        <span>支持 .xlsx、.xls</span>
      </div>
    </Card>
  );
}
