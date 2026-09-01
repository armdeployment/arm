--> statement-breakpoint
-- agent.name — the display name the registry shows.
--
-- Written by hand rather than left as drizzle-kit's single
-- `ADD COLUMN "name" text NOT NULL`, which fails outright on any table that
-- already has rows: Postgres has no value to put in the new column. Adding it
-- with a default backfills every existing row, and dropping the default
-- afterwards leaves the column exactly as the schema declares it — NOT NULL
-- with no default, so future inserts must supply a name.
--
-- The placeholder is deliberately visible. An agent named "(unnamed)" in the
-- registry is a prompt to fix it; an empty string reads as a rendering bug.
ALTER TABLE "agent" ADD COLUMN "name" text NOT NULL DEFAULT '(unnamed)';--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "name" DROP DEFAULT;
