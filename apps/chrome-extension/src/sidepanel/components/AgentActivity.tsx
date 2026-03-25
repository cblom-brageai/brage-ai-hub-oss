import type { MeetingDecision, MeetingQAPair, MeetingAgendaStatus } from '../../types'
import { CheckCircle, MessageSquare, ListChecks } from 'lucide-react'

interface Props {
  decisions: MeetingDecision[]
  qaPairs: MeetingQAPair[]
  agendaStatus: MeetingAgendaStatus[]
}

export function AgentActivity({ decisions, qaPairs, agendaStatus }: Props) {
  const hasActivity = decisions.length > 0 || qaPairs.length > 0 || agendaStatus.length > 0

  if (!hasActivity) {
    return (
      <p className="text-xs text-[rgb(var(--muted-foreground))] text-center py-4">
        Agent activity will appear here.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Decisions */}
      {decisions.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle size={11} className="text-[rgb(var(--primary))]" />
            <span className="text-xs font-semibold text-[rgb(var(--primary))]">Decisions</span>
          </div>
          <div className="space-y-1.5">
            {decisions.slice(0, 5).map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2"
              >
                <p className="text-xs">{d.decision_text}</p>
                {d.context_quote && (
                  <p className="text-xs text-[rgb(var(--muted-foreground))] italic mt-1 line-clamp-1">
                    "{d.context_quote}"
                  </p>
                )}
              </div>
            ))}
            {decisions.length > 5 && (
              <p className="text-xs text-[rgb(var(--muted-foreground))] pl-1">
                +{decisions.length - 5} more
              </p>
            )}
          </div>
        </section>
      )}

      {/* Agenda */}
      {agendaStatus.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ListChecks size={11} className="text-[rgb(var(--primary))]" />
            <span className="text-xs font-semibold text-[rgb(var(--primary))]">Agenda</span>
          </div>
          <div className="space-y-1">
            {agendaStatus.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    a.status === 'completed' ? 'bg-green-400'
                    : a.status === 'in_progress' ? 'bg-blue-400'
                    : 'bg-[rgb(var(--muted-foreground))]'
                  }`}
                />
                <span
                  className={
                    a.status === 'completed' ? 'line-through text-[rgb(var(--muted-foreground))]'
                    : a.status === 'in_progress' ? 'text-blue-400'
                    : 'text-[rgb(var(--muted-foreground))]'
                  }
                >
                  {a.agenda_item_text}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Q&A */}
      {qaPairs.filter((q) => q.answered).length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare size={11} className="text-[rgb(var(--primary))]" />
            <span className="text-xs font-semibold text-[rgb(var(--primary))]">Q&amp;A</span>
          </div>
          <div className="space-y-2">
            {qaPairs
              .filter((q) => q.answered)
              .slice(-3)
              .map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 space-y-1"
                >
                  <p className="text-xs font-medium">Q: {q.question_text}</p>
                  <p className="text-xs text-[rgb(var(--muted-foreground))] line-clamp-2">
                    {q.answer_text}
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
