import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        method?: string;
        email?: string;
        contact?: string;
        created_at: number;
      };
    };
    payment_link: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        reference_id?: string;
        notes?: {
          invoice_id?: string;
          invoice_uuid?: string;
        };
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

    const payload: RazorpayWebhookPayload = await req.json();
    console.log("Razorpay webhook received:", payload.event);

    const invoiceUuid = payload.payload.payment_link?.entity?.notes?.invoice_uuid;
    const invoiceId = payload.payload.payment_link?.entity?.reference_id;

    if (!invoiceUuid && !invoiceId) {
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
      .or(`id.eq.${invoiceUuid},invoice_id.eq.${invoiceId}`)
      .maybeSingle();

    if (invoiceError || !invoice) {
      console.error("Invoice not found");
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (payload.event === "payment_link.paid" && payload.payload.payment) {
      const payment = payload.payload.payment.entity;
      const amountPaid = payment.amount / 100;

      const { error: transactionError } = await supabase
        .from("payment_transactions")
        .insert([{
          transaction_id: payment.id,
          gateway_type: "Razorpay",
          gateway_order_id: payload.payload.payment_link?.entity?.id,
          invoice_id: invoice.id,
          amount: amountPaid,
          currency: payment.currency || "INR",
          status: "Completed",
          payment_method: payment.method,
          customer_email: payment.email || invoice.customer_email,
          customer_phone: payment.contact || invoice.customer_phone,
          raw_webhook_data: payload,
          processed_at: new Date().toISOString(),
        }]);

      if (transactionError) {
        console.error("Error inserting transaction:", transactionError);
      }

      const paymentDate = new Date(payment.created_at * 1000);

      const { error: receiptError } = await supabase
        .from("receipts")
        .insert([{
          invoice_id: invoice.id,
          customer_name: invoice.customer_name,
          customer_email: payment.email || invoice.customer_email,
          payment_method: payment.method || "Online",
          payment_reference: payment.id,
          amount_paid: amountPaid,
          currency: payment.currency || "INR",
          payment_date: paymentDate.toISOString().split('T')[0],
          description: `Payment for ${invoice.title}`,
          notes: `Paid via Razorpay - Transaction ID: ${payment.id}`,
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
    console.error("Error processing Razorpay webhook:", error);
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
