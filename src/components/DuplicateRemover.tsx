import React, { useState, useEffect } from 'react';
import { CheckCircle, Copy, Download, Trash2, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

const Card = ({ children, className = "", ...props }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
);

const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-green-600 text-white hover:bg-green-700"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const DuplicateRemover = () => {
  // 输入输出状态
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  
  // 选项状态
  const [separator, setSeparator] = useState<string>('line');
  const [customSeparator, setCustomSeparator] = useState<string>('');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [trimSpaces, setTrimSpaces] = useState<boolean>(true);
  const [removeEmpty, setRemoveEmpty] = useState<boolean>(true);
  const [removeNumbers, setRemoveNumbers] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<string>('none');
  
  // 统计状态
  const [originalCount, setOriginalCount] = useState<number>(0);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [uniqueCount, setUniqueCount] = useState<number>(0);
  const [reductionRate, setReductionRate] = useState<number>(0);
  
  // 帮助状态
  const [showHelp, setShowHelp] = useState<boolean>(false);
  
  // 统计更新
  useEffect(() => {
    updateStats();
  }, [inputText, separator, customSeparator, removeEmpty, removeNumbers]);
  
  // 更新统计
  const updateStats = () => {
    if (!inputText.trim()) {
      setOriginalCount(0);
      setDuplicateCount(0);
      setUniqueCount(0);
      setReductionRate(0);
      return;
    }
    
    const actualSeparator = getSeparator();
    let items = inputText.split(actualSeparator);
    const original = items.length;
    
    // 处理每个条目
    items = items.map(item => {
      if (trimSpaces) {
        item = item.trim();
      }
      return item;
    });
    
    // 过滤空行
    if (removeEmpty) {
      items = items.filter(item => item !== '');
    }
    
    // 过滤纯数字
    if (removeNumbers) {
      items = items.filter(item => !/^\d+$/.test(item.trim()));
    }
    
    // 去重
    const seen = new Set();
    items.forEach(item => {
      const key = caseSensitive ? item : item.toLowerCase();
      seen.add(key);
    });
    
    const unique = seen.size;
    const duplicates = items.length - unique;
    const rate = items.length > 0 ? Math.round((duplicates / items.length) * 100) : 0;
    
    setOriginalCount(original);
    setDuplicateCount(duplicates);
    setUniqueCount(unique);
    setReductionRate(rate);
  };
  
  // 获取分隔符
  const getSeparator = () => {
    switch (separator) {
      case 'line': return '\n';
      case 'space': return ' ';
      case 'comma': return ',';
      case 'semicolon': return ';';
      case 'custom': return customSeparator || '\n';
      default: return '\n';
    }
  };
  
  // 去除重复
  const deduplicateText = () => {
    if (!inputText.trim()) {
      alert('请输入要去重的文本！');
      return;
    }
    
    const actualSeparator = getSeparator();
    
    // 分割文本
    let items = inputText.split(actualSeparator);
    
    // 处理每个条目
    items = items.map(item => {
      if (trimSpaces) {
        item = item.trim();
      }
      return item;
    });
    
    // 过滤空行
    if (removeEmpty) {
      items = items.filter(item => item !== '');
    }
    
    // 过滤纯数字
    if (removeNumbers) {
      items = items.filter(item => !/^\d+$/.test(item.trim()));
    }
    
    // 去重
    const uniqueItems: string[] = [];
    const seen = new Set();
    
    items.forEach(item => {
      const key = caseSensitive ? item : item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    });
    
    // 排序
    switch(sortOption) {
      case 'asc':
        uniqueItems.sort();
        break;
      case 'desc':
        uniqueItems.sort().reverse();
        break;
      case 'length':
        uniqueItems.sort((a, b) => a.length - b.length);
        break;
    }
    
    // 输出结果
    const result = uniqueItems.join(actualSeparator === '\n' ? '\n' : actualSeparator + ' ');
    setOutputText(result);
  };
  
  // 复制结果
  const copyResult = () => {
    if (!outputText.trim()) {
      alert('没有可复制的内容！');
      return;
    }
    
    navigator.clipboard.writeText(outputText).then(() => {
      alert('复制成功！');
    });
  };
  
  // 下载结果
  const downloadResult = () => {
    if (!outputText.trim()) {
      alert('没有可下载的内容！');
      return;
    }
    
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `去重结果_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('下载成功！');
  };
  
  // 清空所有
  const clearAll = () => {
    if (confirm('确定要清空所有内容吗？')) {
      setInputText('');
      setOutputText('');
      setOriginalCount(0);
      setDuplicateCount(0);
      setUniqueCount(0);
      setReductionRate(0);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">去除重复文本工具</h2>
      </div>
      
      {/* 使用说明 */}
      <Card className="p-5">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowHelp(!showHelp)}>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            使用说明
          </h3>
          {showHelp ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </div>
        {showHelp && (
          <div className="mt-4 text-sm text-gray-600 space-y-3">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">🚀 快速开始</h4>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>在左侧输入框粘贴或输入需要去重的文本</li>
                <li>选择合适的分隔符和处理选项</li>
                <li>点击"去除重复"按钮即可获得结果</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">⚙️ 功能说明</h4>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><strong>分隔符：</strong>支持按行、空格、逗号、分号或自定义分隔符</li>
                <li><strong>区分大小写：</strong>开启后"Apple"和"apple"视为不同项</li>
                <li><strong>去除首尾空格：</strong>自动清理每个条目的前后空格</li>
                <li><strong>排序选项：</strong>可对结果进行升序、降序或按长度排序</li>
                <li><strong>过滤功能：</strong>可移除空行和纯数字项</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">💡 使用技巧</h4>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>处理邮箱列表时建议开启"区分大小写"</li>
                <li>处理关键词时可使用"按长度排序"便于查看</li>
                <li>大量数据建议先"移除空行"提高处理效率</li>
                <li>结果可一键复制或下载为txt文件</li>
              </ul>
            </div>
          </div>
        )}
      </Card>
      
      {/* 选项配置 */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ 配置选项</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 分隔符选项 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">分隔符</label>
            <select 
              value={separator} 
              onChange={(e) => setSeparator(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="line">按行分隔</option>
              <option value="space">按空格分隔</option>
              <option value="comma">按逗号分隔</option>
              <option value="semicolon">按分号分隔</option>
              <option value="custom">自定义分隔符</option>
            </select>
            {separator === 'custom' && (
              <input 
                type="text" 
                value={customSeparator} 
                onChange={(e) => setCustomSeparator(e.target.value)} 
                placeholder="输入自定义分隔符" 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
          
          {/* 去重模式 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">去重模式</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="caseSensitive" 
                  checked={caseSensitive} 
                  onChange={(e) => setCaseSensitive(e.target.checked)} 
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="caseSensitive" className="text-sm text-gray-700">区分大小写</label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="trimSpaces" 
                  checked={trimSpaces} 
                  onChange={(e) => setTrimSpaces(e.target.checked)} 
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="trimSpaces" className="text-sm text-gray-700">去除首尾空格</label>
              </div>
            </div>
          </div>
          
          {/* 排序选项 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">排序选项</label>
            <select 
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="none">保持原顺序</option>
              <option value="asc">升序排列</option>
              <option value="desc">降序排列</option>
              <option value="length">按长度排序</option>
            </select>
          </div>
          
          {/* 过滤选项 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">过滤选项</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="removeEmpty" 
                  checked={removeEmpty} 
                  onChange={(e) => setRemoveEmpty(e.target.checked)} 
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="removeEmpty" className="text-sm text-gray-700">移除空行</label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="removeNumbers" 
                  checked={removeNumbers} 
                  onChange={(e) => setRemoveNumbers(e.target.checked)} 
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="removeNumbers" className="text-sm text-gray-700">移除纯数字</label>
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-blue-50 border-blue-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{originalCount}</div>
            <div className="text-sm text-blue-700">原始条目</div>
          </div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{duplicateCount}</div>
            <div className="text-sm text-red-700">重复条目</div>
          </div>
        </Card>
        <Card className="p-4 bg-green-50 border-green-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{uniqueCount}</div>
            <div className="text-sm text-green-700">去重后</div>
          </div>
        </Card>
        <Card className="p-4 bg-purple-50 border-purple-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{reductionRate}%</div>
            <div className="text-sm text-purple-700">压缩率</div>
          </div>
        </Card>
      </div>
      
      {/* 输入输出区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-4 h-4 bg-blue-600 rounded-full"></span>
              输入文本
            </h3>
            {inputText && (
              <button 
                onClick={() => setInputText('')} 
                className="text-xs text-gray-500 hover:text-red-500 transition-colors"
              >
                清空
              </button>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="请输入要去重的文本，每行一个条目或使用指定分隔符分隔..."
            className="w-full min-h-60 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          ></textarea>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-4 h-4 bg-green-600 rounded-full"></span>
              去重结果
            </h3>
            {outputText && (
              <button 
                onClick={() => setOutputText('')} 
                className="text-xs text-gray-500 hover:text-red-500 transition-colors"
              >
                清空
              </button>
            )}
          </div>
          <textarea
            value={outputText}
            readOnly
            placeholder="去重后的文本将显示在这里..."
            className="w-full min-h-60 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 font-mono bg-gray-50"
          ></textarea>
        </div>
      </div>
      
      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={deduplicateText} variant="primary">
          <CheckCircle className="h-4 w-4" />
          去除重复
        </Button>
        <Button onClick={copyResult} variant="secondary">
          <Copy className="h-4 w-4" />
          复制结果
        </Button>
        <Button onClick={downloadResult} variant="secondary">
          <Download className="h-4 w-4" />
          下载文件
        </Button>
        <Button onClick={clearAll} variant="danger">
          <Trash2 className="h-4 w-4" />
          清空所有
        </Button>
      </div>
    </div>
  );
};

export default DuplicateRemover;