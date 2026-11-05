-- The Pip Rating's second scale (docs/rating.md → "The scale, v2").
--
-- The scale got steeper (each halving of what you give away is now 350
-- points, not 700) and a rating is held under a band until enough decisions
-- are in (`EXPERIENCE_CAPS`). The play behind every rating, `rating_state.core`,
-- is unchanged, so each board number is worked out again from it here, by the
-- same rule as `ratingOf` in supabase/functions/_shared/rating.ts.
--
-- The peak and this week's start were numbers on the old scale, so both start
-- again from the new rating. Deploy `submit-rating` first: an old function
-- would put the next submission back on the old scale.

with rescaled as (
  select
    s.user_id,
    least(
      -- The experience cap: under Strong until 300 decisions, under Expert
      -- until 1,000, under Master until 2,500.
      case
        when (s.core ->> 'decisions')::numeric < 300 then 1599
        when (s.core ->> 'decisions')::numeric < 1000 then 1999
        when (s.core ->> 'decisions')::numeric < 2500 then 2399
        else 3000
      end,
      case
        when (s.core ->> 'sum')::numeric <= 0 then 3000
        else greatest(
          100,
          least(
            3000,
            round(
              1000 - 350 * log(
                2::numeric,
                ((s.core ->> 'sum')::numeric / (s.core ->> 'weight')::numeric) / 0.025
              )
            )
          )
        )
      end
    )::integer as rating
  from public.rating_state s
  where (s.core ->> 'weight')::numeric > 0
)
update public.ratings r
set
  rating = rescaled.rating,
  peak = rescaled.rating,
  week_start_rating = rescaled.rating,
  updated_at = now()
from rescaled
where rescaled.user_id = r.user_id;
