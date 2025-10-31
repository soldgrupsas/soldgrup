import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WEBHOOK_URL = "https://n8n.soldgrup.com/webhook/be776bb0-e830-4d1b-b4f3-a6f927a65003";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProposalPayload {
  offer_id: string | null;
  presentation_date: string | null;
  client: string | null;
  contact_person: string | null;
  reference: string | null;
  soldgrup_contact: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const payload = (await req.json()) as ProposalPayload;
    const {
      offer_id,
      presentation_date,
      client,
      contact_person,
      reference,
      soldgrup_contact,
    } = payload;

    if (!offer_id || !presentation_date || !client) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: offer_id, presentation_date, client",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offer_id,
        presentation_date,
        client,
        contact_person,
        reference,
        soldgrup_contact,
      }),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error("Webhook request failed:", webhookResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to notify webhook",
          details: errorText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
