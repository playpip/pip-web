const config = {
  extensions: ['ts'],
  nodeArguments: ['--import=tsx'],
  workerThreads: false,
  // The Monte-Carlo AI/equity specs are compute-heavy; give them headroom so
  // the run doesn't flake under load. This is AVA's inactivity timer, not a
  // per-test budget and not an assertion: it only decides how long a silent run
  // is allowed to be before AVA gives up on it. tests/ai.test.ts sits around
  // 50s on this machine now that the AI plays more hands to a flop, which is
  // close enough to 60s to flake on a busy runner without anything being wrong.
  timeout: '150s',
  files: ['tests/**/*.test.ts'],
}

export default config
