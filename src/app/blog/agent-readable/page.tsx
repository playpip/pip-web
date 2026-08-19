import type { Metadata } from 'next'
import { LegalPage, Section, Correction, A } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'

const post = BLOG_POSTS.find((p) => p.slug === 'agent-readable')!

export const metadata: Metadata = postMetadata(post)

export default function AgentReadablePost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Correction date="19 August 2026">
        <p>
          There are <strong className="font-medium text-foreground">ten content routes</strong> with
          a Markdown mirror now, not six. The learn guides, the odds calculator and the no-signup
          page were all written after this post, and each one arrived with its mirror.
        </p>
        <p>
          Which makes the last paragraph below exactly backwards: it names the learn pages as part
          of the plain static half, and they are the largest set of mirrors on the site. You can
          read one at <code>/learn/hand-rankings.md</code>. The shared module is still 57 lines. The
          per-route files are still four lines each, except the two learn routes, which are seven.
        </p>
      </Correction>

      <Section title="The short version">
        <p>
          Every content page on this site now comes in two versions. Ask for one the way a browser
          does and you get HTML. Ask for it with an <code>Accept: text/markdown</code> header and
          you get the same page as plain markdown, with the navigation, styling and scripts left
          out. People get the site. Machines get the text.
        </p>
        <p>
          You can try it from a terminal:{' '}
          <code>curl -H &quot;Accept: text/markdown&quot; https://playpip.io/</code>. Or, if you
          would rather not, put <code>.md</code> on the end of any content address and read the
          mirror directly.
        </p>
      </Section>

      <Section title="Why we bothered">
        <p>
          A fair number of people now meet a website through something that read it for them. We
          would rather the thing doing the reading got it right. An AI tool parsing our HTML has to
          guess which parts are the page and which parts are the furniture; handing it the text
          instead removes the guessing.
        </p>
        <p>
          It also follows from the rest of the project. Pip’s claim is that you can check it rather
          than take our word for it: the shuffle is seeded, the engine is a readable module, the
          code is all there. Being legible to machines is the same idea pointed at a different kind
          of reader.
        </p>
      </Section>

      <Section title="How it works">
        <p>
          Three pieces, none of them clever. A post-build script walks the finished export, converts
          each content page to markdown, strips the chrome, and writes the result next to the page
          as <code>/privacy.md</code>, <code>/blog/launch-week.md</code> and so on. The same script
          emits <A href="https://playpip.io/llms.txt">/llms.txt</A>, an index of everything with a
          hand-written summary of what Pip is at the top, following the{' '}
          <A href="https://llmstxt.org/">llms.txt convention</A>. New posts are picked up from the
          export, so writing one requires no changes here. This post was.
        </p>
        <p>
          In front of that sits the negotiation: a request carrying{' '}
          <code>Accept: text/markdown</code> is served the mirror, anything else is served the page.
          Browsers never send that header, so nothing changes for anyone using one. Both responses
          go out with <code>Vary: Accept</code>, so caches keep the two apart, and with{' '}
          <A href="https://www.rfc-editor.org/rfc/rfc8288">RFC 8288</A> Link headers pointing at{' '}
          <code>/llms.txt</code> and at that page’s own markdown mirror. An agent that lands on the
          HTML by accident is told where the good version lives.
        </p>
        <p>
          The module doing the work is 57 lines. Each of the six content routes that uses it is four
          more.
        </p>
      </Section>

      <Section title="Cloudflare ships a version of this">
        <p>
          In March, Cloudflare announced{' '}
          <A href="https://blog.cloudflare.com/markdown-for-agents/">Markdown for Agents</A>, which
          does the same job at the edge and does it more thoroughly than we do. It is in beta, and
          it costs nothing extra, on the Pro, Business and Enterprise plans. Pip is on the free plan
          and intends to stay there, which ruled it out.
        </p>
        <p>
          So the free version is the ninety-odd lines described above. If you are also on a free
          plan and want the same thing, the code is{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/functions/_shared.ts">
            functions/_shared.ts
          </A>{' '}
          and{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/scripts/gen-llms.mjs">
            scripts/gen-llms.mjs
          </A>
          . It is MIT licensed. Take it.
        </p>
      </Section>

      <Section title="What we tell the crawlers">
        <p>
          Our robots.txt now carries a <A href="https://contentsignals.org/">Content Signal</A>{' '}
          line: <code>search=yes, ai-input=yes, ai-train=yes</code>. Yes to being indexed, yes to
          being used as source material for an answer, yes to being trained on. Plenty of sites are
          saying no to the last two, and the reasoning is usually sound. Ours points the other way:
          the whole codebase is public under a licence that already permits all of it, and a model
          that has read Pip and can describe it accurately is a good outcome for us.
        </p>
        <p>
          One correction while we are here. Until Friday the site was quietly turning AI crawlers
          away, via a managed robots.txt setting that was on by default and that we had never
          consciously chosen. It is off now. We had been publishing an agent-friendly index to an
          audience we were blocking at the door.
        </p>
      </Section>

      <Section title="The game is still just files">
        <p>
          Only the six content pages have any of this attached: the home page, privacy, terms,
          credits, the blog and its posts. Everything else, the table, your profile, the stats
          screen, the learn pages, is the same static export it was before and never touches a
          server. The poker still happens entirely in your browser, which was always the point.
        </p>
      </Section>
    </LegalPage>
  )
}
