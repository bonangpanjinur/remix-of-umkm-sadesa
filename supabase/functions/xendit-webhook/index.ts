import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-callback-token",
};

interface XenditInvoiceCallback {
  id: string;
  external_id: string;
  status: "PAID" | "EXPIRED" | "PENDING";
  paid_at?: string;
  payment_method?: string;
  payment_channel?: string;
  paid_amount?: number;
}

interface XenditSettings {
  enabled: boolean;
  callback_token?: string;
}

async function getXenditSettings(supabaseUrl: string, serviceRoleKey: string): Promise<XenditSettings | null> {
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "payment_xendit")
    .single();

  if (error || !data) {
    return null;
  }

  return data.value as XenditSettings;
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

    // Get Xendit settings
    const xenditSettings = await getXenditSettings(supabaseUrl, serviceRoleKey);
    
    // Verify callback token if configured
    if (xenditSettings?.callback_token) {
      const callbackToken = req.headers.get("x-callback-token");
      if (callbackToken !== xenditSettings.callback_token) {
        console.error("Invalid callback token");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { headers: corsHeaders, status: 401 }
        );
      }
    }

    const body: XenditInvoiceCallback = await req.json();
    console.log("Received webhook:", JSON.stringify(body));

    // Determine payment status based on Xendit status
    let paymentStatus: string;
    let orderStatus: string | null = null;

    switch (body.status) {
      case "PAID":
        paymentStatus = "PAID";
        orderStatus = "CONFIRMED"; // Auto-confirm order when paid
        break;
      case "EXPIRED":
        paymentStatus = "EXPIRED";
        orderStatus = "CANCELLED";
        break;
      default:
        paymentStatus = "PENDING";
        break;
    }

    // Update order with payment status
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
      payment_paid_at: body.paid_at || null,
      payment_method: body.payment_method || null,
      payment_channel: body.payment_channel || null,
    };

    if (orderStatus) {
      updateData.status = orderStatus;
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", body.external_id);

    if (updateError) {
      console.error("Error updating order:", updateError);
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    console.log(`Order ${body.external_id} updated to payment_status: ${paymentStatus}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
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