import React, { useState } from 'react'
import { Scale } from 'lucide-react'
import { Card, Input } from '@/components/SharedUI'

const UnitConverterPage = () => {
  const [length, setLength] = useState<any>({ cm: '', in: '', m: '', ft: '', mm: '' })
  const [weight, setWeight] = useState<any>({ kg: '', oz: '', g: '', lb: '', t: '' })
  const [volume, setVolume] = useState<any>({ m3: '', l: '', ml: '', ft3: '', gal: '' })

  const convertLength = (field: string, val: string) => {
    if (val === '') {
      setLength({ cm: '', in: '', m: '', ft: '', mm: '' })
      return
    }
    const v = parseFloat(val)
    if (isNaN(v)) return

    let n: any = {}
    if (field === 'cm') {
      n.cm = val
      n.in = (v / 2.54).toFixed(2)
      n.m = (v / 100).toFixed(2)
      n.ft = (v / 30.48).toFixed(2)
      n.mm = (v * 10).toFixed(2)
    } else if (field === 'in') {
      n.in = val
      n.cm = (v * 2.54).toFixed(2)
      n.m = (v * 0.0254).toFixed(2)
      n.ft = (v / 12).toFixed(2)
      n.mm = (v * 25.4).toFixed(2)
    } else if (field === 'm') {
      n.m = val
      n.cm = (v * 100).toFixed(2)
      n.in = (v / 0.0254).toFixed(2)
      n.ft = (v * 3.28084).toFixed(2)
      n.mm = (v * 1000).toFixed(2)
    } else if (field === 'ft') {
      n.ft = val
      n.cm = (v * 30.48).toFixed(2)
      n.in = (v * 12).toFixed(2)
      n.m = (v / 3.28084).toFixed(2)
      n.mm = (v * 304.8).toFixed(2)
    } else if (field === 'mm') {
      n.mm = val
      n.cm = (v / 10).toFixed(2)
      n.in = (v / 25.4).toFixed(2)
      n.m = (v / 1000).toFixed(2)
      n.ft = (v / 304.8).toFixed(2)
    }
    setLength(n)
  }

  const convertWeight = (field: string, val: string) => {
    if (val === '') {
      setWeight({ kg: '', oz: '', g: '', lb: '', t: '' })
      return
    }
    const v = parseFloat(val)
    if (isNaN(v)) return

    let n: any = {}
    if (field === 'kg') {
      n.kg = val
      n.oz = (v * 35.274).toFixed(2)
      n.g = (v * 1000).toFixed(2)
      n.lb = (v * 2.20462).toFixed(2)
      n.t = (v / 1000).toFixed(2)
    } else if (field === 'oz') {
      n.oz = val
      n.kg = (v / 35.274).toFixed(2)
      n.g = (v * 28.3495).toFixed(2)
      n.lb = (v / 16).toFixed(2)
      n.t = (v / 35274).toFixed(6)
    } else if (field === 'g') {
      n.g = val
      n.kg = (v / 1000).toFixed(2)
      n.oz = (v / 28.3495).toFixed(2)
      n.lb = (v / 453.592).toFixed(2)
      n.t = (v / 1e6).toFixed(6)
    } else if (field === 'lb') {
      n.lb = val
      n.kg = (v / 2.20462).toFixed(2)
      n.oz = (v * 16).toFixed(2)
      n.g = (v * 453.592).toFixed(2)
      n.t = (v / 2204.62).toFixed(6)
    } else if (field === 't') {
      n.t = val
      n.kg = (v * 1000).toFixed(2)
      n.oz = (v * 35274).toFixed(2)
      n.g = (v * 1e6).toFixed(2)
      n.lb = (v * 2204.62).toFixed(2)
    }
    setWeight(n)
  }

  const convertVolume = (field: string, val: string) => {
    if (val === '') {
      setVolume({ m3: '', l: '', ml: '', ft3: '', gal: '' })
      return
    }
    const v = parseFloat(val)
    if (isNaN(v)) return

    let n: any = {}
    if (field === 'm3') {
      n.m3 = val
      n.l = (v * 1000).toFixed(2)
      n.ml = (v * 1e6).toFixed(2)
      n.ft3 = (v * 35.3147).toFixed(2)
      n.gal = (v * 264.172).toFixed(2)
    } else if (field === 'l') {
      n.l = val
      n.m3 = (v / 1000).toFixed(6)
      n.ml = (v * 1000).toFixed(2)
      n.ft3 = (v / 28.3168).toFixed(2)
      n.gal = (v / 3.78541).toFixed(2)
    } else if (field === 'ml') {
      n.ml = val
      n.m3 = (v / 1e6).toFixed(6)
      n.l = (v / 1000).toFixed(2)
      n.ft3 = (v / 28316.8).toFixed(6)
      n.gal = (v / 3785.41).toFixed(6)
    } else if (field === 'ft3') {
      n.ft3 = val
      n.m3 = (v / 35.3147).toFixed(6)
      n.l = (v * 28.3168).toFixed(2)
      n.ml = (v * 28316.8).toFixed(2)
      n.gal = (v * 7.48052).toFixed(2)
    } else if (field === 'gal') {
      n.gal = val
      n.m3 = (v / 264.172).toFixed(6)
      n.l = (v * 3.78541).toFixed(2)
      n.ml = (v * 3785.41).toFixed(2)
      n.ft3 = (v / 7.48052).toFixed(2)
    }
    setVolume(n)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">单位换算</h2>
      </div>
      <Card className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <UnitGroup 
            title="长度换算" 
            units={[{ key: 'cm', label: '厘米 (cm)' }, { key: 'in', label: '英寸 (in)' }, { key: 'm', label: '米 (m)' }, { key: 'ft', label: '英尺 (ft)' }, { key: 'mm', label: '毫米 (mm)' }]} 
            state={length}
            handler={convertLength}
          />
          <UnitGroup 
            title="重量换算" 
            units={[{ key: 'kg', label: '公斤 (kg)' }, { key: 'oz', label: '盎司 (oz)' }, { key: 'g', label: '克 (g)' }, { key: 'lb', label: '磅 (lb)' }, { key: 't', label: '吨 (t)' }]} 
            state={weight}
            handler={convertWeight}
          />
          <UnitGroup 
            title="体积换算" 
            units={[{ key: 'm3', label: '立方米 (m³)' }, { key: 'l', label: '升 (L)' }, { key: 'ml', label: '毫升 (mL)' }, { key: 'ft3', label: '立方英尺 (ft³)' }, { key: 'gal', label: '加仑 (gal)' }]} 
            state={volume}
            handler={convertVolume}
          />
        </div>
      </Card>
    </div>
  )
}

const UnitGroup = ({ title, units, state, handler }: any) => (
  <div className="space-y-4">
    <h3 className="font-bold text-gray-700 text-sm">{title}</h3>
    <div className="space-y-3">
      {units.map((u: any) => (
        <div key={u.key} className="flex items-center gap-3">
          <label className="w-24 text-sm text-gray-600">{u.label}</label>
          <Input type="number" value={state[u.key]} onChange={(e: any) => handler(u.key, e.target.value)} />
        </div>
      ))}
    </div>
  </div>
)

export default UnitConverterPage
