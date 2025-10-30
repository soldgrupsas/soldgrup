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
    console.log('🔵 generate-proposal-pdf-public: Iniciando generación de PDF público');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { slug } = await req.json();

    if (!slug) {
      throw new Error('slug es requerido');
    }

    console.log(`📄 Consultando propuesta pública: ${slug}`);

    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('public_url_slug', slug)
      .single();

    if (proposalError) throw proposalError;

    const [{ data: items }, { data: images }, { data: equipment }] = await Promise.all([
      supabase.from('proposal_items').select('*').eq('proposal_id', proposal.id).order('item_number'),
      supabase.from('proposal_images').select('*').eq('proposal_id', proposal.id).order('image_order'),
      supabase.from('equipment_details').select('*').eq('proposal_id', proposal.id),
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
