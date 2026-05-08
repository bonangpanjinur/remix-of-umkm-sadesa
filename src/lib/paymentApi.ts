import { supabase } from '@/integrations/supabase/client';

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  payerEmail: string;
  description: string;
}

export interface PaymentInvoice {
  success: boolean;
  invoice_id: string;
  invoice_url: string;
  expiry_date: string;
}

export interface PaymentStatus {
  success: boolean;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  paid_at?: string;
  payment_method?: string;
}

const API_BASE = '/api';

export async function createPaymentInvoice(request: CreatePaymentRequest): Promise<PaymentInvoice> {
  const response = await fetch(`${API_BASE}/xendit/create-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: request.orderId,
      amount: request.amount,
      payer_email: request.payerEmail,
      description: request.description,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to create payment invoice' }));
    throw new Error(err.error || 'Failed to create payment invoice');
  }

  return response.json();
}

export async function checkPaymentStatus(invoiceId: string): Promise<PaymentStatus> {
  const response = await fetch(`${API_BASE}/xendit/check-status?invoice_id=${invoiceId}`);

  if (!response.ok) {
    throw new Error('Failed to check payment status');
  }

  return response.json();
}

export async function isXenditEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'payment_xendit')
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const settings = data.value as { enabled?: boolean };
  return settings.enabled ?? false;
}
