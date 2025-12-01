import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle, Copy, Download, RefreshCw, PlusCircle, Trash2 } from 'lucide-react';

const Card = ({ children, className = "", ...props }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
);

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-green-600 text-white hover:bg-green-700",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const ForbiddenWordsChecker = () => {
  // 预设违禁词库
  const [presetForbiddenWords, setPresetForbiddenWords] = useState<string[]>([
    "100% natural",
    "100% quality guaranteed",
    "Acquired Immune Deficiency Syndrome",
    "ADD",
    "added value",
    "ADHD",
    "AIDS",
    "All Natural",
    "ALS",
    "Alzheimers",
    "Antibacterial",
    "Anti-bacterial",
    "antifungal",
    "Anti-Fungal",
    "Anti-Microbial",
    "anxiety",
    "approved",
    "Arrive faster",
    "Attention Deficit Disorder Drug",
    "Authentic",
    "award winning",
    "bacteria",
    "best deal",
    "Best price",
    "Best seller",
    "Best selling",
    "big sale",
    "biodegradable",
    "biological contaminants",
    "bpa free",
    "brand new",
    "buy now",
    "buy with confidence",
    "Cancer",
    "Cancroid",
    "Cataract",
    "certified",
    "Chlamydia",
    "closeout",
    "close-out",
    "CMV",
    "compostable",
    "Concusuion",
    "Coronavirus",
    "covid",
    "COVID-19",
    "Crabs",
    "Crystic Fibrosis",
    "cure",
    "Cytomegalovirus",
    "decomposable",
    "degradable",
    "Dementia",
    "Depression",
    "detoxification",
    "detoxify",
    "Diabetes",
    "Diabetic",
    "Diabetic Neuropathy",
    "Discounted price",
    "disease",
    "diseases",
    "don't miss out",
    "dotoxifying",
    "eco friendly",
    "ecofriendly",
    "eco-friendly",
    "environmentally friendly",
    "etc.",
    "fall sale",
    "fda",
    "FDA Approval",
    "FedEx",
    "filter",
    "flawless",
    "Flu",
    "free gift",
    "free shipping",
    "On sale",
    "Free shipping Guaranteed",
    "fungal",
    "Fungicide",
    "Fungicides",
    "fungus",
    "gift idea",
    "Glaucoma",
    "Gororrhea",
    "Great as",
    "Great for",
    "green",
    "guarantee",
    "guaranteed",
    "Hassle free",
    "heal",
    "Hepatitis A",
    "Hepatitis B",
    "Hepatitis C",
    "Herpes",
    "Herpes Simplex Virus 1",
    "Herpes Simplex Virus 2",
    "highest rated",
    "HIV",
    "Hodgkins Lymphoma",
    "home compostable",
    "hot item",
    "HPV",
    "HSV1",
    "HSV2",
    "huge sale",
    "Human Immunodeficiency Virus",
    "Human Papiloma Virus",
    "imported from",
    "indian",
    "inflammation",
    "Influenza",
    "Kidney Disease",
    "Lasting quality",
    "LGV",
    "limited time offer",
    "Liver disease",
    "Lupus",
    "Lymphogranuloma Venereum",
    "Lymphoma",
    "Made in",
    "mail rebate",
    "make excellent",
    "makes awesome",
    "makes great",
    "makes perfect",
    "makes spectacular",
    "makes the best",
    "makes wonderful",
    "marine degradable",
    "massive sale",
    "Meningitis",
    "mildew",
    "money back guarantee",
    "Mono",
    "Mononucleosis",
    "mould",
    "mould resistant",
    "mould spores",
    "Multiple Sclerosis",
    "Muscular Dystrophy",
    "Mycoplasma Genitalium",
    "Nano Silver",
    "native american",
    "Native American Indian or tribes",
    "natural",
    "newest version",
    "NGU",
    "non toxic",
    "noncorrosive",
    "Nongonococcal Urethritis",
    "non-toxi",
    "non-toxic",
    "now together",
    "over- stock",
    "overstock",
    "parasitic",
    "Parkinson",
    "Parkinsons",
    "patented",
    "peal",
    "Pelvic Inflammatory Disease",
    "Perfect for",
    "Perfect gift",
    "pesticide",
    "pesticides",
    "PID",
    "platinum",
    "plus free",
    "Professional quality",
    "proven",
    "Public lice",
    "quality",
    "Ready to ship",
    "recommended by",
    "remedies",
    "remedy",
    "Retail box",
    "SAD",
    "sanitize",
    "sanitizes",
    "Satisfaction",
    "Save $",
    "Save cash",
    "Save money",
    "scabies",
    "Seasonal Affective Disorder",
    "seen on tv",
    "Ships faster",
    "shop with confidence",
    "Special offer",
    "Special promo",
    "spring sale",
    "Stroke",
    "summer sale",
    "super sale",
    "supplies won't last",
    "TBIs",
    "tested",
    "The Clap",
    "Top notch",
    "top quality",
    "top rated",
    "top selling",
    "toxic",
    "toxin",
    "toxins",
    "Traumatic Brain Injuries",
    "treat",
    "treatment",
    "tribes",
    "Trich",
    "trichomoniasis",
    "tricht",
    "Tumor",
    "unbeatable price",
    "UPS",
    "Used",
    "validated",
    "viral",
    "virus",
    "viruses",
    "weight loss",
    "wholesale price",
    "winter sale",
    "Within hours",
    "worlds best",
    "Insecticidal",
    "disinfect",
    "Anti-toxic",
    "repel insects",
    "Anti-mildew",
    "remove allergens",
    "against mildew",
    "drug",
    "dustproof",
    "antibiotic",
    "antifouling",
    "non-poisonous",
    "preservatives",
    "sterilization",
    "mold",
    "insecticide",
    "anti",
    "UV",
    "Antimicrobial",
    "environment friendly",
    "Used to prevent",
    "moisture",
    "Eliminate",
    "infection",
    "Repel or slow down any pest",
    "Anti-oxidation",
    "hygience",
    "Mildew proof",
    "BPA-Free",
    "Bacteriostatic",
    "micro-bio",
    "non-injurious",
    "anti-virus",
    "Anti-Bacterial vinyl",
    "filter air",
    "repelient",
    "resist ultraviolet rays",
    "mosquitos",
    "prevent or inhibit the growth of bacteria",
    "protect",
    "chemical",
    "allergens",
    "hypoallergenic",
    "filters",
    "mites",
    "rat",
    "dust",
    "pest",
    "insect repellent",
    "rodent",
    "insects",
    "mouse",
    "pests",
    "harmless",
    "Water filtration",
    "Anti-Mites",
    "Inhibit-Algae",
    "Sanitize-Blight",
    "Sterilize",
    "Insect prevention",
    "Resistant for mosquitoes & ants",
    "Nontoxic",
    "Healthy",
    "Environmental Protection.",
    "Anti-Fouling",
    "prevent",
    "resistant",
    "Anti-flu",
    "Ultraviolet",
    "light/UV",
    "germs",
    "bug",
    "Anti-Bacteria",
    "Stop-Microbe/Mildew",
    "Destroy",
    "Fungal/Fungus",
    "Repel-Pesticides",
    "preventing",
    "destroying",
    "repelling",
    "mitigating any pest",
    "anti-mold",
    "odourless",
    "safety",
    "remove",
    "residue",
    "100%",
    "we",
    "our",
    "ours"
  ]);

  // 用户自定义违禁词库
  const [customForbiddenWords, setCustomForbiddenWords] = useState<string[]>([]);

  // 当前选中的预设违禁词
  const [selectedPresetWords, setSelectedPresetWords] = useState<string[]>([]);

  // 最近一次检测的原文与替换结果
  const [lastCheckedContent, setLastCheckedContent] = useState<string>('');
  const [lastModifiedContent, setLastModifiedContent] = useState<string>('');

  // 检测内容
  const [content, setContent] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('未选择文件');

  // 检测结果
  const [foundItems, setFoundItems] = useState<Array<{ word: string; count: number }>>([]);
  const [highlightedContent, setHighlightedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 替换面板状态
  const [replaceInputs, setReplaceInputs] = useState<Record<string, string>>({});
  const [replaceCheckboxes, setReplaceCheckboxes] = useState<Record<string, boolean>>({});

  // 标签页状态
  const [activeTab, setActiveTab] = useState<string>('preset');
  const [activeContentTab, setActiveContentTab] = useState<string>('text');

  // 初始化
  useEffect(() => {
    // 加载本地存储的自定义违禁词
    try {
      const savedCustomWords = localStorage.getItem('forbiddenWordsCustom');
      if (savedCustomWords) {
        setCustomForbiddenWords(JSON.parse(savedCustomWords));
      }
    } catch (error) {
      console.error('Failed to load custom forbidden words:', error);
    }
    
    // 默认选中所有预设词
    setSelectedPresetWords([...presetForbiddenWords]);
  }, []);

  // 词库搜索状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // 过滤后的词库列表
  const filteredPresetWords = presetForbiddenWords.filter(word => 
    word.toLowerCase().includes(searchKeyword.toLowerCase())
  );
  
  const filteredCustomWords = customForbiddenWords.filter(word => 
    word.toLowerCase().includes(searchKeyword.toLowerCase())
  );
  
  // 保存自定义违禁词到本地存储
  useEffect(() => {
    try {
      localStorage.setItem('forbiddenWordsCustom', JSON.stringify(customForbiddenWords));
    } catch {}
  }, [customForbiddenWords]);

  // 工具函数：转义正则特殊字符
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // 工具函数：创建边界正则表达式
  const createBoundaryRegex = (word: string, flags = 'gi') => {
    const escaped = escapeRegExp(word);
    // 使用“非字母数字”作为边界，等价于整词，但允许短语/符号存在
    const pattern = `(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`;
    return new RegExp(pattern, flags);
  };

  // 检测违禁词
  const checkForbiddenWords = () => {
    setIsLoading(true);
    
    const textToCheck = activeContentTab === 'text' ? content : fileContent;
    if (!textToCheck.trim()) {
      alert('请输入或上传需要检测的文案内容！');
      setIsLoading(false);
      return;
    }

    // 保存原文与初始化替换文本
    setLastCheckedContent(textToCheck);
    setLastModifiedContent(textToCheck);

    // 合并选中的预设违禁词和自定义违禁词
    const allForbiddenWords = [...selectedPresetWords, ...customForbiddenWords];
    
    if (allForbiddenWords.length === 0) {
      alert('请至少选择或添加一个违禁词！');
      setIsLoading(false);
      return;
    }
    
    // 找出所有违禁词出现的位置和次数（不区分大小写），并去重
    const found: Array<{ word: string; count: number }> = [];
    allForbiddenWords.forEach(word => {
      const regex = createBoundaryRegex(word, 'gi');
      let count = 0;
      let m;
      while ((m = regex.exec(textToCheck)) !== null) {
        // 防止零宽匹配死循环
        if (m.index === regex.lastIndex) regex.lastIndex++;
        count++;
      }
      if (count > 0) {
        found.push({ word, count });
      }
    });
    
    // 按长度降序，避免替换时词间相互影响
    found.sort((a, b) => b.word.length - a.word.length);
    
    // 高亮显示违禁词
    let highlighted = textToCheck;
    found.forEach(item => {
      const regex = createBoundaryRegex(item.word, 'gi');
      highlighted = highlighted.replace(regex, (match, p1, p2) => `${p1}<span class="bg-red-100 text-red-800 px-1 py-0.5 rounded">${p2}</span>`);
    });
    
    // 初始化替换面板
    const initialReplaceInputs: Record<string, string> = {};
    const initialReplaceCheckboxes: Record<string, boolean> = {};
    found.forEach(item => {
      initialReplaceInputs[item.word] = '';
      initialReplaceCheckboxes[item.word] = true;
    });
    
    setReplaceInputs(initialReplaceInputs);
    setReplaceCheckboxes(initialReplaceCheckboxes);
    setFoundItems(found);
    setHighlightedContent(highlighted);
    setIsLoading(false);
  };

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
  };

  // 切换预设词选择
  const togglePresetWord = (word: string) => {
    setSelectedPresetWords(prev => {
      if (prev.includes(word)) {
        return prev.filter(w => w !== word);
      } else {
        return [...prev, word];
      }
    });
  };

  // 全选/取消全选预设词
  const toggleAllPresetWords = () => {
    setSelectedPresetWords(prev => {
      if (prev.length === presetForbiddenWords.length) {
        return [];
      } else {
        return [...presetForbiddenWords];
      }
    });
  };

  // 添加自定义违禁词
  const addCustomWord = () => {
    const newWordInput = document.getElementById('new-word') as HTMLTextAreaElement;
    if (!newWordInput) return;
    
    const inputText = newWordInput.value.trim();
    
    if (inputText) {
      // 按行分割输入的文本，处理多个词的情况
      const words = inputText.split('\n').filter(w => w.trim() !== '');
      
      if (words.length === 0) {
        alert('请输入违禁词！');
        return;
      }
      
      let addedCount = 0;
      let existingCount = 0;
      let presetCount = 0;
      
      words.forEach(word => {
        const trimmedWord = word.trim();
        // 检查是否已存在于自定义词库（不区分大小写）
        if (!customForbiddenWords.some(item => item.toLowerCase() === trimmedWord.toLowerCase())) {
          // 检查是否已存在于预设词库（不区分大小写）
          if (presetForbiddenWords.some(item => item.toLowerCase() === trimmedWord.toLowerCase())) {
            presetCount++;
          } else {
            customForbiddenWords.push(trimmedWord);
            addedCount++;
          }
        } else {
          existingCount++;
        }
      });
      
      setCustomForbiddenWords([...customForbiddenWords]);
      
      // 清空输入框
      newWordInput.value = '';
      
      // 显示结果
      let message = `成功添加了 ${addedCount} 个违禁词到自定义库。`;
      if (existingCount > 0) {
        message += `\n${existingCount} 个词已存在于自定义库中。`;
      }
      if (presetCount > 0) {
        message += `\n${presetCount} 个词已存在于预设库中。`;
      }
      
      alert(message);
    } else {
      alert('请输入违禁词！');
    }
  };

  // 删除自定义违禁词
  const deleteCustomWord = (index: number) => {
    const updatedCustomWords = [...customForbiddenWords];
    updatedCustomWords.splice(index, 1);
    setCustomForbiddenWords(updatedCustomWords);
  };

  // 清空自定义违禁词
  const clearCustomWords = () => {
    if (confirm('确定要清空所有自定义违禁词吗？')) {
      setCustomForbiddenWords([]);
    }
  };

  // 应用单个替换
  const applySingleReplacement = (word: string) => {
    const replacement = replaceInputs[word] || '';
    if (!replacement) {
      alert(`请先为「${word}」输入替换内容`);
      return;
    }
    
    const regex = createBoundaryRegex(word, 'gi');
    setLastModifiedContent(prev => {
      return prev.replace(regex, (match, p1, p2) => p1 + replacement);
    });
  };

  // 批量应用替换
  const applyBatchReplacements = () => {
    const pairs: Array<{ word: string; replacement: string }> = [];
    
    Object.entries(replaceCheckboxes).forEach(([word, checked]) => {
      if (checked) {
        const replacement = replaceInputs[word] || '';
        if (replacement) {
          pairs.push({ word, replacement });
        }
      }
    });
    
    if (pairs.length === 0) {
      alert('请至少勾选一个要替换的词，并填写替换内容');
      return;
    }
    
    // 按词长度降序，避免替换时产生串扰
    pairs.sort((a, b) => b.word.length - a.word.length);
    
    let updatedContent = lastModifiedContent;
    pairs.forEach(({ word, replacement }) => {
      const regex = createBoundaryRegex(word, 'gi');
      updatedContent = updatedContent.replace(regex, (match, p1, p2) => p1 + replacement);
    });
    
    setLastModifiedContent(updatedContent);
  };

  // 重置为原文
  const resetModified = () => {
    setLastModifiedContent(lastCheckedContent);
  };

  // 复制替换结果
  const copyModified = () => {
    navigator.clipboard.writeText(lastModifiedContent)
      .then(() => {
        alert('已复制到剪贴板');
      })
      .catch(() => {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = lastModifiedContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('已复制到剪贴板');
      });
  };

  // 导出替换结果
  const exportModified = () => {
    const blob = new Blob([lastModifiedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified-content.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 回填到文本输入
  const fillBackModified = () => {
    if (activeContentTab === 'text') {
      setContent(lastModifiedContent);
    } else {
      setFileContent(lastModifiedContent);
    }
  };

  // 渲染预设违禁词列表
  const renderPresetWordList = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索预设违禁词..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
            <span className="text-sm font-medium text-gray-700">
              当前预设词库：{presetForbiddenWords.length}个词（已选择：{selectedPresetWords.length}个）
            </span>
            <Button variant="secondary" size="sm" onClick={toggleAllPresetWords}>
              全选/取消全选
            </Button>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
          {filteredPresetWords.map((word, index) => (
            <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedPresetWords.includes(word)}
                  onChange={() => togglePresetWord(word)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{word}</span>
              </div>
            </div>
          ))}
          {filteredPresetWords.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              未找到匹配的违禁词
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染自定义违禁词列表
  const renderCustomWordList = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索自定义违禁词..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
            <span className="text-sm font-medium text-gray-700">
              当前自定义词库：{customForbiddenWords.length}个词
            </span>
            {customForbiddenWords.length > 0 && (
              <Button variant="danger" size="sm" onClick={clearCustomWords}>
                <Trash2 className="h-4 w-4" />
                清空
              </Button>
            )}
          </div>
        </div>
        
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
          {filteredCustomWords.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              {customForbiddenWords.length === 0 ? '暂无自定义违禁词，请在下方添加' : '未找到匹配的违禁词'}
            </div>
          ) : (
            filteredCustomWords.map((word, index) => {
              const originalIndex = customForbiddenWords.indexOf(word);
              return (
                <div key={originalIndex} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">{word}</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deleteCustomWord(originalIndex)}
                    className="h-7 px-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
        
        <div className="space-y-2">
          <textarea
            id="new-word"
            placeholder="输入新的违禁词（多个词请换行输入）"
            className="w-full min-h-20 p-3 border border-gray-300 rounded-lg text-sm"
          ></textarea>
          <Button onClick={addCustomWord} variant="primary" size="sm">
            <PlusCircle className="h-4 w-4" />
            添加违禁词
          </Button>
        </div>
      </div>
    );
  };

  // 折叠式使用说明状态
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">亚马逊文案违禁词检测工具</h2>
      </div>
      
      {/* 折叠式使用说明 */}
      <Card className="p-5">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setInstructionsOpen(!instructionsOpen)}>
          <h3 className="text-lg font-semibold text-gray-800">使用说明</h3>
          <button className="text-gray-500 hover:text-blue-600 transition-colors">
            {instructionsOpen ? '收起' : '展开'}
          </button>
        </div>
        {instructionsOpen && (
          <div className="mt-4 text-sm text-gray-600 space-y-3">
            <p><strong>使用说明：</strong></p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>本工具用于检测亚马逊文案中可能存在的违禁词</li>
              <li>您可以使用预设的违禁词库，也可以添加自定义违禁词（支持多行批量添加；自定义词会保存在浏览器本地；单个添加时可选择加入预设库）</li>
              <li>支持直接输入文本或上传TXT文件进行检测</li>
              <li>检测结果会高亮显示发现的违禁词，并统计每个词的命中次数</li>
              <li>
                替换与导出：
                <ul className="list-circle list-inside ml-4 mt-1 space-y-1">
                  <li>在检测结果下方，可为每个命中词填写替换内容，支持“仅替换此词”和“应用勾选替换”（批量）</li>
                  <li>替换顺序按词长降序，避免短词影响长词；替换后文本实时展示</li>
                  <li>一键“复制替换结果”“导出TXT”“回填到文本输入”，并可“重置为原文”</li>
                </ul>
              </li>
              <li>
                匹配与替换规则：
                <ul className="list-circle list-inside ml-4 mt-1 space-y-1">
                  <li>匹配大小写不敏感</li>
                  <li>采用“非字母数字”为边界进行整词匹配</li>
                </ul>
              </li>
              <li>预设词管理：支持选择/全选/删除预设词</li>
            </ul>
          </div>
        )}
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：违禁词管理 */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">违禁词管理</h3>
            
            <div className="border-b border-gray-200 mb-4">
              <div className="flex space-x-4">
                <button
                  className={`py-2 px-4 text-sm font-medium ${activeTab === 'preset' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('preset')}
                >
                  预设违禁词
                </button>
                <button
                  className={`py-2 px-4 text-sm font-medium ${activeTab === 'custom' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('custom')}
                >
                  自定义违禁词
                </button>
              </div>
            </div>
            
            {activeTab === 'preset' ? renderPresetWordList() : renderCustomWordList()}
          </Card>
        </div>
        
        {/* 右侧：文案检测和结果 */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">文案检测</h3>
            
            <div className="border-b border-gray-200 mb-4">
              <div className="flex space-x-4">
                <button
                  className={`py-2 px-4 text-sm font-medium ${activeContentTab === 'text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveContentTab('text')}
                >
                  文本输入
                </button>
                <button
                  className={`py-2 px-4 text-sm font-medium ${activeContentTab === 'file' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveContentTab('file')}
                >
                  文件上传
                </button>
              </div>
            </div>
            
            {activeContentTab === 'text' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">文本输入</span>
                  {content && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setContent('')}
                      className="ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      清零
                    </Button>
                  )}
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请输入需要检测的文案内容..."
                  className="w-full min-h-32 p-3 border border-gray-300 rounded-lg text-sm"
                ></textarea>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm text-gray-700 transition-colors">
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <PlusCircle className="h-4 w-4" />
                    选择文件
                  </label>
                  <span className="text-sm text-gray-500">{fileName}</span>
                  {fileName !== '未选择文件' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setFileName('未选择文件');
                        setFileContent('');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      清零
                    </Button>
                  )}
                </div>
                {fileContent && (
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3 text-sm bg-gray-50">
                    {fileContent.substring(0, 500)}{fileContent.length > 500 ? '...' : ''}
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <Button onClick={checkForbiddenWords} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    检测中...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    检测违禁词
                  </>
                )}
              </Button>
            </div>
          </Card>
          
          {/* 检测结果 */}
          {(() => {
            if (foundItems.length > 0) {
              return (
                <Card className="p-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    <AlertCircle className="inline-block h-5 w-5 text-red-500 mr-2" />
                    检测结果
                  </h3>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-600 mb-2">
                      ⚠ 检测到 {foundItems.length} 个违禁词
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                      <div className="text-sm" dangerouslySetInnerHTML={{ __html: highlightedContent }}></div>
                    </div>
                  </div>
                  
                  {/* 修改建议 */}
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-gray-700 mb-2">修改建议</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                      {foundItems.map((item, index) => (
                        <li key={index}>
                          <strong>{item.word}</strong>（{item.count}处） - 建议替换为更中性的描述，避免使用绝对化、夸大的表述
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* 替换面板 */}
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-md font-medium text-gray-700 mb-3">替换与导出</h4>
                    
                    <div className="space-y-3">
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-3">
                        {foundItems.map((item, index) => (
                          <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 hover:bg-gray-50 rounded">
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="checkbox"
                                checked={replaceCheckboxes[item.word] || false}
                                onChange={(e) => setReplaceCheckboxes(prev => ({
                                  ...prev,
                                  [item.word]: e.target.checked
                                }))}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm font-medium text-gray-700 min-w-[150px]">
                                {item.word}
                              </span>
                              <span className="text-xs text-gray-500">
                                （共{item.count}处）
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                              <input
                                type="text"
                                value={replaceInputs[item.word] || ''}
                                onChange={(e) => setReplaceInputs(prev => ({
                                  ...prev,
                                  [item.word]: e.target.value
                                }))}
                                placeholder="替换为..."
                                className="flex-1 w-full sm:w-48 p-2 border border-gray-300 rounded-lg text-sm"
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => applySingleReplacement(item.word)}
                                className="h-9"
                              >
                                替换
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button variant="secondary" size="sm" onClick={applyBatchReplacements}>
                          应用勾选替换
                        </Button>
                        <Button variant="secondary" size="sm" onClick={resetModified}>
                          <RefreshCw className="h-4 w-4" />
                          重置为原文
                        </Button>
                      </div>
                      
                      {/* 替换结果 */}
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-700">替换后文本</h5>
                        <textarea
                          value={lastModifiedContent}
                          readOnly
                          className="w-full min-h-32 p-3 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        ></textarea>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button variant="secondary" size="sm" onClick={fillBackModified}>
                            回填到输入
                          </Button>
                          <Button variant="secondary" size="sm" onClick={copyModified}>
                            <Copy className="h-4 w-4" />
                            复制结果
                          </Button>
                          <Button variant="secondary" size="sm" onClick={exportModified}>
                            <Download className="h-4 w-4" />
                            导出TXT
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            } else if (foundItems.length === 0 && highlightedContent) {
              return (
                <Card className="p-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    <CheckCircle className="inline-block h-5 w-5 text-green-500 mr-2" />
                    检测结果
                  </h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700">
                      ✓ 恭喜！未发现任何违禁词。
                    </p>
                  </div>
                </Card>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
};

export default ForbiddenWordsChecker;