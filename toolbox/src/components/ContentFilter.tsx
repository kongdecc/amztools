import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Copy, Download, X, Edit, Plus, RefreshCw, Filter } from 'lucide-react';

interface WordList {
  [key: string]: string[];
}

interface FilterOptions {
  articles: boolean;
  prepositions: boolean;
  conjunctions: boolean;
  pronouns: boolean;
  auxiliaries: boolean;
}

interface ProcessingOptions {
  ignoreCase: boolean;
  removePunctuation: boolean;
  preserveSpacing: boolean;
}

interface WordFrequency {
  [key: string]: number;
}

const ContentFilter: React.FC = () => {
  // 状态管理
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [customWordsInput, setCustomWordsInput] = useState<string>('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    articles: true,
    prepositions: true,
    conjunctions: true,
    pronouns: false,
    auxiliaries: false
  });
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    ignoreCase: true,
    removePunctuation: false,
    preserveSpacing: true
  });
  const [stats, setStats] = useState({
    originalWords: 0,
    filteredWords: 0,
    removedWords: 0,
    removalRate: 0
  });
  const [filteredWords, setFilteredWords] = useState<WordFrequency>({});
  const [showStats, setShowStats] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  
  // 模态框状态
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('词汇列表');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [currentEditingCategory, setCurrentEditingCategory] = useState<string | null>(null);
  
  // 预设词汇列表（原始备份）
  const originalWordLists: WordList = {
    articles: ['a', 'an', 'the'],
    prepositions: ['in', 'on', 'at', 'by', 'for', 'with', 'to', 'of', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'beside', 'behind', 'across', 'against', 'within', 'without', 'upon', 'beneath', 'beyond', 'throughout', 'underneath'],
    conjunctions: ['and', 'or', 'but', 'nor', 'for', 'so', 'yet', 'because', 'since', 'as', 'if', 'unless', 'while', 'when', 'where', 'although', 'though', 'whereas', 'however', 'therefore', 'moreover', 'furthermore', 'nevertheless', 'nonetheless'],
    pronouns: ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what'],
    auxiliaries: ['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'can', 'could', 'must', 'ought']
  };
  
  // 当前使用的词汇列表（可编辑）
  const [wordLists, setWordLists] = useState<WordList>(JSON.parse(JSON.stringify(originalWordLists)));
  
  // 自定义词库
  const [customWordBank, setCustomWordBank] = useState<string[]>([]);
  
  // 词类名称映射
  const categoryNames: { [key: string]: string } = {
    articles: '冠词',
    prepositions: '介词',
    conjunctions: '连词',
    pronouns: '代词',
    auxiliaries: '助动词'
  };
  
  // 显示通知
  const showNotification = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };
  
  // 检查词汇是否重复
  const isWordDuplicate = (word: string, category: string, currentIndex: number): boolean => {
    // 检查当前类别
    if (category === 'custom') {
      return customWordBank.some((w, i) => w === word && i !== currentIndex);
    } else {
      if (wordLists[category].some((w, i) => w === word && i !== currentIndex)) {
        return true;
      }
    }
    
    // 检查其他预设类别
    if (category !== 'custom') {
      for (let cat in wordLists) {
        if (cat !== category && wordLists[cat].includes(word)) {
          return true;
        }
      }
    }
    
    // 检查自定义词库
    if (category !== 'custom' && customWordBank.includes(word)) {
      return true;
    }
    
    return false;
  };
  
  // 创建词汇元素
  const createWordElement = (word: string, index: number, type: 'preset' | 'custom', category: string) => {
    return (
      <span key={`${category}-${index}`} className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${type === 'preset' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-purple-100 text-purple-800 border border-purple-200'}`}>
        {word}
        <button 
          onClick={() => startEditing(word, index, category)} 
          className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 p-1 rounded-full transition-colors"
          title="编辑"
        >
          <Edit size={14} />
        </button>
        <button 
          onClick={() => deleteWord(word, index, category)} 
          className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded-full transition-colors"
          title="删除"
        >
          <X size={14} />
        </button>
      </span>
    );
  };
  
  // 开始编辑词汇
  const startEditing = (originalWord: string, index: number, category: string) => {
    const newWord = prompt('请输入新词汇:', originalWord);
    if (newWord === null) return;
    
    const trimmedWord = newWord.trim().toLowerCase();
    if (!trimmedWord) {
      showNotification('词汇不能为空！', 'warning');
      return;
    }
    
    if (trimmedWord === originalWord) return;
    
    if (isWordDuplicate(trimmedWord, category, index)) {
      showNotification('该词汇已存在！', 'warning');
      return;
    }
    
    // 更新词汇
    if (category === 'custom') {
      const updatedCustomWords = [...customWordBank];
      updatedCustomWords[index] = trimmedWord;
      setCustomWordBank(updatedCustomWords);
    } else {
      const updatedWordLists = { ...wordLists };
      updatedWordLists[category][index] = trimmedWord;
      setWordLists(updatedWordLists);
    }
    
    showNotification(`词汇已更新: "${originalWord}" → "${trimmedWord}"`, 'success');
  };
  
  // 删除词汇
  const deleteWord = (word: string, index: number, category: string) => {
    if (!confirm(`确定要删除词汇 "${word}" 吗？`)) return;
    
    if (category === 'custom') {
      const updatedCustomWords = customWordBank.filter((_, i) => i !== index);
      setCustomWordBank(updatedCustomWords);
    } else {
      const updatedWordLists = { ...wordLists };
      updatedWordLists[category] = updatedWordLists[category].filter((_, i) => i !== index);
      setWordLists(updatedWordLists);
    }
    
    showNotification(`已删除词汇 "${word}"`, 'success');
  };
  
  // 显示特定类别的词汇
  const showWords = (category: string) => {
    setCurrentEditingCategory(category);
    const words = wordLists[category];
    const categoryName = categoryNames[category];
    
    setModalTitle(`${categoryName} (${words.length}个)`);
    setModalContent(
      <div>
        <p className="mb-4 text-gray-600 italic">点击 ✏️ 编辑词汇，点击 × 删除词汇</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {words.map((word, index) => createWordElement(word, index, 'preset', category))}
        </div>
        <div className="flex gap-2 justify-end pt-4 border-t">
          <button 
            onClick={addNewWord} 
            className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors text-sm"
          >
            <Plus size={14} />
            添加新词
          </button>
          <button 
            onClick={() => resetCategory(category)} 
            className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors text-sm"
          >
            <RefreshCw size={14} />
            恢复默认
          </button>
        </div>
      </div>
    );
    setShowModal(true);
  };
  
  // 显示所有预设词汇
  const showAllPresetWords = () => {
    setCurrentEditingCategory(null);
    setModalTitle('预设词库管理');
    
    const content = (
      <div>
        <p className="mb-4 text-gray-600 italic">管理所有预设词库，可以添加、编辑或删除词汇</p>
        {Object.entries(wordLists).map(([category, words]) => (
          <div key={category} className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-lg font-semibold text-gray-800 pb-1 border-b border-gray-200">
                {categoryNames[category]} ({words.length}个)
              </h4>
              <button 
                onClick={() => showWords(category)} 
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors text-sm"
              >
                管理
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {words.map((word, index) => createWordElement(word, index, 'preset', category))}
            </div>
          </div>
        ))}
      </div>
    );
    
    setModalContent(content);
    setShowModal(true);
  };
  
  // 显示和管理自定义词汇
  const showCustomWords = () => {
    if (customWordBank.length === 0) {
      showNotification('暂无自定义词汇', 'warning');
      return;
    }
    
    setCurrentEditingCategory('custom');
    setModalTitle(`自定义词库管理 (${customWordBank.length}个)`);
    
    setModalContent(
      <div>
        <p className="mb-4 text-gray-600 italic">点击 ✏️ 编辑词汇，点击 × 删除词汇</p>
        <div className="flex flex-wrap gap-2">
          {customWordBank.map((word, index) => createWordElement(word, index, 'custom', 'custom'))}
        </div>
      </div>
    );
    setShowModal(true);
  };
  
  // 添加新词汇到当前类别
  const addNewWord = () => {
    if (!currentEditingCategory || currentEditingCategory === 'custom') {
      showNotification('请先选择一个预设词类进行管理', 'warning');
      return;
    }
    
    const newWord = prompt('请输入新词汇:');
    if (!newWord) return;
    
    const trimmedWord = newWord.trim().toLowerCase();
    if (!trimmedWord) {
      showNotification('词汇不能为空！', 'warning');
      return;
    }
    
    if (isWordDuplicate(trimmedWord, currentEditingCategory, -1)) {
      showNotification('该词汇已存在！', 'warning');
      return;
    }
    
    const updatedWordLists = { ...wordLists };
    updatedWordLists[currentEditingCategory].push(trimmedWord);
    setWordLists(updatedWordLists);
    
    showNotification(`已添加词汇 "${trimmedWord}" 到 ${categoryNames[currentEditingCategory]}`, 'success');
    
    // 刷新显示
    showWords(currentEditingCategory);
  };
  
  // 恢复类别默认词汇
  const resetCategory = (category: string) => {
    if (!confirm(`确定要恢复 ${categoryNames[category]} 的默认词汇吗？这将删除所有自定义添加的词汇。`)) return;
    
    const updatedWordLists = { ...wordLists };
    updatedWordLists[category] = [...originalWordLists[category]];
    setWordLists(updatedWordLists);
    
    showNotification(`${categoryNames[category]} 已恢复默认词汇`, 'success');
    
    // 刷新显示
    showWords(category);
  };
  
  // 添加到预设词库
  const addToPreset = () => {
    const customWords = customWordsInput
      .split(',')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length > 0);
    
    if (customWords.length === 0) {
      showNotification('请输入要添加的词汇', 'warning');
      return;
    }
    
    let addedCount = 0;
    let existingWords: string[] = [];
    
    customWords.forEach(word => {
      // 检查是否已存在
      let exists = false;
      for (let category in wordLists) {
        if (wordLists[category].includes(word)) {
          exists = true;
          break;
        }
      }
      
      if (!exists && customWordBank.includes(word)) {
        exists = true;
      }
      
      if (exists) {
        existingWords.push(word);
      } else {
        customWordBank.push(word);
        addedCount++;
      }
    });
    
    if (addedCount > 0) {
      showNotification(`成功添加 ${addedCount} 个词汇到自定义词库`, 'success');
    }
    
    if (existingWords.length > 0) {
      showNotification(`${existingWords.join(', ')} 已存在于词库中`, 'warning');
    }
    
    setCustomWordsInput('');
  };
  
  // 清空自定义词汇
  const clearCustomWords = () => {
    if (customWordBank.length === 0) {
      showNotification('自定义词库已为空', 'warning');
      return;
    }
    
    if (confirm('确定要清空所有自定义词汇吗？')) {
      setCustomWordBank([]);
      showNotification('自定义词库已清空', 'success');
    }
  };
  
  // 处理文本
  const processText = () => {
    if (!inputText.trim()) {
      showNotification('请输入要处理的文本！', 'warning');
      return;
    }
    
    // 构建要过滤的词汇列表
    let wordsToFilter: string[] = [];
    
    // 添加选中的预设词类
    Object.entries(filterOptions).forEach(([category, isSelected]) => {
      if (isSelected) {
        wordsToFilter = wordsToFilter.concat(wordLists[category]);
      }
    });
    
    // 添加自定义词汇
    wordsToFilter = wordsToFilter.concat(customWordBank);
    
    // 添加输入框中的临时词汇
    const tempCustomWords = customWordsInput
      .split(',')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length > 0);
    wordsToFilter = wordsToFilter.concat(tempCustomWords);
    
    // 去重
    wordsToFilter = [...new Set(wordsToFilter)];
    
    if (wordsToFilter.length === 0) {
      showNotification('请至少选择一种过滤类型或输入自定义词汇！', 'warning');
      return;
    }
    
    // 开始处理文本
    let processedText = inputText;
    const originalWords = inputText.split(/\s+/).filter(word => word.length > 0);
    const removedWords: string[] = [];
    const wordFrequency: WordFrequency = {};
    
    // 创建正则表达式进行词汇过滤
    wordsToFilter.forEach(word => {
      const flags = processingOptions.ignoreCase ? 'gi' : 'g';
      const regex = new RegExp(`\\b${word}\\b`, flags);
      
      // 统计被删除的词汇
      const matches = processedText.match(regex);
      if (matches) {
        const lowerWord = word.toLowerCase();
        wordFrequency[lowerWord] = (wordFrequency[lowerWord] || 0) + matches.length;
        removedWords.push(...matches);
      }
      
      // 删除词汇
      if (processingOptions.preserveSpacing) {
        processedText = processedText.replace(regex, '');
      } else {
        processedText = processedText.replace(regex, ' ');
      }
    });
    
    // 清理多余的空格
    processedText = processedText.replace(/\s+/g, ' ').trim();
    
    // 删除标点符号（如果选中）
    if (processingOptions.removePunctuation) {
      processedText = processedText.replace(/[^\w\s]/g, '');
    }
    
    // 更新结果
    setOutputText(processedText);
    
    // 更新统计信息
    const filteredWordsArray = processedText.split(/\s+/).filter(word => word.length > 0);
    const removedCount = removedWords.length;
    const removalRate = originalWords.length > 0 ? Math.round((removedCount / originalWords.length) * 100) : 0;
    
    setStats({
      originalWords: originalWords.length,
      filteredWords: filteredWordsArray.length,
      removedWords: removedCount,
      removalRate: removalRate
    });
    
    setFilteredWords(wordFrequency);
    setShowStats(true);
    
    showNotification('文本过滤完成！', 'success');
  };
  
  // 复制结果
  const copyResult = () => {
    if (!outputText.trim()) {
      showNotification('没有可复制的内容！', 'warning');
      return;
    }
    
    navigator.clipboard.writeText(outputText)
      .then(() => {
        showNotification('结果已复制到剪贴板！', 'success');
      })
      .catch(() => {
        showNotification('复制失败，请手动复制！', 'error');
      });
  };
  
  // 下载结果
  const downloadResult = () => {
    if (!outputText.trim()) {
      showNotification('没有可下载的内容！', 'warning');
      return;
    }
    
    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('文件下载成功！', 'success');
  };
  
  // 清空所有
  const clearAll = () => {
    setInputText('');
    setOutputText('');
    setCustomWordsInput('');
    setShowStats(false);
    setFilteredWords({});
    showNotification('所有内容已清空！', 'success');
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">英文文本过滤工具</h2>
      </div>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* 输入区域 */}
            <div className="lg:col-span-5 bg-gray-50 p-5 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">📝 文本输入</h3>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="请在此处输入或粘贴您的英文文本..."
                className="w-full h-48 p-3 border-2 border-gray-300 rounded-lg font-mono text-sm resize-vertical focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
              
              <div className="mt-5 bg-gray-100 p-4 rounded-lg">
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <h4 className="flex justify-between items-center text-gray-800 font-medium mb-3">
                      📚 预设词类
                      <button 
                        onClick={showAllPresetWords} 
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                      >
                        管理词库
                      </button>
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(categoryNames).map(([key, name]) => (
                        <div key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={key}
                            checked={filterOptions[key as keyof FilterOptions]}
                            onChange={(e) => setFilterOptions({ ...filterOptions, [key]: e.target.checked })}
                            className="w-4 h-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={key} className="text-gray-700">{name}</label>
                          <button 
                            onClick={() => showWords(key)} 
                            className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded hover:bg-blue-200 transition-colors"
                          >
                            查看
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <h4 className="text-gray-800 font-medium mb-3">🎯 自定义过滤词</h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={customWordsInput}
                        onChange={(e) => setCustomWordsInput(e.target.value)}
                        placeholder="输入自定义词汇，用逗号分隔"
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={addToPreset} 
                          className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                        >
                          <Plus size={12} />
                          添加到词库
                        </button>
                        <button 
                          onClick={showCustomWords} 
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                        >
                          📋 管理词库
                        </button>
                        <button 
                          onClick={clearCustomWords} 
                          className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200 transition-colors flex items-center gap-1"
                        >
                          🗑️ 清空
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                    <input
                      type="checkbox"
                      id="ignoreCase"
                      checked={processingOptions.ignoreCase}
                      onChange={(e) => setProcessingOptions({ ...processingOptions, ignoreCase: e.target.checked })}
                      className="w-4 h-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="ignoreCase" className="text-gray-700">忽略大小写</label>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                    <input
                      type="checkbox"
                      id="removePunctuation"
                      checked={processingOptions.removePunctuation}
                      onChange={(e) => setProcessingOptions({ ...processingOptions, removePunctuation: e.target.checked })}
                      className="w-4 h-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="removePunctuation" className="text-gray-700">删除标点符号</label>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                    <input
                      type="checkbox"
                      id="preserveSpacing"
                      checked={processingOptions.preserveSpacing}
                      onChange={(e) => setProcessingOptions({ ...processingOptions, preserveSpacing: e.target.checked })}
                      className="w-4 h-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="preserveSpacing" className="text-gray-700">保持原有间距</label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 中间控制按钮 */}
            <div className="lg:col-span-2 flex flex-col gap-3 items-center justify-center min-w-[100px]">
              <button 
                onClick={processText} 
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:shadow-lg transform hover:-translate-y-1 transition-all flex items-center gap-2 w-full justify-center"
              >
                🚀 开始过滤
              </button>
              <button 
                onClick={clearAll} 
                className="bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center gap-2 w-full justify-center"
              >
                🗑️ 清空所有
              </button>
            </div>
            
            {/* 输出区域 */}
            <div className="lg:col-span-5 bg-gray-50 p-5 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">📄 过滤结果</h3>
              <textarea
                value={outputText}
                readOnly
                placeholder="过滤后的文本将显示在这里..."
                className="w-full h-48 p-3 border-2 border-gray-300 rounded-lg font-mono text-sm resize-vertical bg-white"
              />
              
              <div className="flex justify-center gap-3 mt-4">
                <button 
                  onClick={copyResult} 
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <Copy size={16} />
                  复制结果
                </button>
                <button 
                  onClick={downloadResult} 
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  下载文件
                </button>
              </div>
              
              {/* 统计信息 */}
              {showStats && (
                <div className="mt-5 bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                  <h4 className="text-green-800 font-medium mb-3">📊 统计信息</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-green-600">{stats.originalWords}</div>
                      <div className="text-sm text-gray-600">原始词数</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-green-600">{stats.filteredWords}</div>
                      <div className="text-sm text-gray-600">过滤后词数</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-green-600">{stats.removedWords}</div>
                      <div className="text-sm text-gray-600">删除词数</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-green-600">{stats.removalRate}%</div>
                      <div className="text-sm text-gray-600">删除率</div>
                    </div>
                  </div>
                  
                  {/* 被过滤的词汇 */}
                  {Object.keys(filteredWords).length > 0 && (
                    <div className="mt-4 bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500">
                      <h5 className="text-yellow-800 font-medium mb-2">🏷️ 被过滤的词汇</h5>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(filteredWords).map(([word, count]) => (
                          <span key={word} className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                            {word} ({count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 通知 */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 transform translate-x-0 opacity-100 z-[9999] ${notification.type === 'success' ? 'bg-green-500 text-white' : notification.type === 'warning' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : notification.type === 'warning' ? <AlertCircle size={20} /> : <X size={20} />}
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)} 
            className="ml-auto text-white hover:opacity-80"
          >
            <X size={16} />
          </button>
        </div>
      )}
      
      {/* 模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="text-xl font-semibold text-gray-800">{modalTitle}</h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-5">
              {modalContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentFilter;