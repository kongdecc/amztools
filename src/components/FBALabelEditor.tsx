'use client';
import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Upload, ChevronLeft, ChevronRight, Download, Loader2, RotateCcw, FileText } from 'lucide-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const FBALabelEditor = () => {
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<ArrayBuffer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [currentScale, setCurrentScale] = useState(1.2);
  const [pdfPageSize, setPdfPageSize] = useState({ width: 0, height: 0 });
  const [renderTask, setRenderTask] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Editor state
  const [textInput, setTextInput] = useState('Made in China');
  const [fontSize, setFontSize] = useState(10);
  const [dragPosition, setDragPosition] = useState({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setPdfDocProxy(null);
    setRawPdfBytes(null);
    setCurrentPage(1);
    setTotalPages(0);
    setCurrentScale(1.2);
    setPdfPageSize({ width: 0, height: 0 });
    setRenderTask(null);
    setIsProcessing(false);
    setTextInput('Made in China');
    setFontSize(10);
    setDragPosition({ x: 50, y: 100 });
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const buffer = await file.arrayBuffer();
      setRawPdfBytes(buffer);
      const bufferCopy = buffer.slice(0);

      const loadingTask = pdfjsLib.getDocument({
        data: bufferCopy,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
      });

      const pdfDoc = await loadingTask.promise;
      setPdfDocProxy(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);

      // Get dimensions from first page
      const libDoc = await PDFDocument.load(buffer);
      const libPage = libDoc.getPages()[0];
      const { width, height } = libPage.getSize();
      setPdfPageSize({ width, height });

      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      alert('加载失败: ' + err.message);
      setIsProcessing(false);
    }
  };

  const renderPage = async () => {
    if (!pdfDocProxy || !canvasRef.current || !containerRef.current) return;

    if (renderTask) {
      await renderTask.cancel();
    }

    try {
      const page = await pdfDocProxy.getPage(currentPage);
      const viewport = page.getViewport({ scale: currentScale });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      containerRef.current.style.width = `${viewport.width}px`;
      containerRef.current.style.height = `${viewport.height}px`;

      const newRenderTask = page.render({
        canvasContext: ctx,
        viewport: viewport,
      });

      setRenderTask(newRenderTask);
      await newRenderTask.promise;
    } catch (err) {
      // Ignore cancellation errors
      console.log('Render cancelled or failed');
    }
  };

  useEffect(() => {
    renderPage();
  }, [pdfDocProxy, currentPage, currentScale]);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - dragPosition.x,
      y: e.clientY - dragPosition.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      const boxWidth = dragBoxRef.current?.offsetWidth || 0;
      const boxHeight = dragBoxRef.current?.offsetHeight || 0;

      const boundedX = Math.max(0, Math.min(newX, containerWidth - boxWidth));
      const boundedY = Math.max(0, Math.min(newY, containerHeight - boxHeight));

      setDragPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleDownload = async () => {
    if (!rawPdfBytes) return;
    setIsProcessing(true);

    try {
      const pdfDoc = await PDFDocument.load(rawPdfBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      const ratio = canvasRef.current!.width / pdfPageSize.width;
      const pdfX = dragPosition.x / ratio;
      // PDF coordinates start from bottom-left
      const pdfY = pdfPageSize.height - (dragPosition.y / ratio) - (fontSize * 0.88);

      pages.forEach(page => {
        page.drawText(textInput, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `FBA_Processed_${Date.now()}.pdf`;
      link.click();
    } catch (err: any) {
      console.error(err);
      alert('保存失败: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="p-2 bg-red-50 rounded-lg">
          <FileText className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">FBA 标签编辑器</h1>
          <p className="text-sm text-gray-500">在线编辑FBA标签PDF，支持批量添加文字、调整位置和大小</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-3 shadow-sm z-10">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <Upload size={18} />
              上传 PDF
            </button>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="application/pdf" 
              className="hidden"
            />
          </div>

          <div className="h-8 w-px bg-gray-300 hidden md:block"></div>

          <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200 shadow-inner">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">文字内容</label>
              <input 
                type="text" 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="输入文字..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">字号</label>
              <input 
                type="number" 
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="h-8 w-px bg-gray-300 mx-1"></div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">视图缩放</label>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={currentScale}
                onChange={(e) => setCurrentScale(Number(e.target.value))}
                className="w-32 h-5 accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="h-8 w-px bg-gray-300 hidden md:block"></div>

          <button 
            onClick={handleDownload}
            disabled={!rawPdfBytes || isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm hover:shadow-md transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            下载 PDF
          </button>
        </div>
        
        {pdfPageSize.width > 0 && (
          <div className="text-xs text-gray-500 mt-3 text-center flex items-center justify-center gap-4">
            <span className="bg-gray-100 px-2 py-1 rounded">页面尺寸: <span className="font-mono text-gray-800">
              {Math.round(pdfPageSize.width * 0.3527)}mm x {Math.round(pdfPageSize.height * 0.3527)}mm
            </span></span>
            
            {pdfDocProxy && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleReset}
                  className="bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1 rounded-md font-medium text-xs transition flex items-center gap-1.5 shadow-sm"
                  title="重置所有更改"
                >
                  <RotateCcw size={12} />
                  重置
                </button>
                <div className="flex items-center bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-2 py-1 hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:hover:bg-white border-r border-gray-100 transition"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-3 text-xs font-mono text-gray-700 min-w-[50px] text-center bg-gray-50/50">
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:hover:bg-white border-l border-gray-100 transition"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <div className="flex-1 overflow-auto p-10 text-center relative bg-gray-100">
        {!pdfDocProxy ? (
          <div className="mt-20 text-gray-400">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-xl">请上传 FBA 标签文件</p>
          </div>
        ) : (
          <div 
            ref={containerRef}
            className="inline-block relative bg-white shadow-lg border border-gray-400 text-left"
          >
            <canvas ref={canvasRef} className="block" />
            <div
              ref={dragBoxRef}
              onMouseDown={handleMouseDown}
              className={`absolute border-2 border-dashed border-red-600 p-0.5 whitespace-nowrap leading-none select-none font-bold text-black font-sans cursor-grab ${isDragging ? 'cursor-grabbing border-solid' : ''}`}
              style={{
                left: dragPosition.x,
                top: dragPosition.y,
                fontSize: `${fontSize * (canvasRef.current ? canvasRef.current.width / pdfPageSize.width : 1)}px`,
                backgroundColor: 'transparent'
              }}
            >
              {textInput}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FBALabelEditor;
