export type Id = string;
export type IsoDate = string;
export type EntityStatus = "draft" | "active" | "paused" | "archived";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  name: string;
  workspaceName?: string | undefined;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: Id;
  email: string;
  name: string;
  avatarUrl?: string;
  workspaceIds: Id[];
  createdAt: IsoDate;
}

export interface Workspace {
  id: Id;
  name: string;
  slug: string;
  ownerId: Id;
  plan: "free" | "starter" | "growth" | "enterprise";
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Brand {
  id: Id;
  workspaceId: Id;
  name: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  voice?: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Campaign {
  id: Id;
  workspaceId: Id;
  brandId: Id;
  name: string;
  objective: string;
  status: EntityStatus;
  startsAt?: IsoDate;
  endsAt?: IsoDate;
  budgetMinor?: number;
  currency?: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Product {
  id: Id;
  brandId: Id;
  name: string;
  description?: string;
  sku?: string;
  priceMinor?: number;
  currency?: string;
  imageUrls: string[];
}

export interface Service {
  id: Id;
  brandId: Id;
  name: string;
  description?: string;
  priceMinor?: number;
  currency?: string;
}

export interface TargetGroup {
  id: Id;
  workspaceId: Id;
  name: string;
  description?: string;
  countries: string[];
  languages: string[];
  interests: string[];
  minAge?: number;
  maxAge?: number;
}

export interface Proof {
  id: Id;
  campaignId: Id;
  submittedBy: Id;
  mediaUrls: string[];
  note?: string;
  status: "pending" | "analyzing" | "needs_review" | "approved" | "rejected";
  aiConfidence?: number;
  submittedAt: IsoDate;
  reviewedAt?: IsoDate;
}

export interface Reward {
  id: Id;
  workspaceId: Id;
  proofId: Id;
  recipientId: Id;
  amountMinor: number;
  currency: string;
  status: "pending_verification" | "approved" | "settling" | "settled" | "rejected";
  approvedBy?: Id;
  settledAt?: IsoDate;
}

export interface Lead {
  id: Id;
  campaignId: Id;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdAt: IsoDate;
}

export interface Conversion {
  id: Id;
  campaignId: Id;
  leadId?: Id;
  clickId?: Id;
  type: string;
  valueMinor?: number;
  currency?: string;
  occurredAt: IsoDate;
}

export interface ShortLink {
  id: Id;
  workspaceId: Id;
  slug: string;
  destinationUrl: string;
  campaignId?: Id;
  active: boolean;
  createdAt: IsoDate;
}

export interface QrCode {
  id: Id;
  workspaceId: Id;
  shortLinkId: Id;
  imageUrl: string;
  format: "png" | "svg";
  createdAt: IsoDate;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
}
