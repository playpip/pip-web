import type { Metadata } from 'next'
import { A, Item, LegalPage, List, Section } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { EQUITY_SAMPLE, HAND_LINK_SAMPLE } from '@/config/landingMocks'
import { encodeHand } from '@/lib/handLink'

const post = BLOG_POSTS.find((p) => p.slug === 'landing-page-mockups')!

// The post quotes the length of a shared hand. Computing it from the hand the
// landing page actually pictures is the only version of that sentence this post
// is entitled to write.
const token = encodeHand(HAND_LINK_SAMPLE)
const handUrlLength = `playpip.io/hand#${token}`.length

export const metadata: Metadata = postMetadata(post)

/** A block of monospaced lines, for the bits that are output rather than prose. */
function Block({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        <code>{head}</code>
      </p>
      <p className="mt-2 text-xs leading-relaxed">{children}</p>
    </div>
  )
}

export default function LandingPageMockupsPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="Four cards, and a comment at the top of the file">
        <p>
          Our home page has four feature cards. Each one carries a small picture of something the
          game produces: the line you copy after playing the Daily, a shared hand&rsquo;s link, the
          win percentage that sits at the table, an avatar with a fan of card backs. They are not
          images. They are components, laid out in the same design system as the real thing and
          rendered live on the page, which is why they look right.
        </p>
        <p>
          The file they live in opens with a comment saying that nothing on the page is a mock-up:
          what you see here is what you get at the table. That sentence was written when it was
          true. It stayed in the file for four months, during which three of the four cards drifted
          away from the product, and the test suite was green every day of it.
        </p>
        <p>
          The one that did not drift is the difference. It maps over the same config the game reads,
          so there was nothing in it to get wrong. The other three were typed out by hand next to
          the code that produces the real version.
        </p>
      </Section>

      <Section title="One: the share line with the share missing">
        <p>
          The Daily card sells the loop. Everyone plays the identical shuffle, so the result line is
          worth pasting somewhere, and the app appends <code>playpip.io/daily</code> to it so
          whoever reads it can go and play the same deal.
        </p>
        <p>
          The card drew that line by hand, from before the address existed. So the card whose entire
          argument is the share loop displayed the version of the line with the loop cut off, for
          the month after we shipped it. Not a wrong number. The missing part was the part that made
          it a mechanism.
        </p>
        <p>
          The fix is one line: call <code>dailyShareText</code>, the function the app shares with,
          with fixed arguments. The card now cannot show a line the app would not produce, because
          it is not drawing a line, it is asking for one.
        </p>
      </Section>

      <Section title="Two: a link that looked like somebody else's database">
        <p>
          The second card says a shared hand needs no server and no account, because the whole hand
          is folded into the URL fragment. It illustrated that with{' '}
          <code>playpip.io/hand#kQyJ3v&hellip;</code>.
        </p>
        <p>
          Six characters and an ellipsis. That is a perfectly normal-looking link, which is the
          problem: it is what a link looks like when it points at a row in somebody&rsquo;s
          database. Short opaque token, server on the other end, gone when the company folds. The
          picture contradicted the claim it was there to support, and it did it in the visual
          grammar everyone already reads fluently.
        </p>
        <p>
          A real one is not like that. We encode the hand as JSON and base64url it, so the length is
          the hand: every action, every board card, every name, every reveal. The hand now on the
          card is a six-handed pot that reaches showdown, and it is {handUrlLength} characters of
          URL.
        </p>
        <Block head="the card, at build time">
          <code>
            playpip.io/hand#{token.slice(0, 24)}
            &hellip; ({handUrlLength} characters)
          </code>
        </Block>
        <p>
          {handUrlLength} characters is not elegant and we are not going to pretend otherwise. It is
          also the entire point. You can read the hand out of the link with a base64 decoder and no
          permission from us, and nothing we do later takes a hand away from someone who has the
          URL. Both numbers in this paragraph are the length of the string in the block above it,
          because the page computes them at build time. Anything else would be a fourth hand-typed
          claim in a post about hand-typed claims.
        </p>
      </Section>

      <Section title="Three: a phrase the game has never said">
        <p>
          The third card shows the ambient equity read: how often you win this hand from here,
          sitting quietly at the edge of the table. The hand-typed version said{' '}
          <code>Top pair, good kicker</code> over <code>72%</code>, with{' '}
          <code>ahead of 4 in 5 hands</code> underneath.
        </p>
        <p>Three problems, and only the first is the kind you would call a bug.</p>
        <List>
          <Item>
            <strong>The game has never emitted that label.</strong> The readout calls{' '}
            <code>evaluateHand(hole, community).name</code> and prints whatever comes back, which
            for ace-king on an ace-high flop is the word <code>Pair</code>. Flat, and a bit
            deflating, and what the product says. Our evaluator also calls a royal flush a{' '}
            <A href="/blog/pokersolver-undocumented">Straight Flush</A>, so this is not the first
            time its naming has surprised us.
          </Item>
          <Item>
            <strong>72% and four in five are two answers to one question.</strong> Four in five is
            80%. Whichever was right, the box printed a number and then restated it as a different
            number, eight points away, in the next line.
          </Item>
          <Item>
            <strong>Neither figure came from a hand.</strong> There was no spot behind the card, so
            there was nothing either number could be checked against. A percentage nobody can
            reproduce is decoration in the shape of evidence.
          </Item>
        </List>
        <p>
          The card now names its spot: ace-king on ace-nine-four, three opponents still in. The
          label is what <code>evaluateHand</code> returns for it. The percentage is{' '}
          {EQUITY_SAMPLE.winPct}%, which is where the equity lands (70.20% over 20 runs of 20,000
          hands, standard deviation 0.39). The sentence restating it in words is gone, because that
          sentence was a second claim with nothing under it.
        </p>
      </Section>

      <Section title="Why the suite stayed green">
        <p>
          We have a lot of tests about claims. One walks every page looking for absolutes about
          money that a paid tier would falsify, because we shipped two of those and served them for
          sixteen days. One fails if the list of paid drills drifts from the code. We are, if
          anything, fussy about this.
        </p>
        <p>
          Every one of them reads <code>src/lib</code> or <code>src/app</code>. None of them had any
          concept that a component in the marketing folder could be making a factual claim about the
          product, because it does not look like a claim. It looks like layout. A sentence saying
          &ldquo;your shared hand fits in a URL&rdquo; is obviously a claim and gets checked; a{' '}
          <code>&lt;span&gt;</code> containing a short fake URL says the same thing more
          persuasively and gets read as design.
        </p>
        <p>
          That is the generalisable bit, and we do not think it is specific to us. If your marketing
          page draws your product&rsquo;s output rather than screenshotting it, you have written
          claims in a file nobody is checking, in a format that survives every rename and refactor
          because nothing imports it.
        </p>
      </Section>

      <Section title="The rule we ended up with">
        <p>Two ways to draw your own output, and one of them has to be true by construction.</p>
        <List>
          <Item>
            <strong>Call the function.</strong> If something real produces the string, the card asks
            it for the string with fixed arguments. The Daily line and the hand link both do this
            now. This is the better option and it is usually available.
          </Item>
          <Item>
            <strong>Or make a test recompute it.</strong> Sometimes calling the function is a bad
            trade: the equity read would drag the hand evaluator and a Monte-Carlo run into the
            bundle for one card. So the inputs and the expected numbers sit in a config file, the
            page renders the constants, and a test runs the real thing against them and fails on a
            gap of more than a point.
          </Item>
        </List>
        <p>
          The tests are in <code>tests/landingMocks.test.ts</code>. One of them greps the landing
          page for a typed-out hand link and fails if it finds one, which caught its own author
          within a minute: we had quoted the old six-character link in a code comment explaining why
          it was wrong.
        </p>
        <p>
          There is a fourth card we have not mentioned. It draws a face and three card backs by
          mapping over the cast and the deck config, which is the same config the game maps over. It
          has been correct since the day it was written, and nobody has ever had to think about it.
          That is the whole argument.
        </p>
      </Section>
    </LegalPage>
  )
}
