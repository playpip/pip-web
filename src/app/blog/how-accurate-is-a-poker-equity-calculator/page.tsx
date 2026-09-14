import type { Metadata } from 'next'
import { A, Item, LegalPage, List, Section } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import {
  COVERAGE,
  COVERAGE_RUNS,
  GROUND_TRUTH,
  MEASURED_ON,
  RATIO_TOLERANCE,
  SWEEP_COMMAND,
  WIDTH,
  WIDTH_SEEDS,
  WORST_BIAS,
  formatSpot,
  sdRelativeError,
  trueEquity,
  widthRatio,
} from '@/config/equitySampling'
import { formatBand, sampleBand } from '@/lib/poker/oddsQuote'

const post = BLOG_POSTS.find((p) => p.slug === 'how-accurate-is-a-poker-equity-calculator')!

export const metadata: Metadata = postMetadata(post)

/** A row of figures, in a monospaced block so the columns line up. */
function Rows({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        <code>{head}</code>
      </p>
      <p className="mt-2 text-xs leading-relaxed">{children}</p>
    </div>
  )
}

export default function EquityCalculatorAccuracyPost() {
  const truth = trueEquity()
  const shownTruth = (truth * 100).toFixed(4)

  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The promise nobody checks">
        <p>
          Ask any poker calculator what your hand is worth and it will answer to a decimal place.
          Almost all of them are sampling: dealing the rest of the hand out a few thousand times and
          counting. That answer is a random variable, and it moves if you ask again.
        </p>
        <p>
          <A href="/poker-odds-calculator">Ours</A> is a sampler too. The difference is that it
          prints what the sample earned:{' '}
          <code>
            &plusmn;{formatBand(sampleBand(truth, 20_000))} points, from 20,000 hands dealt
          </code>
          , and it drops the tenths digit because a tenth of a point is noise at that width. That is
          a promise about how often the printed range contains the real answer. It is also a promise
          we had never tested, which is a strange thing to notice about the page whose entire
          argument is that we are the honest one.
        </p>
        <p>This is the test.</p>
      </Section>

      <Section title="You need an answer you can count">
        <p>
          Checking a sampler needs something to check it against, and a bigger sample is not it: two
          estimates that disagree tell you nothing about which one is closer. You need a spot where
          the true answer can be counted outright.
        </p>
        <p>
          Texas hold&rsquo;em has one such shape, and only one a browser can do while you wait.
          Heads-up with all five community cards out, the only unknown left is the opponent&rsquo;s
          two cards, and there are C(45,2) = {GROUND_TRUTH.showdowns} of them. Deal every one, score
          every one, and that is not an estimate.
        </p>
        <p>
          Everything else is out of reach. Heads-up on the turn is 45,540 showdowns. The smallest
          three-handed enumeration, on the river, is 893,970. Our calculator counts when the count
          is 5,000 or fewer and samples otherwise, which admits exactly this shape.
        </p>
        <Rows head={`${formatSpot(GROUND_TRUTH.hole)} on ${formatSpot(GROUND_TRUTH.community)}`}>
          <code>
            {GROUND_TRUTH.wins} wins &middot; {GROUND_TRUTH.ties} tie &middot; {GROUND_TRUTH.losses}{' '}
            losses
          </code>
          <br />
          <code>
            equity &rarr; {shownTruth}% over {GROUND_TRUTH.showdowns} counted showdowns
          </code>
        </Rows>
        <p>
          Pocket eights on an ace-high board, which nobody would call a strong spot and is worth
          rather more than it looks. It was picked for being near 58% rather than for being
          interesting: a proportion&rsquo;s variance is largest in the middle, so that is where a
          sampler has the hardest time and an error bar has the most work to do.
        </p>
      </Section>

      <Section title="Two questions, and only one of them is the obvious one">
        <p>
          The obvious question is whether the band contains the true answer. A 95% band should
          manage it about 95 times in 100.
        </p>
        <p>
          The question underneath it is whether the band is the right <em>width</em>. A band four
          times wider than it should be passes the first test every single time, and quietly tells
          every reader the calculator is a quarter as good as it is. Containment cannot catch that,
          because being too cautious never looks like a failure.
        </p>
        <p>We measured both. They come out differently, and the second one is the useful one.</p>
      </Section>

      <Section title="Question one: does the band contain the answer?">
        <p>
          {COVERAGE_RUNS} seeded runs at each sample size, each run asked whether its own band
          contained the counted answer above.
        </p>
        <Rows head={`${COVERAGE_RUNS} runs per size, against ${shownTruth}%`}>
          {COVERAGE.map((row) => (
            <span key={row.iterations}>
              <code>
                {row.iterations.toLocaleString('en-GB')} hands &rarr; {row.contained}/
                {COVERAGE_RUNS} contained &middot; worst miss {row.worstMiss.toFixed(2)}pts
              </code>
              <br />
            </span>
          ))}
        </Rows>
        <p>
          That reads like a trend and it is not one. {COVERAGE_RUNS} runs put roughly &plusmn;4.3
          points on a coverage rate, so {COVERAGE[0].contained} and{' '}
          {COVERAGE[COVERAGE.length - 1].contained} are the same measurement said twice. All three
          rows say about 95 in 100, and nothing in them says a bigger sample is better covered. Run
          the sweep on a different spot and the rows move around inside that width, which is what
          made us stop reading the ordering.
        </p>
        <p>
          The worst miss is the column worth keeping. When a run did land outside its band, it
          landed just outside: at 20,000 hands the furthest of {COVERAGE_RUNS} was{' '}
          {COVERAGE[COVERAGE.length - 1].worstMiss.toFixed(2)} points past an interval half a point
          wide. The failures are near misses rather than a different answer.
        </p>
      </Section>

      <Section title="Question two: is the band the right width?">
        <p>
          The band is 1.96 standard errors of a proportion, so it is asserting a specific number:
          that the same spot, run again under a different seed, spreads by band over 1.96. That is
          directly measurable. Run it {WIDTH_SEEDS} times, take the standard deviation, and compare.
        </p>
        <Rows head={`${WIDTH_SEEDS} seeds per size · measured spread vs the band's claim`}>
          {WIDTH.map((row) => (
            <span key={row.iterations}>
              <code>
                {row.iterations.toLocaleString('en-GB')} hands &rarr; spread {row.spread.toFixed(2)}
                pts vs claimed {row.claimedSe.toFixed(2)}pts = {widthRatio(row).toFixed(2)}x
                &middot; bias {row.bias > 0 ? '+' : ''}
                {row.bias.toFixed(2)}pts
              </code>
              <br />
            </span>
          ))}
        </Rows>
        <p>
          A perfect band reads 1.00, and four sample sizes spanning forty-fold come out between{' '}
          {Math.min(...WIDTH.map(widthRatio)).toFixed(2)} and{' '}
          {Math.max(...WIDTH.map(widthRatio)).toFixed(2)}. The band is the width it says it is.
        </p>
        <p>
          It is worth saying what that tolerance is, because it is easy to quote the flattering
          half. {WIDTH_SEEDS} runs pin a standard deviation to about{' '}
          {(sdRelativeError() * 100).toFixed(0)}%, and that is one standard error rather than an
          interval. A 95% interval on these ratios is roughly {(1 - RATIO_TOLERANCE).toFixed(2)} to{' '}
          {(1 + RATIO_TOLERANCE).toFixed(2)}. Every row sits inside it. The furthest,{' '}
          {widthRatio(WIDTH[1]).toFixed(2)} at {WIDTH[1].iterations.toLocaleString('en-GB')} hands,
          is outside {(sdRelativeError() * 100).toFixed(0)}% and about{' '}
          {(Math.abs(widthRatio(WIDTH[1]) - 1) / sdRelativeError()).toFixed(1)} standard errors out,
          which is an ordinary result and not a clean one.
        </p>
        <p>
          The last column is the estimator rather than the band: how far the average of{' '}
          {WIDTH_SEEDS} runs sat from the counted answer. It never exceeded {WORST_BIAS} points in
          either direction, including at {WIDTH[0].iterations} hands, where the printed band is
          &plusmn;{formatBand(sampleBand(truth, WIDTH[0].iterations))} points and therefore{' '}
          {(sampleBand(truth, WIDTH[0].iterations) / WORST_BIAS).toFixed(0)} times as wide. The
          sampler is not shading the answer; it is just imprecise, and it says so.
        </p>
        <p>
          If anything the band is slightly generous, and on purpose. A tie is worth half a pot
          rather than a whole one, which can only reduce the spread, and we compute the band as
          though every showdown were won or lost outright. Overstating your own error is the right
          direction to be wrong in.
        </p>
      </Section>

      <Section title="What this does not show">
        <List>
          <Item>
            <strong>One spot.</strong> Everything above is pocket eights on one board. It is the
            shape where the answer is countable, which is exactly the shape we do not need a sampler
            for. The multi-way spots, where sampling is the only option, cannot be checked this way
            by anyone.
          </Item>
          <Item>
            <strong>Nothing about speed.</strong> Whether 20,000 hands finish before you lose
            interest is a different measurement, and it depends on your phone.
          </Item>
          <Item>
            <strong>Nothing about the evaluator.</strong> This checks the error bar around the
            answer. If the hand-ranking underneath were wrong, both the count and the sample would
            be wrong together and this would report a beautifully calibrated band around the wrong
            number. That is covered elsewhere, and it is why we wrote up{' '}
            <A href="/blog/pokersolver-undocumented">what the library underneath actually does</A>.
          </Item>
        </List>
      </Section>

      <Section title="Run it yourself">
        <p>
          The sweep is <code>scripts/odds-band-coverage.ts</code> in{' '}
          <A href="https://github.com/playpip/pip-web">the repository</A>, and the figures above are
          what <code>{SWEEP_COMMAND}</code> printed on {formatPostDate(MEASURED_ON)}. The seeds are
          fixed, so it prints the same rows on your machine or it has found something.
        </p>
        <p>
          Re-dealing 2.65M showdowns on every commit is not a sensible thing to put in a test suite,
          so the published numbers here are a dated measurement rather than a continuously checked
          one. What does run on every commit is the part that would have to break first: the count
          above, all {GROUND_TRUTH.showdowns} showdowns of it, which is instant, and the arithmetic
          every band in the table is derived from. If the ground truth moves, this post fails the
          build before it misleads anyone.
        </p>
        <p>
          None of this makes our calculator more accurate than anyone else&rsquo;s. The arithmetic
          is ordinary and the estimator is the one everybody uses. It means the range on the screen
          is a measurement rather than a decoration, and now there is a number behind that.
        </p>
      </Section>
    </LegalPage>
  )
}
