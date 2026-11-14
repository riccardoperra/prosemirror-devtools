export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  return Math.round(value) as Cents;
}

export const currencies = ["EUR", "USD"] as const;
export type Currency = (typeof currencies)[number];

const moneyFormatters = new Map<Currency, Intl.NumberFormat>();

export function formatMoney(amount: Cents, currency: Currency): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IE", { style: "currency", currency });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(amount / 100);
}

export const vatRates = [0, 4, 10, 22] as const;
export type VatRate = (typeof vatRates)[number];

export function isVatRate(value: number): value is VatRate {
  return (vatRates as readonly number[]).includes(value);
}

export const invoiceStatuses = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const transitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["paid", "void", "draft"],
  paid: [],
  void: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return transitions[from].includes(to);
}

/** Terminal statuses are the settled ones, so the document is locked exactly when no transition remains. */
export function isLocked(status: InvoiceStatus): boolean {
  return transitions[status].length === 0;
}

export interface InvoiceMeta {
  readonly number: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly currency: Currency;
  readonly status: InvoiceStatus;
}

export interface LineItem {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: Cents;
  readonly vatRate: VatRate;
  readonly discountPercent: number;
}

export function lineNet(item: LineItem): Cents {
  return cents(item.quantity * item.unitPrice * (1 - item.discountPercent / 100));
}

export interface VatBucket {
  readonly rate: VatRate;
  readonly base: Cents;
  readonly tax: Cents;
}

export interface InvoiceTotals {
  readonly net: Cents;
  readonly vatByRate: readonly VatBucket[];
  readonly gross: Cents;
}

export function computeTotals(items: readonly LineItem[]): InvoiceTotals {
  const bases = new Map<VatRate, number>();
  let net = 0;
  for (const item of items) {
    const amount = lineNet(item);
    net += amount;
    bases.set(item.vatRate, (bases.get(item.vatRate) ?? 0) + amount);
  }
  const vatByRate = [...bases]
    .sort(([a], [b]) => a - b)
    .map(([rate, base]) => ({ rate, base: cents(base), tax: cents((base * rate) / 100) }));
  const vat = vatByRate.reduce((sum, bucket) => sum + bucket.tax, 0);
  return { net: cents(net), vatByRate, gross: cents(net + vat) };
}

export interface Issue {
  readonly code: string;
  readonly message: string;
}

interface LineItemRule extends Issue {
  test(item: LineItem): boolean;
}

export const lineItemRules: readonly LineItemRule[] = [
  {
    code: "description-required",
    message: "Describe what is being billed.",
    test: (item) => item.description.trim().length > 0,
  },
  {
    code: "quantity-positive",
    message: "Quantity must be greater than zero.",
    test: (item) => item.quantity > 0,
  },
  {
    code: "price-non-negative",
    message: "Unit price cannot be negative.",
    test: (item) => item.unitPrice >= 0,
  },
  {
    code: "discount-range",
    message: "Discount must be between 0% and 100%.",
    test: (item) => item.discountPercent >= 0 && item.discountPercent <= 100,
  },
];

export function validateLineItem(item: LineItem): Issue[] {
  return lineItemRules
    .filter((rule) => !rule.test(item))
    .map(({ code, message }) => ({ code, message }));
}

export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export interface Invoice {
  readonly meta: InvoiceMeta;
  readonly seller: string;
  readonly buyer: string;
  readonly items: readonly LineItem[];
}

export function reprice(item: LineItem, percent: number): Cents {
  return cents(item.unitPrice * (1 + percent / 100));
}

export interface TimesheetEntry {
  readonly project: string;
  readonly date: string;
  readonly person: string;
  readonly hours: number;
}

export interface TimesheetGroup {
  readonly project: string;
  readonly hours: number;
  readonly entries: readonly TimesheetEntry[];
}

export function groupTimesheet(entries: readonly TimesheetEntry[]): TimesheetGroup[] {
  const groups = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.project);
    if (group) group.push(entry);
    else groups.set(entry.project, [entry]);
  }
  return [...groups].map(([project, grouped]) => ({
    project,
    hours: grouped.reduce((sum, entry) => sum + entry.hours, 0),
    entries: grouped,
  }));
}

export interface InstallmentPlan {
  readonly label: string;
  readonly percent: number;
  readonly dueAfterDays: number;
}

export interface Installment extends InstallmentPlan {
  readonly amount: Cents;
  readonly dueDate: string;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The last installment absorbs rounding so the schedule always sums to the gross total. */
export function scheduleInstallments(
  gross: Cents,
  issueDate: string,
  plan: readonly InstallmentPlan[],
): Installment[] {
  let allocated = 0;
  return plan.map((step, index) => {
    const amount =
      index === plan.length - 1 ? cents(gross - allocated) : cents((gross * step.percent) / 100);
    allocated += amount;
    return { ...step, amount, dueDate: addDays(issueDate, step.dueAfterDays) };
  });
}

export const pageKinds = {
  cover: { title: "Invoice" },
  lineItems: { title: "Line items" },
  timesheet: { title: "Appendix A · Timesheet" },
  schedule: { title: "Payment schedule" },
  terms: { title: "Terms and notes" },
  signatures: { title: "Signatures" },
  continued: { title: "Continued" },
} as const;

export type PageKind = keyof typeof pageKinds;

export function isPageKind(value: string): value is PageKind {
  return Object.hasOwn(pageKinds, value);
}
