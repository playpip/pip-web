// What `eas metadata:push` reads (eas.json → submit.production.ios.metadataPath).
//
// The listing lives in store.config.json, which is committed. The review
// contact and the demo account's password are not: this repo is public. They
// live in store/review.local.json, which is git-ignored and only exists on the
// machine that pushes, and are merged in here.

const fs = require('node:fs')
const path = require('node:path')

const config = require('./store.config.json')
const localPath = path.join(__dirname, 'review.local.json')

if (!fs.existsSync(localPath)) {
  throw new Error(
    'store/review.local.json is missing. It holds the review contact and demo account; see store/README.md.',
  )
}
const local = JSON.parse(fs.readFileSync(localPath, 'utf8'))

module.exports = {
  ...config,
  apple: {
    ...config.apple,
    review: { ...config.apple.review, ...local.apple.review },
  },
}
