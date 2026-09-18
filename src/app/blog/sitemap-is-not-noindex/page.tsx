import type { Metadata } from 'next'
import { A, Item, LegalPage, List, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import {
  NEITHER_LISTED_NOR_NOINDEX,
  NOINDEX_FIXED_ON,
  NOINDEX_FIXED_URLS,
  NOINDEX_SUBTREES,
  routeOf,
} from '@/config/routeStates'

const post = BLOG_POSTS.find((p) => p.slug === 'sitemap-is-not-noindex')!

export const metadata: Metadata = postMetadata(post)

/** A block of monospaced lines, for the bits that are lists rather than prose. */
function Block({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        <code>{head}</code>
      </p>
      <p className="mt-2 text-xs leading-relaxed">{children}</p>
    </div>
  )
}

export default function SitemapIsNotNoindexPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The sitemap is not a fence">
        <p>
          Our sitemap has never listed the game. The file that builds it,{' '}
          <Src path="src/app/sitemap.ts" />, says so in a comment: the game itself is app, not
          content, and nobody needs to find a poker table through a search result. That felt like a
          decision. It was a preference.
        </p>
        <p>
          Google indexed <code>/game</code> anyway. It got there through the Play button on the home
          page, which is a link doing what a link is for, and once it arrived nothing on the page
          asked it to leave. Search Console had the URL listed, ranking, and taking impressions for
          queries meant for the home page, which it could hardly help: the route declared no title
          of its own, so it inherited the root layout&rsquo;s and went into the index as the home
          page&rsquo;s twin.
        </p>
        <p>
          Open a sitemap and you can see why leaving something out achieves nothing. It is a list of{' '}
          <code>&lt;loc&gt;</code> entries with dates on them. There is no element that means{' '}
          <em>not this one</em>, because the file is a set of requests rather than a set of rules. A
          URL you left out is a URL you did not mention.
        </p>
      </Section>

      <Section title="Then we fixed the wrong thing">
        <p>
          The fix was obvious once we had seen it: say <code>noindex</code> on the page, give the
          route a title of its own, and write a test so it cannot come back. We did all three, in
          August, and the test reads <code>src/app/game</code>.
        </p>
        <p>
          Three weeks later the same defect was still shipping on {NOINDEX_FIXED_URLS} other URLs.
          The suite was green the whole time, because it was doing precisely what it said.
        </p>
        <Block head="what the /game fix did not cover">
          <code>/play/&lt;venue&gt; &rarr; twenty-nine prerendered files, one per table</code>
          <br />
          <code>/stats &rarr; your own numbers, out of your own browser</code>
          <br />
          <code>/hand &rarr; a shared hand, which lives in the URL fragment</code>
          <br />
          <code>/reset-password &rarr; where the email lands</code>
          <br />
          <code>
            all of them: no robots meta, no canonical, the home page&rsquo;s own title tag
          </code>
        </Block>
        <p>
          A guard covers what it names. Ours named a directory, so it protected a directory, and the
          ruling behind it (screens are not pages) was never written down anywhere a build could
          read. This is the fourth time on this repository that a rule has been applied to the case
          that got caught rather than to the rule.
        </p>
      </Section>

      <Section title="Three states, and the third one does the work">
        <p>
          What replaced it is an inventory rather than a ban. Every route under <code>src/app</code>{' '}
          is in exactly one of three states, and the build fails on a route in none of them. The
          states are <Src path="src/config/routeStates.ts" /> and the walk that enforces them is{' '}
          <Src path="tests/canonical.test.ts" />.
        </p>
        <Block head="src/config/routeStates.ts">
          <code>1. in the sitemap &rarr; published, and it needs a canonical</code>
          <br />
          <code>2. under a noindex subtree &rarr; app, and the layout says so out loud</code>
          <br />
          <code>3. neither &rarr; allowed, and somebody has to write the reason</code>
        </Block>
        <p>
          The subtrees are read off the filesystem, so a screen added under one of them is covered
          the day it is added rather than the day someone remembers:
        </p>
        <Block head={`${NOINDEX_SUBTREES.length} noindex subtrees, and why each is app`}>
          {NOINDEX_SUBTREES.map((subtree) => (
            <span key={subtree.dir}>
              <code>
                {routeOf(subtree.dir)} &rarr; {subtree.why}
              </code>
              <br />
            </span>
          ))}
        </Block>
        <p>
          The third state is the one worth copying. Our failure was never a route in the wrong
          state, it was a route nobody had thought about, and a test that only checks the routes you
          remembered cannot catch that. So the exceptions are enumerated, with an argument each, and
          the list is short enough to read. Ours currently holds one:
        </p>
        {Object.entries(NEITHER_LISTED_NOR_NOINDEX).map(([route, why]) => (
          <Block key={route} head={route}>
            <code>{why}</code>
          </Block>
        ))}
        <p>
          That entry is not a fix. It is an admission with a name on it, which is the difference
          between a gap and an oversight.
        </p>
      </Section>

      <Section title="Three things that make this easy to get wrong in Next.js">
        <List>
          <Item>
            <strong>
              Metadata merges field by field, so a child route that exports its own{' '}
              <code>robots</code> silently drops the layout&rsquo;s.
            </strong>{' '}
            Nothing warns you. The guard bans the word <code>robots</code> outright in any page
            under a noindex subtree: the subtree&rsquo;s answer is the layout&rsquo;s, and a page
            with an opinion about it is the bug.
          </Item>
          <Item>
            <strong>
              A test that imports <code>metadata</code> cannot see a <code>generateMetadata</code>.
            </strong>{' '}
            A route under a dynamic segment usually declares metadata from the function instead, and
            then the module&rsquo;s <code>metadata</code> export is <code>undefined</code>, the
            assertion passes against nothing, and the route indexes itself while the suite reports
            success. Read the source text as well as the module, so both forms fail.
          </Item>
          <Item>
            <strong>Counting route folders undercounts what you shipped.</strong>{' '}
            <code>/play/[venue]</code> is one folder in the editor and twenty-nine HTML files in the
            export, because <code>generateStaticParams</code> enumerates the venues. Whatever is
            wrong in that file is wrong twenty-nine times.
          </Item>
        </List>
      </Section>

      <Section title="Why not robots.txt">
        <p>
          Because the two instructions fight. <code>Disallow</code> stops the crawl, and a page that
          is never crawled is a page whose <code>noindex</code> is never read. Google says it
          plainly in{' '}
          <A href="https://developers.google.com/search/docs/crawling-indexing/block-indexing">
            its own documentation
          </A>
          : &ldquo;If the page is blocked by a robots.txt file or the crawler can&rsquo;t access the
          page, the crawler will never see the noindex rule, and the page can still appear in search
          results.&rdquo;
        </p>
        <p>
          So <Src path="public/robots.txt" /> is one <code>Allow: /</code> and a link to the
          sitemap. Let the crawler in, then let each page answer for itself. That also happens to be
          the arrangement we would want anyway, since the pages we do want read are the whole reason
          the site has a front end.
        </p>
      </Section>

      <Section title="What this does not show">
        <List>
          <Item>
            <strong>That the {NOINDEX_FIXED_URLS} URLs have left the index.</strong> The{' '}
            <code>noindex</code> went out on {formatPostDate(NOINDEX_FIXED_ON)} and dropping a page
            takes a recrawl, on a schedule nobody outside Google sets. We have not read an export
            since. If it turns out they are still there, that is a fact about recrawl intervals
            rather than about the tag, and we will say so.
          </Item>
          <Item>
            <strong>
              That <code>noindex</code> fixes a title.
            </strong>{' '}
            It does not. A person who bookmarked a table still reads whatever the tab said, so
            giving the route its own title was the other half of the fix and the half that was
            visible to anybody.
          </Item>
          <Item>
            <strong>Anything about sites with a server.</strong> This is a static export, so every
            one of these URLs is a file sitting on disk with its answer baked in. A server gives you{' '}
            <code>X-Robots-Tag</code>, which is better, and one more place for the two halves to
            disagree.
          </Item>
        </List>
        <p>
          It is also one site&rsquo;s experience rather than a survey. The part we would stand
          behind anywhere is the smaller one: the sitemap is a list of things you asked for, and
          everything you did not ask for is still on the table.
        </p>
      </Section>
    </LegalPage>
  )
}
