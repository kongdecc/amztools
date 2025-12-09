'use client'

import React, { useEffect, useState } from 'react'

export default function AdminReward() {
  const [form, setForm] = useState({ rewardDescription: '' })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [rewardQrUrl, setRewardQrUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      const data = await r.json()
      setForm({
        rewardDescription: data.rewardDescription || ''
      })
      // Check reward QR
      const qrRes = await fetch('/api/reward-qr', { method: 'HEAD' })
      if (qrRes.ok) setRewardQrUrl(`/api/reward-qr?ts=${Date.now()}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setMsg('')
    const payload = { rewardDescription: form.rewardDescription }
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
    if (r.ok) { 
      setMsg('保存成功')
      try { localStorage.setItem('settings_cache', JSON.stringify(payload)); localStorage.setItem('settings_updated', String(Date.now())) } catch {} 
    } else {
      setMsg('保存失败或未登录')
    }
  }

  const set = (k: any, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-4">打赏设置</h1>
      <div className="mb-6 text-sm text-gray-600">
        配置前台打赏页面 (/reward) 的显示内容，包括二维码和说明文字。
      </div>
      
      {loading ? '加载中...' : (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">二维码管理</h3>
            <label className="block text-sm text-gray-600 mb-2">上传打赏二维码 (支持 PNG, JPG, WebP, SVG)</label>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                 <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('qr-upload')?.click()}
                 >
                    <input 
                      id="qr-upload"
                      type="file" 
                      accept="image/*" 
                      className="hidden"
                      onChange={async e => { 
                        const f = e.target.files?.[0]; 
                        if (f) { 
                          setUploading(true)
                          setMsg('')
                          try { 
                            const fd = new FormData(); 
                            fd.append('file', f); 
                            
                            // Debug info
                            console.log('Uploading file:', f.name, f.size, f.type)
                            
                            const r = await fetch('/api/reward-qr', { method: 'POST', body: fd, credentials: 'include' }); 
                            let d;
                            try {
                                d = await r.json();
                            } catch (err) {
                                console.error('JSON parse error', err)
                                throw new Error('服务器响应格式错误')
                            }
                            
                            if (r.ok && d?.url) { 
                              setRewardQrUrl(d.url) 
                              setMsg('二维码上传成功')
                            } else {
                              console.error('Upload failed:', d)
                              setMsg('上传失败: ' + (d?.message || d?.error || r.statusText || '未知错误'))
                            }
                          } catch (e) {
                            console.error('Upload exception:', e)
                            setMsg('上传出错: ' + String(e))
                          } finally {
                            setUploading(false)
                            // Reset input value to allow re-uploading same file
                            e.target.value = ''
                          }
                        } 
                      }} 
                    />
                    <div className="text-gray-500">
                      {uploading ? '正在上传...' : '点击选择文件上传'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">最大 4MB</div>
                 </div>
                 {msg && <div className={`text-sm mt-2 ${msg.includes('失败') || msg.includes('出错') ? 'text-red-600' : 'text-green-600'}`}>{msg}</div>}
              </div>
              
              {rewardQrUrl ? (
                <div className="border rounded p-1 bg-gray-50">
                  <img src={rewardQrUrl} alt="Reward QR" className="h-32 w-32 object-contain" />
                </div>
              ) : (
                <div className="h-32 w-32 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                  暂无二维码
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">文字说明</h3>
            <label className="block text-sm text-gray-600 mb-2">打赏页面说明文字</label>
            <textarea 
              className="w-full border rounded px-3 py-2 text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
              value={form.rewardDescription} 
              onChange={e => set('rewardDescription', e.target.value)} 
              placeholder="例如：如果您觉得本工具箱对您有帮助，欢迎打赏支持我们继续维护和开发！" 
            />
            <div className="mt-4 flex justify-end">
              <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm transition-colors shadow-sm">保存文字设置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
