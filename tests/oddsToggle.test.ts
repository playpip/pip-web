import { readFileSync } from 'node:fs'
import test from 'ava'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')

/**
 * "Win odds" off in Settings has to hold at every table a player plays at. The
 * room table rendered `HeroPanel` without `hideOdds`, so rooms showed the win %
 * to a player who had switched it off (pip-web#229). The review is left out on
 * purpose: reading the odds back is what it is for.
 */
const LIVE_TABLES = ['src/components/table/Table.tsx', 'src/components/room/RoomTable.tsx']

for (const path of LIVE_TABLES) {
  test(`every HeroPanel in ${path} honours the odds setting`, (t) => {
    const src = read(path)
    t.regex(src, /useProfile\(\(s\) => s\.showOdds\)/)
    const panels = src.split('<HeroPanel').slice(1)
    t.true(panels.length > 0)
    for (const panel of panels) {
      const props = panel.slice(0, panel.indexOf('/>'))
      t.true(props.includes('hideOdds={!showOdds}'), props)
    }
  })
}
