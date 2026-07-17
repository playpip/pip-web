import test from 'ava'
import { greetingFor, kitchenHintFor } from '@/lib/timeOfDay'

test('greetings cover the whole clock', (t) => {
  t.is(greetingFor(1), 'Late one')
  t.is(greetingFor(4), 'Late one')
  t.is(greetingFor(5), 'Morning')
  t.is(greetingFor(11), 'Morning')
  t.is(greetingFor(12), 'Afternoon')
  t.is(greetingFor(17), 'Afternoon')
  t.is(greetingFor(18), 'Evening')
  t.is(greetingFor(23), 'Evening')
})

test('the kitchen hint shifts after midnight', (t) => {
  t.is(kitchenHintFor(2), "Broke? The Kitchen Table's open all night.")
  t.is(kitchenHintFor(14), 'Broke? Win your way back at the Kitchen Table.')
})
