import { ThemeToggle } from '@/components/theme-toggle'
import { ChatPanel } from '@/components/chat-panel'
import Link from 'next/link'
import { ArrowLeft, Settings } from 'lucide-react'

export default async function EmployeePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const name = params.id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-[rgb(var(--muted))] transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-8 h-8 rounded-full bg-teal-600 dark:bg-teal-400 flex items-center justify-center text-white dark:text-teal-950 font-semibold text-sm">
            {name.split(' ').map(w => w[0]).join('')}
          </div>
          <span className="font-semibold">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/employees/${params.id}/config`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgb(var(--border))] text-sm hover:border-[rgb(var(--primary))] transition-colors"
          >
            <Settings size={14} />
            Config
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <ChatPanel employeeId={params.id} />
    </div>
  )
}
