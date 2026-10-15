export type PriceRating = 'OVERPRICED' | 'FAIR' | 'GOOD_DEAL' | 'STEAL';

export type ReviewSentiment = 'OVERWHELMINGLY_POSITIVE' | 'POSITIVE' | 'MIXED' | 'NEGATIVE';

export interface KeySpec {
  label: string;
  value: string;
}

export interface ProductReview {
  author: string;
  source: string;
  rating: number;
  comment: string;
  date: string;
}

export interface RetailerPrice {
  retailer: string;
  price: number;
  inStock: boolean;
  dealTag?: string;
  url?: string;
}

export interface HistoricalPriceRange {
  lowestEver: number;
  averagePrice: number;
  highestPrice: number;
}

export interface ProductIdentification {
  /** How the product was identified. Only 'database' is a verified match. */
  method: 'database' | 'photo' | 'search' | 'correction';
  verified: boolean;
  source?: string;
  upc?: string;
  imageUrl?: string;
}

export interface UnidentifiedBarcode {
  barcode: string;
  message: string;
  lookupIncomplete?: boolean;
}

export interface ProductScanResult {
  productName: string;
  brand: string;
  category: string;
  confidence?: number;
  summary: string;
  msrp: number;
  goodPrice: number;
  greatDealPrice: number;
  priceRating: PriceRating;
  priceAdvice: string;
  /** Only present when backed by a real source; the app has none yet, so normally omitted. */
  rating?: number;
  totalReviewsCount?: number;
  reviewSentiment?: ReviewSentiment;
  identification?: ProductIdentification;
  pricesAreEstimates?: boolean;
  pros: string[];
  cons: string[];
  keySpecs: KeySpec[];
  topReviews: ProductReview[];
  priceComparison: RetailerPrice[];
  historicalPriceRange: HistoricalPriceRange;
  verdict: string;
  geminiDescription?: string;
}

export interface ProductQAMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: number;
}

export interface SavedScanItem {
  id: string;
  timestamp: number;
  thumbnailUrl?: string;
  scanResult: ProductScanResult;
  userNotes?: string;
  scanType?: 'barcode' | 'camera' | 'search' | 'preset';
  isBookmarked?: boolean;
  tags?: string[];
  targetPrice?: number;
}

export interface SampleProductPreset {
  id: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  description: string;
}
