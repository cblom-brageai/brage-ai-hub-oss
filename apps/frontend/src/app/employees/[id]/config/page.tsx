'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { ArrowLeft, Save, RefreshCw, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

const CONFIG_API = process.env.NEXT_PUBLIC_CONFIG_API_URL || 'http://localhost:8090'

type MainTab = 'strategy' | 'personality' | 'agent-config' | 'skills'

const CORE_TABS: { id: MainTab; label: string; file: string }[] = [
  { id: 'strategy',     label: 'Strategy',      file: 'Strategy.md' },
  { id: 'personality',  label: 'Personality',   file: 'Personality.md' },
  { id: 'agent-config', label: 'Agent Config',  file: 'agent.config.md' },
]

const VALID_TABS: MainTab[] = ['strategy', 'personality', 'agent-config', 'skills']

function ConfigContent({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const initialTab = (() => {
    const t = searchParams.get('tab') as MainTab | null
    return t && VALID_TABS.includes(t) ? t : 'strategy'
  })()

  const [activeTab, setActiveTab] = useState<MainTab>(initialTab)
  const [coreContents, setCoreContents] = useState<Record<string, string>>({})
  const [skills, setSkills] = useState<{ name: string; last_modified: number }[]>([])
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const [skillContents, setSkillContents] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState('')
  const [newSkillName, setNewSkillName] = useState('')
  const [showNewSkill, setShowNewSkill] = useState(false)

  const showStatus = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 3000)
  }

  const loadCoreFiles = useCallback(() => {
    CORE_TABS.forEach(async (tab) => {
      const res = await fetch(`${CONFIG_API}/config/${params.id}/file/${tab.file}`)
      const data = await res.json()
      setCoreContents((prev) => ({ ...prev, [tab.id]: data.content || '' }))
    })
  }, [params.id])

  const loadSkills = useCallback(async () => {
    const res = await fetch(`${CONFIG_API}/config/${params.id}/skills`)
    const data = await res.json()
    setSkills(data)
  }, [params.id])

  useEffect(() => {
    loadCoreFiles()
    loadSkills()
  }, [loadCoreFiles, loadSkills])

  const loadSkillContent = async (skillName: string) => {
    if (skillContents[skillName] !== undefined) return
    const res = await fetch(`${CONFIG_API}/config/${params.id}/skill/${skillName}`)
    const data = await res.json()
    setSkillContents((prev) => ({ ...prev, [skillName]: data.content || '' }))
  }

  const selectSkill = async (skillName: string) => {
    setActiveSkill(skillName)
    await loadSkillContent(skillName)
  }

  const saveCore = async () => {
    const tab = CORE_TABS.find((t) => t.id === activeTab)!
    setSaving(true)
    try {
      await fetch(`${CONFIG_API}/config/${params.id}/file/${tab.file}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: coreContents[activeTab], reload: true }),
      })
      setDirty((prev) => ({ ...prev, [activeTab]: false }))
      showStatus('Saved & agent reloaded')
    } catch {
      showStatus('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveSkill = async () => {
    if (!activeSkill) return
    setSaving(true)
    try {
      await fetch(`${CONFIG_API}/config/${params.id}/skill/${activeSkill}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: skillContents[activeSkill], reload: true }),
      })
      setDirty((prev) => ({ ...prev, [`skill:${activeSkill}`]: false }))
      showStatus('Skill saved & agent reloaded')
    } catch {
      showStatus('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createSkill = async () => {
    const name = newSkillName.trim().replace(/\s+/g, '-').toLowerCase()
    const filename = name.endsWith('.md') ? name : `${name}.md`
    try {
      await fetch(`${CONFIG_API}/config/${params.id}/skill?skill_name=${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `# ${name}\n\n` }),
      })
      setNewSkillName('')
      setShowNewSkill(false)
      await loadSkills()
      setSkillContents((prev) => ({ ...prev, [filename]: `# ${name}\n\n` }))
      setActiveSkill(filename)
    } catch {
      showStatus('Failed to create skill')
    }
  }

  const deleteSkill = async (skillName: string) => {
    if (!confirm(`Delete ${skillName}?`)) return
    await fetch(`${CONFIG_API}/config/${params.id}/skill/${skillName}`, { method: 'DELETE' })
    if (activeSkill === skillName) setActiveSkill(null)
    await loadSkills()
  }

  const isSkillsTab = activeTab === 'skills'
  const currentContent = isSkillsTab
    ? (activeSkill ? skillContents[activeSkill] ?? '' : '')
    : (coreContents[activeTab] ?? '')
  const isDirty = isSkillsTab
    ? dirty[`skill:${activeSkill}`]
    : dirty[activeTab]

  const handleChange = (value: string) => {
    if (isSkillsTab && activeSkill) {
      setSkillContents((prev) => ({ ...prev, [activeSkill]: value }))
      setDirty((prev) => ({ ...prev, [`skill:${activeSkill}`]: true }))
    } else {
      setCoreContents((prev) => ({ ...prev, [activeTab]: value }))
      setDirty((prev) => ({ ...prev, [activeTab]: true }))
    }
  }

  const save = isSkillsTab ? saveSkill : saveCore

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-[rgb(var(--muted))] transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <span className="font-semibold">Config Editor</span>
          <span className="text-sm text-[rgb(var(--muted-foreground))]">— {params.id}</span>
        </div>
        <div className="flex items-center gap-3">
          {status && <span className="text-sm text-[rgb(var(--primary))]">{status}</span>}
          <button
            onClick={save}
            disabled={saving || !isDirty || (isSkillsTab && !activeSkill)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save & Reload
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main tabs */}
      <div className="border-b border-[rgb(var(--border))] px-6 flex gap-1">
        {CORE_TABS.map((tab) => (
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
        <button
          onClick={() => setActiveTab('skills')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'skills'
              ? 'border-[rgb(var(--primary))] text-[rgb(var(--primary))]'
              : 'border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
          }`}
        >
          Skills ({skills.length})
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Skills sidebar */}
        {isSkillsTab && (
          <div className="w-56 border-r border-[rgb(var(--border))] flex flex-col">
            <div className="p-3 flex items-center justify-between border-b border-[rgb(var(--border))]">
              <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted-foreground))]">Skills</span>
              <button
                onClick={() => setShowNewSkill(true)}
                className="p-1 rounded hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--primary))] transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            {showNewSkill && (
              <div className="p-2 border-b border-[rgb(var(--border))]">
                <input
                  autoFocus
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createSkill(); if (e.key === 'Escape') setShowNewSkill(false) }}
                  placeholder="skill-name"
                  className="w-full px-2 py-1 text-xs rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] focus:outline-none focus:border-[rgb(var(--primary))]"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {skills.map((skill) => (
                <div
                  key={skill.name}
                  onClick={() => selectSkill(skill.name)}
                  className={`group flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors ${
                    activeSkill === skill.name
                      ? 'bg-[rgb(var(--muted))] text-[rgb(var(--primary))]'
                      : 'hover:bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]'
                  }`}
                >
                  <span className="truncate">{skill.name.replace('.md', '')}{dirty[`skill:${skill.name}`] ? ' •' : ''}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSkill(skill.name) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-500 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {skills.length === 0 && (
                <p className="px-3 py-4 text-xs text-[rgb(var(--muted-foreground))]">No skills yet. Click + to add.</p>
              )}
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 p-4">
          {isSkillsTab && !activeSkill ? (
            <div className="h-full flex items-center justify-center text-[rgb(var(--muted-foreground))]">
              <p className="text-sm">Select a skill to edit, or click + to create one.</p>
            </div>
          ) : (
            <textarea
              value={currentContent}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full h-full min-h-[calc(100vh-180px)] p-4 font-mono text-sm rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] focus:outline-none focus:border-[rgb(var(--primary))] resize-none transition-colors"
              spellCheck={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function ConfigPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[rgb(var(--muted-foreground))]">Loading…</div>}>
      <ConfigContent params={params} />
    </Suspense>
  )
}
