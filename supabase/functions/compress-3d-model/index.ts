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
    console.log('🔵 compress-3d-model: Iniciando compresión de modelo 3D');

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

    const originalSizeMB = (uint8Array.length / (1024 * 1024)).toFixed(2);
    console.log(`📊 Tamaño original: ${originalSizeMB}MB`);

    // Dynamic import of gltf-transform (using npm: specifier for Deno)
    console.log('📥 Importando gltf-transform...');
    const { Document, NodeIO } = await import("npm:@gltf-transform/core@4.1.0");
    const { ALL_EXTENSIONS } = await import("npm:@gltf-transform/extensions@4.1.0");
    const { draco } = await import("npm:@gltf-transform/functions@4.1.0");

    console.log('✅ gltf-transform importado correctamente');

    // Create NodeIO with all extensions
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

    // Read GLB file
    console.log('📖 Leyendo archivo GLB...');
    const doc = await io.readBinary(uint8Array);
    console.log('✅ Archivo GLB leído correctamente');

    // Apply Draco compression
    console.log('🗜️ Aplicando compresión Draco...');
    await doc.transform(
      draco({
        quantizePosition: 14, // Bits de cuantización para posiciones (14 = alta calidad)
        quantizeNormal: 10,    // Bits para normales
        quantizeTexcoord: 12,  // Bits para coordenadas de textura
        quantizeColor: 8,      // Bits para colores
        quantizeGeneric: 12,   // Bits para atributos genéricos
      })
    );
    console.log('✅ Compresión Draco aplicada');

    // Write compressed GLB
    console.log('💾 Escribiendo archivo comprimido...');
    const compressedArrayBuffer = await io.writeBinary(doc);
    const compressedUint8Array = new Uint8Array(compressedArrayBuffer);
    const compressedSizeMB = (compressedUint8Array.length / (1024 * 1024)).toFixed(2);
    const compressionRatio = ((1 - compressedUint8Array.length / uint8Array.length) * 100).toFixed(1);

    console.log(`📊 Tamaño comprimido: ${compressedSizeMB}MB (reducción del ${compressionRatio}%)`);

    // Upload to Supabase Storage
    const fileExt = fileName.split('.').pop();
    const compressedFileName = `${proposalId}/${Date.now()}-compressed.${fileExt}`;

    console.log(`📤 Subiendo archivo comprimido a Storage: ${compressedFileName}`);
    const { error: uploadError } = await supabase.storage
      .from('3d-models')
      .upload(compressedFileName, compressedUint8Array, {
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
      .getPublicUrl(compressedFileName);

    console.log(`✅ Archivo subido exitosamente: ${publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        originalSizeMB: parseFloat(originalSizeMB),
        compressedSizeMB: parseFloat(compressedSizeMB),
        compressionRatio: parseFloat(compressionRatio),
        fileName: compressedFileName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error en compress-3d-model:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
