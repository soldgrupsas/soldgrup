import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { createMaintenanceReportPDF, type MaintenanceReportPdfPayload } from '../_shared/maintenance-report-pdf.ts';
import { buildPdfResponseHeaders } from '../_shared/response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const checklistFallback = [
  'Motor de elevación',
  'Freno motor de elevación',
  'Trolley',
  'Motor trolley',
  'Freno motor trolley',
  'Guías de trolley',
  'Ruedas trolley',
  'Monorriel',
  'Gancho',
  'Cadena',
  'Gabinete eléctrico',
  'Aceite',
  'Estructura y aparellaje',
  'Topes mecánicos',
  'Botonera',
  'Pines de seguridad',
  'Polipasto',
  'Límite de elevación',
  'Carro porta escobillas',
  'Carros intermedios y cables planos',
  'Carcazas',
];

const inferContentTypeByPath = (path: string): string => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.match(/\.jpe?g$/)) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'application/octet-stream';
};

type MaintenanceReportRecord = {
  id: string;
  user_id: string | null;
  data: Record<string, any> | null;
  start_date: string | null;
  end_date: string | null;
  company: string | null;
  address: string | null;
  phone: string | null;
  contact: string | null;
  technician_name: string | null;
  equipment: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  capacity: string | null;
  location_pg: string | null;
  voltage: string | null;
  initial_state: string | null;
  recommendations: string | null;
  tests: Record<string, any> | null;
  created_at: string;
};

