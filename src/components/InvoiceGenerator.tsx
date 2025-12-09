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
    }, 1000) // Reduced time for better UX in React
    
    return () => clearTimeout(timer)
  }, [])

  const loadSavedData = () => {
    try {
      const companies = JSON.parse(localStorage.getItem('invoice_companies') || '[]')
      const buyers = JSON.parse(localStorage.getItem('invoice_buyers') || '[]')
      setSavedCompanies(companies)
      setSavedBuyers(buyers)
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
    setProducts([...products, { id: Date.now().toString(), name: 'Shipping', qty: 1, price: 0 }])
  }

  const handleAddTax = () => {
    setProducts([...products, { id: Date.now().toString(), name: 'Tax', qty: 1, price: 0 }])
  }

  const handleAddDiscount = () => {
    setProducts([...products, { id: Date.now().toString(), name: 'Discount', qty: 1, price: 0 }]) // Usually negative, but user inputs positive and maybe we handle it? The original code didn't specify negative logic, just add row. User can input negative price.
  }

  const handleRemoveProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id))
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
    const name = prompt('Enter a name for this company info:')
    if (name) {
      const newSaved = [...savedCompanies, { name, content: companyInfo }]
      setSavedCompanies(newSaved)
      localStorage.setItem('invoice_companies', JSON.stringify(newSaved))
    }
  }

  const deleteCompany = () => {
    const select = document.getElementById('savedCompanies') as HTMLSelectElement
    const index = select.selectedIndex - 1 // -1 because of default option
    if (index >= 0) {
      const newSaved = savedCompanies.filter((_, i) => i !== index)
      setSavedCompanies(newSaved)
      localStorage.setItem('invoice_companies', JSON.stringify(newSaved))
    }
  }

  const loadCompany = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value)
    if (!isNaN(idx) && savedCompanies[idx]) {
      setCompanyInfo(savedCompanies[idx].content)
    }
  }

  const saveBuyer = () => {
    const name = prompt('Enter a name for this buyer info:')
    if (name) {
      const newSaved = [...savedBuyers, { name, content: buyerInfo }]
      setSavedBuyers(newSaved)
      localStorage.setItem('invoice_buyers', JSON.stringify(newSaved))
    }
  }

  const deleteBuyer = () => {
    const select = document.getElementById('savedBuyers') as HTMLSelectElement
    const index = select.selectedIndex - 1
    if (index >= 0) {
      const newSaved = savedBuyers.filter((_, i) => i !== index)
      setSavedBuyers(newSaved)
      localStorage.setItem('invoice_buyers', JSON.stringify(newSaved))
    }
  }

  const loadBuyer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value)
    if (!isNaN(idx) && savedBuyers[idx]) {
      setBuyerInfo(savedBuyers[idx].content)
    }
  }

  const saveTemplate = () => {
    const data = {
      invoiceNo,
      companyInfo,
      buyerInfo,
      orderFrom,
      orderNo,
      itemNo,
      currency,
      products,
      logo
    }
    localStorage.setItem('invoice_template', JSON.stringify(data))
    alert('Template saved successfully!')
  }

  const loadTemplate = () => {
    try {
      const saved = localStorage.getItem('invoice_template')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.invoiceNo) setInvoiceNo(data.invoiceNo)
        if (data.companyInfo) setCompanyInfo(data.companyInfo)
        if (data.buyerInfo) setBuyerInfo(data.buyerInfo)
        if (data.orderFrom) setOrderFrom(data.orderFrom)
        if (data.orderNo) setOrderNo(data.orderNo)
        if (data.itemNo) setItemNo(data.itemNo)
        if (data.currency) setCurrency(data.currency)
        if (data.products) setProducts(data.products)
        if (data.logo) setLogo(data.logo)
        alert('Template loaded successfully!')
      } else {
        alert('No saved template found.')
      }
    } catch (e) {
      console.error('Error loading template', e)
      alert('Error loading template.')
    }
  }

  const newInvoice = () => {
    if (confirm('Are you sure you want to create a new invoice? Unsaved changes will be lost.')) {
        setInvoiceNo('INV-0001')
        setInvoiceDate(new Date().toISOString().split('T')[0])
        setCompanyInfo("Company Name\nAddress Line 1\nAddress Line 2\nCity, State ZIP")
        setBuyerInfo("Buyer's Name\nAddress Line 1\nAddress Line 2\nCity, State ZIP")
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
    
    // Temporarily hide non-printable elements if needed (handled by CSS media print, but for html2canvas we might need manual handling)
    // Actually html2canvas captures what is visible. We should probably clone it or style it.
    // The original code used html2canvas on the container.
    
    // For better PDF quality with html2canvas:
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
    })
    
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    })
    
    const imgWidth = 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`invoice_${invoiceNo}.pdf`)
  }

  const handlePreview = async () => {
    if (!invoiceRef.current) return
    setPreviewVisible(true)
    // In React we can just render the invoice in the modal, but reusing the same component might be tricky if it has inputs.
    // The original code cloned the node or something.
    // For simplicity, we can just generate the image and show it in the modal, or rely on the fact that the modal covers the screen and we can show a read-only version.
    // However, the original code's preview allowed printing/exporting from there.
    // Let's implement a simple preview that just generates an image for now, or better, use a read-only view of the invoice.
    // Actually, let's just use the html2canvas to show a snapshot.
    
    const element = invoiceRef.current
    const canvas = await html2canvas(element, {
        scale: 1, // Preview doesn't need high res
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
      <div className={`flex items-center gap-2 mb-6 ${styles.pageHeader}`}>
        <Receipt className="h-6 w-6 text-cyan-600" />
        <h2 className="text-xl font-bold text-gray-800">发票生成工具</h2>
      </div>

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
                    <option key={i} value={i}>{c.name}</option>
                  ))}
                </select>
                <button onClick={saveCompany} className={styles.btnSmall}>保存</button>
                <button onClick={deleteCompany} className={styles.btnSmall}>删除</button>
              </div>
            </div>
            <div className={styles.companyLogo}>
              <div className={styles.logoPlaceholder} style={{ border: logo ? 'none' : '' }}>
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
                    <option key={i} value={i}>{c.name}</option>
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
            <button onClick={() => { setPreviewVisible(false); setTimeout(handlePrint, 100); }} className={`${styles.btn} ${styles.btnSuccess}`}>打印</button>
            <button onClick={() => { setPreviewVisible(false); setTimeout(handleExportPDF, 100); }} className={`${styles.btn} ${styles.btnInfo}`}>导出PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoiceGenerator
