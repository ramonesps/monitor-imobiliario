// Tipos TypeScript completos para o Monitor Imobiliário

// ============================================================
// Enums / union types
// ============================================================

export type ListingType = 'sale' | 'rent'

export type FurnishedStatus = 'full' | 'partial' | 'none' | 'unknown'

export type ListingStatus = 'active' | 'inactive' | 'pending_review'

export type DuplicateReviewStatus = 'pending' | 'confirmed_same' | 'confirmed_different'

// ============================================================
// Entidades do banco de dados
// ============================================================

export interface Building {
  id: string
  name: string
  address: string
  city: string | null
  searchTerms: string[] // JSON array
  areaMin: number | null
  areaMax: number | null
  rentPriceMin: number | null
  rentPriceMax: number | null
  salePriceMin: number | null
  salePriceMax: number | null
  createdAt: string // ISO timestamp
}

export interface Listing {
  id: string
  buildingId: string
  type: ListingType
  unitFingerprint: string
  floor: string | null
  area: number | null
  bedrooms: number | null
  city: string | null
  state: string | null
  priceCurrent: number
  priceOriginal: number
  furnished: FurnishedStatus
  description: string
  status: ListingStatus
  firstSeenAt: string // ISO date
  lastSeenAt: string // ISO date
  deactivatedAt: string | null // ISO date
  daysOnMarket: number | null
  createdAt: string // ISO timestamp
}

export interface ListingSource {
  id: string
  listingId: string
  platform: string
  agencyName: string | null
  externalUrl: string
  externalId: string
  firstSeenAt: string
  lastSeenAt: string
}

export interface PriceHistory {
  id: string
  listingId: string
  price: number
  sourceId: string
  recordedAt: string
}

export interface ListingPhoto {
  id: string
  listingId: string
  urlOriginal: string
  localPath: string | null
  phash: string | null // perceptual hash 64-bit
  orderIndex: number
}

export interface DuplicateReview {
  id: string
  listingAId: string
  listingBId: string
  similarityScore: number
  status: DuplicateReviewStatus
  createdAt: string
}

// ============================================================
// Interface do scraper
// ============================================================

export interface RawListing {
  externalId: string
  externalUrl: string
  platform: string
  type: ListingType
  price: number
  floor?: string
  area?: number
  bedrooms?: number
  furnished: FurnishedStatus
  description: string
  agencyName?: string
  photoUrls: string[]
  city?: string  // cidade do anúncio; usado para filtro e exibição
  state?: string // estado (UF)
}

export interface PlatformScraper {
  name: string
  search(buildingName: string, address: string): Promise<RawListing[]>
}

// ============================================================
// Tipos de fingerprint para deduplicação
// ============================================================

export interface ListingFingerprint {
  floor: string | null
  price: number
  type: ListingType
  area: number | null
  bedrooms: number | null
  phashes: string[]
}

// ============================================================
// Tipos de resposta da API
// ============================================================

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface BuildingsListResponse {
  buildings: Building[]
}

export interface ListingsListResponse {
  listings: ListingWithSources[]
  total: number
}

export interface ListingWithSources extends Listing {
  sources: ListingSource[]
  photos: ListingPhoto[]
  priceHistory: PriceHistory[]
}

export interface BuildingStats {
  activeListings: number
  avgRentPrice: number | null
  avgSalePricePerSqm: number | null
  avgDaysOnMarket: number | null
  minPrice: number | null
  maxPrice: number | null
  medianPrice: number | null
}

export interface ListingFilters {
  type?: ListingType
  status?: ListingStatus
  furnished?: FurnishedStatus
  priceMin?: number
  priceMax?: number
}

// ============================================================
// Tipos para o runner do scraper
// ============================================================

export interface ScraperRunOptions {
  platformFilter?: string[]
  buildingIds?: string[]
}

export interface ScraperRunResult {
  platform: string
  buildingId: string
  success: boolean
  newListings: number
  updatedListings: number
  deactivatedListings: number
  error?: string
}
