'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from './InvoiceGenerator.module.css'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Receipt } from 'lucide-react'

const CURRENCY_SYMBOLS: { [key: string]: string } = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'CNY': '¥',
  'JPY': '¥'
}

interface Product {
  id: string
  name: string
  qty: number
  price: number
}

interface SavedInfo {
  name: string
  content: string
}

const InvoiceGenerator = () => {
  const [helpVisible, setHelpVisible] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('INV-0001')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [companyInfo, setCompanyInfo] = useState("Company Name\nAddress Line 1\nAddress Line 2\nCity, State ZIP")
  const [buyerInfo, setBuyerInfo] = useState("Buyer's Name\nAddress Line 1\nAddress Line 2\nCity, State ZIP")
  const [orderFrom, setOrderFrom] = useState('Amazon')
  const [orderNo, setOrderNo] = useState('')
  const [itemNo, setItemNo] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: '', qty: 1, price: 0 }
  ])
  const [logo, setLogo] = useState<string | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  
  const [savedCompanies, setSavedCompanies] = useState<SavedInfo[]>([])
  const [savedBuyers, setSavedBuyers] = useState<SavedInfo[]>([])

  const invoiceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize date
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    setInvoiceDate(dateStr)
    
    // Load saved data
    loadSavedData()
    
    // Show help by default then hide
    setHelpVisible(true)
    const timer = setTimeout(() => {
        setHelpVisible(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  const loadSavedData = () => {
    try {
      // Use the keys from the HTML file logic to match potential existing data if any, 
      // but the HTML file uses 'savedCompanies' object structure, here we use array for Select options.
      // Let's stick to the React implementation logic but keep the keys consistent if possible.
      // The HTML file uses: savedCompanies (object), savedBuyers (object), invoiceTemplates (object)
      // We will adapt to array for React state.
      
      const companiesObj = JSON.parse(localStorage.getItem('savedCompanies') || '{}')
      const buyersObj = JSON.parse(localStorage.getItem('savedBuyers') || '{}')
      
      const companiesArr = Object.keys(companiesObj).map(key => ({ name: key, content: companiesObj[key] }))
      const buyersArr = Object.keys(buyersObj).map(key => ({ name: key, content: buyersObj[key] }))
      
      setSavedCompanies(companiesArr)
      setSavedBuyers(buyersArr)
    } catch (e) {
      console.error('Error loading saved data', e)
    }
  }

  const formatCurrency = (amount: number) => {
    const symbol = CURRENCY_SYMBOLS[currency] || '$'
    return `${symbol}${amount.toFixed(2)}`
  }

  const calculateTotal = () => {
    return products.reduce((sum, p) => sum + (p.qty * p.price), 0)
  }

  const handleAddProduct = () => {
    setProducts([...products, { id: Date.now().toString(), name: '', qty: 1, price: 0 }])
  }

  const handleAddShipping = () => {
    setProducts([...products, { id: Date.now().toString(), name: 'Shipping Fee', qty: 1, price: 0 }])
  }

  const handleAddTax = () => {
    setProducts([...products, { id: Date.now().toString(), name: 'Tax', qty: 1, price: 0 }])
  }

  const handleAddDiscount = () => {
    setProducts([...products, { id: Date.now().toString(), name: 'Discount', qty: 1, price: 0 }])
  }

  const handleRemoveProduct = (id: string) => {
    if (products.length > 1) {
      if (confirm('确定要删除这个产品行吗？\n\n点击"确定"继续，点击"取消"放弃操作。')) {
        setProducts(products.filter(p => p.id !== id))
      }
    } else {
      alert('至少需要保留一个产品行')
    }
  }

  const handleProductChange = (id: string, field: keyof Product, value: any) => {
    setProducts(products.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value }
      }
      return p
    }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogo(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogoClick = () => {
    document.getElementById('logoUploadInput')?.click()
  }

  const saveCompany = () => {
    if (!companyInfo.trim()) {
      alert('请输入公司信息')
      return
    }
    const name = prompt('请输入模板名称:')
    if (name) {
      const companiesObj = JSON.parse(localStorage.getItem('savedCompanies') || '{}')
      companiesObj[name] = companyInfo
      localStorage.setItem('savedCompanies', JSON.stringify(companiesObj))
      loadSavedData() // Reload to update state
      alert('公司信息已保存')
    }
  }

  const deleteCompany = () => {
    const select = document.getElementById('savedCompanies') as HTMLSelectElement
    const name = select.value
    if (name) {
      if (confirm(`确定要删除模板 "${name}" 吗？\n\n点击"确定"继续，点击"取消"放弃操作。`)) {
        const companiesObj = JSON.parse(localStorage.getItem('savedCompanies') || '{}')
        delete companiesObj[name]
        localStorage.setItem('savedCompanies', JSON.stringify(companiesObj))
        loadSavedData()
        alert('模板已删除')
      }
    } else {
      alert('请选择要删除的模板')
    }
  }

  const loadCompany = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value
    if (name) {
      const companiesObj = JSON.parse(localStorage.getItem('savedCompanies') || '{}')
      if (companiesObj[name]) {
        setCompanyInfo(companiesObj[name])
      }
    }
  }

  const saveBuyer = () => {
    if (!buyerInfo.trim()) {
      alert('请输入买家信息')
      return
    }
    const name = prompt('请输入模板名称:')
    if (name) {
      const buyersObj = JSON.parse(localStorage.getItem('savedBuyers') || '{}')
      buyersObj[name] = buyerInfo
      localStorage.setItem('savedBuyers', JSON.stringify(buyersObj))
      loadSavedData()
      alert('买家信息已保存')
    }
  }

  const deleteBuyer = () => {
    const select = document.getElementById('savedBuyers') as HTMLSelectElement
    const name = select.value
    if (name) {
      if (confirm(`确定要删除模板 "${name}" 吗？\n\n点击"确定"继续，点击"取消"放弃操作。`)) {
        const buyersObj = JSON.parse(localStorage.getItem('savedBuyers') || '{}')
        delete buyersObj[name]
        localStorage.setItem('savedBuyers', JSON.stringify(buyersObj))
        loadSavedData()
        alert('模板已删除')
      }
    } else {
      alert('请选择要删除的模板')
    }
  }

  const loadBuyer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value
    if (name) {
      const buyersObj = JSON.parse(localStorage.getItem('savedBuyers') || '{}')
      if (buyersObj[name]) {
        setBuyerInfo(buyersObj[name])
      }
    }
  }

  const saveTemplate = () => {
    const data = {
      invoiceNo,
      invoiceDate,
      companyInfo,
      buyerInfo,
      orderFrom,
      orderNo,
      itemNo,
      currency,
      products,
      logoSrc: logo
    }
    const name = prompt('请输入模板名称:')
    if (name) {
      const savedTemplates = JSON.parse(localStorage.getItem('invoiceTemplates') || '{}')
      savedTemplates[name] = data
      localStorage.setItem('invoiceTemplates', JSON.stringify(savedTemplates))
      alert('模板已保存')
    }
  }

  const loadTemplate = () => {
    try {
      const savedTemplates = JSON.parse(localStorage.getItem('invoiceTemplates') || '{}')
      const names = Object.keys(savedTemplates)
      
      if (names.length === 0) {
        alert('没有保存的模板')
        return
      }
      
      const name = prompt(`请选择模板:\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n请输入模板名称:`)
      if (name && savedTemplates[name]) {
        const data = savedTemplates[name]
        if (data.invoiceNo) setInvoiceNo(data.invoiceNo)
        if (data.invoiceDate) setInvoiceDate(data.invoiceDate)
        if (data.companyInfo) setCompanyInfo(data.companyInfo)
        if (data.buyerInfo) setBuyerInfo(data.buyerInfo)
        if (data.orderFrom) setOrderFrom(data.orderFrom)
        if (data.orderNo) setOrderNo(data.orderNo)
        if (data.itemNo) setItemNo(data.itemNo)
        if (data.currency) setCurrency(data.currency)
        if (data.products) setProducts(data.products)
        if (data.logoSrc) setLogo(data.logoSrc)
        alert('模板已加载')
      } else if (name) {
        alert('模板不存在')
      }
    } catch (e) {
      console.error('Error loading template', e)
      alert('Error loading template.')
    }
  }

  const newInvoice = () => {
    if (confirm('确定要创建新发票吗？当前数据将被清空。\n\n点击"确定"继续，点击"取消"放弃操作。')) {
        const newInvoiceNo = 'INV-' + String(Date.now()).slice(-4)
        setInvoiceNo(newInvoiceNo)
        setInvoiceDate(new Date().toISOString().split('T')[0])
        setCompanyInfo("")
        setBuyerInfo("")
        setOrderFrom('Amazon')
        setOrderNo('')
        setItemNo('')
        setCurrency('USD')
        setProducts([{ id: Date.now().toString(), name: '', qty: 1, price: 0 }])
        setLogo(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = async () => {
    if (!invoiceRef.current) return
    
    const element = invoiceRef.current
    const logoPlaceholder = element.querySelector(`.${styles.logoPlaceholder}`) as HTMLElement
    const companyLogo = element.querySelector(`.${styles.companyLogo}`) as HTMLElement
    const hasLogo = logo && logo.length > 0
    const elementsToHide = [
      ...Array.from(element.querySelectorAll(`.${styles.templateControls}`)),
      ...Array.from(element.querySelectorAll(`.${styles.productControls}`)),
      ...Array.from(element.querySelectorAll(`.${styles.btnRemove}`)),
      ...Array.from(element.querySelectorAll(`.${styles.btnChangeLogo}`))
    ] as HTMLElement[]
    const lastHeaders = Array.from(element.querySelectorAll(`.${styles.productsTable} th:last-child`)) as HTMLElement[]
    const lastCells = Array.from(element.querySelectorAll(`.${styles.productsTable} td:last-child`)) as HTMLElement[]
    const originalTitle = document.title

    try {
      document.title = invoiceNo || 'invoice'

      if (!hasLogo) {
        if (companyLogo) companyLogo.classList.add(styles.noLogo)
        if (logoPlaceholder) logoPlaceholder.classList.add(styles.noLogo)
      }

      elementsToHide.forEach(el => el.style.display = 'none')
      lastHeaders.forEach(el => el.style.display = 'none')
      lastCells.forEach(el => el.style.display = 'none')
      
      const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      pdf.save(`${invoiceNo || 'invoice'}.pdf`)
    } catch (error) {
      console.error('PDF导出失败:', error)
      alert('PDF导出失败，请检查浏览器是否支持或尝试使用打印功能')
    } finally {
      elementsToHide.forEach(el => el.style.display = '')
      lastHeaders.forEach(el => el.style.display = '')
      lastCells.forEach(el => el.style.display = '')
      if (!hasLogo) {
        if (companyLogo) companyLogo.classList.remove(styles.noLogo)
        if (logoPlaceholder) logoPlaceholder.classList.remove(styles.noLogo)
      }
      document.title = originalTitle
    }
  }

  const handlePreview = async () => {
    if (!invoiceRef.current) return
    setPreviewVisible(true)
    
    // Simple preview generation
    const element = invoiceRef.current
    const canvas = await html2canvas(element, {
        scale: 1, 
        useCORS: true
    })
    const imgData = canvas.toDataURL('image/png')
    const previewContent = document.getElementById('previewContentImg') as HTMLImageElement
    if (previewContent) {
        previewContent.src = imgData
    }
  }

  return (
    <div className={styles.container}>
      {/* Help Section */}
      <div className={styles.helpSection}>
        <div className={styles.helpHeader} onClick={() => setHelpVisible(!helpVisible)}>
          <h3>📖 使用说明 <span className={styles.helpToggle} style={{ transform: helpVisible ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span></h3>
        </div>
        <div className={`${styles.helpContent} ${helpVisible ? styles.show : ''}`} id="helpContent">
          <div className={styles.helpGrid}>
            <div className={styles.helpItem}>
              <h4>🏢 基本信息</h4>
              <p>• 填写发票号和日期<br/>• 输入公司信息和买家信息<br/>• 上传公司Logo（可重新选择）</p>
            </div>
            <div className={styles.helpItem}>
              <h4>📦 订单信息</h4>
              <p>• 选择订单来源（Amazon等）<br/>• 输入订单号和商品编号<br/>• 选择货币类型</p>
            </div>
            <div className={styles.helpItem}>
              <h4>🛍️ 产品管理</h4>
              <p>• 添加产品、运费、税费、折扣<br/>• 自动计算金额和总计<br/>• 可删除不需要的行</p>
            </div>
            <div className={styles.helpItem}>
              <h4>💾 模板功能</h4>
              <p>• 保存常用的公司和买家信息<br/>• 保存完整发票模板<br/>• 快速加载已保存的模板</p>
            </div>
            <div className={styles.helpItem}>
              <h4>📄 导出打印</h4>
              <p>• 建议导出再打印，不要直接打印，排版不如导出效果好<br/>• 预览发票效果<br/>• 打印发票<br/>• 导出为PDF文件</p>
            </div>
            <div className={styles.helpItem}>
              <h4>💡 小贴士</h4>
              <p>• 所有数据保存在本地<br/>• 完全离线使用<br/>• 支持多种货币</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <button onClick={saveTemplate} className={`${styles.btn} ${styles.btnPrimary}`}>保存模板</button>
        <button onClick={loadTemplate} className={`${styles.btn} ${styles.btnSecondary}`}>加载模板</button>
        <button onClick={handlePreview} className={`${styles.btn} ${styles.btnInfo}`}>预览发票</button>
        <button onClick={handlePrint} className={`${styles.btn} ${styles.btnSuccess}`}>打印发票</button>
        <button onClick={handleExportPDF} className={`${styles.btn} ${styles.btnInfo}`}>导出PDF</button>
        <button onClick={newInvoice} className={`${styles.btn} ${styles.btnWarning}`}>新建发票</button>
      </div>

      <div className={styles.invoiceContainer} ref={invoiceRef}>
        <div className={styles.invoiceHeader}>
          <div className={styles.invoiceTitle}>
            <h1>INVOICE</h1>
          </div>
          <div className={styles.invoiceInfo}>
            <div className={styles.infoGroup}>
              <label>Invoice No.</label>
              <input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
            </div>
            <div className={styles.infoGroup}>
              <label>Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className={styles.companySection}>
          <div className={styles.companyInfo}>
            <div className={styles.companyFrom}>
              <label>Company Name & Address</label>
              <textarea 
                value={companyInfo} 
                onChange={e => setCompanyInfo(e.target.value)}
                placeholder="写店铺公司名和地址"
              />
              <div className={styles.templateControls}>
                <select id="savedCompanies" onChange={loadCompany}>
                  <option value="">-- Select Saved --</option>
                  {savedCompanies.map((c, i) => (
                    <option key={i} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <button onClick={saveCompany} className={styles.btnSmall}>保存</button>
                <button onClick={deleteCompany} className={styles.btnSmall}>删除</button>
              </div>
            </div>
            <div className={styles.companyLogo}>
              <div className={`${styles.logoPlaceholder} ${logo ? styles.hasLogo : ''}`} style={{ border: logo ? 'none' : '' }}>
                {!logo && <span>Company Logo</span>}
                <input 
                  type="file" 
                  id="logoUploadInput"
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                />
                {logo && <img src={logo} alt="Company Logo" />}
                {logo && (
                  <button 
                    className={styles.btnChangeLogo} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogoClick();
                    }}
                  >
                    上传公司Logo（可重新选择）
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.billToSection}>
            <div className={styles.billTo}>
              <label>Bill To</label>
              <textarea 
                value={buyerInfo} 
                onChange={e => setBuyerInfo(e.target.value)}
                placeholder="买家名字和地址"
              />
              <div className={styles.templateControls}>
                <select id="savedBuyers" onChange={loadBuyer}>
                  <option value="">-- Select Saved --</option>
                  {savedBuyers.map((c, i) => (
                    <option key={i} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <button onClick={saveBuyer} className={styles.btnSmall}>保存</button>
                <button onClick={deleteBuyer} className={styles.btnSmall}>删除</button>
              </div>
            </div>
            <div className={styles.orderInfo}>
              <div className={styles.orderDetails}>
                <div className={styles.infoGroup}>
                  <label>Order From</label>
                  <input type="text" value={orderFrom} onChange={e => setOrderFrom(e.target.value)} />
                </div>
                <div className={styles.infoGroup}>
                  <label>Order No.</label>
                  <input type="text" value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="123-1234567-1234567" />
                </div>
                <div className={styles.infoGroup}>
                  <label>Item No.</label>
                  <input type="text" value={itemNo} onChange={e => setItemNo(e.target.value)} placeholder="Listing/ASIN" />
                </div>
                <div className={styles.infoGroup}>
                  <label>Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CNY">CNY (¥)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.productsSection}>
          <div className={styles.productControls}>
            <button onClick={handleAddProduct} className={`${styles.btn} ${styles.btnPrimary}`}>添加产品</button>
            <button onClick={handleAddShipping} className={`${styles.btn} ${styles.btnSecondary}`}>添加运费</button>
            <button onClick={handleAddTax} className={`${styles.btn} ${styles.btnSecondary}`}>添加税费</button>
            <button onClick={handleAddDiscount} className={`${styles.btn} ${styles.btnSecondary}`}>添加折扣</button>
          </div>

          <table className={styles.productsTable}>
            <thead>
              <tr>
                <th>Description</th>
                <th>QTY</th>
                <th>Unit Price</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td><input type="text" value={product.name} onChange={e => handleProductChange(product.id, 'name', e.target.value)} placeholder="product name" /></td>
                  <td><input type="number" value={product.qty} onChange={e => handleProductChange(product.id, 'qty', Number(e.target.value))} min="1" /></td>
                  <td><input type="number" value={product.price} onChange={e => handleProductChange(product.id, 'price', Number(e.target.value))} step="0.01" /></td>
                  <td className={styles.productAmount}>{formatCurrency(product.qty * product.price)}</td>
                  <td><button onClick={() => handleRemoveProduct(product.id)} className={styles.btnRemove}>删除</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.invoiceTotal}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalAmount}>{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <div className={`${styles.modal} ${previewVisible ? styles.show : ''}`}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h3>发票预览</h3>
            <span className={styles.close} onClick={() => setPreviewVisible(false)}>&times;</span>
          </div>
          <div className={styles.modalBody}>
            <img id="previewContentImg" style={{ maxWidth: '100%', border: '1px solid #ddd' }} alt="Preview" />
          </div>
          <div className={styles.modalFooter}>
            <button onClick={() => setPreviewVisible(false)} className={`${styles.btn} ${styles.btnSecondary}`}>关闭</button>
            <button onClick={() => { setPreviewVisible(false); handlePrint(); }} className={`${styles.btn} ${styles.btnSuccess}`}>打印</button>
            <button onClick={() => { setPreviewVisible(false); handleExportPDF(); }} className={`${styles.btn} ${styles.btnInfo}`}>导出PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoiceGenerator
