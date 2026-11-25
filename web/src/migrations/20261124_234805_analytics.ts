import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "analytics_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"visitor" varchar NOT NULL,
  	"session" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"lang" varchar,
  	"device" varchar,
  	"ref" varchar,
  	"src" varchar,
  	"med" varchar,
  	"cmp" varchar,
  	"data" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders" ADD COLUMN "src" varchar;
  ALTER TABLE "orders" ADD COLUMN "med" varchar;
  ALTER TABLE "orders" ADD COLUMN "cmp" varchar;
  ALTER TABLE "orders" ADD COLUMN "landing" varchar;
  ALTER TABLE "orders" ADD COLUMN "visitor" varchar;
  ALTER TABLE "orders" ADD COLUMN "session" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_events_id" integer;
  CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name");
  CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor");
  CREATE INDEX "analytics_events_session_idx" ON "analytics_events" USING btree ("session");
  CREATE INDEX "analytics_events_updated_at_idx" ON "analytics_events" USING btree ("updated_at");
  CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");
  CREATE INDEX "name_createdAt_idx" ON "analytics_events" USING btree ("name","created_at");
  CREATE INDEX "path_createdAt_idx" ON "analytics_events" USING btree ("path","created_at");
  CREATE INDEX "session_createdAt_idx" ON "analytics_events" USING btree ("session","created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_events_fk" FOREIGN KEY ("analytics_events_id") REFERENCES "public"."analytics_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_src_idx" ON "orders" USING btree ("src");
  CREATE INDEX "orders_cmp_idx" ON "orders" USING btree ("cmp");
  CREATE INDEX "orders_visitor_idx" ON "orders" USING btree ("visitor");
  CREATE INDEX "payload_locked_documents_rels_analytics_events_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "analytics_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "analytics_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_analytics_events_fk";
  
  DROP INDEX "orders_src_idx";
  DROP INDEX "orders_cmp_idx";
  DROP INDEX "orders_visitor_idx";
  DROP INDEX "payload_locked_documents_rels_analytics_events_id_idx";
  ALTER TABLE "orders" DROP COLUMN "src";
  ALTER TABLE "orders" DROP COLUMN "med";
  ALTER TABLE "orders" DROP COLUMN "cmp";
  ALTER TABLE "orders" DROP COLUMN "landing";
  ALTER TABLE "orders" DROP COLUMN "visitor";
  ALTER TABLE "orders" DROP COLUMN "session";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "analytics_events_id";`)
}
