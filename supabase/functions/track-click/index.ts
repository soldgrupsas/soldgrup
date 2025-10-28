import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposalSlug } = await req.json();
    
    if (!proposalSlug) {
      return new Response(
        JSON.stringify({ error: 'Proposal slug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get client IP and user agent
    const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Find proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id')
      .eq('public_url_slug', proposalSlug)
      .eq('status', 'published')
      .single();

    if (proposalError || !proposal) {
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert click record
    const { error: clickError } = await supabase
      .from('proposal_clicks')
      .insert({
        proposal_id: proposal.id,
        ip_address: ipAddress,
        user_agent: userAgent
      });

    if (clickError) {
      console.error('Error inserting click:', clickError);
    }

    // Increment click count
    const { error: updateError } = await supabase
      .rpc('increment_proposal_clicks', { proposal_slug: proposalSlug });

    if (updateError) {
      console.error('Error incrementing click count:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error tracking click:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
