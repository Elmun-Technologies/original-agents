import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('uz', 'ru');
  CREATE TYPE "public"."enum_orders_lang" AS ENUM('uz', 'ru');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('new', 'accepted', 'assembling', 'shipping', 'delivered', 'cancelled');
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('pending', 'paid', 'cancelled', 'refund');
  CREATE TYPE "public"."enum_orders_payment" AS ENUM('click', 'payme', 'card');
  CREATE TYPE "public"."enum_orders_delivery" AS ENUM('tashkent', 'region');
  CREATE TYPE "public"."enum_payments_provider" AS ENUM('click', 'payme');
  CREATE TYPE "public"."enum_promo_codes_type" AS ENUM('percent', 'fixed');
  CREATE TYPE "public"."enum_gift_cards_form" AS ENUM('tg', 'card');
  CREATE TYPE "public"."enum_products_skin" AS ENUM('dry', 'oily', 'combo', 'sens', 'normal');
  CREATE TYPE "public"."enum_products_concerns" AS ENUM('acne', 'pores', 'pigment', 'dryness', 'wrinkles', 'dull');
  CREATE TYPE "public"."enum_products_not_for" AS ENUM('pregnant', 'teen');
  CREATE TYPE "public"."enum_products_tags" AS ENUM('hit', 'new', 'set');
  CREATE TYPE "public"."enum_products_fit_skin" AS ENUM('dry', 'oily', 'combo', 'sens', 'normal');
  CREATE TYPE "public"."enum_reviews_skin" AS ENUM('dry', 'oily', 'combo', 'sens', 'normal');
  CREATE TYPE "public"."enum_banners_kind" AS ENUM('slide', 'sale');
  CREATE TYPE "public"."enum_banners_tag_style" AS ENUM('tag-sale', 'tag-hit', 'tag-new');
  CREATE TYPE "public"."enum_segments_exclude" AS ENUM('pregnant', 'teen');
  CREATE TYPE "public"."enum_articles_category" AS ENUM('teri-turi', 'tarkiblar', 'rutina', 'spf', 'erkaklar', 'originallik');
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"slug" varchar,
  	"brand" varchar,
  	"name" varchar NOT NULL,
  	"volume" varchar,
  	"img" varchar,
  	"price" numeric NOT NULL,
  	"qty" numeric NOT NULL
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"token" varchar NOT NULL,
  	"lang" "enum_orders_lang" DEFAULT 'uz',
  	"status" "enum_orders_status" DEFAULT 'new' NOT NULL,
  	"payment_status" "enum_orders_payment_status" DEFAULT 'pending' NOT NULL,
  	"payment" "enum_orders_payment" NOT NULL,
  	"paid_at" timestamp(3) with time zone,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"telegram_updates" boolean DEFAULT true,
  	"delivery" "enum_orders_delivery" NOT NULL,
  	"city" varchar,
  	"address" varchar NOT NULL,
  	"slot" varchar,
  	"comment" varchar,
  	"gift" boolean DEFAULT false,
  	"subtotal" numeric NOT NULL,
  	"discount" numeric DEFAULT 0,
  	"discount_label" varchar,
  	"delivery_fee" numeric DEFAULT 0,
  	"gift_fee" numeric DEFAULT 0,
  	"total" numeric NOT NULL,
  	"points_used" numeric DEFAULT 0,
  	"points_earned" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" "enum_payments_provider" NOT NULL,
  	"provider_id" varchar NOT NULL,
  	"order_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"state" numeric NOT NULL,
  	"create_time" numeric,
  	"perform_time" numeric,
  	"cancel_time" numeric,
  	"reason" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promo_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"type" "enum_promo_codes_type" DEFAULT 'percent' NOT NULL,
  	"value" numeric NOT NULL,
  	"min_total" numeric,
  	"first_order_only" boolean DEFAULT false,
  	"active" boolean DEFAULT true,
  	"valid_to" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promo_codes_locales" (
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "gift_cards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"balance" numeric NOT NULL,
  	"order_number" varchar,
  	"form" "enum_gift_cards_form",
  	"valid_to" timestamp(3) with time zone,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"city" varchar,
  	"address" varchar NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"name" varchar,
  	"skin" varchar,
  	"concerns" jsonb,
  	"routine" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "login_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"tries" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_skin" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_skin",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_concerns" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_concerns",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_not_for" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_not_for",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_tags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_tags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"volume" varchar,
  	"sku" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"stock" numeric DEFAULT 0
  );
  
  CREATE TABLE "products_fit" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"skin" "enum_products_fit_skin" NOT NULL,
  	"ok" boolean DEFAULT true
  );
  
  CREATE TABLE "products_fit_locales" (
  	"note" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "products_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_faq_locales" (
  	"q" varchar NOT NULL,
  	"a" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"brand_id" integer NOT NULL,
  	"category_id" integer NOT NULL,
  	"batch" varchar,
  	"expires_at" timestamp(3) with time zone,
  	"certificate_id" integer,
  	"sample" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_locales" (
  	"type" varchar,
  	"need" varchar,
  	"summary" varchar,
  	"description" jsonb,
  	"ingredients" jsonb,
  	"how_to" jsonb,
  	"expert_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "brands_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar NOT NULL,
  	"color" varchar DEFAULT '#E2DAD2'
  );
  
  CREATE TABLE "brands_lines_locales" (
  	"name" varchar NOT NULL,
  	"note" varchar,
  	"who" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "brands_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "brands_faq_locales" (
  	"q" varchar NOT NULL,
  	"a" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "brands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"cover_id" integer,
  	"featured" boolean DEFAULT false,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brands_locales" (
  	"tagline" varchar,
  	"short" varchar,
  	"about" varchar,
  	"country" varchar DEFAULT 'Janubiy Koreya',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"image_id" integer,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_locales" (
  	"title" varchar NOT NULL,
  	"short" varchar,
  	"seo_title" varchar,
  	"seo_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "price_history" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"sku" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"order" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"skin" "enum_reviews_skin",
  	"rating" numeric NOT NULL,
  	"text" varchar NOT NULL,
  	"helpful" numeric DEFAULT 0,
  	"approved" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "banners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_banners_kind" DEFAULT 'slide' NOT NULL,
  	"active" boolean DEFAULT true,
  	"order" numeric DEFAULT 0,
  	"tag_style" "enum_banners_tag_style" DEFAULT 'tag-sale',
  	"link" varchar,
  	"image_id" integer,
  	"image_pos" varchar DEFAULT '50% 50%',
  	"bg" varchar DEFAULT '#F2D6D0',
  	"ends_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "banners_locales" (
  	"tag" varchar,
  	"title" varchar NOT NULL,
  	"accent" varchar,
  	"text" varchar,
  	"cta" varchar,
  	"tag_short" varchar,
  	"title_short" varchar,
  	"cta_short" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "segments_set" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL
  );
  
  CREATE TABLE "segments_set_locales" (
  	"step" varchar,
  	"why" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "segments_exclude" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_segments_exclude",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "segments_avoid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "segments_avoid_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "segments_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "segments_faq_locales" (
  	"q" varchar NOT NULL,
  	"a" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "segments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"order" numeric DEFAULT 0,
  	"image_id" integer,
  	"image_pos" varchar DEFAULT '50% 30%',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "segments_locales" (
  	"title" varchar NOT NULL,
  	"tag" varchar,
  	"h1" varchar NOT NULL,
  	"say" varchar,
  	"set_name" varchar,
  	"set_why" varchar,
  	"grid_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "segments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "search_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"count" numeric DEFAULT 0,
  	"missed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "legal_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "legal_pages_locales" (
  	"title" varchar NOT NULL,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "articles_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "articles_sections_locales" (
  	"h" varchar NOT NULL,
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "articles_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer
  );
  
  CREATE TABLE "articles_steps_locales" (
  	"t" varchar,
  	"d" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "articles_ingredients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "articles_ingredients_locales" (
  	"name" varchar,
  	"d" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "articles_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "articles_faq_locales" (
  	"q" varchar NOT NULL,
  	"a" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"category" "enum_articles_category" NOT NULL,
  	"cover_id" integer,
  	"cover_pos" varchar DEFAULT '50% 50%',
  	"minutes" numeric DEFAULT 4,
  	"featured" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "articles_locales" (
  	"title" varchar NOT NULL,
  	"accent" varchar,
  	"tag" varchar,
  	"excerpt" varchar,
  	"author" varchar,
  	"reviewed_by" varchar,
  	"short_answer" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "ingredients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ingredients_locales" (
  	"name" varchar NOT NULL,
  	"does" varchar,
  	"who" varchar,
  	"care" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "media_locales" (
  	"caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"orders_id" integer,
  	"payments_id" integer,
  	"promo_codes_id" integer,
  	"gift_cards_id" integer,
  	"customers_id" integer,
  	"login_codes_id" integer,
  	"products_id" integer,
  	"brands_id" integer,
  	"categories_id" integer,
  	"price_history_id" integer,
  	"reviews_id" integer,
  	"banners_id" integer,
  	"segments_id" integer,
  	"search_log_id" integer,
  	"legal_pages_id" integer,
  	"articles_id" integer,
  	"ingredients_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "store_loyalty_tiers_perks" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "store_loyalty_tiers_perks_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "store_loyalty_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"percent" numeric NOT NULL,
  	"from" numeric DEFAULT 0
  );
  
  CREATE TABLE "store_loyalty_tiers_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "store" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"free_delivery_from" numeric DEFAULT 300000 NOT NULL,
  	"tashkent_days" numeric DEFAULT 1 NOT NULL,
  	"region_days" varchar DEFAULT '2–4' NOT NULL,
  	"tashkent_price" numeric DEFAULT 25000 NOT NULL,
  	"region_price" numeric DEFAULT 35000 NOT NULL,
  	"gift_box_price" numeric DEFAULT 15000 NOT NULL,
  	"return_days" numeric DEFAULT 14 NOT NULL,
  	"order_cutoff" varchar DEFAULT '18:00' NOT NULL,
  	"telegram_url" varchar DEFAULT 'https://t.me/' NOT NULL,
  	"telegram_bot_url" varchar DEFAULT 'https://t.me/' NOT NULL,
  	"phone" varchar,
  	"email" varchar,
  	"telegram_handle" varchar,
  	"pickup_hours" varchar DEFAULT '10:00–20:00',
  	"refund_days" varchar DEFAULT '3–5',
  	"min_shelf_months" numeric DEFAULT 6,
  	"loyalty_max_use_pct" numeric DEFAULT 30,
  	"loyalty_credit_days" numeric,
  	"loyalty_expire_months" numeric,
  	"cash_on_delivery" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "store_locales" (
  	"support_hours" varchar DEFAULT '9:00–21:00',
  	"pickup_address" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "store_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promo_codes_locales" ADD CONSTRAINT "promo_codes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_addresses" ADD CONSTRAINT "customers_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_skin" ADD CONSTRAINT "products_skin_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_concerns" ADD CONSTRAINT "products_concerns_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_not_for" ADD CONSTRAINT "products_not_for_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_tags" ADD CONSTRAINT "products_tags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_fit" ADD CONSTRAINT "products_fit_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_fit_locales" ADD CONSTRAINT "products_fit_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_fit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_faq" ADD CONSTRAINT "products_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_faq_locales" ADD CONSTRAINT "products_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_certificate_id_media_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_locales" ADD CONSTRAINT "products_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands_lines" ADD CONSTRAINT "brands_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands_lines_locales" ADD CONSTRAINT "brands_lines_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brands_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands_faq" ADD CONSTRAINT "brands_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands_faq_locales" ADD CONSTRAINT "brands_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brands_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands" ADD CONSTRAINT "brands_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brands_locales" ADD CONSTRAINT "brands_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners_locales" ADD CONSTRAINT "banners_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_set" ADD CONSTRAINT "segments_set_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "segments_set" ADD CONSTRAINT "segments_set_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_set_locales" ADD CONSTRAINT "segments_set_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segments_set"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_exclude" ADD CONSTRAINT "segments_exclude_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_avoid" ADD CONSTRAINT "segments_avoid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_avoid_locales" ADD CONSTRAINT "segments_avoid_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segments_avoid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_faq" ADD CONSTRAINT "segments_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_faq_locales" ADD CONSTRAINT "segments_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segments_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments" ADD CONSTRAINT "segments_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "segments_locales" ADD CONSTRAINT "segments_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_rels" ADD CONSTRAINT "segments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "segments_rels" ADD CONSTRAINT "segments_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_locales" ADD CONSTRAINT "legal_pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_sections" ADD CONSTRAINT "articles_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_sections_locales" ADD CONSTRAINT "articles_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_steps" ADD CONSTRAINT "articles_steps_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_steps" ADD CONSTRAINT "articles_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_steps_locales" ADD CONSTRAINT "articles_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_ingredients" ADD CONSTRAINT "articles_ingredients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_ingredients_locales" ADD CONSTRAINT "articles_ingredients_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_faq" ADD CONSTRAINT "articles_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_faq_locales" ADD CONSTRAINT "articles_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_locales" ADD CONSTRAINT "articles_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ingredients_locales" ADD CONSTRAINT "ingredients_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promo_codes_fk" FOREIGN KEY ("promo_codes_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_cards_fk" FOREIGN KEY ("gift_cards_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_login_codes_fk" FOREIGN KEY ("login_codes_id") REFERENCES "public"."login_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brands_fk" FOREIGN KEY ("brands_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_history_fk" FOREIGN KEY ("price_history_id") REFERENCES "public"."price_history"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_segments_fk" FOREIGN KEY ("segments_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_log_fk" FOREIGN KEY ("search_log_id") REFERENCES "public"."search_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_pages_fk" FOREIGN KEY ("legal_pages_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_loyalty_tiers_perks" ADD CONSTRAINT "store_loyalty_tiers_perks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_loyalty_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_loyalty_tiers_perks_locales" ADD CONSTRAINT "store_loyalty_tiers_perks_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_loyalty_tiers_perks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_loyalty_tiers" ADD CONSTRAINT "store_loyalty_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_loyalty_tiers_locales" ADD CONSTRAINT "store_loyalty_tiers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_loyalty_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_locales" ADD CONSTRAINT "store_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_rels" ADD CONSTRAINT "store_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_rels" ADD CONSTRAINT "store_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("number");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status");
  CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("phone");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE UNIQUE INDEX "payments_provider_id_idx" ON "payments" USING btree ("provider_id");
  CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE UNIQUE INDEX "promo_codes_code_idx" ON "promo_codes" USING btree ("code");
  CREATE INDEX "promo_codes_updated_at_idx" ON "promo_codes" USING btree ("updated_at");
  CREATE INDEX "promo_codes_created_at_idx" ON "promo_codes" USING btree ("created_at");
  CREATE UNIQUE INDEX "promo_codes_locales_locale_parent_id_unique" ON "promo_codes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "promo_codes_locales_parent_id_idx" ON "promo_codes_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "gift_cards_code_idx" ON "gift_cards" USING btree ("code");
  CREATE INDEX "gift_cards_order_number_idx" ON "gift_cards" USING btree ("order_number");
  CREATE INDEX "gift_cards_updated_at_idx" ON "gift_cards" USING btree ("updated_at");
  CREATE INDEX "gift_cards_created_at_idx" ON "gift_cards" USING btree ("created_at");
  CREATE INDEX "customers_addresses_order_idx" ON "customers_addresses" USING btree ("_order");
  CREATE INDEX "customers_addresses_parent_id_idx" ON "customers_addresses" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "login_codes_phone_idx" ON "login_codes" USING btree ("phone");
  CREATE INDEX "login_codes_updated_at_idx" ON "login_codes" USING btree ("updated_at");
  CREATE INDEX "login_codes_created_at_idx" ON "login_codes" USING btree ("created_at");
  CREATE INDEX "products_skin_order_idx" ON "products_skin" USING btree ("order");
  CREATE INDEX "products_skin_parent_idx" ON "products_skin" USING btree ("parent_id");
  CREATE INDEX "products_concerns_order_idx" ON "products_concerns" USING btree ("order");
  CREATE INDEX "products_concerns_parent_idx" ON "products_concerns" USING btree ("parent_id");
  CREATE INDEX "products_not_for_order_idx" ON "products_not_for" USING btree ("order");
  CREATE INDEX "products_not_for_parent_idx" ON "products_not_for" USING btree ("parent_id");
  CREATE INDEX "products_tags_order_idx" ON "products_tags" USING btree ("order");
  CREATE INDEX "products_tags_parent_idx" ON "products_tags" USING btree ("parent_id");
  CREATE INDEX "products_variants_order_idx" ON "products_variants" USING btree ("_order");
  CREATE INDEX "products_variants_parent_id_idx" ON "products_variants" USING btree ("_parent_id");
  CREATE INDEX "products_fit_order_idx" ON "products_fit" USING btree ("_order");
  CREATE INDEX "products_fit_parent_id_idx" ON "products_fit" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_fit_locales_locale_parent_id_unique" ON "products_fit_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_fit_locales_parent_id_idx" ON "products_fit_locales" USING btree ("_parent_id");
  CREATE INDEX "products_faq_order_idx" ON "products_faq" USING btree ("_order");
  CREATE INDEX "products_faq_parent_id_idx" ON "products_faq" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_faq_locales_locale_parent_id_unique" ON "products_faq_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_faq_locales_parent_id_idx" ON "products_faq_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_certificate_idx" ON "products" USING btree ("certificate_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE UNIQUE INDEX "products_locales_locale_parent_id_unique" ON "products_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_locales_parent_id_idx" ON "products_locales" USING btree ("_parent_id");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_media_id_idx" ON "products_rels" USING btree ("media_id");
  CREATE INDEX "products_rels_products_id_idx" ON "products_rels" USING btree ("products_id");
  CREATE INDEX "brands_lines_order_idx" ON "brands_lines" USING btree ("_order");
  CREATE INDEX "brands_lines_parent_id_idx" ON "brands_lines" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "brands_lines_locales_locale_parent_id_unique" ON "brands_lines_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "brands_lines_locales_parent_id_idx" ON "brands_lines_locales" USING btree ("_parent_id");
  CREATE INDEX "brands_faq_order_idx" ON "brands_faq" USING btree ("_order");
  CREATE INDEX "brands_faq_parent_id_idx" ON "brands_faq" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "brands_faq_locales_locale_parent_id_unique" ON "brands_faq_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "brands_faq_locales_parent_id_idx" ON "brands_faq_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");
  CREATE INDEX "brands_cover_idx" ON "brands" USING btree ("cover_id");
  CREATE INDEX "brands_updated_at_idx" ON "brands" USING btree ("updated_at");
  CREATE INDEX "brands_created_at_idx" ON "brands" USING btree ("created_at");
  CREATE UNIQUE INDEX "brands_locales_locale_parent_id_unique" ON "brands_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "brands_locales_parent_id_idx" ON "brands_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "categories_locales_parent_id_idx" ON "categories_locales" USING btree ("_parent_id");
  CREATE INDEX "price_history_product_idx" ON "price_history" USING btree ("product_id");
  CREATE INDEX "price_history_sku_idx" ON "price_history" USING btree ("sku");
  CREATE INDEX "price_history_updated_at_idx" ON "price_history" USING btree ("updated_at");
  CREATE INDEX "price_history_created_at_idx" ON "price_history" USING btree ("created_at");
  CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id");
  CREATE INDEX "reviews_approved_idx" ON "reviews" USING btree ("approved");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE INDEX "banners_image_idx" ON "banners" USING btree ("image_id");
  CREATE INDEX "banners_updated_at_idx" ON "banners" USING btree ("updated_at");
  CREATE INDEX "banners_created_at_idx" ON "banners" USING btree ("created_at");
  CREATE UNIQUE INDEX "banners_locales_locale_parent_id_unique" ON "banners_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "banners_locales_parent_id_idx" ON "banners_locales" USING btree ("_parent_id");
  CREATE INDEX "segments_set_order_idx" ON "segments_set" USING btree ("_order");
  CREATE INDEX "segments_set_parent_id_idx" ON "segments_set" USING btree ("_parent_id");
  CREATE INDEX "segments_set_product_idx" ON "segments_set" USING btree ("product_id");
  CREATE UNIQUE INDEX "segments_set_locales_locale_parent_id_unique" ON "segments_set_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "segments_set_locales_parent_id_idx" ON "segments_set_locales" USING btree ("_parent_id");
  CREATE INDEX "segments_exclude_order_idx" ON "segments_exclude" USING btree ("order");
  CREATE INDEX "segments_exclude_parent_idx" ON "segments_exclude" USING btree ("parent_id");
  CREATE INDEX "segments_avoid_order_idx" ON "segments_avoid" USING btree ("_order");
  CREATE INDEX "segments_avoid_parent_id_idx" ON "segments_avoid" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "segments_avoid_locales_locale_parent_id_unique" ON "segments_avoid_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "segments_avoid_locales_parent_id_idx" ON "segments_avoid_locales" USING btree ("_parent_id");
  CREATE INDEX "segments_faq_order_idx" ON "segments_faq" USING btree ("_order");
  CREATE INDEX "segments_faq_parent_id_idx" ON "segments_faq" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "segments_faq_locales_locale_parent_id_unique" ON "segments_faq_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "segments_faq_locales_parent_id_idx" ON "segments_faq_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "segments_slug_idx" ON "segments" USING btree ("slug");
  CREATE INDEX "segments_image_idx" ON "segments" USING btree ("image_id");
  CREATE INDEX "segments_updated_at_idx" ON "segments" USING btree ("updated_at");
  CREATE INDEX "segments_created_at_idx" ON "segments" USING btree ("created_at");
  CREATE UNIQUE INDEX "segments_locales_locale_parent_id_unique" ON "segments_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "segments_locales_parent_id_idx" ON "segments_locales" USING btree ("_parent_id");
  CREATE INDEX "segments_rels_order_idx" ON "segments_rels" USING btree ("order");
  CREATE INDEX "segments_rels_parent_idx" ON "segments_rels" USING btree ("parent_id");
  CREATE INDEX "segments_rels_path_idx" ON "segments_rels" USING btree ("path");
  CREATE INDEX "segments_rels_products_id_idx" ON "segments_rels" USING btree ("products_id");
  CREATE UNIQUE INDEX "search_log_query_idx" ON "search_log" USING btree ("query");
  CREATE INDEX "search_log_missed_idx" ON "search_log" USING btree ("missed");
  CREATE INDEX "search_log_updated_at_idx" ON "search_log" USING btree ("updated_at");
  CREATE INDEX "search_log_created_at_idx" ON "search_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "legal_pages_slug_idx" ON "legal_pages" USING btree ("slug");
  CREATE INDEX "legal_pages_updated_at_idx" ON "legal_pages" USING btree ("updated_at");
  CREATE INDEX "legal_pages_created_at_idx" ON "legal_pages" USING btree ("created_at");
  CREATE UNIQUE INDEX "legal_pages_locales_locale_parent_id_unique" ON "legal_pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "legal_pages_locales_parent_id_idx" ON "legal_pages_locales" USING btree ("_parent_id");
  CREATE INDEX "articles_sections_order_idx" ON "articles_sections" USING btree ("_order");
  CREATE INDEX "articles_sections_parent_id_idx" ON "articles_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_sections_locales_locale_parent_id_unique" ON "articles_sections_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_sections_locales_parent_id_idx" ON "articles_sections_locales" USING btree ("_parent_id");
  CREATE INDEX "articles_steps_order_idx" ON "articles_steps" USING btree ("_order");
  CREATE INDEX "articles_steps_parent_id_idx" ON "articles_steps" USING btree ("_parent_id");
  CREATE INDEX "articles_steps_product_idx" ON "articles_steps" USING btree ("product_id");
  CREATE UNIQUE INDEX "articles_steps_locales_locale_parent_id_unique" ON "articles_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_steps_locales_parent_id_idx" ON "articles_steps_locales" USING btree ("_parent_id");
  CREATE INDEX "articles_ingredients_order_idx" ON "articles_ingredients" USING btree ("_order");
  CREATE INDEX "articles_ingredients_parent_id_idx" ON "articles_ingredients" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_ingredients_locales_locale_parent_id_unique" ON "articles_ingredients_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_ingredients_locales_parent_id_idx" ON "articles_ingredients_locales" USING btree ("_parent_id");
  CREATE INDEX "articles_faq_order_idx" ON "articles_faq" USING btree ("_order");
  CREATE INDEX "articles_faq_parent_id_idx" ON "articles_faq" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_faq_locales_locale_parent_id_unique" ON "articles_faq_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_faq_locales_parent_id_idx" ON "articles_faq_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_cover_idx" ON "articles" USING btree ("cover_id");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE UNIQUE INDEX "articles_locales_locale_parent_id_unique" ON "articles_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_locales_parent_id_idx" ON "articles_locales" USING btree ("_parent_id");
  CREATE INDEX "ingredients_updated_at_idx" ON "ingredients" USING btree ("updated_at");
  CREATE INDEX "ingredients_created_at_idx" ON "ingredients" USING btree ("created_at");
  CREATE UNIQUE INDEX "ingredients_locales_locale_parent_id_unique" ON "ingredients_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "ingredients_locales_parent_id_idx" ON "ingredients_locales" USING btree ("_parent_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_locales_parent_id_idx" ON "media_locales" USING btree ("_parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");
  CREATE INDEX "payload_locked_documents_rels_promo_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("promo_codes_id");
  CREATE INDEX "payload_locked_documents_rels_gift_cards_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_cards_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_login_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("login_codes_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_brands_id_idx" ON "payload_locked_documents_rels" USING btree ("brands_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_price_history_id_idx" ON "payload_locked_documents_rels" USING btree ("price_history_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_banners_id_idx" ON "payload_locked_documents_rels" USING btree ("banners_id");
  CREATE INDEX "payload_locked_documents_rels_segments_id_idx" ON "payload_locked_documents_rels" USING btree ("segments_id");
  CREATE INDEX "payload_locked_documents_rels_search_log_id_idx" ON "payload_locked_documents_rels" USING btree ("search_log_id");
  CREATE INDEX "payload_locked_documents_rels_legal_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_pages_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_ingredients_id_idx" ON "payload_locked_documents_rels" USING btree ("ingredients_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "store_loyalty_tiers_perks_order_idx" ON "store_loyalty_tiers_perks" USING btree ("_order");
  CREATE INDEX "store_loyalty_tiers_perks_parent_id_idx" ON "store_loyalty_tiers_perks" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "store_loyalty_tiers_perks_locales_locale_parent_id_unique" ON "store_loyalty_tiers_perks_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "store_loyalty_tiers_perks_locales_parent_id_idx" ON "store_loyalty_tiers_perks_locales" USING btree ("_parent_id");
  CREATE INDEX "store_loyalty_tiers_order_idx" ON "store_loyalty_tiers" USING btree ("_order");
  CREATE INDEX "store_loyalty_tiers_parent_id_idx" ON "store_loyalty_tiers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "store_loyalty_tiers_locales_locale_parent_id_unique" ON "store_loyalty_tiers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "store_loyalty_tiers_locales_parent_id_idx" ON "store_loyalty_tiers_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "store_locales_locale_parent_id_unique" ON "store_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "store_locales_parent_id_idx" ON "store_locales" USING btree ("_parent_id");
  CREATE INDEX "store_rels_order_idx" ON "store_rels" USING btree ("order");
  CREATE INDEX "store_rels_parent_idx" ON "store_rels" USING btree ("parent_id");
  CREATE INDEX "store_rels_path_idx" ON "store_rels" USING btree ("path");
  CREATE INDEX "store_rels_products_id_idx" ON "store_rels" USING btree ("products_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "payments" CASCADE;
  DROP TABLE "promo_codes" CASCADE;
  DROP TABLE "promo_codes_locales" CASCADE;
  DROP TABLE "gift_cards" CASCADE;
  DROP TABLE "customers_addresses" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "login_codes" CASCADE;
  DROP TABLE "products_skin" CASCADE;
  DROP TABLE "products_concerns" CASCADE;
  DROP TABLE "products_not_for" CASCADE;
  DROP TABLE "products_tags" CASCADE;
  DROP TABLE "products_variants" CASCADE;
  DROP TABLE "products_fit" CASCADE;
  DROP TABLE "products_fit_locales" CASCADE;
  DROP TABLE "products_faq" CASCADE;
  DROP TABLE "products_faq_locales" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_locales" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "brands_lines" CASCADE;
  DROP TABLE "brands_lines_locales" CASCADE;
  DROP TABLE "brands_faq" CASCADE;
  DROP TABLE "brands_faq_locales" CASCADE;
  DROP TABLE "brands" CASCADE;
  DROP TABLE "brands_locales" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_locales" CASCADE;
  DROP TABLE "price_history" CASCADE;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "banners" CASCADE;
  DROP TABLE "banners_locales" CASCADE;
  DROP TABLE "segments_set" CASCADE;
  DROP TABLE "segments_set_locales" CASCADE;
  DROP TABLE "segments_exclude" CASCADE;
  DROP TABLE "segments_avoid" CASCADE;
  DROP TABLE "segments_avoid_locales" CASCADE;
  DROP TABLE "segments_faq" CASCADE;
  DROP TABLE "segments_faq_locales" CASCADE;
  DROP TABLE "segments" CASCADE;
  DROP TABLE "segments_locales" CASCADE;
  DROP TABLE "segments_rels" CASCADE;
  DROP TABLE "search_log" CASCADE;
  DROP TABLE "legal_pages" CASCADE;
  DROP TABLE "legal_pages_locales" CASCADE;
  DROP TABLE "articles_sections" CASCADE;
  DROP TABLE "articles_sections_locales" CASCADE;
  DROP TABLE "articles_steps" CASCADE;
  DROP TABLE "articles_steps_locales" CASCADE;
  DROP TABLE "articles_ingredients" CASCADE;
  DROP TABLE "articles_ingredients_locales" CASCADE;
  DROP TABLE "articles_faq" CASCADE;
  DROP TABLE "articles_faq_locales" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "articles_locales" CASCADE;
  DROP TABLE "ingredients" CASCADE;
  DROP TABLE "ingredients_locales" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "store_loyalty_tiers_perks" CASCADE;
  DROP TABLE "store_loyalty_tiers_perks_locales" CASCADE;
  DROP TABLE "store_loyalty_tiers" CASCADE;
  DROP TABLE "store_loyalty_tiers_locales" CASCADE;
  DROP TABLE "store" CASCADE;
  DROP TABLE "store_locales" CASCADE;
  DROP TABLE "store_rels" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_orders_lang";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_payment_status";
  DROP TYPE "public"."enum_orders_payment";
  DROP TYPE "public"."enum_orders_delivery";
  DROP TYPE "public"."enum_payments_provider";
  DROP TYPE "public"."enum_promo_codes_type";
  DROP TYPE "public"."enum_gift_cards_form";
  DROP TYPE "public"."enum_products_skin";
  DROP TYPE "public"."enum_products_concerns";
  DROP TYPE "public"."enum_products_not_for";
  DROP TYPE "public"."enum_products_tags";
  DROP TYPE "public"."enum_products_fit_skin";
  DROP TYPE "public"."enum_reviews_skin";
  DROP TYPE "public"."enum_banners_kind";
  DROP TYPE "public"."enum_banners_tag_style";
  DROP TYPE "public"."enum_segments_exclude";
  DROP TYPE "public"."enum_articles_category";`)
}
