import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// PostGIS custom types — Drizzle doesn't ship `geography` natively.
// ============================================================================

const geographyPoint = customType<{ data: { lat: number; lng: number }; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver({ lat, lng }) {
    return `SRID=4326;POINT(${lng} ${lat})`;
  },
});

const geographyPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Polygon, 4326)";
  },
});

// ============================================================================
// locality — 30 seeded rows. Bangalore neighborhoods.
// ============================================================================

export const locality = pgTable(
  "locality",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    centroid: geographyPoint("centroid").notNull(),
    boundary: geographyPolygon("boundary"),
    parentLocalityId: uuid("parent_locality_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_locality_slug").on(t.slug),
    index("idx_locality_centroid").using("gist", t.centroid),
  ],
);

// ============================================================================
// building — stubbed in v1 (FK target only). Populated in v3 (reputation pages).
// ============================================================================

export const building = pgTable(
  "building",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    location: geographyPoint("location").notNull(),
    localityId: uuid("locality_id")
      .notNull()
      .references(() => locality.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_building_slug").on(t.slug),
    index("idx_building_location").using("gist", t.location),
  ],
);

// ============================================================================
// listing — the core entity. v1 seed + v2 scraper share this exact shape.
//
// V2-FUTURE columns (included in v1 to avoid migration churn when scraper lands):
//   source_url, source_listing_id, content_hash, contact_phone_hash,
//   source_confidence. See /src/lib/truth/README.md for the evolution path.
// ============================================================================

export const listing = pgTable(
  "listing",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),

    // Core facts
    title: text("title").notNull(),
    description: text("description"),
    bhk: smallint("bhk").notNull(),
    rentInr: integer("rent_inr").notNull(),
    depositInr: integer("deposit_inr"),
    areaSqft: integer("area_sqft"),
    floor: smallint("floor"),
    totalFloors: smallint("total_floors"),
    furnishing: text("furnishing"),
    availableFrom: date("available_from"),

    // Location
    location: geographyPoint("location").notNull(),
    addressLine: text("address_line"),
    localityId: uuid("locality_id")
      .notNull()
      .references(() => locality.id, { onDelete: "restrict" }),
    buildingId: uuid("building_id").references(() => building.id, { onDelete: "set null" }),

    // Media
    photos: jsonb("photos").notNull().default(sql`'[]'::jsonb`),

    // Contact
    contactName: text("contact_name"),
    // V2-FUTURE: sha256 of normalized phone. Used by owner-vs-broker detector
    // (count frequency across listings). v1 leaves null.
    contactPhoneHash: text("contact_phone_hash"),

    // Truth: source label
    // v1 — hand-labeled in seed/listings.json.
    // v2 — detector output; same column, zero API change.
    sourceLabel: text("source_label").notNull().default("unknown"),
    // V2-FUTURE: detector writes 0..1 confidence. v1 null (hand-label implicit 1.0).
    sourceConfidence: real("source_confidence"),

    // Provenance — v2 scraper writes directly without migration
    sourcePlatform: text("source_platform").notNull().default("seed"),
    sourceUrl: text("source_url"),
    sourceListingId: text("source_listing_id"),
    contentHash: text("content_hash"),

    // Lifecycle
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_listing_slug").on(t.slug),
    index("idx_listing_location").using("gist", t.location),
    index("idx_listing_locality_bhk_active").on(t.localityId, t.bhk, t.isActive),
    index("idx_listing_active").on(t.isActive).where(sql`${t.isActive} = true`),
    // Scraper idempotency. Partial unique: only enforced when source_listing_id is set.
    uniqueIndex("idx_listing_source_external")
      .on(t.sourcePlatform, t.sourceListingId)
      .where(sql`${t.sourceListingId} is not null`),
    check("listing_bhk_range", sql`${t.bhk} between 1 and 5`),
    check("listing_rent_positive", sql`${t.rentInr} > 0`),
    check(
      "listing_source_label_enum",
      sql`${t.sourceLabel} in ('owner', 'broker', 'unknown')`,
    ),
    check(
      "listing_source_platform_enum",
      sql`${t.sourcePlatform} in ('seed', '99acres', 'magicbricks', 'housing', 'nobroker', 'facebook', 'telegram', 'other')`,
    ),
    check(
      "listing_furnishing_enum",
      sql`${t.furnishing} is null or ${t.furnishing} in ('unfurnished', 'semi', 'fully')`,
    ),
    check(
      "listing_source_confidence_range",
      sql`${t.sourceConfidence} is null or (${t.sourceConfidence} >= 0 and ${t.sourceConfidence} <= 1)`,
    ),
  ],
);

// ============================================================================
// profile — mirrors auth.users via trigger (migration 0002).
// ============================================================================

export const profile = pgTable("profile", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// favorite — composite PK, user-scoped, RLS-protected.
// ============================================================================

export const favorite = pgTable(
  "favorite",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profile.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listingId] }),
    index("idx_favorite_user").on(t.userId),
  ],
);

// ============================================================================
// Inferred types
// ============================================================================

export type Locality = typeof locality.$inferSelect;
export type Building = typeof building.$inferSelect;
export type Listing = typeof listing.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type Favorite = typeof favorite.$inferSelect;

export type NewLocality = typeof locality.$inferInsert;
export type NewBuilding = typeof building.$inferInsert;
export type NewListing = typeof listing.$inferInsert;
