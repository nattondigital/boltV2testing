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

    if (!invoice.customer_name || !invoice.total_amount) {
      return new Response(
        JSON.stringify({
          error: "Invoice is missing required fields (customer_name or total_amount)"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const customerEmail = invoice.customer_email || "info@professionalsaathi.com";
    const customerName = invoice.customer_name || "Customer";

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

      const cleanPhone = invoice.customer_phone
        ? invoice.customer_phone.replace(/[\s\-\+]/g, '').replace(/^91/, '')
        : "9999999999";

      const cashfreePayload = {
        link_id: `INV${invoice.invoice_id}${Date.now()}`,
        link_amount: parseFloat(invoice.total_amount),
        link_currency: invoice.currency || "INR",
        link_purpose: invoice.title || "Invoice Payment",
        link_expiry_time: expiryDate.toISOString(),
        customer_details: {
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: cleanPhone,
        },
        link_notify: {
          send_email: true,
          send_sms: false,
        },
        link_notes: {
          invoice_id: invoice.invoice_id,
          invoice_uuid: invoice.id,
        },
        link_auto_reminders: true,
      };

      console.log("Cashfree Request:", {
        url: cashfreeUrl,
        payload: cashfreePayload,
        headers: {
          "x-api-version": gatewayConfig.api_version || "2023-08-01",
          "x-client-id": gatewayConfig.app_id,
        }
      });

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
        console.error("Cashfree API error:", {
          status: cashfreeResponse.status,
          statusText: cashfreeResponse.statusText,
          error: errorData
        });

        let userMessage = "Failed to create Cashfree payment link";
        if (errorData.type === "feature_not_enabled") {
          userMessage = "Cashfree payment links feature is not enabled. Please contact Cashfree support at care@cashfree.com to enable payment links for your account.";
        } else if (errorData.message) {
          userMessage = `Cashfree Error: ${errorData.message}`;
        }

        return new Response(
          JSON.stringify({
            error: userMessage,
            details: errorData,
            gateway: "Cashfree"
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const cashfreeData: CashfreeResponse = await cashfreeResponse.json();
      console.log("Cashfree Response:", cashfreeData);
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
        description: invoice.title || "Invoice Payment",
        customer: {
          name: customerName,
          email: customerEmail,
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

        let userMessage = "Failed to create Razorpay payment link";
        if (errorData.error && errorData.error.description) {
          userMessage = `Razorpay Error: ${errorData.error.description}`;
        } else if (errorData.error && errorData.error.reason) {
          userMessage = `Razorpay Error: ${errorData.error.reason}`;
        }

        return new Response(
          JSON.stringify({
            error: userMessage,
            details: errorData,
            gateway: "Razorpay"
          }),
          {
            status: 400,
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
