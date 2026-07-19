import { VENUES } from '@/config/venues'
import { VenueBrowser } from '@/components/menu/VenueBrowser'

// The venue ladder — its own page off the main menu.
export default function Page() {
  return (
    <VenueBrowser
      title="Venues"
      subtitle="Ten rooms on one ladder. The Garage forgives; the Main Event won't."
      venues={VENUES}
      tiered
    />
  )
}
