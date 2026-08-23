-- Component / work-package full-text + fuzzy search (guide 01 §6.1).
--
-- `packages/discovery/src/search.ts` (`buildComponentSearchSql` /
-- `buildWorkPackageSearchSql`) is written against a generated `search_vector`
-- tsvector column + GIN index on `component(name, slug, description)` /
-- `work_package(name, description)`, plus a `pg_trgm` GIN index for fuzzy
-- matching on `component.slug` / `work_package.role_key`. This migration
-- lands that DDL — flagged by the `library` Wave-1 agent as a genuine gap
-- (docs/solutions/2026-08-21-d12-component-library-discovery.md) since
-- packages/db/src/schema/{artifactory,catalog}.ts were frozen during Wave 1.
--
-- The generated columns are intentionally NOT modeled in the Drizzle TS
-- schema (drizzle-orm has no first-class tsvector column type); they are
-- DB-level only, read exclusively by the raw SQL in
-- packages/discovery/src/search.ts.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
ALTER TABLE "component" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
	to_tsvector('english', coalesce("name", '') || ' ' || coalesce("slug", '') || ' ' || coalesce("description", ''))
) STORED;
--> statement-breakpoint
CREATE INDEX "component_search_vector_gin" ON "component" USING gin ("search_vector");
--> statement-breakpoint
CREATE INDEX "component_slug_trgm_gin" ON "component" USING gin ("slug" gin_trgm_ops);
--> statement-breakpoint
ALTER TABLE "work_package" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
	to_tsvector('english', coalesce("name", '') || ' ' || coalesce("description", ''))
) STORED;
--> statement-breakpoint
CREATE INDEX "work_package_search_vector_gin" ON "work_package" USING gin ("search_vector");
--> statement-breakpoint
CREATE INDEX "work_package_role_key_trgm_gin" ON "work_package" USING gin ("role_key" gin_trgm_ops);