type MaintenanceReportPhotoRecord = {
  id: string;
  storage_path: string;
  optimized_path: string | null;
  thumbnail_path: string | null;
  description: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[maintenance-pdf] start request');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Faltan variables de entorno de Supabase');
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Falta token de autorización' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { reportId } = await req.json();
    console.log('[maintenance-pdf] reportId:', reportId);

    if (!reportId || typeof reportId !== 'string') {
      return new Response(JSON.stringify({ error: 'reportId es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userResponse, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userResponse?.user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userResponse.user.id;

    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin');

    const isAdmin = Boolean(adminRoles && adminRoles.length > 0);

    const { data: reportRaw, error: reportError } = await supabase
      .from('maintenance_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !reportRaw) {
      return new Response(JSON.stringify({ error: 'Informe no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const report = reportRaw as MaintenanceReportRecord;
    console.log('[maintenance-pdf] report loaded');

    if (!isAdmin && report.user_id && report.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'No tienes permisos para este informe' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: photosData, error: photosError } = await supabase
      .from('maintenance_report_photos')
      .select('id, storage_path, optimized_path, thumbnail_path, description')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (photosError) {
      console.warn('No se pudieron consultar las fotografías:', photosError);
    }

    const storagePhotos: MaintenanceReportPhotoRecord[] = photosData ?? [];

    const reportData = (report.data ?? {}) as Record<string, any>;
    const reportPhotosArray = Array.isArray(reportData.photos) ? reportData.photos : [];
    const descriptionByStoragePath = new Map<string, string>();
    const descriptionById = new Map<string, string>();

    for (const entry of reportPhotosArray) {
      if (!entry || typeof entry !== 'object') continue;
      const desc = typeof entry.description === 'string' ? entry.description.trim() : '';
      const storagePath = typeof entry.storagePath === 'string' ? entry.storagePath : typeof entry.storage_path === 'string' ? entry.storage_path : null;
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (storagePath && desc) descriptionByStoragePath.set(storagePath, desc);
      if (id && desc) descriptionById.set(id, desc);
    }

    const resolveDescription = (record: MaintenanceReportPhotoRecord): string => {
      const fromRecord = typeof record.description === 'string' ? record.description.trim() : '';
      if (fromRecord) return fromRecord;
      const byStorage = record.storage_path ? descriptionByStoragePath.get(record.storage_path)?.trim() : undefined;
      if (byStorage) return byStorage;
      const byId = descriptionById.get(record.id)?.trim();
      if (byId) return byId;
      return '';
    };

    const toOptimizedImageUrl = (rawUrl: string): string => {
      // Transform object public URL to render URL with resizing and JPEG format
      // Example:
      // https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
      // -> https://<ref>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=1600&quality=85&format=jpeg
      try {
        const url = new URL(rawUrl);
        url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        url.searchParams.set('width', '1200');
        url.searchParams.set('quality', '80');
        url.searchParams.set('format', 'jpeg');
        return url.toString();
      } catch {
        return rawUrl; // fallback
      }
    };

    const downloadPhoto = async (record: MaintenanceReportPhotoRecord) => {
      const preferredPath = record.optimized_path || record.storage_path;
      if (!preferredPath) return null;

      const { data: preferredPublic } = supabase.storage
        .from('maintenance-report-photos')
        .getPublicUrl(preferredPath);
      const { data: fallbackPublic } = record.optimized_path
        ? supabase.storage.from('maintenance-report-photos').getPublicUrl(record.storage_path)
        : { data: null, error: null } as any;

      const publicUrl = preferredPublic?.publicUrl ?? fallbackPublic?.publicUrl ?? null;

      const fetchOptimized = async () => {
        if (!publicUrl) return null;
        const targetUrl = record.optimized_path ? publicUrl : toOptimizedImageUrl(publicUrl);
        try {
          const response = await fetch(targetUrl, { headers: { accept: 'image/jpeg,image/png;q=0.9,*/*;q=0.8' } });
          if (!response.ok) {
            console.warn('Optimized image fetch failed', targetUrl, response.status);
            return null;
          }
          const ab = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') ?? 'image/jpeg';
          return {
            bytes: new Uint8Array(ab),
            contentType,
          };
        } catch (error) {
          console.warn('Optimized image fetch error', targetUrl, error);
          return null;
        }
      };

      const fetchOriginal = async () => {
        try {
          const { data: blob, error } = await supabase.storage.from('maintenance-report-photos').download(record.storage_path);
          if (error || !blob) {
            console.warn('No se pudo descargar la foto de Storage:', record.storage_path, error);
            return null;
          }
          const ab = await blob.arrayBuffer();
          const contentType = (blob as any).type || inferContentTypeByPath(record.storage_path);
          return {
            bytes: new Uint8Array(ab),
            contentType,
          };
        } catch (error) {
          console.warn('Error bajando foto de Storage:', record.storage_path, error);
          return null;
        }
      };

      return (await fetchOptimized()) ?? (await fetchOriginal());
    };

    const photos: MaintenanceReportPdfPayload['photos'] = [];
    const MAX_PHOTOS = 24;
    const CONCURRENCY = 4;
    const photoQueue = storagePhotos.slice(0, MAX_PHOTOS);

    for (let i = 0; i < photoQueue.length; i += CONCURRENCY) {
      const chunk = photoQueue.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((record) => downloadPhoto(record)));
      results.forEach((result, indexInChunk) => {
        if (!result) return;
        if (result.bytes.length > 2_500_000) {
          console.warn('Foto omitida por tamaño (bytes):', result.bytes.length);
          return;
        }
        const type = result.contentType.toLowerCase();
        if (!type.includes('jpeg') && !type.includes('jpg') && !type.includes('png')) {
          console.warn('Formato de imagen no soportado en PDF, se omite:', type);
          return;
        }
        const record = chunk[indexInChunk];
        const description = resolveDescription(record);
        photos.push({ ...result, description });
      });
    }

    console.log('[maintenance-pdf] photos count:', photos.length);

    const testsSource = (report.tests ?? reportData.tests ?? {}) as Record<string, any>;
    const voltageValue = testsSource?.voltage ?? undefined;
    const subirValues = {
      l1: testsSource?.polipasto?.subir?.l1 ?? testsSource?.subir?.l1,
      l2: testsSource?.polipasto?.subir?.l2 ?? testsSource?.subir?.l2,
      l3: testsSource?.polipasto?.subir?.l3 ?? testsSource?.subir?.l3,
    };
    const bajarValues = {
      l1: testsSource?.polipasto?.bajar?.l1 ?? testsSource?.bajar?.l1,
      l2: testsSource?.polipasto?.bajar?.l2 ?? testsSource?.bajar?.l2,
      l3: testsSource?.polipasto?.bajar?.l3 ?? testsSource?.bajar?.l3,
    };

    const hasSubir = Boolean(subirValues.l1 || subirValues.l2 || subirValues.l3);
    const hasBajar = Boolean(bajarValues.l1 || bajarValues.l2 || bajarValues.l3);

    const tests: MaintenanceReportPdfPayload['tests'] | null = voltageValue || hasSubir || hasBajar
      ? {
          voltage: voltageValue,
          polipasto: {
            subir: hasSubir ? subirValues : undefined,
            bajar: hasBajar ? bajarValues : undefined,
          },
        }
      : null;

    const checklistEntriesRaw = Array.isArray(reportData.checklist)
      ? reportData.checklist
      : Array.isArray(reportData?.data?.checklist)
      ? reportData.data.checklist
      : [];

    const checklistMap = new Map<string, MaintenanceReportPdfPayload['checklist'][number]>();

    (checklistEntriesRaw ?? []).forEach((entry: any, index: number) => {
      const key = typeof entry?.name === 'string' ? entry.name.trim().toLowerCase() : checklistFallback[index]?.toLowerCase();
      if (!key) return;
      checklistMap.set(key, {
        index,
        name: typeof entry?.name === 'string' ? entry.name : checklistFallback[index] ?? `Ítem ${index + 1}`,
        status: entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : null,
        observation: typeof entry?.observation === 'string' ? entry.observation : '',
      });
    });

    const checklist = checklistFallback.map((name, index) => {
      const entry = checklistMap.get(name.toLowerCase());
      return {
        index,
        name,
        status: entry?.status ?? null,
        observation: entry?.observation ?? '',
      };
    });

    const payload: MaintenanceReportPdfPayload = {
      title: 'Informe de Mantenimiento',
      reportId,
      basicInfo: {
        company: report.company ?? reportData.company,
        address: report.address ?? reportData.address,
        phone: report.phone ?? reportData.phone,
        contact: report.contact ?? reportData.contact,
        technicianName: report.technician_name ?? reportData.technicianName,
        startDate: report.start_date ?? reportData.startDate,
        endDate: report.end_date ?? reportData.endDate,
        equipment: report.equipment ?? reportData.equipment,
        brand: report.brand ?? reportData.brand,
        model: report.model ?? reportData.model,
        serial: report.serial ?? reportData.serial,
        capacity: report.capacity ?? reportData.capacity,
        locationPg: report.location_pg ?? reportData.locationPg,
        voltage: report.voltage ?? reportData.voltage,
      },
      initialState: report.initial_state ?? reportData.initialState ?? reportData.initial_state ?? null,
      recommendations: report.recommendations ?? reportData.recommendations ?? null,
      tests: tests ?? undefined,
      checklist,
      photos,
    };

    console.log('[maintenance-pdf] generating PDF...');
    const pdfBytes = await createMaintenanceReportPDF(payload);
    console.log('[maintenance-pdf] PDF generated, bytes:', pdfBytes?.length ?? 0);

    const filenameCompany = payload.basicInfo.company?.replace(/[^a-zA-Z0-9-_]/g, '_') ?? 'Informe';
    const filenameDate = report.start_date ? new Date(report.start_date).toISOString().slice(0, 10) : report.created_at.slice(0, 10);
    const filename = `Informe_Mantenimiento_${filenameCompany}_${filenameDate}`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        ...buildPdfResponseHeaders(filename),
      },
    });
  } catch (error) {
    console.error('Error generando PDF de mantenimiento', error);
    const message = error instanceof Error ? error.message : 'No fue posible generar el PDF';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
