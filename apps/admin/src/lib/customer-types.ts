import type { CustomerSourceValue, CustomerTypeValue, OrderStatusValue, SalesChannelValue } from '@ktm/shared';

export interface CustomerGroupOption {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  discountBps: number;
}

export interface CustomerListItem {
  id: string;
  type: CustomerTypeValue;
  fullName: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  taxCode: string | null;
  source: CustomerSourceValue;
  createdAt: string;
  group: { id: string; name: string };
  assignedStaff: { id: string; fullName: string } | null;
  _count: { orders: number };
  lastOrderAt: string | null;
  completedTotal: number;
}

export interface CustomerContact {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  isPrimary: boolean;
  note: string | null;
}

/** Khớp CustomerService.getById */
export interface CustomerDetail {
  id: string;
  type: CustomerTypeValue;
  fullName: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  taxCode: string | null;
  invoiceAddress: string | null;
  source: CustomerSourceValue;
  note: string | null;
  privacyConsentAt: string | null;
  createdAt: string;
  group: { id: string; code: string; name: string };
  assignedStaff: { id: string; fullName: string } | null;
  contacts: CustomerContact[];
  orders: {
    id: string;
    code: string;
    channel: SalesChannelValue;
    status: OrderStatusValue;
    grandTotal: number;
    paidTotal: number;
    placedAt: string;
    _count: { lines: number };
    lines: { name: string; quantity: number }[];
  }[];
  stats: { orderCount: number; openCount: number; completedTotal: number };
}