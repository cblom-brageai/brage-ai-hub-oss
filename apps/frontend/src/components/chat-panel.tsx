'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Check, X, RotateCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface PendingApproval {
  reason?: string
  draft_output?: string
}

interface ChatPanelProps {
  employeeId: string
}

const newThreadId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export function ChatPanel({ employeeId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // One LangGraph thread per panel: the agent remembers earlier turns until "New conversation".
  const [threadId, setThreadId] = useState<string>(newThreadId)
  const [pending, setPending] = useState<PendingApproval | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  const pushAssistant = (content: string) =>
    setMessages((prev) => [...prev, { role: 'assistant', content, timestamp: new Date() }])

  const handleResponse = (data: { response: string; pending_approval?: boolean; interrupt?: PendingApproval }) => {
    pushAssistant(data.response)
    setPending(data.pending_approval ? data.interrupt ?? {} : null)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }])
    setLoading(true)

    try {
      const res = await fetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          pending
            ? { employee_id: employeeId, resume: true, thread_id: threadId, approved: true, feedback: text }
            : { employee_id: employeeId, message: text, thread_id: threadId }
        ),
      })
      handleResponse(await res.json())
    } catch {
      pushAssistant('Error connecting to agent.')
    } finally {
      setLoading(false)
    }
  }

  const decide = async (approved: boolean) => {
    if (loading) return
    const feedback = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `${approved ? 'Approved' : 'Rejected'}${feedback ? `: ${feedback}` : ''}`, timestamp: new Date() },
    ])
    setLoading(true)
    try {
      const res = await fetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, resume: true, thread_id: threadId, approved, feedback }),
      })
      handleResponse(await res.json())
    } catch {
      pushAssistant('Error connecting to agent.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setMessages([])
    setPending(null)
    setThreadId(newThreadId())
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-[rgb(var(--muted-foreground))] mt-16">
            <p className="text-lg font-medium mb-2">Start a conversation</p>
            <p className="text-sm">Assign a task or ask a question.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-tr-sm'
                  : 'bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {pending && !loading && (
          <div className="border border-[rgb(var(--border))] rounded-2xl p-4 text-sm space-y-3">
            <p className="font-medium">The employee is waiting for your approval{pending.reason ? `: ${pending.reason}` : ''}.</p>
            <p className="text-[rgb(var(--muted-foreground))]">
              Approve to let it continue, reject to stop it, or type feedback below before deciding.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => decide(true)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90"
              >
                <Check size={14} /> Approve
              </button>
              <button
                onClick={() => decide(false)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]"
              >
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[rgb(var(--muted))] px-4 py-3 rounded-2xl rounded-tl-sm">
              <Loader2 size={16} className="animate-spin text-[rgb(var(--primary))]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={reset}
          title="New conversation"
          className="px-3 py-3 rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
        >
          <RotateCcw size={16} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={pending ? 'Feedback for the employee (optional)…' : 'Assign a task or ask a question…'}
          className="flex-1 px-4 py-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] placeholder-[rgb(var(--muted-foreground))] focus:outline-none focus:border-[rgb(var(--primary))] transition-colors text-sm"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-3 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
