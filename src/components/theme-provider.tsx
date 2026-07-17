'use client'

// Pip's own tiny theme system (light / dark / system, class-based, persisted).
// We used next-themes, but it injects its no-flash <script> from a client
// component, which React 19 now flags in dev ("scripts inside components are
// never executed…"). The split that avoids the warning entirely:
//   - the no-flash boot script renders from the SERVER layout (app/layout.tsx),
//     so the class is set before first paint with no client-rendered <script>;
//   - this provider owns the state afterwards.
// Storage key stays "theme" so existing users' choice carries over.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME: Theme = 'dark'

interface ThemeContextValue {
  theme: Theme
  /** The theme actually on screen — 'system' resolved to light/dark. */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  resolvedTheme: 'dark',
  setTheme: () => {},
})

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

const readStored = (): Theme => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Track the OS preference while 'system' is (or becomes) selected.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Mirror the resolved theme onto <html> (the boot script did first paint).
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove(resolvedTheme === 'dark' ? 'light' : 'dark')
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    // Suppress colour transitions for the flip, so the whole page snaps at once.
    const css = document.createElement('style')
    css.appendChild(document.createTextNode('*,*::before,*::after{transition:none!important}'))
    document.head.appendChild(css)
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    window.getComputedStyle(document.body)
    setTimeout(() => document.head.removeChild(css), 1)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * The no-flash boot: sets the theme class before first paint. Must be rendered
 * as an inline <script> by the SERVER layout — that's what keeps React's
 * client-script warning away. Mirrors readStored + system resolution above.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='light'&&t!=='dark'&&t!=='system')t='${DEFAULT_THEME}';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.remove(d?'light':'dark');r.classList.add(d?'dark':'light');r.style.colorScheme=d?'dark':'light'}catch(e){}})()`
