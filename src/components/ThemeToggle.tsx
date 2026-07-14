'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useHydrated } from '@/lib/useHydrated'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => {
        sound.play('tap')
        setTheme(isDark ? 'light' : 'dark')
      }}
      className={cn(
        'rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground',
        className,
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Render a stable icon until hydrated to avoid a mismatch. */}
      {!hydrated ? <Sun className="size-4" /> : isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
