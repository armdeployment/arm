CREATE TABLE "component_install" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sub_account_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"version" text NOT NULL,
	"blob_digest" text,
	"installed_path" text,
	"client_version" text DEFAULT '' NOT NULL,
	"installed_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "component_install" ADD CONSTRAINT "component_install_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_install" ADD CONSTRAINT "component_install_component_id_component_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."component"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "component_install_sub_account_id_component_id_uq" ON "component_install" USING btree ("sub_account_id","component_id");