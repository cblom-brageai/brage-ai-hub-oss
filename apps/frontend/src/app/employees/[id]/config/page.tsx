'use client'

import { useState, useEffect } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { ArrowLeft, Save, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const CONFIG_API = process.env.NEXT_PUBLIC_CONFIG_API_URL || 'http://localhost:8090'

type Tab = 'strategy' | 'skills' | 'personality'
const TABS: { id: Tab; label: string; file: string }[] = [
  { id: 'strategy',    label: 'Strategy',    file: 'Strategy.md' },
  { id: 'skills',      label: 'Skills',      file: 'Skills.md' },
  { id: 'personality', label: 'Personality', file: 'Personality.md' },
]

export default function ConfigPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('strategy')
  const [contents, setContents] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState('')

  const currentTab = TABS.find((t) => t.id === activeTab)!

  useEffect(() => {
    TABS.forEach(async (tab) => {
      const res = await fetch(`${CONFIG_API}/config/${params.id}/file/${tab.file}`)
      const data = await res.json()
      setContents((prev) => ({ ...prev, [tab.id]: data.content }))
    })
  }, [params.id])

  const save = async () => {
    setSaving(true)
    setStatus('')
    try {
      await fetch(`${CONFIG_API}/config/${params.id}/file/${currentTab.file}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contents[activeTab], reload: true }),
      })
      setDirty((prev) => ({ ...prev, [activeTab]: false }))
      setStatus('Saved & agent reloaded')
    } catch {
      setStatus('Save failed')
    } finally {
      setSaving(false)
      setTimeout(() => setStatus(''), 3000)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/employees/${params.id}`} className="p-2 rounded-lg hover:bg-[rgb(var(--muted))] transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <span className="font-semibold">Config Editor</span>
        </div>
        <div className="flex items-center gap-3">
          {status && <span className="text-sm text-[rgb(var(--primary))]">{status}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save & Reload
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b border-[rgb(var(--border))] px-6 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[rgb(var(--primary))] text-[rgb(var(--primary))]'
                : 'border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
            }`}
          >
            {tab.label}{dirty[tab.id] ? ' •' : ''}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4">
        <textarea
          value={contents[activeTab] || ''}
          onChange={(e) => {
            setContents((prev) => ({ ...prev, [activeTab]: e.target.value }))
            setDirty((prev) => ({ ...prev, [activeTab]: true }))
          }}
          className="w-full h-full min-h-[calc(100vh-180px)] p-4 font-mono text-sm rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] focus:outline-none focus:border-[rgb(var(--primary))] resize-none transition-colors"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
