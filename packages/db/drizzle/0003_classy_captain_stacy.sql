CREATE TYPE "public"."blob_residency" AS ENUM('control_plane', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."component_kind" AS ENUM('mcp', 'http_api', 'cli', 'connector', 'plugin', 'skill', 'subagent', 'template', 'prompt_pack');--> statement-breakpoint
CREATE TYPE "public"."component_review_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."component_source_kind" AS ENUM('first_party', 'tenant_authored', 'imported');--> statement-breakpoint
CREATE TYPE "public"."discovery_candidate_status" AS ENUM('new', 'triaged', 'promoted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."discovery_source_kind" AS ENUM('mcp_registry', 'git', 'http_index', 'marketplace');--> statement-breakpoint
CREATE TYPE "public"."questionnaire_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."storage_backend" AS ENUM('fs', 's3', 'oci');--> statement-breakpoint
CREATE TABLE "component_blob" (
	"digest" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"media_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_backend" "storage_backend" NOT NULL,
	"residency" "blob_residency" NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_job_function" (
	"tenant_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"job_function_id" uuid NOT NULL,
	CONSTRAINT "component_job_function_component_id_job_function_id_pk" PRIMARY KEY("component_id","job_function_id")
);
--> statement-breakpoint
CREATE TABLE "component" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"kind" "component_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"review_status" "component_review_status" DEFAULT 'draft' NOT NULL,
	"source_kind" "component_source_kind" DEFAULT 'first_party' NOT NULL,
	"source_ref" text DEFAULT '' NOT NULL,
	"endpoint" text,
	"auth_strategy" text,
	"data_classification" text NOT NULL,
	"homepage_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"version" text NOT NULL,
	"manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"manifest_sha256" text NOT NULL,
	"blob_digest" text,
	"blob_size_bytes" bigint,
	"blob_media_type" text,
	"config_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requires" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"changelog" text DEFAULT '' NOT NULL,
	"yanked" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid
);
--> statement-breakpoint
CREATE TABLE "discovery_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"external_ref" text NOT NULL,
	"proposed_kind" "component_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"raw_manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "discovery_candidate_status" DEFAULT 'new' NOT NULL,
	"promoted_component_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discovery_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "discovery_source_kind" NOT NULL,
	"name" text NOT NULL,
	"endpoint" text NOT NULL,
	"auth_ref" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_function" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"function_family" text NOT NULL,
	"industry_profile" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"headcount_weight" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_package_job_function" (
	"tenant_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"job_function_id" uuid NOT NULL,
	CONSTRAINT "work_package_job_function_package_id_job_function_id_pk" PRIMARY KEY("package_id","job_function_id")
);
--> statement-breakpoint
CREATE TABLE "questionnaire_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"industry_profile" "industry_profile" NOT NULL,
	"graph" jsonb NOT NULL,
	"status" "questionnaire_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questionnaire_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"definition_version" integer NOT NULL,
	"user_id" uuid,
	"org_node_id" uuid,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_job_function_key" text,
	"recommended_package_version_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"token_sha256" text NOT NULL,
	"user_id" uuid NOT NULL,
	"package_version_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connections_digest" text NOT NULL,
	"activation_code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"redeemed_client_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "tool" CASCADE;--> statement-breakpoint
DROP TABLE "tool_version" CASCADE;--> statement-breakpoint
ALTER TABLE "work_package" ADD COLUMN "approval_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "work_package_version" ADD COLUMN "manifest_version" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_package_version" ADD COLUMN "components" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "work_package_version" ADD COLUMN "job_functions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "component_blob" ADD CONSTRAINT "component_blob_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_job_function" ADD CONSTRAINT "component_job_function_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_job_function" ADD CONSTRAINT "component_job_function_component_id_component_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."component"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_job_function" ADD CONSTRAINT "component_job_function_job_function_id_job_function_id_fk" FOREIGN KEY ("job_function_id") REFERENCES "public"."job_function"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component" ADD CONSTRAINT "component_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_version" ADD CONSTRAINT "component_version_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_version" ADD CONSTRAINT "component_version_component_id_component_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."component"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidate" ADD CONSTRAINT "discovery_candidate_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidate" ADD CONSTRAINT "discovery_candidate_source_id_discovery_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."discovery_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidate" ADD CONSTRAINT "discovery_candidate_promoted_component_id_component_id_fk" FOREIGN KEY ("promoted_component_id") REFERENCES "public"."component"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_source" ADD CONSTRAINT "discovery_source_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_function" ADD CONSTRAINT "job_function_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_package_job_function" ADD CONSTRAINT "work_package_job_function_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_package_job_function" ADD CONSTRAINT "work_package_job_function_job_function_id_job_function_id_fk" FOREIGN KEY ("job_function_id") REFERENCES "public"."job_function"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_definition" ADD CONSTRAINT "questionnaire_definition_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_response" ADD CONSTRAINT "questionnaire_response_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_response" ADD CONSTRAINT "questionnaire_response_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_token" ADD CONSTRAINT "setup_token_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_token" ADD CONSTRAINT "setup_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "component_tenant_id_slug_uq" ON "component" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "component_version_component_id_version_uq" ON "component_version" USING btree ("component_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_candidate_source_id_external_ref_uq" ON "discovery_candidate" USING btree ("source_id","external_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "job_function_tenant_id_key_uq" ON "job_function" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaire_definition_tenant_id_version_uq" ON "questionnaire_definition" USING btree ("tenant_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "setup_token_tenant_id_activation_code_uq" ON "setup_token" USING btree ("tenant_id","activation_code");--> statement-breakpoint
ALTER TABLE "work_package_version" DROP COLUMN "tools";--> statement-breakpoint
ALTER TABLE "work_package_version" DROP COLUMN "skills";--> statement-breakpoint
ALTER TABLE "work_package_version" DROP COLUMN "subagent_configs";--> statement-breakpoint
ALTER TABLE "work_package_version" DROP COLUMN "template_refs";--> statement-breakpoint
DROP TYPE "public"."tool_kind";--> statement-breakpoint
DROP TYPE "public"."tool_review_status";