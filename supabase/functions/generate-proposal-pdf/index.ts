import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createProposalPDF } from '../_shared/pdf.ts';
import { buildPdfResponseHeaders } from '../_shared/response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔵 generate-proposal-pdf: Iniciando generación de PDF');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { proposalId } = await req.json();

    if (!proposalId) {
      throw new Error('proposalId es requerido');
    }

    console.log(`📄 Consultando propuesta: ${proposalId}`);

    // Fetch proposal data
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (proposalError) throw proposalError;

    // Fetch related data
    const [{ data: items }, { data: images }, { data: equipment }] = await Promise.all([
      supabase.from('proposal_items').select('*').eq('proposal_id', proposalId).order('item_number'),
      supabase.from('proposal_images').select('*').eq('proposal_id', proposalId).order('image_order'),
      supabase.from('equipment_details').select('*').eq('proposal_id', proposalId),
    ]);

    console.log('✅ Datos consultados correctamente');

    const pdfBytes = await createProposalPDF({
      proposal,
      items: items || [],
      equipment: equipment || [],
      images: images || [],
    });

    console.log('✅ PDF generado exitosamente');

    const filenameBase = `Propuesta_${proposal.offer_id ?? 'SIN_ID'}_${proposal.client ?? 'Cliente'}`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        ...buildPdfResponseHeaders(filenameBase),
      },
    });
  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
