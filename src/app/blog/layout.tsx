import type { Metadata } from 'next'
import { APP_BANNER } from '@/config/site'

// The blog and every post carry Safari's app banner, like the Android one
// (installBannerRoute). Nothing else; each post keeps its own metadata.
export const metadata: Metadata = { ...APP_BANNER }

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
