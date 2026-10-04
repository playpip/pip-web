import type { Metadata } from 'next'
import { Item, LegalPage, List, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'

const post = BLOG_POSTS.find((p) => p.slug === 'sign-in-with-google-and-apple')!

export const metadata: Metadata = postMetadata(post)

export default function SignInWithGoogleAndApplePost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="Two new buttons">
        <p>
          The account dialog now offers Continue with Google and Continue with Apple, above the
          email and password it already had. You press one, go to Google or Apple for a moment, and
          come back to the page you left, signed in, with your Roll syncing.
        </p>
        <p>
          An account is still optional. This only changes how long it takes to make one if you want
          one, which used to be the time it takes to think of a password.
        </p>
      </Section>

      <Section title="What they hand us">
        <p>
          A button that says Continue with Google is also a small data transfer, and the button does
          not mention it. So here it is, in the same words as{' '}
          <Src path="src/app/privacy/page.tsx">the privacy page</Src>:
        </p>
        <List>
          <Item>
            <strong>Both send</strong> your email address and an id for your account with them.
          </Item>
          <Item>
            <strong>Google also sends</strong> the name and picture on your Google account.
          </Item>
          <Item>
            <strong>Apple sends your name</strong> the first time, and lets you hide your email, in
            which case we only ever see a relay address Apple makes up for us.
          </Item>
        </List>
        <p>
          Supabase keeps those with the account record. Pip never shows or uses them: nothing in the
          app reads the name or the picture, and deleting the account deletes them. We do not need
          them either. They come with the sign-in.
        </p>
      </Section>

      <Section title="Two details we cared about more than you will">
        <List>
          <Item>
            <strong>A button only appears once it works.</strong> A provider that is not switched on
            behind the scenes sends whoever presses it to a page of raw JSON on someone else&rsquo;s
            domain. So the build lists the providers it offers, and a button is not drawn until its
            provider is on (<Src path="src/lib/sync/client.ts" />
            ).
          </Item>
          <Item>
            <strong>An account made this way has no password</strong>, so it does not offer to
            change one. It says Set a password instead, and setting one lets you sign in with your
            email as well (<Src path="src/store/sync.ts" />
            ).
          </Item>
        </List>
        <p>
          Neither is interesting. Both are the sort of thing that, done the other way, ends up as a
          support email.
        </p>
      </Section>
    </LegalPage>
  )
}
