import type { Metadata } from 'next'
import { APP_BANNER } from '@/config/site'

// Learn and every guide under it carry Safari's app banner, like the Android one
// (installBannerRoute). Nothing else; each page keeps its own metadata.
export const metadata: Metadata = { ...APP_BANNER }

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children
}
