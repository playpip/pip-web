import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideLink, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { Section } from '@/components/marketing/LegalPage'
import {
  FLOPS,
  FLOPS_BOARD_TRIPS,
  FLOPS_SET_OR_BETTER,
  FLOPS_WITH_YOUR_RANK,
  FLOP_OUTCOMES,
  flopShare,
  oneFlopIn,
} from '@/config/flopSet'
import { guideBySlug } from '@/config/learn'
import { contentAlternates, contentSocial } from '@/config/site'

// The first answer page: one narrow question, one number, and where the number
// came from. Deliberately not a seventh guide. The six pillars sit at search
// positions 73 to 97 because every affiliate site alive has written them; this
// is the test of whether a query nobody has bothered to answer properly is one
// a young domain can actually rank for. See marketing#83.

const guide = guideBySlug('how-often-do-you-flop-a-set')!

export const metadata: Metadata = {
  title: `${guide.metaTitle} · Pip`,
  description: guide.description,
  alternates: contentAlternates(`/learn/${guide.slug}`),
  ...contentSocial({
    path: `/learn/${guide.slug}`,
    title: guide.metaTitle,
    description: guide.description,
  }),
}

const strong = 'font-medium text-foreground'

const link =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function FlopASetAnswer() {
  const missed = FLOPS - FLOPS_SET_OR_BETTER
  return (
    <GuidePage slug="how-often-do-you-flop-a-set">
      <Lead>
        <p>
          <strong className={strong}>About 11.8% of the time.</strong> You are dealt a pocket pair,
          the flop comes down, and roughly one flop in {oneFlopIn(FLOPS_WITH_YOUR_RANK)} contains
          one of the two remaining cards of your rank.
        </p>
        <p>
          That is the answer, and it is the one every poker site gives. It is also counting the
          wrong thing, by a small and quite interesting amount.
        </p>
      </Lead>

      <Section title={`All ${FLOPS.toLocaleString('en-GB')} flops, graded`}>
        <p>
          Your two cards are gone, so 50 are unseen and there are exactly{' '}
          {FLOPS.toLocaleString('en-GB')} flops you can meet. That is a small enough number to look
          at all of them, which is what the table below is: every flop, graded by the same code that
          decides who wins a hand on Pip.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">You have</th>
              <th scope="col">Which is</th>
              <th scope="col">Flops</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {FLOP_OUTCOMES.map((row) => (
              <tr key={row.hand}>
                <td className={`whitespace-nowrap ${strong}`}>{row.hand}</td>
                <td>{row.what}</td>
                <td className="whitespace-nowrap">{row.flops.toLocaleString('en-GB')}</td>
                <td className="whitespace-nowrap">{flopShare(row.flops)}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          The counts add to {FLOPS.toLocaleString('en-GB')}, which is the only check worth having on
          a table like this one. Five percentages are five separate chances to be wrong and nothing
          can catch any of them. Five counts have to add up.
        </p>
      </Section>

      <Section title="The famous number counts cards, not hands">
        <p>
          11.8% is the chance that at least one of the two remaining cards of your rank turns up in
          the flop:{' '}
          <strong className={strong}>{FLOPS_WITH_YOUR_RANK.toLocaleString('en-GB')}</strong> flops
          of {FLOPS.toLocaleString('en-GB')}. That is the right way to count if the question is
          whether you hit.
        </p>
        <p>
          Grade the hands instead and the answer is{' '}
          <strong className={strong}>{FLOPS_SET_OR_BETTER.toLocaleString('en-GB')}</strong> flops
          where you hold three of a kind or better, which is {flopShare(FLOPS_SET_OR_BETTER)}{' '}
          exactly. Not rounded to it.
        </p>
        <p>
          The gap is {FLOPS_BOARD_TRIPS} flops, and they are the ones where the board comes three of
          a kind on its own. K-K-K in front of your pocket sevens is a full house, and there is not
          a seven in it. You did not hit anything and you are holding the{' '}
          <GuideLink slug="hand-rankings">fourth best hand in poker</GuideLink>.
        </p>
        <p>
          At the table this is a rounding error. It is on the page because it is the clean small
          version of a thing that is generally true, and expensive when it is not:{' '}
          <strong className={strong}>
            “did my card come” and “what have I got” are different questions
          </strong>
          , and only the second one wins the pot.
        </p>
      </Section>

      <Section title="What it means while you are holding one">
        <p>
          The other side of {flopShare(FLOPS_SET_OR_BETTER)} is{' '}
          <strong className={strong}>{flopShare(missed)}</strong>, also exact:{' '}
          {missed.toLocaleString('en-GB')} flops leave you with the pair you were dealt and nothing
          more. Seven times in eight, the flop is a disappointment.
        </p>
        <p>
          Which is the whole reason the advice about pocket pairs is always about the price rather
          than the pair. You are paying, before the flop, for something that arrives one time in{' '}
          {oneFlopIn(FLOPS_SET_OR_BETTER)}. What makes that worth paying is how much you stand to
          win on the times it does arrive, which is the implied half of{' '}
          <GuideLink slug="pot-odds">pot odds</GuideLink>. The number on this page is the input to
          that decision, not the decision.
        </p>
        <p>
          And it is the same number for every pocket pair. Deuces flop sets exactly as often as aces
          do. What changes is what happens on the {flopShare(missed)}, which is what the{' '}
          <GuideLink slug="starting-hands">starting hand chart</GuideLink> is really about.
        </p>
      </Section>

      <Section title="Where these numbers come from">
        <p>
          They are not quoted from anywhere.{' '}
          <Link
            href="https://github.com/playpip/pip-web/blob/main/tests/flopSet.test.ts"
            className={link}
          >
            A test in the repo
          </Link>{' '}
          deals every one of the {FLOPS.toLocaleString('en-GB')} flops from the same 52-card deck
          the game deals from, hands each one to the same evaluator that settles a real pot on Pip,
          and checks the five counts above. It does it for all thirteen ranks, because “the same for
          every pair” is a claim too, and it is the one a reader is most likely to doubt.
        </p>
        <p>
          The counts are typed out by hand in the source rather than computed, which looks like the
          wrong way round and is not.{' '}
          <strong className={strong}>
            A number worked out by the evaluator cannot disagree with the evaluator.
          </strong>{' '}
          Written down first, it can be wrong, and the build says so.
        </p>
      </Section>

      <TryIt>
        <p>
          Pocket pairs are exactly one deal in seventeen, so waiting for{' '}
          {FLOPS.toLocaleString('en-GB')} of them is not a plan. Deal yourself some instead.
        </p>
        <p>Free, no signup, nothing to install.</p>
      </TryIt>
    </GuidePage>
  )
}
