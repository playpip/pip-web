import { SIDE_TABLES } from '@/config/venues'
import { VenueBrowser } from '@/components/menu/VenueBrowser'

// Side tables — format twists off the main ladder.
export default function Page() {
  return (
    <VenueBrowser
      title="Side Tables"
      subtitle="The same game with the screws turned — turbos, deep stacks, heads-up, and a price on every head."
      venues={SIDE_TABLES}
    />
  )
}
