// The rules for the Android install banner (components/InstallBanner.tsx).
// Pure, so they can be tested without a browser.

/** Days the banner stays away after the close button. */
export const INSTALL_BANNER_SNOOZE_DAYS = 30

/** The banner shows from this visit on. A first visit is for playing. */
export const INSTALL_BANNER_FROM_VISIT = 2

export const INSTALL_VISITS_KEY = 'pip.install.visits'
export const INSTALL_DISMISSED_KEY = 'pip.install.dismissedAt'

/**
 * Where the banner may show: the landing page, the lobby and the reading
 * pages. Never a table, a drill, a lesson on the felt, or the welcome steps.
 * An allowlist, so a new table route is excluded without anyone remembering.
 */
const ALLOWED = [
  /^\/$/,
  /^\/game\/?$/,
  /^\/learn(\/|$)/,
  /^\/blog(\/|$)/,
  /^\/poker-odds-calculator\/?$/,
  /^\/play-poker-free-no-signup\/?$/,
  /^\/membership\/?$/,
  /^\/stats\/?$/,
  /^\/support\/?$/,
  /^\/credits\/?$/,
]

export function installBannerRoute(pathname: string): boolean {
  return ALLOWED.some((r) => r.test(pathname))
}

/** Whether a returning player should see the banner, given what was stored. */
export function installBannerDue(visits: number, dismissedAt: number | null, now: number): boolean {
  if (visits < INSTALL_BANNER_FROM_VISIT) return false
  if (dismissedAt === null) return true
  return now - dismissedAt >= INSTALL_BANNER_SNOOZE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Catches Chrome's install offer as early as the page allows, before React
 * loads: the event can fire before hydration and is not sent twice. It holds
 * the event on `window.__pipInstall`, stops Chrome's own mini-infobar (so
 * nothing appears mid-hand), and counts one visit per tab session.
 */
export const INSTALL_BOOT_SCRIPT = `(function(){try{if(!sessionStorage.getItem('pip.install.counted')){sessionStorage.setItem('pip.install.counted','1');var v=+(localStorage.getItem('${INSTALL_VISITS_KEY}')||0);localStorage.setItem('${INSTALL_VISITS_KEY}',String(v+1))}}catch(e){}window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pipInstall=e;window.dispatchEvent(new Event('pip-install-change'))});window.addEventListener('appinstalled',function(){window.__pipInstall=null;window.__pipInstalled=true;window.dispatchEvent(new Event('pip-install-change'))})})()`
