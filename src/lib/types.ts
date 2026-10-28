// Typed data models for the CubeSites Super Admin portal.
// These mirror the shapes the future backend API is expected to return.

export type ContractorStatus = "active" | "suspended" | "expired";
export interface Contractor {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  gstin?: string;
  registeredAt: string;
  status: ContractorStatus;
  lastActivityAt: string;
}

export type SiteStatus = "active" | "inactive" | "archived";
export interface Site {
  id: string;
  contractorId: string;
  name: string;
  location: string;
  status: SiteStatus;
  createdAt: string;
  lastActivityAt: string;
  /** Set when an inactive site was reactivated mid-period (drives proration). */
  reactivatedAt?: string;
}

export interface Staff {
  id: string;
  contractorId: string;
  name: string;
  role: string;
  isOwner: boolean;
  status: "enabled" | "disabled";
  siteIds: string[];
  createdAt: string;
  lastActivityAt: string;
}

export interface Subscription {
  id: string;
  contractorId: string;
  plan: "free" | "paid";
  status: "active" | "expired" | "grace";
  periodStart: string;
  periodEnd: string;
  renewalDate: string;
  expiredAt?: string;
}

export interface PricingVersion {
  id: string;
  effectiveFrom: string;
  siteRate: number;
  freeSites: number;
  staffRate: number;
  freeStaff: number;
  storageFreeMb: number;
  storageBlockMb: number;
  storageBlockRate: number;
  billingDays: number;
  createdBy: string;
  createdAt: string;
  note: string;
}

export type LineType = "site" | "staff" | "storage" | "proration";
export interface TaxRule {
  id: string;
  name: string;
  rate: number;
  inclusive: boolean;
  appliesTo: LineType[];
  effectiveFrom: string;
  effectiveTo?: string;
  invoiceLabel: string;
  registration: string;
}

export interface InvoiceLine {
  type: LineType;
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}
export interface Invoice {
  id: string;
  number: string;
  contractorId: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  /** Frozen copy of the tax rule used when issued — never recalculated. */
  taxSnapshot: { name: string; rate: number; inclusive: boolean; label: string } | null;
  pricingVersionId: string;
  status: "paid" | "pending" | "overdue";
}

export type PaymentMethod = "upi_gateway" | "card_gateway" | "bank_transfer" | "cash" | "cheque";
export type PaymentStatus = "success" | "failed" | "pending_review" | "approved" | "rejected";
export interface Payment {
  id: string;
  invoiceId: string;
  contractorId: string;
  method: PaymentMethod;
  channel: "online" | "manual";
  amount: number;
  tax: number;
  status: PaymentStatus;
  reference: string;
  paidAt: string;
  proofName?: string;
  gatewayStatus?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
}

export interface StorageSnapshot {
  id: string;
  contractorId: string;
  date: string;
  /** null = measurement failed / missing */
  mb: number | null;
  corrected?: { from: number | null; reason: string; by: string; at: string };
}

export interface DriveConnection {
  contractorId: string;
  status: "connected" | "disconnected" | "token_expired";
  email: string;
  connectedAt?: string;
}

export interface BackupLog {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
}
export interface BackupJob {
  id: string;
  contractorId: string;
  type: "scheduled_daily" | "weekly_full" | "manual";
  status: "success" | "failed" | "running" | "overdue";
  attemptedAt: string;
  completedAt?: string;
  sizeMb?: number;
  failure?: string;
  restoreTest: "passed" | "failed" | "not_tested";
  logs: BackupLog[];
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  contractorId?: string;
  action: string;
  target: string;
  before?: string;
  after?: string;
  reason?: string;
}

export type NotificationType =
  | "subscription_expiry"
  | "manual_payment"
  | "backup_failed"
  | "storage_anomaly"
  | "retention_deadline"
  | "delivery_failed";
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  contractorId?: string;
  createdAt: string;
  read: boolean;
}

export interface RetentionNotice {
  id: string;
  contractorId: string;
  sentAt: string;
  channel: "email" | "sms";
  daysBefore: number;
  delivery: "sent" | "failed";
}

export interface SupportNote {
  id: string;
  by: string;
  at: string;
  text: string;
}
export interface SupportCase {
  id: string;
  contractorId: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "waiting" | "resolved";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  notes: SupportNote[];
}

export interface AdminSettings {
  adminName: string;
  adminEmail: string;
  prefs: Record<NotificationType, boolean>;
  ops: { backupHourIst: number; reminderDays: number[]; maintenanceBanner: string };
}

export interface DataState {
  contractors: Contractor[];
  sites: Site[];
  staff: Staff[];
  subscriptions: Subscription[];
  pricing: PricingVersion[];
  taxRules: TaxRule[];
  invoices: Invoice[];
  payments: Payment[];
  snapshots: StorageSnapshot[];
  drive: DriveConnection[];
  backups: BackupJob[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  retention: RetentionNotice[];
  support: SupportCase[];
  settings: AdminSettings;
}
