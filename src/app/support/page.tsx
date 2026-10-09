import type { Metadata } from 'next'
import { A, Item, LegalPage, List, Section } from '@/components/marketing/LegalPage'
import { contentAlternates, contentSocial } from '@/config/site'

const DESCRIPTION =
  'How to reach us, manage or cancel a membership, move your progress and delete an account.'

export const metadata: Metadata = {
  title: 'Support · Pip',
  description: DESCRIPTION,
  alternates: contentAlternates('/support'),
  ...contentSocial({
    path: '/support',
    title: 'Support',
    description: DESCRIPTION,
    type: 'website',
  }),
}

// The App Store listing's support URL points here (mobile/store), so this is
// the page a player lands on from "App Support". Plain answers to the things
// people actually write in about, and a way to write in.
export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="October 2026">
      <Section title="Get in touch">
        <p>
          Email <A href="mailto:hello@playpip.io">hello@playpip.io</A>. A person reads every one. If
          something is broken, say what you were doing and on which device, and a screenshot helps.
        </p>
      </Section>

      <Section title="Your progress">
        <p>
          Your profile lives on your device. To carry it to another one, either add a free account
          (Settings, Your account) and it syncs, or move it by hand with a code, a QR or a file
          (Settings, Your account, Carry it across by hand instead). Neither is needed to play.
        </p>
      </Section>

      <Section title="Managing a membership">
        <List>
          <Item>
            <strong>Joined on the website:</strong> Settings, Membership, Manage. That opens the
            portal, where you can cancel, change card or get an invoice.
          </Item>
          <Item>
            <strong>Joined in the iPhone app:</strong> it is billed by Apple, so it is managed in
            Apple’s settings: Settings, your name, Subscriptions. Pip’s own Settings has a button
            that takes you there.
          </Item>
          <Item>
            <strong>New phone, or reinstalled the app:</strong> sign in to the same account, then
            tap Restore purchases on the membership page.
          </Item>
        </List>
        <p>
          Cancelling stops the renewal; you stay a member until the end of the period you paid for.
          Refunds for a membership bought in the app are handled by Apple, through{' '}
          <A href="https://reportaproblem.apple.com">reportaproblem.apple.com</A>.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          Settings, Your account, Manage account, Delete my account and synced data. It deletes the
          account and the synced copy of your profile straight away. A membership bought on the
          website is cancelled with it. One bought in the app is not, because only you can cancel it
          with Apple, so cancel that first. See <A href="/privacy">privacy</A> for what is kept and
          for how long.
        </p>
      </Section>

      <Section title="The code">
        <p>
          Pip is open source, at{' '}
          <A href="https://github.com/playpip/pip-web">github.com/playpip/pip-web</A>, and bug
          reports there are welcome too.
        </p>
      </Section>
    </LegalPage>
  )
}
