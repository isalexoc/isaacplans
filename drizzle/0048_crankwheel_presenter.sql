-- Which CrankWheel account a meeting link was minted on: a CRANKWHEEL_PRESENTERS email (an agent's
-- own account, e.g. Ysmael for Legal Shield), or NULL for Isaac's (the env defaults). Additive and
-- nullable, so the code on main keeps working with it: apply BEFORE deploying the code that reads it.
--> statement-breakpoint
ALTER TABLE "crankwheel_meetings" ADD COLUMN IF NOT EXISTS "presenter_email" text;
