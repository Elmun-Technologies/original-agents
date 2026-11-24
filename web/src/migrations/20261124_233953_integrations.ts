import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ga4_id" varchar,
  	"metrica_id" varchar,
  	"metrica_webvisor" boolean DEFAULT false,
  	"meta_pixel_id" varchar,
  	"google_verification" varchar,
  	"yandex_verification" varchar,
  	"bing_verification" varchar,
  	"index_now_on" boolean DEFAULT false,
  	"index_now_key" varchar,
  	"payments_mode" varchar,
  	"card_provider" varchar,
  	"click_service_id" varchar,
  	"click_merchant_id" varchar,
  	"click_secret" varchar,
  	"payme_merchant_id" varchar,
  	"payme_key" varchar,
  	"payme_test" boolean DEFAULT false,
  	"sms_mode" varchar,
  	"eskiz_email" varchar,
  	"eskiz_password" varchar,
  	"eskiz_from" varchar,
  	"telegram_token" varchar,
  	"telegram_admin_ids" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations" CASCADE;`)
}
