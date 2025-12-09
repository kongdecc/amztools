import React, { useState } from 'react';
import { Search, Copy, RefreshCw, Info, ChevronDown, ChevronUp } from 'lucide-react';

const Card = ({ children, className = "", ...props }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
);

const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    success: "bg-green-600 text-white hover:bg-green-700",
    info: "bg-blue-100 text-blue-700 hover:bg-blue-200"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const TextComparator = () => {
  // 文本输入状态
  const [leftText, setLeftText] = useState<string>('');
  const [rightText, setRightText] = useState<string>('');
  
  // 比较结果状态
  const [showResult, setShowResult] = useState<boolean>(false);
  const [diffResult, setDiffResult] = useState<any[]>([]);
  const [addedCount, setAddedCount] = useState<number>(0);
  const [removedCount, setRemovedCount] = useState<number>(0);
  const [similarity, setSimilarity] = useState<number>(0);
  
  // 详细统计状态
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(false);
  const [detailedStats, setDetailedStats] = useState<any>(null);
  
  // 使用说明状态
  const [showHelp, setShowHelp] = useState<boolean>(false);
  
  // 改进的相似度计算函数
  const calculateSimilarity = (text1: string, text2: string): number => {
    if (text1 === text2) return 100;
    if (!text1 && !text2) return 100;
    if (!text1 || !text2) return 0;
    
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    
    if (maxLines === 0) return 100;
    
    let sameLines = 0;
    const minLines = Math.min(lines1.length, lines2.length);
    
    // 计算完全相同的行数
    for (let i = 0; i < minLines; i++) {
      if (lines1[i] === lines2[i]) {
        sameLines++;
      }
    }
    
    // 相似度 = 相同行数 / 总行数的最大值 × 100%
    return Math.round((sameLines / maxLines) * 100 * 10) / 10; // 保留一位小数
  };
  
  // 详细统计计算函数
  const calculateDetailedStats = (text1: string, text2: string) => {
    // 行级统计
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    const minLines = Math.min(lines1.length, lines2.length);
    
    let identicalLines = 0;
    for (let i = 0; i < minLines; i++) {
      if (lines1[i] === lines2[i]) {
        identicalLines++;
      }
    }
    
    const modifiedLines = minLines - identicalLines;
    const addedLines = lines2.length - lines1.length > 0 ? lines2.length - lines1.length : 0;
    const removedLines = lines1.length - lines2.length > 0 ? lines1.length - lines2.length : 0;
    
    // 词级统计
    const words1 = text1.match(/\S+/g) || [];
    const words2 = text2.match(/\S+/g) || [];
    const maxWords = Math.max(words1.length, words2.length);
    const minWords = Math.min(words1.length, words2.length);
    
    let identicalWords = 0;
    const words1Set = new Set(words1);
    const words2Set = new Set(words2);
    for (const word of words1Set) {
      if (words2Set.has(word)) {
        identicalWords++;
      }
    }
    
    const addedWords = words2.length - words1.length > 0 ? words2.length - words1.length : 0;
    const removedWords = words1.length - words2.length > 0 ? words1.length - words2.length : 0;
    
    // 字符级统计
    const chars1 = text1.length;
    const chars2 = text2.length;
    const maxChars = Math.max(chars1, chars2);
    
    let identicalChars = 0;
    const minChars = Math.min(chars1, chars2);
    for (let i = 0; i < minChars; i++) {
      if (text1[i] === text2[i]) {
        identicalChars++;
      }
    }
    
    const addedChars = chars2 - chars1 > 0 ? chars2 - chars1 : 0;
    const removedChars = chars1 - chars2 > 0 ? chars1 - chars2 : 0;
    
    return {
      lines: {
        total: maxLines,
        identical: identicalLines,
        modified: modifiedLines,
        added: addedLines,
        removed: removedLines,
        similarity: maxLines > 0 ? (identicalLines / maxLines * 100).toFixed(1) : '100.0'
      },
      words: {
        total: maxWords,
        identical: identicalWords,
        modified: Math.max(0, minWords - identicalWords),
        added: addedWords,
        removed: removedWords,
        similarity: maxWords > 0 ? (identicalWords / maxWords * 100).toFixed(1) : '100.0'
      },
      chars: {
        total: maxChars,
        identical: identicalChars,
        modified: Math.max(0, minChars - identicalChars),
        added: addedChars,
        removed: removedChars,
        similarity: maxChars > 0 ? (identicalChars / maxChars * 100).toFixed(1) : '100.0'
      }
    };
  };
  
  // 文本差异比较函数
  const diffTexts = (text1: string, text2: string) => {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    
    const result: any[] = [];
    let i = 0, j = 0;
    
    while (i < lines1.length || j < lines2.length) {
      if (i >= lines1.length) {
        result.push({ type: 'added', content: lines2[j], line1: null, line2: j + 1 });
        j++;
      } else if (j >= lines2.length) {
        result.push({ type: 'removed', content: lines1[i], line1: i + 1, line2: null });
        i++;
      } else if (lines1[i] === lines2[j]) {
        result.push({ type: 'unchanged', content: lines1[i], line1: i + 1, line2: j + 1 });
        i++;
        j++;
      } else {
        let found = false;
        for (let k = j + 1; k < Math.min(j + 5, lines2.length); k++) {
          if (lines1[i] === lines2[k]) {
            for (let l = j; l < k; l++) {
              result.push({ type: 'added', content: lines2[l], line1: null, line2: l + 1 });
            }
            result.push({ type: 'unchanged', content: lines1[i], line1: i + 1, line2: k + 1 });
            i++;
            j = k + 1;
            found = true;
            break;
          }
        }
        
        if (!found) {
          for (let k = i + 1; k < Math.min(i + 5, lines1.length); k++) {
            if (lines1[k] === lines2[j]) {
              for (let l = i; l < k; l++) {
                result.push({ type: 'removed', content: lines1[l], line1: l + 1, line2: null });
              }
              result.push({ type: 'unchanged', content: lines1[k], line1: k + 1, line2: j + 1 });
              i = k + 1;
              j++;
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          result.push({ type: 'removed', content: lines1[i], line1: i + 1, line2: null });
          result.push({ type: 'added', content: lines2[j], line1: null, line2: j + 1 });
          i++;
          j++;
        }
      }
    }
    
    return result;
  };
  
  // 比较文本函数
  const compareTexts = () => {
    if (!leftText.trim() && !rightText.trim()) {
      alert('请至少在一个文本框中输入内容');
      return;
    }
    
    const similarityScore = calculateSimilarity(leftText, rightText);
    const detailedStatsData = calculateDetailedStats(leftText, rightText);
    const diff = diffTexts(leftText, rightText);
    
    let added = 0, removed = 0;
    diff.forEach(item => {
      if (item.type === 'added') added++;
      if (item.type === 'removed') removed++;
    });
    
    setSimilarity(similarityScore);
    setDetailedStats(detailedStatsData);
    setDiffResult(diff);
    setAddedCount(added);
    setRemovedCount(removed);
    setShowResult(true);
  };
  
  // 清空所有内容
  const clearAll = () => {
    setLeftText('');
    setRightText('');
    setShowResult(false);
    setDiffResult([]);
    setAddedCount(0);
    setRemovedCount(0);
    setSimilarity(0);
    setShowDetailedStats(false);
    setDetailedStats(null);
  };
  
  // 返回编辑模式
  const backToEdit = () => {
    setShowResult(false);
  };
  
  // 复制结果
  const copyResult = () => {
    if (!showResult) return;
    
    let text = '';
    diffResult.forEach(item => {
      if (item.type === 'added') {
        text += '[新增] ' + item.content + '\n';
      } else if (item.type === 'unchanged') {
        text += item.content + '\n';
      }
    });
    
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板！');
    });
  };
  
  // 切换详细统计
  const toggleDetailedStats = () => {
    setShowDetailedStats(!showDetailedStats);
  };
  
  // 切换使用说明
  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };
  
  // 转义HTML特殊字符
  const escapeHtml = (text: string) => {
    if (!text) return '';
    return text.replace(/[<>&"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Search className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">文本比较工具</h2>
      </div>
      
      {/* 使用说明 */}
      <Card className="p-5">
        <div className="flex items-center justify-between cursor-pointer" onClick={toggleHelp}>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            使用说明
          </h3>
          {showHelp ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </div>
        {showHelp && (
          <div className="mt-4 text-sm text-gray-600 space-y-3">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>基本操作：</strong>在左右文本框中分别输入原始文本和对比文本，点击"比较文本"查看差异</li>
              <li><strong>颜色含义：</strong>
                <span style={{background: '#fee2e2', color: '#991b1b', padding: '2px 4px', borderRadius: '3px', margin: '0 4px'}}>红色删除线</span> = 原文中有但新文中删除的内容，
                <span style={{background: '#dcfce7', color: '#166534', padding: '2px 4px', borderRadius: '3px', margin: '0 4px'}}>绿色背景</span> = 新文中新增的内容
              </li>
              <li><strong>相似度计算：</strong>基于行级匹配，公式为：相同行数 ÷ 最大行数 × 100%</li>
              <li><strong>详细统计：</strong>提供行、词、字符三个维度的详细分析</li>
              <li><strong>复制功能：</strong>将比较结果以纯文本格式复制到剪贴板，方便粘贴到其他地方</li>
              <li><strong>适用场景：</strong>文档版本对比、代码审查、合同修改、文章编辑等</li>
            </ul>
          </div>
        )}
      </Card>
      
      {/* 控制按钮 */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={compareTexts} variant="primary">
          <Search className="h-4 w-4" />
          比较文本
        </Button>
        <Button onClick={clearAll} variant="secondary">
          <RefreshCw className="h-4 w-4" />
          清空所有
        </Button>
        {showResult && (
          <>
            <Button onClick={backToEdit} variant="secondary">
              返回编辑
            </Button>
            <Button onClick={copyResult} variant="success">
              <Copy className="h-4 w-4" />
              复制结果
            </Button>
            <Button onClick={toggleDetailedStats} variant="info">
              {showDetailedStats ? '隐藏统计' : '详细统计'}
            </Button>
          </>
        )}
      </div>
      
      {/* 详细统计面板 */}
      {showDetailedStats && detailedStats && (
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            📊 详细统计分析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <h4 className="text-md font-medium text-gray-700 mb-3">📄 行级分析</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">总计</span>
                  <span className="font-medium">{detailedStats.lines.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">相同</span>
                  <span className="font-medium">{detailedStats.lines.identical} ({(detailedStats.lines.identical / Math.max(detailedStats.lines.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">修改</span>
                  <span className="font-medium">{detailedStats.lines.modified} ({(detailedStats.lines.modified / Math.max(detailedStats.lines.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">新增</span>
                  <span className="font-medium text-green-600">{detailedStats.lines.added} ({(detailedStats.lines.added / Math.max(detailedStats.lines.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">删除</span>
                  <span className="font-medium text-red-600">{detailedStats.lines.removed} ({(detailedStats.lines.removed / Math.max(detailedStats.lines.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                  <span className="text-gray-600">相似度</span>
                  <span className="font-bold text-purple-600">{detailedStats.lines.similarity}%</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
              <h4 className="text-md font-medium text-gray-700 mb-3">📝 词级分析</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">总计</span>
                  <span className="font-medium">{detailedStats.words.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">相同</span>
                  <span className="font-medium">{detailedStats.words.identical} ({(detailedStats.words.identical / Math.max(detailedStats.words.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">修改</span>
                  <span className="font-medium">{detailedStats.words.modified} ({(detailedStats.words.modified / Math.max(detailedStats.words.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">新增</span>
                  <span className="font-medium text-green-600">{detailedStats.words.added} ({(detailedStats.words.added / Math.max(detailedStats.words.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">删除</span>
                  <span className="font-medium text-red-600">{detailedStats.words.removed} ({(detailedStats.words.removed / Math.max(detailedStats.words.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                  <span className="text-gray-600">相似度</span>
                  <span className="font-bold text-purple-600">{detailedStats.words.similarity}%</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-red-500">
              <h4 className="text-md font-medium text-gray-700 mb-3">🔤 字符分析</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">总计</span>
                  <span className="font-medium">{detailedStats.chars.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">相同</span>
                  <span className="font-medium">{detailedStats.chars.identical} ({(detailedStats.chars.identical / Math.max(detailedStats.chars.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">修改</span>
                  <span className="font-medium">{detailedStats.chars.modified} ({(detailedStats.chars.modified / Math.max(detailedStats.chars.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">新增</span>
                  <span className="font-medium text-green-600">{detailedStats.chars.added} ({(detailedStats.chars.added / Math.max(detailedStats.chars.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">删除</span>
                  <span className="font-medium text-red-600">{detailedStats.chars.removed} ({(detailedStats.chars.removed / Math.max(detailedStats.chars.total, 1) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                  <span className="text-gray-600">相似度</span>
                  <span className="font-bold text-purple-600">{detailedStats.chars.similarity}%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* 比较区域 */}
      {!showResult ? (
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">文本输入</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">原始文本</label>
                {leftText && (
                  <button 
                    onClick={() => setLeftText('')} 
                    className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
              <textarea
                value={leftText}
                onChange={(e) => setLeftText(e.target.value)}
                placeholder="在此输入原始文本..."
                className="w-full min-h-60 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              ></textarea>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">对比文本</label>
                {rightText && (
                  <button 
                    onClick={() => setRightText('')} 
                    className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
              <textarea
                value={rightText}
                onChange={(e) => setRightText(e.target.value)}
                placeholder="在此输入要对比的文本..."
                className="w-full min-h-60 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              ></textarea>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">比较结果</h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600">添加: {addedCount}</span>
              <span className="text-red-600">删除: {removedCount}</span>
              <span className="text-purple-600 font-medium">相似度: {similarity}%</span>
            </div>
          </div>
          
          {leftText === rightText ? (
            <div className="text-center py-10 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-lg font-medium">✅ 文本完全相同，没有发现差异</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">原始文本</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-60 max-h-96 overflow-y-auto font-mono text-sm">
                  {diffResult.map((item, index) => (
                    <div 
                      key={index} 
                      className={
                        item.type === 'removed' 
                          ? 'bg-red-50 text-red-800 line-through py-1 px-2 rounded' 
                          : item.type === 'unchanged' 
                            ? 'py-1 px-2' 
                            : 'py-1 px-2'
                      }
                    >
                      {item.type === 'removed' && escapeHtml(item.content)}
                      {item.type === 'unchanged' && escapeHtml(item.content)}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">对比文本</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-60 max-h-96 overflow-y-auto font-mono text-sm">
                  {diffResult.map((item, index) => (
                    <div 
                      key={index} 
                      className={
                        item.type === 'added' 
                          ? 'bg-green-50 text-green-800 py-1 px-2 rounded' 
                          : item.type === 'unchanged' 
                            ? 'py-1 px-2' 
                            : 'py-1 px-2'
                      }
                    >
                      {item.type === 'added' && escapeHtml(item.content)}
                      {item.type === 'unchanged' && escapeHtml(item.content)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default TextComparator;