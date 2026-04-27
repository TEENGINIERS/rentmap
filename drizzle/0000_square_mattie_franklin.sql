CREATE TABLE IF NOT EXISTS "building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"locality_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "building_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favorite" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"bhk" smallint NOT NULL,
	"rent_inr" integer NOT NULL,
	"deposit_inr" integer,
	"area_sqft" integer,
	"floor" smallint,
	"total_floors" smallint,
	"furnishing" text,
	"available_from" date,
	"location" geography(Point, 4326) NOT NULL,
	"address_line" text,
	"locality_id" uuid NOT NULL,
	"building_id" uuid,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_name" text,
	"contact_phone_hash" text,
	"source_label" text DEFAULT 'unknown' NOT NULL,
	"source_confidence" real,
	"source_platform" text DEFAULT 'seed' NOT NULL,
	"source_url" text,
	"source_listing_id" text,
	"content_hash" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_slug_unique" UNIQUE("slug"),
	CONSTRAINT "listing_bhk_range" CHECK ("listing"."bhk" between 1 and 5),
	CONSTRAINT "listing_rent_positive" CHECK ("listing"."rent_inr" > 0),
	CONSTRAINT "listing_source_label_enum" CHECK ("listing"."source_label" in ('owner', 'broker', 'unknown')),
	CONSTRAINT "listing_source_platform_enum" CHECK ("listing"."source_platform" in ('seed', '99acres', 'magicbricks', 'housing', 'nobroker', 'facebook', 'telegram', 'other')),
	CONSTRAINT "listing_furnishing_enum" CHECK ("listing"."furnishing" is null or "listing"."furnishing" in ('unfurnished', 'semi', 'fully')),
	CONSTRAINT "listing_source_confidence_range" CHECK ("listing"."source_confidence" is null or ("listing"."source_confidence" >= 0 and "listing"."source_confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locality" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"centroid" geography(Point, 4326) NOT NULL,
	"boundary" geography(Polygon, 4326),
	"parent_locality_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locality_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "building" ADD CONSTRAINT "building_locality_id_locality_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."locality"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorite" ADD CONSTRAINT "favorite_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing" ADD CONSTRAINT "listing_locality_id_locality_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."locality"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing" ADD CONSTRAINT "listing_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_building_slug" ON "building" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_building_location" ON "building" USING gist ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_favorite_user" ON "favorite" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_slug" ON "listing" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listing_location" ON "listing" USING gist ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listing_locality_bhk_active" ON "listing" USING btree ("locality_id","bhk","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listing_active" ON "listing" USING btree ("is_active") WHERE "listing"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_source_external" ON "listing" USING btree ("source_platform","source_listing_id") WHERE "listing"."source_listing_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_locality_slug" ON "locality" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_locality_centroid" ON "locality" USING gist ("centroid");