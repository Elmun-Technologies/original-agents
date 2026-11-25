import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_locales" ADD COLUMN "seo_title" varchar;
  ALTER TABLE "products_locales" ADD COLUMN "seo_description" varchar;
  ALTER TABLE "articles_locales" ADD COLUMN "seo_title" varchar;
  ALTER TABLE "articles_locales" ADD COLUMN "seo_description" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_locales" DROP COLUMN "seo_title";
  ALTER TABLE "products_locales" DROP COLUMN "seo_description";
  ALTER TABLE "articles_locales" DROP COLUMN "seo_title";
  ALTER TABLE "articles_locales" DROP COLUMN "seo_description";`)
}
