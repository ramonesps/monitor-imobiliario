// Schema Drizzle ORM para o Monitor Imobiliário
// Todas as 6 tabelas conforme SPEC.md

import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

// ============================================================
// buildings
// ============================================================
export const buildings = sqliteTable('buildings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  searchTerms: text('search_terms'), // JSON array serializado
  createdAt: text('created_at').notNull(),
})

// ============================================================
// listings
// ============================================================
export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),
  buildingId: text('building_id')
    .notNull()
    .references(() => buildings.id),
  type: text('type').notNull(), // 'sale' | 'rent'
  unitFingerprint: text('unit_fingerprint').notNull(),
  floor: text('floor'),
  area: real('area'),
  bedrooms: integer('bedrooms'),
  priceCurrent: real('price_current').notNull(),
  priceOriginal: real('price_original').notNull(),
  furnished: text('furnished').notNull(), // 'full' | 'partial' | 'none' | 'unknown'
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('active'), // 'active' | 'inactive' | 'pending_review'
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  deactivatedAt: text('deactivated_at'),
  daysOnMarket: integer('days_on_market'),
  createdAt: text('created_at').notNull(),
})

// ============================================================
// listing_sources
// ============================================================
export const listingSources = sqliteTable('listing_sources', {
  id: text('id').primaryKey(),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id),
  platform: text('platform').notNull(),
  agencyName: text('agency_name'),
  externalUrl: text('external_url').notNull(),
  externalId: text('external_id').notNull(),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
})

// ============================================================
// price_history
// ============================================================
export const priceHistory = sqliteTable('price_history', {
  id: text('id').primaryKey(),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id),
  price: real('price').notNull(),
  sourceId: text('source_id').references(() => listingSources.id),
  recordedAt: text('recorded_at').notNull(),
})

// ============================================================
// listing_photos
// ============================================================
export const listingPhotos = sqliteTable('listing_photos', {
  id: text('id').primaryKey(),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id),
  urlOriginal: text('url_original').notNull(),
  localPath: text('local_path'),
  phash: text('phash'), // perceptual hash 64-bit
  orderIndex: integer('order_index').notNull().default(0),
})

// ============================================================
// duplicate_reviews
// ============================================================
export const duplicateReviews = sqliteTable('duplicate_reviews', {
  id: text('id').primaryKey(),
  listingAId: text('listing_a_id')
    .notNull()
    .references(() => listings.id),
  listingBId: text('listing_b_id')
    .notNull()
    .references(() => listings.id),
  similarityScore: real('similarity_score').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'confirmed_same' | 'confirmed_different'
  createdAt: text('created_at').notNull(),
})

// ============================================================
// Tipos inferidos do Drizzle
// ============================================================
export type Building = typeof buildings.$inferSelect
export type NewBuilding = typeof buildings.$inferInsert
export type Listing = typeof listings.$inferSelect
export type NewListing = typeof listings.$inferInsert
export type ListingSource = typeof listingSources.$inferSelect
export type NewListingSource = typeof listingSources.$inferInsert
export type PriceHistory = typeof priceHistory.$inferSelect
export type NewPriceHistory = typeof priceHistory.$inferInsert
export type ListingPhoto = typeof listingPhotos.$inferSelect
export type NewListingPhoto = typeof listingPhotos.$inferInsert
export type DuplicateReview = typeof duplicateReviews.$inferSelect
export type NewDuplicateReview = typeof duplicateReviews.$inferInsert
