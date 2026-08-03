CREATE TYPE "public"."industry_profile" AS ENUM('tech', 'manufacturing', 'finance', 'holding', 'custom');--> statement-breakpoint
CREATE TYPE "public"."work_type_stage" AS ENUM('structural', 'cache', 'linear', 'embedding', 'unknown');--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'mes';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'erp';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'scada';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'historian';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'plm';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'cmms';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'iot';--> statement-breakpoint
ALTER TYPE "public"."scope_type" ADD VALUE 'plant';--> statement-breakpoint
ALTER TYPE "public"."scope_type" ADD VALUE 'line';--> statement-breakpoint
ALTER TYPE "public"."scope_type" ADD VALUE 'cell';--> statement-breakpoint
ALTER TYPE "public"."scope_type" ADD VALUE 'station';--> statement-breakpoint
CREATE TABLE "work_type_taxonomy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid NOT NULL,
	"name" text NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secondary_tag_presets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classifier_version" text DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_mutation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"verb" text NOT NULL,
	"node_id" uuid NOT NULL,
	"node_name" text NOT NULL,
	"node_type" text NOT NULL,
	"old_parent_id" uuid,
	"new_parent_id" uuid,
	"new_name" text,
	"reason" text,
	"auth_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department" ADD COLUMN "parent_department_id" uuid;--> statement-breakpoint
ALTER TABLE "department" ADD COLUMN "node_type" text;--> statement-breakpoint
ALTER TABLE "department" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "industry_profile" "industry_profile" DEFAULT 'tech' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "profile_applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "preset_key" text;--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "classification_level" ADD COLUMN "regulatory_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "work_type_taxonomy" ADD CONSTRAINT "work_type_taxonomy_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_mutation_log" ADD CONSTRAINT "org_mutation_log_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_mutation_log" ADD CONSTRAINT "org_mutation_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;