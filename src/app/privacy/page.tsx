import type { Metadata } from 'next'
import { LegalPage, Section, List, Item, A } from '@/components/marketing/LegalPage'
import { contentAlternates } from '@/config/site'

export const metadata: Metadata = {
  title: 'Privacy · Pip',
  description:
    'What Pip collects (almost nothing), where your data lives, and how to delete an account.',
  alternates: contentAlternates('/privacy'),
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="August 2026">
      <Section title="The short version">
        <p>
          Pip is built to need as little of your data as possible — which turns out to be almost
          none. No account needed, no personal data, no cross-site tracking, no cookies. We do count
          anonymous, cookieless usage so we can see what’s working — nothing that identifies you.
          Here’s the whole story, plainly.
        </p>
      </Section>

      <Section title="What we store">
        <p>
          Your profile — name, avatar, your Roll, stats, card backs, all of it — lives in your
          browser’s local storage, on your device. Nothing leaves your device unless you ask it to.
          Clear your browser data and it’s gone; we keep no copy, because we never had one.
        </p>
      </Section>

      <Section title="If you add an account">
        <p>
          Pip has an optional account, and it exists for exactly one thing: carrying your progress
          to another device. It is off unless you turn it on, in Settings, under Account. Until then
          Pip makes no request to us at all, holds no identity for you, and there is no row anywhere
          with your name on it.
        </p>
        <p>
          Turn it on and we store two things:{' '}
          <strong className="font-medium text-foreground">your email address</strong>, so you can
          sign back in, and{' '}
          <strong className="font-medium text-foreground">a copy of the same profile</strong> that
          was already on your device. Nothing else. No hand histories beyond what your profile
          already holds, no IP-based profiling, no marketing email, ever. The data sits with{' '}
          <A href="https://supabase.com">Supabase</A> on our behalf, and password-reset email goes
          out through <A href="https://resend.com">Resend</A>.
        </p>
        <p>
          You can delete it from the same place you made it. “Delete my account and synced data” in
          Settings removes the account and the stored profile together, and it is genuinely gone
          rather than flagged. Your profile on the device stays exactly as it is, and Pip keeps
          working the way it did before.
        </p>
        <p>
          You can also just ask. Email <A href="mailto:hello@playpip.io">hello@playpip.io</A> from
          the address on the account and we’ll delete it for you within 7 working days, whether or
          not you can still get into the app. Once it’s gone we keep nothing: no archive, no copy
          set aside, nothing to come back later and find.
        </p>
      </Section>

      <Section title="What we don't do">
        <List>
          <Item>
            <strong className="font-medium text-foreground">No account needed.</strong> You can play
            everything without one. There’s an optional account for moving your progress between
            devices (above), and that’s the only thing it does.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">No personal data.</strong> The counts we
            keep (below) are anonymous and aggregate — never your name, avatar, Roll, or anything
            that points back to you. You can check: it’s all in the open repo.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">No tracking cookies.</strong> None. So
            there’s no cookie banner to click away, either — and no way to follow you around the
            web.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">No selling your data.</strong> We don’t
            have any to sell, and wouldn’t if we did.
          </Item>
        </List>
      </Section>

      <Section title="What we count">
        <p>
          To know whether Pip is any good — whether people find it, start playing, and come back —
          we keep a handful of anonymous, aggregate counts through{' '}
          <A href="https://umami.is">Umami</A>, a privacy-first, cookieless analytics tool. It
          records things like page views and a couple of milestones (someone made a profile, someone
          played their first hand) with no cookies, no fingerprinting, and no personal data. We
          can’t tie any of it to a person — including you. It exists so we can improve the game, and
          for nothing else. It’s never sold or shared.
        </p>
        <p>
          The counts are held by Umami on our behalf and roll off after about six months. We don’t
          keep our own copy beyond that.
        </p>
      </Section>

      <Section title="Server logs">
        <p>
          The site is served as plain files by Cloudflare. Like any web host, Cloudflare keeps
          standard access logs — things like IP addresses and which files were requested — to
          deliver the page and keep it standing up. That’s Cloudflare’s doing, under their own
          privacy terms; we don’t add to it and we don’t go digging through it.
        </p>
      </Section>

      <Section title="Sharing a hand or a result">
        <p>
          When you copy a hand link or a Daily result, the data rides inside the link itself —
          nothing is uploaded. It only goes anywhere if you paste it somewhere. Following a link out
          to GitHub takes you to GitHub, under their rules, not ours.
        </p>
      </Section>

      <Section title="Children">
        <p>Pip is play money, but it’s still card play. It’s meant for people 13 and over.</p>
      </Section>

      <Section title="Changes">
        <p>
          If this ever changes — say we add something you can pay for — we’ll update this page and
          the date at the top. The honest version: right now there’s very little to say, and we’d
          like to keep it that way.
        </p>
      </Section>

      <Section title="Don't take our word for it">
        <p>
          Pip is open source. The whole app lives at{' '}
          <A href="https://github.com/playpip/pip-web">github.com/playpip/pip-web</A> — you can read
          exactly what it does and doesn’t collect. Questions? Open an issue there.
        </p>
      </Section>
    </LegalPage>
  )
}
