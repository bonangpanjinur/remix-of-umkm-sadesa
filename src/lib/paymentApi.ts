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

/**
 * Create payment invoice via Xendit
 */
export async function createPaymentInvoice(request: CreatePaymentRequest): Promise<PaymentInvoice> {
  const { data, error } = await supabase.functions.invoke('xendit-payment/create-invoice', {
    body: {
      order_id: request.orderId,
      amount: request.amount,
      payer_email: request.payerEmail,
      description: request.description,
    },
  });

  if (error) {
    console.error('Error creating payment invoice:', error);
    throw new Error(error.message || 'Failed to create payment invoice');
  }

  return data as PaymentInvoice;
}

/**
 * Check payment status for an invoice
 */
export async function checkPaymentStatus(invoiceId: string): Promise<PaymentStatus> {
  const { data, error } = await supabase.functions.invoke('xendit-payment/check-status', {
    body: {},
    headers: {},
  });

  // Use query params for GET-like requests
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xendit-payment/check-status?invoice_id=${invoiceId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to check payment status');
  }

  return response.json();
}

/**
 * Check if Xendit payment is enabled
 */
export async function isXenditEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'payment_xendit')
    .single();

  if (error || !data) {
    return false;
  }

  const settings = data.value as { enabled?: boolean };
  return settings.enabled ?? false;
}