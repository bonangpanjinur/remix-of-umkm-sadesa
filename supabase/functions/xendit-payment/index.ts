import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateInvoiceRequest {
  order_id: string;
  amount: number;
  payer_email: string;
  description: string;
}

interface XenditSettings {
  enabled: boolean;
  secret_key?: string;
  public_key?: string;
  is_production?: boolean;
  callback_token?: string;
}

async function getXenditSettings(supabaseUrl: string, serviceRoleKey: string): Promise<XenditSettings> {
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "payment_xendit")
    .single();

  if (error || !data) {
    throw new Error("Xendit settings not found");
  }

  const settings = data.value as XenditSettings;

  if (!settings.enabled) {
    throw new Error("Xendit payment is disabled");
  }

  if (!settings.secret_key) {
    throw new Error("Xendit secret key not configured");
  }

  return settings;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    // Get Xendit settings from database
    const xenditSettings = await getXenditSettings(supabaseUrl, serviceRoleKey);
    const xenditSecretKey = xenditSettings.secret_key!;
    
    const xenditBaseUrl = "https://api.xendit.co";
    const authHeader = `Basic ${btoa(xenditSecretKey + ":")}`;

    if (action === "create-invoice" && req.method === "POST") {
      // Create invoice for order payment
      const body: CreateInvoiceRequest = await req.json();
      
      const invoicePayload = {
        external_id: body.order_id,
        amount: body.amount,
        payer_email: body.payer_email,
        description: body.description,
        invoice_duration: 86400, // 24 hours
        currency: "IDR",
        success_redirect_url: `${req.headers.get("origin")}/orders?payment=success`,
        failure_redirect_url: `${req.headers.get("origin")}/orders?payment=failed`,
      };

      const response = await fetch(`${xenditBaseUrl}/v2/invoices`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoicePayload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Xendit API error:", errorData);
        throw new Error(`Xendit API error: ${response.status}`);
      }

      const invoice = await response.json();

      // Update order with payment info
      await supabaseAdmin
        .from("orders")
        .update({
          payment_invoice_id: invoice.id,
          payment_invoice_url: invoice.invoice_url,
          payment_status: "PENDING",
        })
        .eq("id", body.order_id);

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: invoice.id,
          invoice_url: invoice.invoice_url,
          expiry_date: invoice.expiry_date,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (action === "check-status" && req.method === "GET") {
      const invoiceId = url.searchParams.get("invoice_id");
      
      if (!invoiceId) {
        throw new Error("Invoice ID is required");
      }

      const response = await fetch(`${xenditBaseUrl}/v2/invoices/${invoiceId}`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check invoice status: ${response.status}`);
      }

      const invoice = await response.json();

      return new Response(
        JSON.stringify({
          success: true,
          status: invoice.status,
          paid_at: invoice.paid_at,
          payment_method: invoice.payment_method,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});