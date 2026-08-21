CREATE TYPE "public"."package_assignment_status" AS ENUM('requested', 'approved', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."tool_kind" AS ENUM('mcp', 'http_api', 'cli', 'connector');--> statement-breakpoint
CREATE TYPE "public"."tool_review_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."work_package_mode" AS ENUM('automated', 'copilot');--> statement-breakpoint
CREATE TABLE "budget_reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"package_id" uuid,
	"work_type" text,
	"period" text NOT NULL,
	"usd_cap_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"package_version_id" uuid NOT NULL,
	"assignee_type" text NOT NULL,
	"assignee_id" uuid NOT NULL,
	"status" "package_assignment_status" DEFAULT 'requested' NOT NULL,
	"approver_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "tool_kind" NOT NULL,
	"endpoint" text NOT NULL,
	"auth_strategy" text NOT NULL,
	"data_classification" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"review_status" "tool_review_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"version" text NOT NULL,
	"manifest_sha256" text NOT NULL,
	"config_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"changelog" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role_key" text NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"mode" "work_package_mode" DEFAULT 'copilot' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_package_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"version" text NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subagent_configs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_routing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_template" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starter_prompts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_agent_version" text DEFAULT '0.0.0' NOT NULL,
	"manifest_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_reservation" ADD CONSTRAINT "budget_reservation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_reservation" ADD CONSTRAINT "budget_reservation_package_id_work_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."work_package"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_assignment" ADD CONSTRAINT "package_assignment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_assignment" ADD CONSTRAINT "package_assignment_package_version_id_work_package_version_id_fk" FOREIGN KEY ("package_version_id") REFERENCES "public"."work_package_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool" ADD CONSTRAINT "tool_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_version" ADD CONSTRAINT "tool_version_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_version" ADD CONSTRAINT "tool_version_tool_id_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_package" ADD CONSTRAINT "work_package_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_package_version" ADD CONSTRAINT "work_package_version_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_package_version" ADD CONSTRAINT "work_package_version_package_id_work_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."work_package"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_tenant_id_name_uq" ON "tool" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_version_tool_id_version_uq" ON "tool_version" USING btree ("tool_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "work_package_tenant_id_role_key_uq" ON "work_package" USING btree ("tenant_id","role_key");--> statement-breakpoint
CREATE UNIQUE INDEX "work_package_version_package_id_version_uq" ON "work_package_version" USING btree ("package_id","version");