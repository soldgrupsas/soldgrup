import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔵 compress-3d-model: Procesando modelo 3D');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { proposalId, fileName, fileData } = await req.json();

    if (!proposalId || !fileName || !fileData) {
      throw new Error('Missing required parameters: proposalId, fileName, or fileData');
    }

    console.log(`📦 Archivo recibido: ${fileName} para propuesta ${proposalId}`);

    // Convert base64 to Uint8Array if needed
    let uint8Array: Uint8Array;
    if (typeof fileData === 'string') {
      const binaryString = atob(fileData);
      uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
    } else if (fileData.type === 'Buffer') {
      uint8Array = new Uint8Array(fileData.data);
    } else {
      uint8Array = new Uint8Array(fileData);
    }

    const fileSizeMB = (uint8Array.length / (1024 * 1024)).toFixed(2);
    console.log(`📊 Tamaño del archivo: ${fileSizeMB}MB`);

    // Upload directly to Supabase Storage (compression requires native libs not available in Edge Functions)
    const fileExt = fileName.split('.').pop();
    const uploadFileName = `${proposalId}/${Date.now()}.${fileExt}`;

    console.log(`📤 Subiendo archivo a Storage: ${uploadFileName}`);
    const { error: uploadError } = await supabase.storage
      .from('3d-models')
      .upload(uploadFileName, uint8Array, {
        contentType: 'model/gltf-binary',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Error subiendo archivo:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('3d-models')
      .getPublicUrl(uploadFileName);

    console.log(`✅ Archivo subido exitosamente: ${publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        originalSizeMB: parseFloat(fileSizeMB),
        compressedSizeMB: parseFloat(fileSizeMB),
        compressionRatio: 0,
        fileName: uploadFileName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error en compress-3d-model:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorStack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
