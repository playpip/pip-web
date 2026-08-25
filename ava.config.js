const config = {
  extensions: ['ts'],
  nodeArguments: ['--import=tsx'],
  workerThreads: false,
  // The Monte-Carlo AI/equity specs are compute-heavy; give them headroom so
  // the run doesn't flake under load. This is AVA's inactivity timer, not a
  // per-test budget and not an assertion: it only decides how long a silent run
  // is allowed to be before AVA gives up on it. tests/ai.test.ts sits around
  // 85s on this machine now that the preflop bands are measured against every
  // table in `ALL_VENUES` rather than three hand-copied rungs, and a busy runner
  // is comfortably slower than this one. Raising this weakens nothing.
  timeout: '300s',
  files: ['tests/**/*.test.ts'],
}

export default config
