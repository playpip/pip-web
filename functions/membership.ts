import { serveContentPage } from './_shared'

// The ninth content function. **This is markdown content negotiation, not
// billing** — two different things get called "function" in the membership
// build and conflating them is how a Stripe secret ends up on the wrong
// platform. Nothing here knows a price exists.
export const onRequestGet = serveContentPage
export const onRequestHead = serveContentPage
