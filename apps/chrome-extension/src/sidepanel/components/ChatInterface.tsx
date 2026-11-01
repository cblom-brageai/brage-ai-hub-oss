import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { api } from '../lib/api'
import type { MeetingQAPair } from '../../types'

interface Props {
  meetingId: string
  qaPairs: MeetingQAPair[]   // from Realtime — includes chat questions
}

export function ChatInterface({ meetingId, qaPairs }: Props) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const chatItems = qaPairs.filter((q) => q.question_source === 'chat')

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatItems])

  async function handleSend() {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)
    try {
      await api.meetings.chat(meetingId, msg)
    } catch (e) {
      console.error('Chat send failed:', e)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatItems.length === 0 ? (
          <p className="text-xs text-[rgb(var(--muted-foreground))] text-center py-6">
            Ask a question about the meeting or company knowledge.
          </p>
        ) : (
          chatItems.map((q) => (
            <div key={q.id} className="space-y-1.5">
              {/* User question */}
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-2xl rounded-tr-sm px-3 py-2 text-xs">
                  {q.question_text}
                </div>
              </div>
              {/* Agent answer */}
              {q.answered ? (
                <div className="flex justify-start">
                  <div className="max-w-[85%] bg-[rgb(var(--muted))] rounded-2xl rounded-tl-sm px-3 py-2 text-xs">
                    {q.answer_text}
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="bg-[rgb(var(--muted))] rounded-2xl rounded-tl-sm px-3 py-2">
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--muted-foreground))] animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--muted-foreground))] animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--muted-foreground))] animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[rgb(var(--border))]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask a question…"
            className="flex-1 resize-none px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-xs focus:outline-none focus:border-[rgb(var(--primary))] max-h-24"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = `${t.scrollHeight}px`
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-full bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1 pl-1">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
