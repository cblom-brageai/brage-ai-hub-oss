'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, FileText, CheckSquare, BarChart2, Calendar } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const NAV_ITEMS = [
  { href: '/',          label: 'Employees', icon: Users },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/tasks',     label: 'Tasks',     icon: CheckSquare },
  { href: '/admin/meetings', label: 'Meetings', icon: Calendar },
  { href: '/admin',     label: 'Admin',     icon: BarChart2 },
]

export function NavHeader() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="border-b border-[rgb(var(--border))] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-[rgb(var(--primary-foreground))] font-bold text-sm">B</span>
        </div>
        <span className="font-semibold text-lg">Brage AI Hub</span>
      </div>

      <nav className="hidden md:flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isActive(href)
                ? 'font-medium bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]'
                : 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))]'
            }`}
          >
            <Icon size={13} />
            {label}
          </Link>
        ))}
      </nav>

      <ThemeToggle />
    </header>
  )
}
