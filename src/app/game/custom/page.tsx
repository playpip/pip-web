import { TableBuilder } from '@/components/menu/TableBuilder'

// Build your own table. Reachable by everybody, dealable by members — the same
// call the member rooms make, for the same reason: you cannot want what you
// cannot see, and a builder that appears out of nowhere the day somebody joins
// is worse than one that was always there with a line explaining itself.
export default function Page() {
  return <TableBuilder />
}
