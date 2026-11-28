import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reminder_log_kind" AS ENUM('abandoned', 'lapsed');
  CREATE TYPE "public"."enum_reminder_log_channel" AS ENUM('telegram', 'sms', 'none');
  CREATE TYPE "public"."enum_reminder_log_status" AS ENUM('sent', 'failed', 'skipped');
  CREATE TYPE "public"."enum_expenses_category" AS ENUM('ads', 'delivery', 'packing', 'salary', 'rent', 'services', 'tax', 'other');
  CREATE TYPE "public"."enum_site_state_mode" AS ENUM('open', 'closed', 'env');
  CREATE TYPE "public"."enum_reminders_abandoned_channel" AS ENUM('telegram_sms', 'telegram', 'sms');
  CREATE TYPE "public"."enum_reminders_lapsed_channel" AS ENUM('telegram_sms', 'telegram', 'sms');
  CREATE TABLE "reminder_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_reminder_log_kind" NOT NULL,
  	"key" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"order_number" varchar,
  	"channel" "enum_reminder_log_channel",
  	"status" "enum_reminder_log_status" NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "expenses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"category" "enum_expenses_category" NOT NULL,
  	"amount" numeric NOT NULL,
  	"channel" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_state" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mode" "enum_site_state_mode" DEFAULT 'env',
  	"orders_enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_state_locales" (
  	"orders_off_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "reminders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"abandoned_on" boolean DEFAULT false,
  	"abandoned_after_min" numeric DEFAULT 60,
  	"abandoned_channel" "enum_reminders_abandoned_channel" DEFAULT 'telegram_sms',
  	"lapsed_on" boolean DEFAULT false,
  	"lapsed_days" numeric DEFAULT 45,
  	"lapsed_channel" "enum_reminders_lapsed_channel" DEFAULT 'telegram',
  	"lapsed_promo" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "reminders_locales" (
  	"abandoned_text" varchar,
  	"lapsed_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "finance" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"click_fee_pct" numeric,
  	"payme_fee_pct" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "orders_items" ADD COLUMN "cost" numeric;
  ALTER TABLE "orders" ADD COLUMN "marketing_consent" boolean DEFAULT false;
  ALTER TABLE "products_variants" ADD COLUMN "cost" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reminder_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "expenses_id" integer;
  ALTER TABLE "integrations" ADD COLUMN "gsc_service_account" varchar;
  ALTER TABLE "integrations" ADD COLUMN "gsc_property" varchar;
  ALTER TABLE "integrations" ADD COLUMN "yandex_o_auth" varchar;
  ALTER TABLE "site_state_locales" ADD CONSTRAINT "site_state_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reminders_locales" ADD CONSTRAINT "reminders_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reminder_log_kind_idx" ON "reminder_log" USING btree ("kind");
  CREATE UNIQUE INDEX "reminder_log_key_idx" ON "reminder_log" USING btree ("key");
  CREATE INDEX "reminder_log_phone_idx" ON "reminder_log" USING btree ("phone");
  CREATE INDEX "reminder_log_status_idx" ON "reminder_log" USING btree ("status");
  CREATE INDEX "reminder_log_updated_at_idx" ON "reminder_log" USING btree ("updated_at");
  CREATE INDEX "reminder_log_created_at_idx" ON "reminder_log" USING btree ("created_at");
  CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");
  CREATE INDEX "expenses_updated_at_idx" ON "expenses" USING btree ("updated_at");
  CREATE INDEX "expenses_created_at_idx" ON "expenses" USING btree ("created_at");
  CREATE UNIQUE INDEX "site_state_locales_locale_parent_id_unique" ON "site_state_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_state_locales_parent_id_idx" ON "site_state_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "reminders_locales_locale_parent_id_unique" ON "reminders_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "reminders_locales_parent_id_idx" ON "reminders_locales" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reminder_log_fk" FOREIGN KEY ("reminder_log_id") REFERENCES "public"."reminder_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expenses_fk" FOREIGN KEY ("expenses_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_reminder_log_id_idx" ON "payload_locked_documents_rels" USING btree ("reminder_log_id");
  CREATE INDEX "payload_locked_documents_rels_expenses_id_idx" ON "payload_locked_documents_rels" USING btree ("expenses_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reminder_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "expenses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_state" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_state_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reminders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reminders_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "finance" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reminder_log" CASCADE;
  DROP TABLE "expenses" CASCADE;
  DROP TABLE "site_state" CASCADE;
  DROP TABLE "site_state_locales" CASCADE;
  DROP TABLE "reminders" CASCADE;
  DROP TABLE "reminders_locales" CASCADE;
  DROP TABLE "finance" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reminder_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_expenses_fk";
  
  DROP INDEX "payload_locked_documents_rels_reminder_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_expenses_id_idx";
  ALTER TABLE "orders_items" DROP COLUMN "cost";
  ALTER TABLE "orders" DROP COLUMN "marketing_consent";
  ALTER TABLE "products_variants" DROP COLUMN "cost";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reminder_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "expenses_id";
  ALTER TABLE "integrations" DROP COLUMN "gsc_service_account";
  ALTER TABLE "integrations" DROP COLUMN "gsc_property";
  ALTER TABLE "integrations" DROP COLUMN "yandex_o_auth";
  DROP TYPE "public"."enum_reminder_log_kind";
  DROP TYPE "public"."enum_reminder_log_channel";
  DROP TYPE "public"."enum_reminder_log_status";
  DROP TYPE "public"."enum_expenses_category";
  DROP TYPE "public"."enum_site_state_mode";
  DROP TYPE "public"."enum_reminders_abandoned_channel";
  DROP TYPE "public"."enum_reminders_lapsed_channel";`)
}
