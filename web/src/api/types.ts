export type ApiMode = 'stub' | 'live' | 'deterministic_fallback';
export type DataMode = ApiMode | 'demo';
export type Role = 'farmer' | 'buyer' | 'transporter';
export type Crop = 'tomato' | 'potato' | 'carrot';
export type Point = { lat: number; lng: number };
export type LineString = { type: 'LineString'; coordinates: [number, number][] };
export type ListingInput = { demoFarmerId: string; crop: Crop; quantityKg: number; pickup: Point; readyAt: string; minNetMinor: number; confirmed: true };
export type Listing = ListingInput & { latestProposal?: {id:string;status:Plan['status']} | null; id: string; status: 'open' | 'closed' | 'booked' | 'withdrawn'; createdAt: string };
export type OrderInput = { demoBuyerId: string; crop: Crop; remainingKg: number; pricePerKgMinor: number; delivery: Point; deadlineAt: string; allowsPartial: boolean };
export type Order = OrderInput & { id: string; status: 'open' | 'closed' | 'booked' | 'withdrawn'; createdAt: string };
export type TripInput = { demoTransporterId: string; start: Point; end: Point; departureAt: string; availableKg: number; corridorM: number; maxExtraDistanceM: number; maxExtraTimeS: number; baseMinor: number; perKmMinor: number; handlingMinor: number; ratePerKgKmMinor: number; pricingVersion: 'weight-distance-v2' };
// Demo records intentionally contain no fabricated road geometry.
export type Trip = TripInput & { id: string; status: 'open' | 'closed' | 'booked' | 'withdrawn'; createdAt: string; routeGeoJSON: LineString | null; routeDistanceM: number | null; routeDurationS: number | null; routeProvider: string; routeProfile: string };
export type ExtractInput = { text: string; localTimeContext: { now: string; timeZone: 'Asia/Colombo' } };
export type ExtractResult = { draft: { crop: Crop | null; quantityKg: number | null; locationText: string | null; readyAt: string | null; minNetMinor: number | null }; missingFields: string[]; questions: string[] };
export type QuoteSnapshot = { ratePerKgKmMinor: number; pricingVersion: 'weight-distance-v2'; routeCarryDistanceM: number | null; shipmentChargeMinor: number | null; detourChargeMinor: number | null; expiresAt: string; quoteId: string; listingId: string; orderId: string; tripId: string; quantityKg: number; pricePerKgMinor: number; baseMinor: number; perKmMinor: number; handlingMinor: number; grossMinor: number; transportMinor: number; netMinor: number; baseGeometry: LineString | null; modifiedGeometry: LineString | null; baseDistanceM: number | null; modifiedDistanceM: number | null; extraDistanceM: number | null; baseDurationS: number | null; modifiedDurationS: number | null; extraTimeS: number | null; pickupAt: string; deliveryAt: string; generatedAt: string; ruleOutcomes: Record<string, boolean> };
export type TraceEntry = { role: 'market' | 'logistics' | 'advocate' | 'workflow'; action: string; outcome: string };
export type Booking = { buyer: 'pending' | 'approved' | 'rejected'; driver: 'pending' | 'approved' | 'rejected'; approvalExpiresAt: string; farmerAcceptedAt?: string; confirmedAt?: string; resolutionCode?: string };
export type Plan = { booking?: Booking; id: string; listingId: string; orderId: string; tripId: string; quantityKg: number; status: 'proposed' | 'farmer_accepted_pending_confirmations' | 'rejected' | 'confirmed' | 'declined' | 'expired' | 'unavailable' | 'superseded'; quoteSnapshot: QuoteSnapshot; review: { verdict: 'recommend' | 'try_alternative' | 'no_feasible_plan'; selectedQuoteId: string | null; reasonCodes: string[]; explanation: string }; trace: TraceEntry[]; expiresAt: string; createdAt: string; sourceSnapshot?: { listing: Listing; order: Order; trip: Trip }; mode?: DataMode; searchComplete?: boolean };
export type GenerationResult = { outcome: 'proposed' | 'no_feasible_plan'; plan: Plan | null; alternatives: QuoteSnapshot[]; rejections: Array<{ orderId: string; tripId: string; codes: string[] }>; trace: TraceEntry[]; searchComplete: boolean; mode?: DataMode };
export type Meta = { mode: DataMode; persistence: 'session' | 'memory' | 'postgres'; requestId: string };
export type Result<T> = { data: T; meta: Meta };
export interface CropConvoyService {
  mode: 'demo' | 'api';
  listPlans(filter: ProposalFilter): Promise<Result<ProposalPage>>;
  approve(id:string, role:'buyer'|'driver', decision:'approve'|'reject'): Promise<Result<ProposalSummary>>;
  extract(input: ExtractInput): Promise<Result<ExtractResult>>;
  createListing(input: ListingInput): Promise<Result<Listing>>;
  getListing(id: string): Promise<Result<Listing>>;
  listListings(farmerId: string): Promise<Result<Listing[]>>;
  listOrders(): Promise<Result<Order[]>>;
  createOrder(input: OrderInput): Promise<Result<Order>>;
  listTrips(): Promise<Result<Trip[]>>;
  createTrip(input: TripInput): Promise<Result<Trip>>;
  generate(listingId: string): Promise<Result<GenerationResult>>;
  getPlan(id: string): Promise<Result<Plan>>;
  decide(id: string, decision: 'accept' | 'reject'): Promise<Result<Plan>>;
}

export type ProposalSummary = {id:string;listingId:string;orderId:string;tripId:string;quantityKg:number;crop:string;status:Plan['status'];createdAt:string;expiresAt:string;booking:Booking|null;pickup?:Point;delivery?:Point;pickupAt:string;deliveryAt:string;grossMinor:number;transportMinor:number;netMinor?:number;legacy:boolean;pricePerKgMinor?:number;routeCarryDistanceM?:number;ratePerKgKmMinor?:number;extraDistanceM?:number;baseGeometry?:LineString;modifiedGeometry?:LineString;baseMinor?:number;shipmentChargeMinor?:number;detourChargeMinor?:number;handlingMinor?:number};
export type ProposalPage = {items:ProposalSummary[];nextCursor:string|null;pendingCount:number};
export type ProposalFilter = {listingId?:string;status?:'all'|'pending'|'history';cursor?:string};
