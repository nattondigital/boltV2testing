import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentLinkRequest {
  invoice_id: string;
  gateway_override?: 'Cashfree' | 'Razorpay';
}

interface CashfreeResponse {
  cf_link_id: string;
  link_url: string;
  link_status: string;
  link_expiry_time?: string;
}

interface RazorpayResponse {
  id: string;
  short_url: string;
  status: string;
  expire_by?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invoice_id, gateway_override }: PaymentLinkRequest = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let gatewayType = gateway_override;
    if (!gatewayType) {
      const { data: defaultGateway } = await supabase
        .from("payment_gateway_config")
        .select("gateway_type")
        .eq("is_default", true)
        .eq("is_active", true)
        .maybeSingle();

      if (!defaultGateway) {
        const { data: anyActiveGateway } = await supabase
          .from("payment_gateway_config")
          .select("gateway_type")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!anyActiveGateway) {
          return new Response(
            JSON.stringify({ error: "No active payment gateway configured" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        gatewayType = anyActiveGateway.gateway_type;
      } else {
        gatewayType = defaultGateway.gateway_type;
      }
    }

    const { data: gatewayConfig, error: configError } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("gateway_type", gatewayType)
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !gatewayConfig) {
      return new Response(
        JSON.stringify({ error: `${gatewayType} gateway not configured` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let paymentLinkUrl = "";
    let paymentLinkId = "";
    let paymentLinkStatus = "";
    let paymentLinkExpiry = null;

    if (gatewayType === "Cashfree") {
      const cashfreeUrl = gatewayConfig.environment === "production"
        ? "https://api.cashfree.com/pg/links"
        : "https://sandbox.cashfree.com/pg/links";

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const cashfreePayload = {
        link_id: `INV-${invoice.invoice_id}`,
        link_amount: parseFloat(invoice.total_amount),
        link_currency: invoice.currency || "INR",
        link_purpose: invoice.title,
        customer_details: {
          customer_name: invoice.customer_name,
          customer_email: invoice.customer_email,
          customer_phone: invoice.customer_phone || "",
        },
        link_notify: {
          send_sms: false,
          send_email: true,
        },
        link_expiry_time: expiryDate.toISOString(),
        link_notes: {
          invoice_id: invoice.invoice_id,
          invoice_uuid: invoice.id,
        },
      };

      const cashfreeResponse = await fetch(cashfreeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": gatewayConfig.api_version || "2023-08-01",
          "x-client-id": gatewayConfig.app_id,
          "x-client-secret": gatewayConfig.secret_key,
        },
        body: JSON.stringify(cashfreePayload),
      });

      if (!cashfreeResponse.ok) {
        const errorData = await cashfreeResponse.json();
        console.error("Cashfree API error:", errorData);
        return new Response(
          JSON.stringify({
            error: "Failed to create Cashfree payment link",
            details: errorData,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const cashfreeData: CashfreeResponse = await cashfreeResponse.json();
      paymentLinkUrl = cashfreeData.link_url;
      paymentLinkId = cashfreeData.cf_link_id;
      paymentLinkStatus = cashfreeData.link_status;
      paymentLinkExpiry = cashfreeData.link_expiry_time || expiryDate.toISOString();

    } else if (gatewayType === "Razorpay") {
      const razorpayUrl = "https://api.razorpay.com/v1/payment_links";

      const expiryTimestamp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

      const razorpayPayload = {
        amount: Math.round(parseFloat(invoice.total_amount) * 100),
        currency: invoice.currency || "INR",
        description: invoice.title,
        customer: {
          name: invoice.customer_name,
          email: invoice.customer_email,
          contact: invoice.customer_phone || "",
        },
        notify: {
          sms: false,
          email: true,
        },
        reminder_enable: true,
        expire_by: expiryTimestamp,
        reference_id: invoice.invoice_id,
        notes: {
          invoice_id: invoice.invoice_id,
          invoice_uuid: invoice.id,
        },
      };

      const authString = btoa(`${gatewayConfig.app_id}:${gatewayConfig.secret_key}`);

      const razorpayResponse = await fetch(razorpayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify(razorpayPayload),
      });

      if (!razorpayResponse.ok) {
        const errorData = await razorpayResponse.json();
        console.error("Razorpay API error:", errorData);
        return new Response(
          JSON.stringify({
            error: "Failed to create Razorpay payment link",
            details: errorData,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const razorpayData: RazorpayResponse = await razorpayResponse.json();
      paymentLinkUrl = razorpayData.short_url;
      paymentLinkId = razorpayData.id;
      paymentLinkStatus = razorpayData.status;
      if (razorpayData.expire_by) {
        paymentLinkExpiry = new Date(razorpayData.expire_by * 1000).toISOString();
      }
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        payment_gateway_used: gatewayType,
        payment_link_id: paymentLinkId,
        payment_link_url: paymentLinkUrl,
        payment_link_status: paymentLinkStatus,
        payment_link_expiry: paymentLinkExpiry,
        payment_link_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice_id);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        gateway: gatewayType,
        payment_link_id: paymentLinkId,
        payment_link_url: paymentLinkUrl,
        payment_link_status: paymentLinkStatus,
        payment_link_expiry: paymentLinkExpiry,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating payment link:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
