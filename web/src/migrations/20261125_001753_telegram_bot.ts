import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "waitlist" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"chat" varchar NOT NULL,
  	"lang" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders" ADD COLUMN "telegram_chat" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "waitlist_id" integer;
  CREATE INDEX "waitlist_sku_idx" ON "waitlist" USING btree ("sku");
  CREATE INDEX "waitlist_updated_at_idx" ON "waitlist" USING btree ("updated_at");
  CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");
  CREATE UNIQUE INDEX "sku_chat_idx" ON "waitlist" USING btree ("sku","chat");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_waitlist_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_telegram_chat_idx" ON "orders" USING btree ("telegram_chat");
  CREATE INDEX "payload_locked_documents_rels_waitlist_id_idx" ON "payload_locked_documents_rels" USING btree ("waitlist_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "waitlist" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "waitlist" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_waitlist_fk";
  
  DROP INDEX "orders_telegram_chat_idx";
  DROP INDEX "payload_locked_documents_rels_waitlist_id_idx";
  ALTER TABLE "orders" DROP COLUMN "telegram_chat";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "waitlist_id";`)
}
