import type { Metadata } from 'next'
import { LegalPage, Section, A } from '@/components/marketing/LegalPage'
import { contentAlternates } from '@/config/site'
import { MEMBERSHIP_PRICE } from '@/config/membership'

export const metadata: Metadata = {
  title: 'Terms · Pip',
  description: 'The short, human rules for using Pip — free, play money, open source.',
  alternates: contentAlternates('/terms'),
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="September 2026">
      <Section title="The short version">
        <p>
          The plain-English rules for using Pip at <A href="https://playpip.io">playpip.io</A>. No
          surprises: Pip is free, play money, and open source.
        </p>
      </Section>

      <Section title="It's play money — not gambling">
        <p>
          Pip is a single-player poker game played with pretend chips. There is no real money
          anywhere in it: nothing to deposit, nothing to win, no prizes, nothing to cash out. Your
          “Roll” is a number in your browser, not a balance. Pip is not a gambling service and is
          not a way to gamble.
        </p>
      </Section>

      <Section title="As is">
        <p>
          The game is free and provided as-is. We build it with care, but we can’t promise it will
          always work perfectly, never lose your local data, or suit any particular purpose. To the
          extent the law allows, we’re not liable for anything that comes of using it. If your
          progress matters to you, back your profile up from Settings. Unless you switch sync on, it
          lives only on your device, so it’s yours to keep and yours to lose.
        </p>
      </Section>

      {/* This section did not exist while "Pip is free and provided as-is" sat
          in the one above, which was true and would have become false and
          consumer-relied-upon on the day a first payment landed. It is here
          before checkout is, on purpose. */}
      <Section title="The membership">
        <p>
          Pip is free to play and always will be: the ten-venue ladder, the Rail&rsquo;s cash games,
          the Daily and the freeroll stay free forever, and you can never be chip-blocked,
          timer-blocked or ad-blocked out of any of them. There is also an optional paid{' '}
          <A href="/membership">membership</A>, which adds the side tables, the games that
          aren&rsquo;t Hold&rsquo;em and the tools beside them. It costs {MEMBERSHIP_PRICE.monthly}{' '}
          a month or {MEMBERSHIP_PRICE.annual} a year in pounds, and a fixed price of its own in US
          dollars, euros and Chinese yuan — the prices for each are on the{' '}
          <A href="/membership">membership page</A>. You are charged in the currency you chose, at
          the price shown, and never converted at checkout. Every price includes any tax that
          applies where you are, so the amount shown is the amount charged.
        </p>
        <p>
          <strong>It renews automatically</strong> — monthly or annually, matching what you chose —
          until you cancel. You can cancel at any time from Settings, and we will not ask you why.
        </p>
        <p>
          <strong>
            Cancelling takes effect at the end of the period you have already paid for
          </strong>
          , and you keep your membership until then. An annual membership that you cancel partway
          through runs to the end of that year and{' '}
          <strong>is not refunded for the unused months</strong>. We are saying that plainly because
          “cancel any time” is easy to read as “and get my money back”, and it does not mean that.
        </p>
        <p>
          When you join, you are asking us to give you access straight away rather than after a
          waiting period, and you will be asked to confirm that at the checkout. Nothing on this
          page affects any rights you have under consumer law that cannot be signed away.
        </p>
        <p>
          Payments are handled by <A href="https://stripe.com">Stripe</A>. We never see or store
          your card number. Play-money chips are not involved in any of this: they are not a
          currency, they cannot be bought, and they cannot be cashed out.
        </p>
      </Section>

      <Section title="Play nice">
        <p>
          Use Pip for what it’s for. Don’t attack or disrupt the service, or try to break it for
          other people. That’s about the whole of it.
        </p>
      </Section>

      <Section title="The code">
        <p>
          Pip’s source is public at{' '}
          <A href="https://github.com/playpip/pip-web">github.com/playpip/pip-web</A> — read it,
          learn from it, check our claims. These terms cover the game as hosted at playpip.io; the
          code itself is released under the MIT licence in the repository.
        </p>
      </Section>

      <Section title="Age">
        <p>Pip is intended for people 13 and over.</p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms as Pip grows. We’ll change the date at the top when we do. Keep
          using Pip and you’re fine with the current version.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, or something not right? Open an issue at{' '}
          <A href="https://github.com/playpip/pip-web">github.com/playpip/pip-web</A>.
        </p>
      </Section>
    </LegalPage>
  )
}
