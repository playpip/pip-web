import type { Metadata } from 'next'
import { LegalPage, Section, List, Item, A } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'

const post = BLOG_POSTS.find((p) => p.slug === 'two-devices-two-chip-counts')!

export const metadata: Metadata = postMetadata(post)

export default function TwoDevicesTwoChipCountsPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          Pip now has an account. It is optional, it is off unless you turn it on, and it does one
          thing: carries your progress to another device. You can still play everything without one,
          exactly as before.
        </p>
        <p>
          It is free, and it stays free. Sync shipped free, so paywalling it later would be a
          promise broken rather than a price introduced.
        </p>
        <p>
          If you never turn it on, Pip makes no request to us at all. No client loads, no identity
          exists, and there is no row anywhere with your name on it. That is not a policy we are
          asking you to believe. It is what the code does, and the code is{' '}
          <A href="https://github.com/playpip/pip-web">all there</A>.
        </p>
      </Section>

      <Section title="The easy half">
        <p>
          Email and password, a reset link, and a delete button. That part is a solved problem and
          we did not solve it again: it runs on <A href="https://supabase.com">Supabase</A>, with
          reset email through <A href="https://resend.com">Resend</A>. There is nothing to say about
          it and that is the point.
        </p>
      </Section>

      <Section title="The hard half">
        <p>
          You play a session on your phone and finish on 4,200. You play a session on your laptop
          that went less well and finish on 900. Both were offline. Now they meet.
        </p>
        <p>
          There is no correct answer to that. There is only a chosen one, and the only real
          requirement is that a player can predict it. Adding the two together invents chips you
          never won. Taking the larger rewards anyone who keeps a losing session unsynced, which is
          a rule that teaches people to game it. Taking the most recent write quietly eats a good
          night, which is the worst of the three because you find out afterwards.
        </p>
        <p>All three are worse than asking. So Pip asks.</p>
      </Section>

      <Section title="The rule">
        <p>
          Everything that can only grow merges in your favour, whichever device you pick, because
          gaining it can never cost you anything:
        </p>
        <List>
          <Item>
            <strong className="font-medium text-foreground">Awards</strong> are the union of both
            devices, keeping the earlier time earned. You earned it when you earned it. The other
            device had not heard yet.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">Peak Roll</strong> is the higher of the
            two. <strong className="font-medium text-foreground">Cosmetics you own</strong> are the
            union. <strong className="font-medium text-foreground">Venue and cast records</strong>{' '}
            take the better of each.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">Today’s Daily</strong> keeps the record
            that says you played it. Syncing should not hand you a second attempt.
          </Item>
        </List>
        <p>
          Two things cannot merge, and they are the two that matter: your{' '}
          <strong className="font-medium text-foreground">Roll</strong> and your{' '}
          <strong className="font-medium text-foreground">lifetime stats</strong>. Those follow one
          side, and you pick which. Stats follow the Roll rather than being merged separately,
          because a profile with one device’s chips and the other device’s hand count is a profile
          that disagrees with itself.
        </p>
      </Section>

      <Section title="When you actually get asked">
        <p>
          Rarely, by design. The prompt needs the other device to have written something new, this
          device to have unsent changes of its own, and the two to disagree about the Roll or about
          hands played.
        </p>
        <p>
          Change your card back on the bus and nothing happens. Play a real session on each of two
          devices and you get one dialog, showing both sides, and you choose. If only one device
          moved there is nothing to lose, so the merge is silent.
        </p>
      </Section>

      <Section title="What we store now, which is more than nothing">
        <p>
          Pip used to collect nothing. That was true, and it is not true any more, so we are saying
          so plainly rather than letting an old line stand.
        </p>
        <p>
          Turn the account on and we hold two things: your email address, so you can sign back in,
          and a copy of the same profile that was already on your device. Not a new profile
          assembled about you. The same one, moved. No hand histories beyond what it already holds,
          no IP profiling, and no marketing email, ever.
        </p>
        <p>
          Delete it from the same place you made it and it is genuinely gone, account and stored
          profile together, rather than flagged and kept. Your profile on the device stays exactly
          where it is and Pip carries on working. The whole story is on the{' '}
          <A href="https://playpip.io/privacy">privacy page</A>.
        </p>
      </Section>

      <Section title="What we did not build">
        <p>
          Doing this properly means a three-way merge, which needs each device to remember the last
          state both sides agreed on. That is a much larger build for a single-player game where one
          device is almost always the active one. We chose the rule you can explain in a sentence
          instead. If it turns out to annoy people, it is a known upgrade path rather than a corner
          we painted into.
        </p>
        <p>
          There is also no banner. Signed out is a permanent, first-class state, not a funnel step,
          so you will not find a prompt asking you to sync your progress or a badge suggesting your
          account is incomplete. There is one quiet section in Settings, under Account, and it will
          wait there indefinitely.
        </p>
        <p>
          Transfer codes and the QR still work too, and they always will. Moving a profile between
          devices never required an account and still doesn’t. The account is only there if you
          would rather not think about it.
        </p>
      </Section>
    </LegalPage>
  )
}
