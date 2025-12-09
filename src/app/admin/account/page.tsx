'use client'

import React, { useEffect, useState } from 'react'

export default function AdminAccount() {
  const [username, setUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [changing, setChanging] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        if (r.status === 200) {
          const d = await r.json()
          setUsername(String(d?.user?.username || ''))
        } else if (r.status === 401) {
          window.location.href = '/login?from=/admin'
        }
      } catch {}
    })()
  }, [])

  const onChangePassword = async () => {
    setMsg('')
    if (!currentPassword || !newPassword || !confirmPassword) { setMsg('请输入当前密码、新密码与确认密码'); return }
    if (newPassword !== confirmPassword) { setMsg('两次输入的新密码不一致'); return }
    if (newPassword.length < 6) { setMsg('新密码长度至少6位'); return }
    setChanging(true)
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include'
      })
      if (r.ok) {
        setMsg('密码修改成功，已退出登录，请重新登录')
        setTimeout(() => { window.location.href = '/login?from=/admin' }, 1200)
      } else {
        const d = await r.json().catch(() => ({}))
        setMsg(String(d?.error || '修改密码失败'))
      }
    } finally {
      setChanging(false)
    }
  }

  const onLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    window.location.href = '/login?from=/admin'
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">账号信息</h3>
          <p className="text-xs text-gray-500 mt-1">当前登录账号：{username || '-'}</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">当前密码</label>
              <div className="flex items-center gap-2">
                <input type={showCurrent ? 'text' : 'password'} className="flex-1 border rounded px-3 py-2 text-sm" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                <label className="text-xs text-gray-600 flex items-center gap-1"><input type="checkbox" checked={showCurrent} onChange={e => setShowCurrent(e.target.checked)} /> 显示</label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">新密码</label>
              <div className="flex items-center gap-2">
                <input type={showNew ? 'text' : 'password'} className="flex-1 border rounded px-3 py-2 text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <label className="text-xs text-gray-600 flex items-center gap-1"><input type="checkbox" checked={showNew} onChange={e => setShowNew(e.target.checked)} /> 显示</label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">确认新密码</label>
              <div className="flex items-center gap-2">
                <input type={showConfirm ? 'text' : 'password'} className="flex-1 border rounded px-3 py-2 text-sm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <label className="text-xs text-gray-600 flex items-center gap-1"><input type="checkbox" checked={showConfirm} onChange={e => setShowConfirm(e.target.checked)} /> 显示</label>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={onChangePassword} disabled={changing} className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-60">{changing ? '修改中...' : '修改密码'}</button>
            <button onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMsg('') }} className="border border-gray-200 rounded px-4 py-2 text-sm">清空</button>
          </div>
          {msg && <div className="mt-3 text-sm text-gray-600">{msg}</div>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">退出登录</h3>
          <p className="text-xs text-gray-500 mt-1">退出当前会话，返回登录页面</p>
        </div>
        <div className="p-5">
          <button onClick={onLogout} className="bg-red-600 text-white rounded px-4 py-2 text-sm">退出登录</button>
        </div>
      </div>
    </div>
  )
}