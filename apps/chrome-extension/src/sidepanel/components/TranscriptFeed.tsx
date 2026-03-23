import { useEffect, useRef } from 'react'
import type { MeetingTranscription } from '../../types'

interface Props {
  transcriptions: MeetingTranscription[]
  liveText: string        // partial tokens not yet finalized
  recording: boolean
}

export function TranscriptFeed({ transcriptions, liveText, recording }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcriptions, liveText])

  if (transcriptions.length === 0 && !liveText) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-[rgb(var(--muted-foreground))]">
        {recording ? 'Listening…' : 'No transcript yet.'}
      </div>
    )
  }

  return (
    <div className="space-y-1 text-xs font-mono leading-relaxed">
      {transcriptions.map((t) => (
        <div key={t.id} className="flex gap-2">
          <span className="text-[rgb(var(--primary))] shrink-0 w-20 truncate">
            {t.speaker_label ?? `Spk ${t.speaker_id ?? '?'}`}
          </span>
          <span>{t.text}</span>
        </div>
      ))}
      {liveText && (
        <div className="flex gap-2 opacity-50 italic">
          <span className="text-[rgb(var(--primary))] shrink-0 w-20">…</span>
          <span>{liveText}</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
