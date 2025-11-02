import { createClient } from 'jsr:@supabase/supabase-js@2';
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
  description: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    if (!isAdmin && report.user_id && report.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'No tienes permisos para este informe' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: photosData, error: photosError } = await supabase
      .from('maintenance_report_photos')
      .select('id, storage_path, description')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (photosError) {
      console.warn('No se pudieron consultar las fotografías:', photosError);
    }

    const storagePhotos: MaintenanceReportPhotoRecord[] = photosData ?? [];

    const photos = storagePhotos
      .map((photo) => {
        const { data } = supabase.storage.from('maintenance-report-photos').getPublicUrl(photo.storage_path);
        if (!data?.publicUrl) return null;
        return {
          url: data.publicUrl,
          description: photo.description ?? '',
        };
      })
      .filter(Boolean) as { url: string; description: string }[];

    const reportData = (report.data ?? {}) as Record<string, any>;

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

    const pdfBytes = await createMaintenanceReportPDF(payload);

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
    return new Response(JSON.stringify({ error: 'No fue posible generar el PDF' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
