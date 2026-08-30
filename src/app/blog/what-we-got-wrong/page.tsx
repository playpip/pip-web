import type { Metadata } from 'next'
import { A, Item, LegalPage, List, Section } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { CORRECTIONS, type Correction, daysLive } from '@/config/corrections'

const post = BLOG_POSTS.find((p) => p.slug === 'what-we-got-wrong')!

export const metadata: Metadata = postMetadata(post)

const fixed = CORRECTIONS.filter((c) => c.fixedOn !== null)
const open = CORRECTIONS.filter((c) => c.fixedOn === null)
const longest = Math.max(...fixed.map((c) => daysLive(c) ?? 0))
const shortest = Math.min(...fixed.map((c) => daysLive(c) ?? 0))

function Life({ correction }: { correction: Correction }) {
  const days = daysLive(correction)
  if (correction.fixedOn === null || days === null) {
    return (
      <>
        Live from {formatPostDate(correction.liveFrom)}. <strong>Still live.</strong>
      </>
    )
  }
  return (
    <>
      Live {formatPostDate(correction.liveFrom)} to {formatPostDate(correction.fixedOn)}.{' '}
      {days === 1 ? 'One day' : `${days} days`}.
    </>
  )
}

function Entry({ correction }: { correction: Correction }) {
  return (
    <Section title={correction.where.join(', ')}>
      <p>
        <strong>It said:</strong> {correction.said}
      </p>
      <p>
        <strong>It was wrong because:</strong> {correction.wrong}
      </p>
      {correction.liveFromNote ? <p>{correction.liveFromNote}</p> : null}
      <p>
        <strong>How we caught it:</strong> {correction.caught}
      </p>
      <p>
        <Life correction={correction} />{' '}
        {/* An open row has no guard by definition: nothing is stopping a thing
            that is still happening. The guard sentence belongs to fixed rows. */}
        {correction.fixedOn === null ? null : correction.guard ? (
          <>
            The test that fails if it comes back is <code>{correction.guard}</code>.
          </>
        ) : (
          <>
            <strong>Nothing stops this one coming back.</strong>{' '}
            {correction.guardNote ?? 'We have not written the check yet.'}
          </>
        )}
      </p>
    </Section>
  )
}

export default function WhatWeGotWrongPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          Pip has been public since 25 July 2026. In that time we have published{' '}
          {CORRECTIONS.length} claims that turned out to be false, and this is all of them: what it
          said, when it went live, when the fix went live, how we found it, and the test that now
          fails if it comes back. The longest one served for {longest} days and the shortest for{' '}
          {shortest === 1 ? 'a day' : `${shortest} days`}.
        </p>
        <p>
          The reason to publish this is not modesty. It is that a page nobody checks has the same
          errors and no list of them. The figures on{' '}
          <A href="https://playpip.io/learn">our guides</A> are computed rather than typed, and
          pinned by tests that run the same engine that deals the cards, and the way you can tell we
          mean it is that it keeps catching us.
        </p>
        {open.length > 0 ? (
          <p>
            <strong>
              {open.length === 1
                ? 'One of them is still wrong'
                : `${open.length} of them are still wrong`}{' '}
              as you read this.
            </strong>{' '}
            {open.length === 1 ? 'It is' : 'They are'} first in the list, because burying{' '}
            {open.length === 1 ? 'it' : 'them'} would be the joke writing itself.
          </p>
        ) : (
          <p>
            <strong>Nothing on this list is open as you read this.</strong> One was when this went
            up on 24 August: the site was serving a build with its account system missing from it.
            That was fixed the next evening, and the row for it now carries both dates, a correction
            to the date we first printed, and no guard at all.
          </p>
        )}
      </Section>

      {open.map((correction) => (
        <Entry key={correction.id} correction={correction} />
      ))}

      {fixed.map((correction) => (
        <Entry key={correction.id} correction={correction} />
      ))}

      <Section title="Three of these are the same mistake">
        <p>
          The bet-sizing row, the rankings row and the suitedness row are one error wearing three
          hats. In each of them, every number was right. The table under the sentence was correct,
          the figures in it were computed rather than typed, and the tests covering them all passed.
          What was wrong was the sentence describing the shape of the table, sitting directly above
          it.
        </p>
        <p>
          That is the failure mode we did not design for, and it is worth naming because it is not
          obvious. A repository can check a number against the thing that produces it. It cannot
          check a claim about a table, because nothing in the repository disagrees with a claim
          about a table. Somebody has to read the sentence and then look down.
        </p>
        <p>
          The fix in each case was to make the shape itself a computed thing: the rankings page now
          derives the one place the rarity rule breaks rather than asserting it does not, and the
          bet-sizing page has a test that both columns climb rather than a sentence saying they
          diverge.
        </p>
      </Section>

      <Section title="No test has ever found one of these">
        <p>
          Worth being precise about, since the tests are the reassuring part. Not one of the errors
          above was found by a test. They were found by:
        </p>
        <List>
          <Item>reading a sentence against the table printed underneath it, three times</Item>
          <Item>reading the landing page top to bottom against what the product now does</Item>
          <Item>sweeping the blog for a fact after finding it wrong somewhere else</Item>
          <Item>
            downloading the JavaScript the live site actually serves and reading the configuration
            out of it
          </Item>
          <Item>reading this post against the live site the morning after publishing it</Item>
        </List>
        <p>
          The tests come after. Their job is that a fixed thing stays fixed, which they are good at
          and which nothing else does. But a green build tells you the code is right. It does not
          tell you that what shipped is right, and the account row is the expensive version of that
          distinction: every test passed, every build was green, every one of those builds had the
          configuration in it, and the site was serving a different build entirely.
        </p>
      </Section>

      <Section title="What this page is promising">
        <p>
          That every future one lands here too. The list is generated from a registry the test suite
          reads, so a row cannot be quietly dropped and a corrected sentence cannot creep back into
          the site without the build failing. Where a row has no guard behind it, it has to say so
          in as many words, which is why one of them does.
        </p>
        <p>
          It is not promising there will not be more. There will be. The interesting number is not{' '}
          {CORRECTIONS.length}, it is how long each one lived, and that is the number we are trying
          to push down.
        </p>
      </Section>
    </LegalPage>
  )
}
