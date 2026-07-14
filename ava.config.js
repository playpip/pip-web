const config = {
  extensions: ['ts'],
  nodeArguments: ['--import=tsx'],
  workerThreads: false,
  // The Monte-Carlo AI/equity specs are compute-heavy; give them headroom so
  // the run doesn't flake under load.
  timeout: '60s',
  files: ['tests/**/*.test.ts'],
}

export default config
