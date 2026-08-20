import type { Metadata } from 'next'
import { A, Item, LegalPage, List, Section } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import {
  PROOF_DAILY_NUMBER,
  PROOF_DATE,
  PROOF_DAY_SEED,
  PROOF_DECK,
  PROOF_HAND_SEED,
  PROOF_PREVIEW_CARDS,
  SNIPPET,
} from '@/config/dailyProof'

const post = BLOG_POSTS.find((p) => p.slug === 'verify-todays-deal')!

export const metadata: Metadata = postMetadata(post)

const preview = PROOF_DECK.split(' ').slice(0, PROOF_PREVIEW_CARDS).join(' ')

export default function VerifyTodaysDealPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          Everyone who plays the Daily on a given day gets the same shuffle, in the same order, on
          the same cards. That is not a promise about our integrity. It is a fact about a function,
          and you can check it without asking us and without reading our code.
        </p>
        <p>
          Below is the whole chain from the date to the deck, in six steps, then a snippet that runs
          anywhere JavaScript runs. Then the answer for {formatPostDate(PROOF_DATE)}, so there is
          something to compare against when you run it.
        </p>
      </Section>

      <Section title="From the date to the deck">
        <List>
          <Item>
            The day key is the UTC date written as <code>{PROOF_DATE}</code>.
          </Item>
          <Item>
            The day&rsquo;s seed is{' '}
            <A href="https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function">
              FNV-1a
            </A>{' '}
            over that string, kept as a 32-bit unsigned integer.
          </Item>
          <Item>
            Hand number N gets its own seed:{' '}
            <code>(daySeed XOR imul(N, 0x9e3779b9)) &gt;&gt;&gt; 0</code>, counting the first hand
            as 1. That is why refreshing the page mid-tournament re-deals the hand you were on
            rather than a new one.
          </Item>
          <Item>
            The generator is{' '}
            <A href="https://github.com/bryc/code/blob/master/jshash/PRNGs.md">mulberry32</A> over
            that seed. Small, ordinary, not ours.
          </Item>
          <Item>
            The deck starts in order: ranks 2 through A, and within each rank the suits go clubs,
            diamonds, hearts, spades. So <code>2c 2d 2h 2s 3c</code> and on.
          </Item>
          <Item>
            The shuffle is one pass of Fisher-Yates from the top down: for i from 51 to 1, swap
            position i with <code>floor(rng() * (i + 1))</code>.
          </Item>
        </List>
        <p>
          None of those steps is clever, and that is the point. There is nothing in there for a
          house edge to hide in, because there is no house and nowhere to hide it.
        </p>
      </Section>

      <Section title="The snippet">
        <p>
          Paste this into a browser console, or into <code>node</code>, or into anything else that
          runs JavaScript. It imports nothing and it does not talk to us.
        </p>
        <pre className="-mx-6 mt-4 overflow-x-auto px-6 md:mx-0 md:rounded-2xl md:border md:border-foreground/10 md:bg-foreground/[0.03] md:px-4 md:py-3">
          <code className="text-muted-foreground text-xs leading-relaxed">{SNIPPET}</code>
        </pre>
      </Section>

      <Section title="What it should print">
        <p>
          For {formatPostDate(PROOF_DATE)}, which was Daily #{PROOF_DAILY_NUMBER}, the day seed is{' '}
          <code>{PROOF_DAY_SEED}</code>, the first hand&rsquo;s seed is{' '}
          <code>{PROOF_HAND_SEED}</code>, and the first {PROOF_PREVIEW_CARDS} cards off the top are:
        </p>
        <p>
          <code>{preview}</code>
        </p>
        <p>All 52, in dealt order:</p>
        <pre className="-mx-6 mt-4 overflow-x-auto px-6 md:mx-0 md:rounded-2xl md:border md:border-foreground/10 md:bg-foreground/[0.03] md:px-4 md:py-3">
          <code className="text-muted-foreground text-xs leading-relaxed">{PROOF_DECK}</code>
        </pre>
        <p>
          Change the date at the top of the snippet and you get any other day, including the one you
          are reading this on. The date is the only input.
        </p>
      </Section>

      <Section title="What this proves, and what it does not">
        <List>
          <Item>
            It proves the deck was fixed before anyone sat down. The date decides it, so we could
            not have dealt you a worse one for playing well, and we could not have dealt ourselves a
            better one either.
          </Item>
          <Item>
            It gives you the deck, not your hand. Which cards reach which seat depends on the seat
            order and where the button is, and the snippet models neither. Claim the deck; do not
            claim the hole cards.
          </Item>
          <Item>
            Only the Daily works this way. An ordinary hand at any other table uses your
            browser&rsquo;s own randomness, with no seed, no server and nothing of ours involved.
            There is nothing to reproduce there, and we have said the opposite by accident before,
            so: not every hand, just the Daily.
          </Item>
          <Item>
            It says nothing about whether the opponents play well. That is a separate argument and
            the code for it is{' '}
            <A href="https://github.com/playpip/pip-web/tree/main/src/lib/poker">also public</A>.
          </Item>
        </List>
      </Section>

      <Section title="Why we wrote it down">
        <p>
          Every crypto casino has a page headed Provably Fair, and most of them are a badge with a
          paragraph under it about commitment to trust. We would rather hand over the arithmetic and
          let you go and check. It takes about a minute and it does not require believing us about
          anything.
        </p>
        <p>
          The code was already public, in{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/src/lib/daily.ts">one small file</A>
          , so this post is less a disclosure than a shortcut past reading it. Today&rsquo;s deal is
          at <A href="https://playpip.io/game">playpip.io</A>, and it is the same one everybody else
          got.
        </p>
      </Section>
    </LegalPage>
  )
}
