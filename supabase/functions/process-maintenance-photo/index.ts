import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'maintenance-report-photos';

const resizeAndEncode = async (bytes: Uint8Array, width: number) => {
  const image = await Image.decode(bytes);
  const resized = image.width > width ? image.resize(width, Image.RESIZE_AUTO) : image;
  const jpeg = await resized.encodeJPEG(82);
  return new Uint8Array(jpeg);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let currentPhotoId: string | null = null;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { photoId, storagePath } = await req.json();
    if (!photoId || typeof photoId !== 'string') {
      return new Response(JSON.stringify({ error: 'photoId es obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!storagePath || typeof storagePath !== 'string') {
      return new Response(JSON.stringify({ error: 'storagePath es obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    currentPhotoId = photoId;

    const normalizedPath = storagePath.replace(/^\/+/, '');
    const optimizedPath = `optimized/${normalizedPath}`;
    const thumbnailPath = `thumbnails/${normalizedPath}`;

    const { data: originalBlob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(normalizedPath);
    if (downloadError || !originalBlob) {
      throw new Error('No se pudo descargar la imagen original');
    }
    const originalBuffer = new Uint8Array(await originalBlob.arrayBuffer());
    const optimizedBytes = await resizeAndEncode(originalBuffer, 1600);
    const thumbnailBytes = await resizeAndEncode(originalBuffer, 400);

    await supabase.storage.from(BUCKET).upload(optimizedPath, optimizedBytes, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    });

    await supabase.storage.from(BUCKET).upload(thumbnailPath, thumbnailBytes, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    });

    await supabase
      .from('maintenance_report_photos')
      .update({
        optimized_path: optimizedPath,
        thumbnail_path: thumbnailPath,
        processing_status: 'ready',
        processing_error: null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', photoId);

    await supabase.from('maintenance_photo_upload_metrics').insert({
      photo_id: photoId,
      event: 'processed',
      metadata: { optimized_path: optimizedPath, thumbnail_path: thumbnailPath },
    });

    return new Response(JSON.stringify({ optimizedPath, thumbnailPath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('process-maintenance-photo error', error);
    const message = error instanceof Error ? error.message : 'Error procesando foto';
    try {
      if (currentPhotoId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && serviceKey) {
          const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await supabase
            .from('maintenance_report_photos')
            .update({ processing_status: 'error', processing_error: message })
            .eq('id', currentPhotoId);
          await supabase.from('maintenance_photo_upload_metrics').insert({
            photo_id: currentPhotoId,
            event: 'process_error',
            metadata: { message },
          });
        }
      }
    } catch (loggingError) {
      console.error('No se pudo registrar el error de procesamiento', loggingError);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
