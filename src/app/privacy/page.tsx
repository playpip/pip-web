import type { Metadata } from 'next'
import { LegalPage, Section, List, Item, A } from '@/components/marketing/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy · Pip',
  description: 'What Pip collects (almost nothing) and where your data lives (your device).',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="July 2026">
      <Section title="The short version">
        <p>
          Pip is built to need as little of your data as possible — which turns out to be almost
          none. No account, no personal data, no cross-site tracking, no cookies. We do count
          anonymous, cookieless usage so we can see what&rsquo;s working — nothing that identifies
          you. Here&rsquo;s the whole story, plainly.
        </p>
      </Section>

      <Section title="What we store">
        <p>
          Your profile — name, avatar, your Roll, stats, card backs, all of it — lives in your
          browser&rsquo;s local storage, on your device. It never reaches a server, because Pip
          doesn&rsquo;t have one to send it to. Clear your browser data and it&rsquo;s gone; we keep
          no copy, because we never had one.
        </p>
      </Section>

      <Section title="What we don't do">
        <List>
          <Item>
            <strong className="font-medium text-foreground">No accounts.</strong> Nothing to sign up
            for, so nothing for us to hold.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">No personal data.</strong> The counts we
            keep (below) are anonymous and aggregate — never your name, avatar, Roll, or anything
            that points back to you. You can check: it&rsquo;s all in the open repo.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">No tracking cookies.</strong> None. So
            there&rsquo;s no cookie banner to click away, either — and no way to follow you around
            the web.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">No selling your data.</strong> We
            don&rsquo;t have any to sell, and wouldn&rsquo;t if we did.
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
          can&rsquo;t tie any of it to a person — including you. It exists so we can improve the
          game, and for nothing else. It&rsquo;s never sold or shared.
        </p>
        <p>
          The counts are held by Umami on our behalf and roll off after about six months. We
          don&rsquo;t keep our own copy beyond that.
        </p>
      </Section>

      <Section title="Server logs">
        <p>
          The site is served as plain files by Cloudflare. Like any web host, Cloudflare keeps
          standard access logs — things like IP addresses and which files were requested — to
          deliver the page and keep it standing up. That&rsquo;s Cloudflare&rsquo;s doing, under
          their own privacy terms; we don&rsquo;t add to it and we don&rsquo;t go digging through
          it.
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
        <p>
          Pip is play money, but it&rsquo;s still card play. It&rsquo;s meant for people 13 and
          over.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this ever changes — say we add something you can pay for — we&rsquo;ll update this page
          and the date at the top. The honest version: right now there&rsquo;s very little to say,
          and we&rsquo;d like to keep it that way.
        </p>
      </Section>

      <Section title="Don't take our word for it">
        <p>
          Pip is open source. The whole app lives at{' '}
          <A href="https://github.com/playpip/pip-web">github.com/playpip/pip-web</A> — you can read
          exactly what it does and doesn&rsquo;t collect. Questions? Open an issue there.
        </p>
      </Section>
    </LegalPage>
  )
}
