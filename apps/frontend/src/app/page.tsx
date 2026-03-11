import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
            <span className="text-[rgb(var(--primary-foreground))] font-bold text-sm">B</span>
          </div>
          <span className="font-semibold text-lg">Brage AI Hub</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-2">Virtual Employees</h1>
        <p className="text-[rgb(var(--muted-foreground))] mb-8">Manage and interact with your AI team members.</p>

        <div className="grid gap-4">
          <Link
            href="/employees/marketing-manager"
            className="block p-5 rounded-xl border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] transition-colors bg-[rgb(var(--card))]"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-teal-600 dark:bg-teal-400 flex items-center justify-center text-white dark:text-teal-950 font-semibold">MM</div>
              <div>
                <div className="font-medium">Marketing Manager</div>
                <div className="text-sm text-[rgb(var(--muted-foreground))]">Campaigns · LinkedIn · Publishing Calendar</div>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
