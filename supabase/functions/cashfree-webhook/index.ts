import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CashfreeWebhookPayload {
  type: string;
  data: {
    order?: {
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
    };
    payment?: {
      cf_payment_id: string;
      payment_status: string;
      payment_amount: number;
      payment_method?: string;
      payment_time?: string;
    };
    customer_details?: {
      customer_name: string;
      customer_email: string;
      customer_phone: string;
    };
    link?: {
      link_id: string;
      link_amount: number;
      link_currency: string;
      link_status: string;
      link_notes?: {
        invoice_id?: string;
        invoice_uuid?: string;
      };
    };
  };
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

    const payload: CashfreeWebhookPayload = await req.json();
    console.log("Cashfree webhook received:", payload.type);

    const invoiceId = payload.data.link?.link_notes?.invoice_uuid ||
                     payload.data.order?.order_id?.replace('INV-', '');

    if (!invoiceId) {
      console.error("No invoice ID found in webhook payload");
      return new Response(
        JSON.stringify({ error: "Invoice ID not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceId);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (payload.type === "PAYMENT_SUCCESS_WEBHOOK" && payload.data.payment) {
      const payment = payload.data.payment;
      const amountPaid = payment.payment_amount;

      const { error: transactionError } = await supabase
        .from("payment_transactions")
        .insert([{
          transaction_id: payment.cf_payment_id,
          gateway_type: "Cashfree",
          gateway_order_id: payload.data.order?.order_id,
          invoice_id: invoice.id,
          amount: amountPaid,
          currency: payload.data.order?.order_currency || "INR",
          status: "Completed",
          payment_method: payment.payment_method,
          customer_email: payload.data.customer_details?.customer_email || invoice.customer_email,
          customer_phone: payload.data.customer_details?.customer_phone || invoice.customer_phone,
          raw_webhook_data: payload,
          processed_at: new Date().toISOString(),
        }]);

      if (transactionError) {
        console.error("Error inserting transaction:", transactionError);
      }

      const { error: receiptError } = await supabase
        .from("receipts")
        .insert([{
          invoice_id: invoice.id,
          customer_name: payload.data.customer_details?.customer_name || invoice.customer_name,
          customer_email: payload.data.customer_details?.customer_email || invoice.customer_email,
          payment_method: payment.payment_method || "Online",
          payment_reference: payment.cf_payment_id,
          amount_paid: amountPaid,
          currency: payload.data.order?.order_currency || "INR",
          payment_date: payment.payment_time ? new Date(payment.payment_time).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          description: `Payment for ${invoice.title}`,
          notes: `Paid via Cashfree - Transaction ID: ${payment.cf_payment_id}`,
          status: "Completed",
        }]);

      if (receiptError) {
        console.error("Error creating receipt:", receiptError);
      }

      const newPaidAmount = (parseFloat(invoice.paid_amount) || 0) + amountPaid;
      const newBalanceDue = (parseFloat(invoice.total_amount) || 0) - newPaidAmount;
      let invoiceStatus = invoice.status;

      if (newBalanceDue <= 0) {
        invoiceStatus = "Paid";
      } else if (newPaidAmount > 0) {
        invoiceStatus = "Partially Paid";
      }

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          paid_amount: newPaidAmount,
          balance_due: newBalanceDue,
          status: invoiceStatus,
          paid_date: newBalanceDue <= 0 ? new Date().toISOString().split('T')[0] : null,
          payment_link_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (updateError) {
        console.error("Error updating invoice:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing Cashfree webhook:", error);
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
