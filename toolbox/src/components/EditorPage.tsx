'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Type, Eye, Code, RotateCcw, RotateCw, Bold, Italic, Underline, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, 
  Link as LinkIcon, Image as ImageIcon, Save, FolderOpen, 
  FileCode, FileText, X, RefreshCw, ChevronDown, ChevronUp,
  Search, Copy, Upload, Trash2, Download
} from 'lucide-react'

const Card = ({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
)

const commonSymbols = [
    { symbol: '√', name: '对勾' },
    { symbol: '™', name: '商标' },
    { symbol: '★', name: '星号' },
    { symbol: '△', name: '三角' },
    { symbol: '↑', name: '上箭头' },
    { symbol: '↓', name: '下箭头' },
    { symbol: '←', name: '左箭头' },
    { symbol: '→', name: '右箭头' },
    { symbol: '☺', name: '笑脸' },
    { symbol: '@', name: 'at符号' },
    { symbol: '①', name: '数字1' },
    { symbol: '②', name: '数字2' },
    { symbol: '③', name: '数字3' },
    { symbol: '④', name: '数字4' },
    { symbol: '⑤', name: '数字5' },
    { symbol: '⑥', name: '数字6' },
    { symbol: '⑦', name: '数字7' },
    { symbol: '⑧', name: '数字8' },
    { symbol: '⑨', name: '数字9' },
    { symbol: '⑩', name: '数字10' },
    { symbol: '©', name: '版权' },
    { symbol: '®', name: '注册' },
    { symbol: '☑', name: '选中' },
    { symbol: '+', name: '加号' },
    { symbol: '●', name: '实心圆' },
    { symbol: '♥', name: '心形' },
    { symbol: '•', name: '项目符号' },
    { symbol: '▲', name: '上三角' },
    { symbol: '▼', name: '下三角' },
    { symbol: '□', name: '方框' }
]

const moreSymbols = [
    { symbol: '※', name: '米号' },
    { symbol: '№', name: '序号' },
    { symbol: '♂', name: '男性' },
    { symbol: '♀', name: '女性' },
    { symbol: '♠', name: '黑桃' },
    { symbol: '♣', name: '梅花' },
    { symbol: '♥', name: '红心' },
    { symbol: '♦', name: '方块' },
    { symbol: '♪', name: '音符' },
    { symbol: '♫', name: '双音符' },
    { symbol: '☀', name: '太阳' },
    { symbol: '☁', name: '云朵' },
    { symbol: '☂', name: '雨伞' },
    { symbol: '☃', name: '雪花' },
    { symbol: '☄', name: '彗星' },
    { symbol: '♨', name: '温泉' },
    { symbol: '♩', name: '四分音符' },
    { symbol: '♬', name: '十六分音符' },
    { symbol: '♭', name: '降号' },
    { symbol: '♮', name: '还原号' },
    { symbol: '♯', name: '升号' },
    { symbol: '♰', name: '双升号' },
    { symbol: '♱', name: '双降号' },
    { symbol: '♲', name: '循环' },
    { symbol: '♳', name: '回收' },
    { symbol: '♴', name: '纸张' },
    { symbol: '♵', name: '塑料' },
    { symbol: '♶', name: '玻璃' },
    { symbol: '♷', name: '金属' },
    { symbol: '♸', name: '电子' },
    { symbol: '♹', name: '堆肥' },
    { symbol: '♺', name: '叶子' },
    { symbol: '♻', name: '循环利用' },
    { symbol: '♼', name: '谷物' },
    { symbol: '♽', name: '可回收' },
    { symbol: '♾', name: '永久' },
    { symbol: '♿', name: '轮椅' },
    { symbol: '⚀', name: '骰子1' },
    { symbol: '⚁', name: '骰子2' },
    { symbol: '⚂', name: '骰子3' },
    { symbol: '⚃', name: '骰子4' },
    { symbol: '⚄', name: '骰子5' },
    { symbol: '⚅', name: '骰子6' },
    { symbol: '⚆', name: '白圆圈' },
    { symbol: '⚇', name: '闪电' },
    { symbol: '⚈', name: '彗星' },
    { symbol: '⚉', name: '爆炸' },
    { symbol: '⚐', name: '白旗' },
    { symbol: '⚑', name: '黑旗' },
    { symbol: '⚒', name: '锤子' },
    { symbol: '⚓', name: '锚' },
    { symbol: '⚔', name: '交叉剑' },
    { symbol: '⚕', name: '医疗' },
    { symbol: '⚖', name: '天平' },
    { symbol: '⚗', name: '烧瓶' },
    { symbol: '⚘', name: '花朵' },
    { symbol: '⚙', name: '齿轮' },
    { symbol: '⚚', name: '调和' },
    { symbol: '⚛', name: '原子' },
    { symbol: '⚜', name: '鸢尾花' },
    { symbol: '⚝', name: '星星' },
    { symbol: '⚞', name: '指北针' },
    { symbol: '⚟', name: '指南针' },
    { symbol: '⚠', name: '警告' },
    { symbol: '⚡', name: '高压电' },
    { symbol: '⚢', name: '女性双性' },
    { symbol: '⚣', name: '男性双性' },
    { symbol: '⚤', name: '异性恋' },
    { symbol: '⚥', name: '双性恋' },
    { symbol: '⚦', name: '男性带箭头' },
    { symbol: '⚧', name: '跨性别' },
    { symbol: '⚨', name: '垂直双性' },
    { symbol: '⚩', name: '水平双性' },
    { symbol: '⚪', name: '白圆' },
    { symbol: '⚫', name: '黑圆' },
    { symbol: '⚬', name: '中空圆' },
    { symbol: '⚭', name: '波浪线' },
    { symbol: '⚮', name: '禁止' },
    { symbol: '⚯', name: '离开' },
    { symbol: '⚰', name: '骨灰盒' },
    { symbol: '⚱', name: '骨灰瓮' },
    { symbol: '⚲', name: '地球' },
    { symbol: '⚳', name: '水瓶座' },
    { symbol: '⚴', name: '双鱼座' },
    { symbol: '⚵', name: '白羊座' },
    { symbol: '⚶', name: '金牛座' },
    { symbol: '⚷', name: '双子座' },
    { symbol: '⚸', name: '巨蟹座' },
    { symbol: '⚹', name: '狮子座' },
    { symbol: '⚺', name: '处女座' },
    { symbol: '⚻', name: '天秤座' },
    { symbol: '⚼', name: '天蝎座' },
    { symbol: '⚽', name: '足球' },
    { symbol: '⚾', name: '棒球' },
    { symbol: '⚿', name: '台球' },
    { symbol: '⛀', name: '斯诺克' },
    { symbol: '⛁', name: '国际象棋' },
    { symbol: '⛂', name: '国际象棋' },
    { symbol: '⛃', name: '国际象棋' },
    { symbol: '⛄', name: '雪人' },
    { symbol: '⛇', name: '雪崩' },
    { symbol: '⛈', name: '雷雨' },
    { symbol: '⛉', name: '日出' },
    { symbol: '⛊', name: '日落' },
    { symbol: '⛋', name: '月亮' },
    { symbol: '⛌', name: '日食' },
    { symbol: '⛍', name: '月食' },
    { symbol: '⛎', name: '上升' },
    { symbol: '⛏', name: '镐' },
    { symbol: '⛐', name: '电钻' },
    { symbol: '⛑', name: '救援' },
    { symbol: '⛒', name: '海关' },
    { symbol: '⛓', name: '锁链' },
    { symbol: '⛔', name: '禁止' },
    { symbol: '⛕', name: '禁止进入' },
    { symbol: '⛖', name: '禁止吸烟' },
    { symbol: '⛗', name: '禁止停车' },
    { symbol: '⛘', name: '禁止左转' },
    { symbol: '⛙', name: '禁止右转' },
    { symbol: '⛚', name: '禁止掉头' },
    { symbol: '⛛', name: '禁止超车' },
    { symbol: '⛜', name: '禁止鸣笛' },
    { symbol: '⛝', name: '禁止行人' },
    { symbol: '⛞', name: '禁止自行车' },
    { symbol: '⛟', name: '禁止摩托车' },
    { symbol: '⛠', name: '注意儿童' },
    { symbol: '⛡', name: '注意行人' },
    { symbol: '⛢', name: '注意自行车' },
    { symbol: '⛣', name: '注意动物' },
    { symbol: '⛤', name: '注意施工' },
    { symbol: '⛥', name: '注意落石' },
    { symbol: '⛦', name: '注意弯道' },
    { symbol: '⛧', name: '注意坡道' },
    { symbol: '⛨', name: '注意隧道' },
    { symbol: '⛩', name: '鸟居' },
    { symbol: '⛪', name: '教堂' },
    { symbol: '⛫', name: '清真寺' },
    { symbol: '⛬', name: '犹太教堂' },
    { symbol: '⛭', name: '寺庙' },
    { symbol: '⛮', name: '神社' },
    { symbol: '⛯', name: '墓地' },
    { symbol: '⛰', name: '山' },
    { symbol: '⛱', name: '沙滩' },
    { symbol: '⛲', name: '喷泉' },
    { symbol: '⛳', name: '高尔夫' },
    { symbol: '⛴', name: '渡轮' },
    { symbol: '⛵', name: '帆船' },
    { symbol: '⛶', name: '划艇' },
    { symbol: '⛷', name: '滑雪' },
    { symbol: '⛸', name: '滑冰' },
    { symbol: '⛹', name: '篮球' },
    { symbol: '⛺', name: '露营' },
    { symbol: '⛻', name: '日本' },
    { symbol: '⛼', name: '韩国' },
    { symbol: '⛽', name: '加油站' },
    { symbol: '⛾', name: '公交站' },
    { symbol: '⛿', name: '地铁站' },
    { symbol: '✀', name: '回车' },
    { symbol: '✁', name: '剪刀' },
    { symbol: '✂', name: '剪刀' },
    { symbol: '✃', name: '剪刀' },
    { symbol: '✄', name: '剪刀' },
    { symbol: '✅', name: '对勾' },
    { symbol: '✆', name: '电话' },
    { symbol: '✇', name: '磁带' },
    { symbol: '✈', name: '飞机' },
    { symbol: '✉', name: '信封' },
    { symbol: '✊', name: '拳头' },
    { symbol: '✋', name: '手掌' },
    { symbol: '✌', name: '胜利' },
    { symbol: '✍', name: '写字' },
    { symbol: '✎', name: '铅笔' },
    { symbol: '✏', name: '铅笔' },
    { symbol: '✐', name: '铅笔' },
    { symbol: '✑', name: '钢笔' },
    { symbol: '✒', name: '钢笔' },
    { symbol: '✓', name: '对勾' },
    { symbol: '✔', name: '十字' },
    { symbol: '✕', name: '叉号' },
    { symbol: '✖', name: '叉号' },
    { symbol: '✗', name: '叉号' },
    { symbol: '✘', name: '叉号' },
    { symbol: '✙', name: '十字架' },
    { symbol: '✚', name: '加号' },
    { symbol: '✛', name: '加号' },
    { symbol: '✜', name: '加号' },
    { symbol: '✝', name: '十字架' },
    { symbol: '✞', name: '十字架' },
    { symbol: '✟', name: '十字架' },
    { symbol: '✠', name: '万字符' },
    { symbol: '✡', name: '大卫之星' },
    { symbol: '✢', name: '星号' },
    { symbol: '✣', name: '星号' },
    { symbol: '✤', name: '星号' },
    { symbol: '✥', name: '星号' },
    { symbol: '✦', name: '星号' },
    { symbol: '✧', name: '星号' },
    { symbol: '✨', name: '星星' },
    { symbol: '✩', name: '星号' },
    { symbol: '✪', name: '星号' },
    { symbol: '✫', name: '星号' },
    { symbol: '✬', name: '星号' },
    { symbol: '✭', name: '星号' },
    { symbol: '✮', name: '星号' },
    { symbol: '✯', name: '星号' },
    { symbol: '✰', name: '星号' },
    { symbol: '✱', name: '星号' },
    { symbol: '✲', name: '星号' },
    { symbol: '✳', name: '星号' },
    { symbol: '✴', name: '星号' },
    { symbol: '✵', name: '星号' },
    { symbol: '✶', name: '星号' },
    { symbol: '✷', name: '星号' },
    { symbol: '✸', name: '星号' },
    { symbol: '✹', name: '星号' },
    { symbol: '✺', name: '星号' },
    { symbol: '✻', name: '星号' },
    { symbol: '✼', name: '星号' },
    { symbol: '✽', name: '星号' },
    { symbol: '✾', name: '星号' },
    { symbol: '✿', name: '花朵' },
    { symbol: '❀', name: '花朵' },
    { symbol: '❁', name: '花朵' },
    { symbol: '❂', name: '花朵' },
    { symbol: '❃', name: '花朵' },
    { symbol: '❄', name: '雪花' },
    { symbol: '❅', name: '雪花' },
    { symbol: '❆', name: '雪花' },
    { symbol: '❇', name: '星号' },
    { symbol: '❈', name: '星号' },
    { symbol: '❉', name: '星号' },
    { symbol: '❊', name: '星号' },
    { symbol: '❋', name: '星号' },
    { symbol: '❌', name: '叉号' },
    { symbol: '❍', name: '圆圈' },
    { symbol: '❎', name: '叉号' },
    { symbol: '❏', name: '方块' },
    { symbol: '❐', name: '方块' },
    { symbol: '❑', name: '方块' },
    { symbol: '❒', name: '方块' },
    { symbol: '❓', name: '问号' },
    { symbol: '❔', name: '白问号' },
    { symbol: '❕', name: '感叹号' },
    { symbol: '❖', name: '菱形' },
    { symbol: '❗', name: '感叹号' },
    { symbol: '❘', name: '竖线' },
    { symbol: '❙', name: '竖线' },
    { symbol: '❚', name: '竖线' },
    { symbol: '❛', name: '单引号' },
    { symbol: '❜', name: '单引号' },
    { symbol: '❝', name: '双引号' },
    { symbol: '❞', name: '双引号' },
    { symbol: '❟', name: '逗号' },
    { symbol: '❠', name: '问号' },
    { symbol: '❡', name: '音符' },
    { symbol: '❢', name: '双叹号' },
    { symbol: '❣', name: '心形' },
    { symbol: '❤', name: '心形' },
    { symbol: '❥', name: '心形' },
    { symbol: '❦', name: '花朵' },
    { symbol: '❧', name: '花朵' },
    { symbol: '❨', name: '左括号' },
    { symbol: '❩', name: '右括号' },
    { symbol: '❪', name: '左括号' },
    { symbol: '❫', name: '右括号' },
    { symbol: '❬', name: '左括号' },
    { symbol: '❭', name: '右括号' },
    { symbol: '❮', name: '左三角' },
    { symbol: '❯', name: '右三角' },
    { symbol: '❰', name: '左三角' },
    { symbol: '❱', name: '右三角' },
    { symbol: '❲', name: '左括号' },
    { symbol: '❳', name: '右括号' },
    { symbol: '❴', name: '左花括号' },
    { symbol: '❵', name: '右花括号' },
    { symbol: '❶', name: '数字1' },
    { symbol: '❷', name: '数字2' },
    { symbol: '❸', name: '数字3' },
    { symbol: '❹', name: '数字4' },
    { symbol: '❺', name: '数字5' },
    { symbol: '❻', name: '数字6' },
    { symbol: '❼', name: '数字7' },
    { symbol: '❽', name: '数字8' },
    { symbol: '❾', name: '数字9' },
    { symbol: '❿', name: '数字10' },
    { symbol: '⓫', name: '数字11' },
    { symbol: '⓬', name: '数字12' },
    { symbol: '⓭', name: '数字13' },
    { symbol: '⓮', name: '数字14' },
    { symbol: '⓯', name: '数字15' },
    { symbol: '⓰', name: '数字16' },
    { symbol: '⓱', name: '数字17' },
    { symbol: '⓲', name: '数字18' },
    { symbol: '⓳', name: '数字19' },
    { symbol: '⓴', name: '数字20' },
    { symbol: '⓵', name: '数字1' },
    { symbol: '⓶', name: '数字2' },
    { symbol: '⓷', name: '数字3' },
    { symbol: '⓸', name: '数字4' },
    { symbol: '⓹', name: '数字5' },
    { symbol: '⓺', name: '数字6' },
    { symbol: '⓻', name: '数字7' },
    { symbol: '⓼', name: '数字8' },
    { symbol: '⓽', name: '数字9' },
    { symbol: '⓾', name: '数字10' },
    { symbol: '⓿', name: '数字0' },
    { symbol: '❀', name: '花朵' },
    { symbol: '❁', name: '花朵' },
    { symbol: '❂', name: '花朵' },
    { symbol: '❃', name: '花朵' },
    { symbol: '❄', name: '雪花' },
    { symbol: '❅', name: '雪花' },
    { symbol: '❆', name: '雪花' },
    { symbol: '❇', name: '星号' },
    { symbol: '❈', name: '星号' },
    { symbol: '❉', name: '星号' },
    { symbol: '❊', name: '星号' },
    { symbol: '❋', name: '星号' }
]

const EditorPage = () => {
  const [isCodeView, setIsCodeView] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const [showMoreSymbols, setShowMoreSymbols] = useState(false)
  const [isTipsExpanded, setIsTipsExpanded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [htmlCode, setHtmlCode] = useState('')
  
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [history, setHistory] = useState<string[]>([])
  const [historyStep, setHistoryStep] = useState(-1)
  
  useEffect(() => {
    loadFromLocal(false)
    try {
      const tipsExpanded = localStorage.getItem('tipsExpanded')
      if (tipsExpanded !== 'false') {
        setIsTipsExpanded(true)
      }
    } catch {}
  }, [])

  useEffect(() => {
    const interval = setInterval(saveToLocal, 30000)
    return () => clearInterval(interval)
  }, [history, historyStep])

  const getCurrentHtml = () => (isCodeView ? htmlCode : (editorRef.current?.innerHTML || ''))

  const saveToLocal = () => {
    try {
      const content = getCurrentHtml()
      localStorage.setItem('editorContent', content)
      localStorage.setItem('editorHistory', JSON.stringify(history))
      localStorage.setItem('historyStep', historyStep.toString())
    } catch {}
  }

  const saveToLocalExplicit = () => {
    saveToLocal()
    try { alert('已保存到本地') } catch {}
  }

  const loadFromLocal = (arg?: unknown) => {
    const showToast = typeof arg === 'boolean' ? arg : true
    let savedContent: string | null = null
    let savedHistory: string | null = null
    let savedStep: string | null = null

    try {
      savedContent = localStorage.getItem('editorContent')
      savedHistory = localStorage.getItem('editorHistory')
      savedStep = localStorage.getItem('historyStep')
    } catch {}
    
    if (savedContent) {
      if (isCodeView) {
        setHtmlCode(savedContent)
      } else if (editorRef.current) {
        editorRef.current.innerHTML = savedContent
      }
      updateContent()
      if (showToast) {
        try { alert('已从本地加载') } catch {}
      }
    }
    
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
    
    if (savedStep) {
      setHistoryStep(parseInt(savedStep))
    }
  }

  const handleOpenFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (isCodeView) {
        setHtmlCode(content)
      } else if (editorRef.current) {
        editorRef.current.innerHTML = content
      }
      updateContent()
      saveHistory()
    }
    reader.readAsText(file)
    event.target.value = '' // Reset input
  }

  const handleClearAll = () => {
    if (confirm('确定要清空所有内容吗？这将无法恢复。')) {
      if (editorRef.current) {
        editorRef.current.innerHTML = ''
      }
      setHtmlCode('')
      setHistory([])
      setHistoryStep(-1)
      updateContent()
      
      localStorage.removeItem('editorContent')
      localStorage.removeItem('editorHistory')
      localStorage.removeItem('historyStep')
    }
  }

  const updateContent = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML
      const text = editorRef.current.innerText || editorRef.current.textContent || ''
      setCharCount(text.length)
      if (isCodeView) {
        setHtmlCode(content)
      }
    }
  }

  const handleInput = () => {
    updateContent()
    saveHistory()
  }

  const saveHistory = () => {
    if (!editorRef.current) return
    const content = editorRef.current.innerHTML
    
    if (history.length > 0 && history[historyStep] === content) return

    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(content)
    
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryStep(prev => prev + 1)
    }
    setHistory(newHistory)
  }

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1
      setHistoryStep(newStep)
      if (editorRef.current) {
        editorRef.current.innerHTML = history[newStep]
        updateContent()
      }
    }
  }

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1
      setHistoryStep(newStep)
      if (editorRef.current) {
        editorRef.current.innerHTML = history[newStep]
        updateContent()
      }
    }
  }

  const formatText = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value ?? undefined)
    updateContent()
    if (editorRef.current) {
      editorRef.current.focus()
    }
    saveHistory()
  }

  const toggleView = () => {
    if (isCodeView) {
      if (editorRef.current) {
        editorRef.current.innerHTML = htmlCode
      }
      setIsCodeView(false)
      setTimeout(updateContent, 0)
    } else {
      if (editorRef.current) {
        setHtmlCode(editorRef.current.innerHTML)
      }
      setIsCodeView(true)
    }
  }

  const insertLink = () => {
    const url = prompt('请输入链接地址：', 'https://')
    if (url && url !== 'https://') {
      formatText('createLink', url)
    }
  }

  const insertImage = () => {
    const url = prompt('请输入图片地址：', 'https://')
    if (url && url !== 'https://') {
      const alt = prompt('请输入图片描述：', '')
      const imgHtml = `<img src="${url}" alt="${alt || '图片'}" style="max-width: 100%; height: auto;">`
      
      if (editorRef.current) {
        editorRef.current.focus()
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          const fragment = range.createContextualFragment(imgHtml)
          range.insertNode(fragment)
          updateContent()
          saveHistory()
        }
      }
    }
  }

  const insertSymbol = (symbol: string) => {
    if (editorRef.current) {
      editorRef.current.focus()
      formatText('insertText', symbol)
    }
  }

  const clearFormat = () => {
    document.execCommand('removeFormat')
    updateContent()
    if (editorRef.current) {
      editorRef.current.focus()
    }
    saveHistory()
  }

  const exportAsHTML = () => {
    if (!editorRef.current) return
    const content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>导出的文档</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
${editorRef.current.innerHTML}
</body>
</html>`
    const blob = new Blob([content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAsText = () => {
    if (!editorRef.current) return
    const text = editorRef.current.innerText || editorRef.current.textContent || ''
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyHTML = () => {
    navigator.clipboard.writeText(htmlCode).then(() => {
      alert('HTML代码已复制到剪贴板！')
    }).catch(() => {
      alert('复制失败，请手动选择复制')
    })
  }

  const applyColorToSelection = (prop: 'color' | 'backgroundColor', value: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) return

    const span = document.createElement('span')
    span.style[prop] = value
    
    const content = range.extractContents()
    span.appendChild(content)
    
    range.insertNode(span)
    
    selection.removeAllRanges()
    range.setStartAfter(span)
    range.setEndAfter(span)
    selection.addRange(range)
    
    updateContent()
    saveHistory()
  }

  const setTextColor = (value: string) => {
    applyColorToSelection('color', value)
    if (editorRef.current) {
      editorRef.current.focus()
    }
  }

  const setBgColor = (value: string) => {
    applyColorToSelection('backgroundColor', value)
    if (editorRef.current) {
      editorRef.current.focus()
    }
  }

  const toggleTips = () => {
    const newState = !isTipsExpanded
    setIsTipsExpanded(newState)
    localStorage.setItem('tipsExpanded', String(newState))
  }

  const filteredSymbols = (showMoreSymbols ? [...commonSymbols, ...moreSymbols] : commonSymbols).filter(item => 
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Type className="h-6 w-6 text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-800">可视化编辑器</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="bg-gray-50 border-b border-gray-200">
          <div 
            className="flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={toggleTips}
          >
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <span>📖 使用说明</span>
            </h3>
            {isTipsExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </div>
          
          {isTipsExpanded && (
            <div className="p-4 space-y-4 border-t border-gray-200 text-sm text-gray-600">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">🚀 快速开始</h4>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>在编辑区域输入文字，使用工具栏按钮编辑</li>
                    <li>点击"查看HTML代码"，全选、复制生成的代码</li>
                    <li>将复制的代码粘贴到需要的地方使用</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">🎨 文本格式化</h4>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>基本格式：粗体、斜体、下划线</li>
                    <li>文本对齐：左对齐、居中对齐、右对齐</li>
                    <li>列表：无序列表、有序列表</li>
                    <li>颜色设置：字体颜色、背景颜色</li>
                  </ul>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r">
                <strong>💡 小贴士：</strong>从其他页面复制过来的文字，建议先点击"清除文字效果"按钮，然后再重新编辑
              </div>
            </div>
          )}
        </div>

        
        <div className="p-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2 items-center">
            
            <div className="flex items-center gap-1 bg-white rounded-md border border-gray-200 p-1">
                <button 
                    onClick={toggleView}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm ${isCodeView ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-700'}`}
                    title={isCodeView ? "切换到编辑模式" : "切换到代码模式"}
                >
                    {isCodeView ? <Type className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                    <span>{isCodeView ? "编辑模式" : "HTML代码"}</span>
                </button>
                <button 
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm ${isPreviewMode ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-700'}`}
                    title="实时预览"
                >
                    <Eye className="h-4 w-4" />
                    <span>预览</span>
                </button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-1">
                <button onClick={undo} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="撤销"><RotateCcw className="h-4 w-4" /></button>
                <button onClick={redo} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="重做"><RotateCw className="h-4 w-4" /></button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-1">
                <button onClick={() => formatText('bold')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="粗体"><Bold className="h-4 w-4" /></button>
                <button onClick={() => formatText('italic')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="斜体"><Italic className="h-4 w-4" /></button>
                <button onClick={() => formatText('underline')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="下划线"><Underline className="h-4 w-4" /></button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-1">
                <button onClick={() => formatText('insertUnorderedList')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="无序列表"><List className="h-4 w-4" /></button>
                <button onClick={() => formatText('insertOrderedList')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="有序列表"><ListOrdered className="h-4 w-4" /></button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-1">
                <button onClick={() => formatText('justifyLeft')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="左对齐"><AlignLeft className="h-4 w-4" /></button>
                <button onClick={() => formatText('justifyCenter')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="居中对齐"><AlignCenter className="h-4 w-4" /></button>
                <button onClick={() => formatText('justifyRight')} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="右对齐"><AlignRight className="h-4 w-4" /></button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">字:</span>
                    <input 
                        type="color" 
                        onChange={(e) => setTextColor(e.target.value)} 
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        title="文字颜色"
                    />
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">底:</span>
                    <input 
                        type="color" 
                        onChange={(e) => setBgColor(e.target.value)} 
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        title="背景颜色"
                    />
                </div>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <select 
                onChange={(e) => formatText('fontSize', e.target.value)} 
                className="p-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                <option value="">字号</option>
                <option value="1">小</option>
                <option value="3">正常</option>
                <option value="5">大</option>
                <option value="7">特大</option>
            </select>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-1">
                <button onClick={insertLink} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="插入链接"><LinkIcon className="h-4 w-4" /></button>
                <button onClick={insertImage} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="插入图片"><ImageIcon className="h-4 w-4" /></button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-1">
                <button onClick={saveToLocalExplicit} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="保存到本地"><Save className="h-4 w-4" /></button>
                <button onClick={() => loadFromLocal(true)} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="从本地加载"><Upload className="h-4 w-4" /></button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            <div className="flex items-center gap-1">
                <button onClick={exportAsHTML} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="保存为HTML文件"><Download className="h-4 w-4" /></button>
                <button onClick={handleOpenFile} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="打开文件"><FolderOpen className="h-4 w-4" /></button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".html,.htm,.txt"
                  className="hidden"
                />
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            
            <div className="flex items-center gap-1">
                <button onClick={exportAsHTML} className="p-1.5 rounded hover:bg-gray-200 text-green-600" title="导出HTML"><FileCode className="h-4 w-4" /></button>
                <button onClick={exportAsText} className="p-1.5 rounded hover:bg-gray-200 text-green-600" title="导出文本"><FileText className="h-4 w-4" /></button>
                <button onClick={handleClearAll} className="p-1.5 rounded hover:bg-red-100 text-red-600" title="清空所有内容"><Trash2 className="h-4 w-4" /></button>
            </div>
        </div>

        
        <div className="relative">
            {isCodeView ? (
                <div className="p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">HTML代码：</span>
                        <button 
                            onClick={copyHTML}
                            className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                        >
                            <Copy className="h-3 w-3" />
                            <span>复制代码</span>
                        </button>
                    </div>
                    <textarea 
                        value={htmlCode}
                        onChange={(e) => setHtmlCode(e.target.value)}
                        className="w-full h-[400px] p-4 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="HTML代码将显示在这里..."
                    />
                </div>
            ) : (
                <div 
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    className="w-full min-h-[400px] p-4 outline-none prose max-w-none"
                    style={{ minHeight: '400px' }}
                ></div>
            )}
        </div>

        
        {isPreviewMode && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-gray-700">实时预览</h4>
                    <button onClick={() => setIsPreviewMode(false)} className="text-xs text-gray-500 hover:text-gray-700">关闭预览</button>
                </div>
                <div 
                    className="bg-white border border-gray-200 p-4 rounded min-h-[100px] prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: isCodeView ? htmlCode : (editorRef.current?.innerHTML || '') }}
                ></div>
            </div>
        )}

        
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
            <span>输入 {charCount} 字符</span>
            <button 
                onClick={clearFormat}
                className="flex items-center gap-1 hover:text-red-600 transition-colors"
                title="清除选中文字效果"
            >
                <RefreshCw className="h-3 w-3" />
                <span>清除文字效果</span>
            </button>
            <span className="text-xs text-gray-400 ml-2 hidden sm:inline">（仅清除选中文字的格式，全选可清除所有）</span>
        </div>
      </div>

      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">常用符号</h3>
            <button 
                onClick={() => setShowMoreSymbols(!showMoreSymbols)}
                className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
            >
                {showMoreSymbols ? '收起' : '更多'}
            </button>
        </div>

        <div className="mb-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="搜索符号..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
            </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto">
            {filteredSymbols.map((item, index) => (
                <div 
                    key={index}
                    onClick={() => insertSymbol(item.symbol)}
                    className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer group transition-colors"
                    title={item.name}
                >
                    <span className="text-lg font-bold text-gray-700">{item.symbol}</span>
                    <span className="text-xs text-indigo-600 opacity-0 group-hover:opacity-100">复制</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default EditorPage
  
