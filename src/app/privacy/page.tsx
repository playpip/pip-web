import type { Metadata } from 'next'
import { LegalPage, Section, List, Item, A } from '@/components/marketing/LegalPage'
import { contentAlternates } from '@/config/site'
import { ratingEnabled } from '@/lib/rating/local'

export const metadata: Metadata = {
  title: 'Privacy · Pip',
  description:
    'What Pip collects (almost nothing), where your data lives, and how to delete an account.',
  alternates: contentAlternates('/privacy'),
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="November 2026">
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
          browser’s local storage, on your device. It never leaves your device unless you ask it to.
          Clear your browser data and it’s gone; we keep no copy, because we never had one.
        </p>
      </Section>

      <Section title="If you add an account">
        <p>
          Pip has an optional account. It carries your progress to another device, and it is what a{' '}
          <A href="/membership">membership</A> belongs to if you take one. It is off unless you turn
          it on, in Settings, under Account. Until then the only thing Pip sends us is a count of
          hands played (see What we count), it holds no identity for you, and there is no row
          anywhere with your name on it.
        </p>
        <p>
          Turn it on and we store two things:{' '}
          <strong className="font-medium text-foreground">your email address</strong>, so you can
          sign back in, and{' '}
          <strong className="font-medium text-foreground">a copy of the same profile</strong> that
          was already on your device. Nothing else, unless you take a membership, turn on email,
          play a slow game or allow notifications (all below). No hand histories beyond what your
          profile already holds, and no IP-based profiling. The data sits with{' '}
          <A href="https://supabase.com">Supabase</A> on our behalf, and email goes out through{' '}
          <A href="https://resend.com">Resend</A>.
        </p>
        <p>
          If you sign in with Google or Apple instead of a password, they send us your email address
          and an id for your account with them. Google also sends the name and picture on your
          Google account, and Apple sends your name the first time. Supabase keeps those with the
          account record. Pip never shows or uses them, and deleting the account deletes them. With
          Apple you can choose to hide your email, and then we only ever see a relay address Apple
          gives us.
        </p>
        <p>
          You can delete it from the same place you made it. “Delete my account and synced data” in
          Settings removes the account and the stored profile together, and it is genuinely gone
          rather than flagged. Your profile on the device stays exactly as it is, and Pip keeps
          working the way it did before.
        </p>
        <p>
          If you ever take out a <A href="/membership">membership</A> on the website, the payment is
          handled by <A href="https://stripe.com">Stripe</A>. In the iPhone or Android app, Apple or
          Google handles it, and <A href="https://www.revenuecat.com">RevenueCat</A> tells us it
          exists, which means RevenueCat holds your account’s id.{' '}
          <strong className="font-medium text-foreground">
            We never see or store your card number
          </strong>{' '}
          — it goes straight to Stripe and never touches our servers. What we keep is a record that
          your account has a live membership and when it renews, which is what the app checks to
          unlock what you paid for. Nothing about a membership is linked to how you play.
        </p>
        <p>
          Deleting your account cancels a membership bought on the website on the spot. One bought
          in the app can only be cancelled in your App Store or Google Play settings, so cancel
          there first. The one thing that outlives it is Stripe’s record of what you paid — the
          invoices and the email address they went to — because tax law requires a business to keep
          them. None of it is linked to a Pip profile any more.
        </p>
        <p>
          You can also just ask. Email <A href="mailto:hello@playpip.io">hello@playpip.io</A> from
          the address on the account and we’ll delete it for you within 7 working days, whether or
          not you can still get into the app. Once it’s gone we keep nothing: no archive, no copy
          set aside, nothing to come back later and find.
        </p>
      </Section>

      {ratingEnabled() && (
        <Section title="The Pip Rating and the leaderboard">
          <p>
            Your Pip Rating is worked out on your device from the calls and folds you make at a
            Hold’em table. With an account, the game sends our server, for each hand, when it
            finished and what each of those decisions cost, and nothing else about the hand: no
            cards, no Roll. The server keeps the arithmetic behind your rating and when you last
            sent one, so the same hand is never counted twice.
          </p>
          <p>
            <strong className="font-medium text-foreground">The leaderboard is public.</strong>{' '}
            Anyone can see your rating there with your name and your avatar, the same ones your
            account already syncs. Your Roll is never on it. “Hide me from the leaderboard” in your
            rating takes you off it straight away, and deleting your account deletes your rating
            with it. Without an account your rating stays on your device and is never sent.
          </p>
        </Section>
      )}

      <Section title="Email">
        <p>
          With an account you can turn on two kinds of email about your play, in Settings →
          Notifications or with the box when you create the account. Both are off until you do. A
          slow game you are playing can also email you, which is under Notifications below.
        </p>
        <List>
          <Item>
            <strong className="font-medium text-foreground">A Daily reminder.</strong> At 18:00 UTC,
            on a day you have not played the Daily, if you played it the day before.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">A weekly summary.</strong> On Mondays:
            your Roll, the hands and tournaments you played since the last one, and your streak.
          </Item>
          <Item>
            <strong className="font-medium text-foreground">
              One email when you turn them on.
            </strong>{' '}
            It says what you will get. Never more than one email a day in all.
          </Item>
        </List>
        <p>
          They are made from your email address and the profile your account already syncs: your
          Roll, your lifetime hand and tournament counts, the date you last played and your streak.
          To say what changed in a week we keep those few numbers as they were at the last summary.
          We also keep which emails you turned on, when each was last sent, and a random code for
          the unsubscribe link. We do not track whether you open an email or click anything in it.
        </p>
        <p>
          Every email has an unsubscribe link at the foot, and your mail app’s own Unsubscribe
          button works too. Either one turns off both kinds, with no sign-in. You can also turn them
          off in Settings → Notifications, and deleting your account deletes all of this with it.
          Password-reset email, when you ask for one, is separate and always sent.
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
          To know whether Pip is any good, whether people find it, start playing and come back, we
          keep a handful of anonymous, aggregate counts through <A href="https://umami.is">Umami</A>
          , a privacy-first, cookieless analytics tool. It records page views and a few milestones:
          someone made a profile, someone played their first hand, someone created an account, two
          devices disagreed about a Roll, someone claimed a daily reward, someone opened their
          streak rewards, someone tried to sign in, and whether a sign-in reached our servers at
          all. Those last two are there because a sign-in that fails on a bad network looks exactly
          like nobody wanting an account, and we would rather know the difference. We count the
          tries so we know whether the failures are rare. To see whether people come back, your
          device remembers which week it last played a hand in, and we count that a device played a
          hand in a new week and whether it had also played the week before. No date or number is
          sent, only those two. For the membership we count four steps: someone opened the
          membership page, someone went to pay, someone came back from paying, and a membership
          started. Paying needs an account, so we also count whether they were signed out when they
          opened it, and whether they tapped to create an account from it. We count whether they
          scrolled down as far as the join button, whether they pressed join, and whether the plans
          were opened from the welcome steps. When one of the day’s free games is used up we show a
          card saying so, and we count that the free table card was shown, that the free table card
          was tapped, that the free room card was shown, that the free room card was tapped, that
          the free quick match card was shown, that the free quick match card was tapped, that the
          free round card was shown and that the free round card was tapped. For each quick game we
          count that a round of it was started and finished: that someone started a round of Poker
          Solitaire, that someone finished a round of Poker Solitaire, that someone started a round
          of Ten Hands, that someone finished a round of Ten Hands, that someone started a round of
          Mystery Card and that someone finished a round of Mystery Card. A guest at the end of a
          friend’s room game sees a card about hosting their own, and we count that the hosting card
          was shown, that its open a room button was tapped and that its membership button was
          tapped. When someone tries to join a room with no seats left, we count that a full room
          turned someone away. Before your first free report opens, the lobby shows how many hands
          it needs, and we count that the free report card on the lobby was shown and that the free
          report card on the lobby was tapped. On Android phones a row at the top offers to add Pip
          to your home screen, and we count that the install row was shown, that its install button
          was tapped and that Pip was added to a home screen.{' '}
          {ratingEnabled() &&
            'For the Pip Rating we count that someone opened their rating and that someone opened the leaderboard. '}{' '}
          That tells us where people stop, not who they are. No cookies, no fingerprinting, no
          personal data, and never anything you typed or any message we got back. We can’t tie any
          of it to a person, including you. It exists so we can improve the game, and for nothing
          else. It’s never sold or shared.
        </p>
        <p>
          The counts are held by Umami on our behalf and roll off after about six months. We don’t
          keep our own copy beyond that.
        </p>
        <p>
          The home page says how many hands have been played on Pip. For that, every ten hands the
          game sends our server one number: how many hands it is reporting. No id, no profile, no
          name, nothing about the hands themselves. Your internet address is held in memory for a
          minute so one place cannot send the number over and over, and it is not stored.
          Multiplayer tables count their own hands on our server.
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

      {/* Multiplayer (2026-10-11). Only said in a build that has it, because a
          privacy page describing a server the build does not talk to is as
          wrong as one that leaves a server out. */}
      {process.env.NEXT_PUBLIC_ROOMS_URL && (
        <Section title="Multiplayer">
          <p>
            Multiplayer tables run on a small server of ours, on Cloudflare. While you are at a
            table it holds your account’s id (to know it is you), the name and avatar you play
            under, and the game: the cards, the chips and whose turn it is. The other players see
            your name, your avatar and your chips, and never your Roll, your rank or your account. A
            finished game is deleted within half an hour, and a room nobody started within two
            hours.
          </p>
          <p>
            Your camera and microphone are off until you turn them on at a table with friends, and
            they are never available at a quick-match table. When they are on, the picture and sound
            go directly from your device to the other players’, encrypted, and are not recorded by
            anyone. On networks that block a direct connection they pass through Cloudflare’s relay,
            still encrypted, so the relay cannot see or hear them. Nothing of either is stored on
            our server.
          </p>
        </Section>
      )}

      {/* Notifications (slow games 2026-10, the board and the streak 2026-11-09).
          They run on the same room server, so they are said where it is. */}
      {process.env.NEXT_PUBLIC_ROOMS_URL && (
        <Section title="Notifications">
          <p>
            Pip only sends a notification to a device you allowed, after your phone or browser asks
            you. Settings → Notifications has a switch for each kind: your move in a slow game,
            someone passing you on the Pip Rating board, and your streak about to end. Nothing is
            sent in your quiet hours.
          </p>
          <p>
            To do that our room server keeps, with your account’s id: the address of each device you
            allowed, your switches, your quiet hours and time zone, and your slow games. The address
            is made by your phone or browser and only works for sending to it. The notification
            itself goes through the push service your phone or browser maker runs, and through
            Expo’s for the Pip app. To check your streak, the server reads it once a day from the
            profile your account already syncs.
          </p>
          <p>
            A slow game can also email you when a move has waited a while, at most one email every
            12 hours, and only while it is your move. That one is off until you turn it on in
            Settings → Notifications, and the link at the foot of each email turns it off again.
          </p>
          <p>Deleting your account from Settings deletes all of this with it.</p>
        </Section>
      )}

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
