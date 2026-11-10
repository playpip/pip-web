import test from 'ava'
import { deleteWithNotify } from '@/lib/sync/deleteAccount'

function steps(opts: { kept?: string | null; forgot?: boolean; deleted?: boolean }) {
  const calls: string[] = []
  return {
    calls,
    run: () =>
      deleteWithNotify<string>({
        readNotify: async () => {
          calls.push('read')
          return opts.kept === undefined ? 'prefs' : opts.kept
        },
        forgetNotify: async () => {
          calls.push('forget')
          return opts.forgot ?? true
        },
        deleteAccount: async () => {
          calls.push('delete')
          return opts.deleted ?? true
        },
        restoreNotify: async (kept) => {
          calls.push(`restore:${kept}`)
        },
      }),
  }
}

test('the room server forgets the account before it is deleted, while the session still works', async (t) => {
  const s = steps({})
  t.true(await s.run())
  t.deepEqual(s.calls, ['read', 'forget', 'delete'])
})

test('a failed delete puts the notification switches back', async (t) => {
  const s = steps({ deleted: false })
  t.false(await s.run())
  t.deepEqual(s.calls, ['read', 'forget', 'delete', 'restore:prefs'])
})

test('nothing is put back when nothing was forgotten or nothing was read', async (t) => {
  const notForgotten = steps({ deleted: false, forgot: false })
  await notForgotten.run()
  t.false(notForgotten.calls.some((c) => c.startsWith('restore')))

  const notRead = steps({ deleted: false, kept: null })
  await notRead.run()
  t.false(notRead.calls.some((c) => c.startsWith('restore')))
})

test('the room server being down does not stop the account being deleted', async (t) => {
  const s = steps({ forgot: false, kept: null })
  t.true(await s.run())
  t.deepEqual(s.calls, ['read', 'forget', 'delete'])
})
