import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { createMaintenanceReportPDF, type MaintenanceReportPdfPayload } from '../_shared/maintenance-report-pdf.ts';
import { buildPdfResponseHeaders } from '../_shared/response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Items para ELEVADORES (lista simple, sin sub-items especiales)
const ELEVATOR_CHECKLIST_ITEMS = [
  'Motor elevación',
  'Freno elevación',
  'Estructura',
  'Gancho',
  'Cadena',
  'Guaya',
  'Gabinete eléctrico',
  'Guías laterales',
  'Finales de carrera',
  'Topes mecánicos',
  'Aceite',
  'Botoneras',
  'Pines de seguridad',
  'Cabina o canasta',
  'Puertas',
];

// Items para PUENTES GRÚA
// NOTA: Esta lista DEBE coincidir con la del frontend (ElevatorMaintenanceReportWizard.tsx)
// NOTA: "Trolley" y "Carros testeros" NO están en esta lista porque se manejan como pasos especiales
//       con sub-items (trolleyData y carrosTesterosData) y se agregan dinámicamente después
const BRIDGE_CRANE_CHECKLIST_ITEMS = [
  'Motor de elevación',
  'Freno motor de elevación',
  'Estructura',
  'Gancho',
  'Cadena',
  'Guaya',
  'Gabinete eléctrico',
  'Aceite',
  'Sistema de cables planos',
  'Topes mecánicos',
  'Botonera',
  'Pines de seguridad',
  'Polipasto',
  'Límite de elevación',
  'Limitador de carga',
  'Sistema de alimentación de línea blindada',
  'Carcazas',
];

// Función para obtener los items según el tipo de equipo
const getChecklistItems = (equipmentType?: string): string[] => {
  if (equipmentType === 'puentes-grua') {
    return BRIDGE_CRANE_CHECKLIST_ITEMS;
  }
  return ELEVATOR_CHECKLIST_ITEMS;
};

// Indica si el tipo de equipo tiene pasos especiales (Trolley, Carros testeros con sub-items)
const hasSpecialItems = (equipmentType?: string): boolean => {
  return equipmentType === 'puentes-grua';
};

// Indica si es un informe de mantenimiento general (con procedimientos dinámicos)
const isGeneralMaintenance = (equipmentType?: string): boolean => {
  return equipmentType === 'mantenimientos-generales';
};

// Mantener checklistFallback para compatibilidad
const checklistFallback = ELEVATOR_CHECKLIST_ITEMS;

// Mapeo de nombres de elevadores a puentes grúa (para datos guardados incorrectamente)
// Esto permite encontrar datos aunque se hayan guardado con nombres de elevadores
const ELEVATOR_TO_BRIDGE_CRANE_MAP: Record<string, string> = {
  'motor elevacion': 'motor de elevacion',
  'motor elevación': 'motor de elevación',
  'freno elevacion': 'freno motor de elevacion',
  'freno elevación': 'freno motor de elevación',
  'guias laterales': 'sistema de cables planos',
  'guías laterales': 'sistema de cables planos',
  'finales de carrera': 'polipasto',
  'botoneras': 'botonera',
  'cabina o canasta': 'limite de elevacion',
  'puertas': 'limitador de carga',
};

// Función para normalizar nombres con mapeo adicional
const normalizeNameWithMapping = (str: string, equipmentType?: string): string => {
  const normalized = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  // Si es puentes-grua, intentar mapear nombres de elevadores
  if (equipmentType === 'puentes-grua' && ELEVATOR_TO_BRIDGE_CRANE_MAP[normalized]) {
    return ELEVATOR_TO_BRIDGE_CRANE_MAP[normalized].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  return normalized;
};

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
  trolley_group?: Record<string, any> | null; // Columnas dedicadas (opcionales, se agregan con migración)
  carros_testeros?: Record<string, any> | null;
  motorreductor?: Record<string, any> | null; // Columnas dedicadas (opcionales, se agregan con migración)
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
    console.log('[maintenance-pdf] ========== START REQUEST ==========');
    console.log('[maintenance-pdf] Method:', req.method);
    console.log('[maintenance-pdf] URL:', req.url);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('[maintenance-pdf] Supabase URL exists:', !!supabaseUrl);
    console.log('[maintenance-pdf] Service key exists:', !!serviceKey);

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

    const requestBody = await req.json();
    const { reportId } = requestBody;
    console.log('[maintenance-pdf] Request body:', JSON.stringify(requestBody, null, 2));
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
      console.log('[maintenance-pdf] ERROR loading report:', reportError);
      return new Response(JSON.stringify({ error: 'Informe no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const report = reportRaw as MaintenanceReportRecord;
    console.log('[maintenance-pdf] Report loaded successfully');
    console.log('[maintenance-pdf] Report ID:', report.id);
    console.log('[maintenance-pdf] Report company:', report.company);
    console.log('[maintenance-pdf] Report data exists:', !!report.data);
    console.log('[maintenance-pdf] Report data type:', typeof report.data);
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
    
    // Log completo del reportData para debugging
    console.log('[maintenance-pdf] ========== ESTRUCTURA DE DATOS ==========');
    console.log('[maintenance-pdf] reportData keys:', Object.keys(reportData));
    console.log('[maintenance-pdf] reportData.checklist existe?', Array.isArray(reportData.checklist));
    console.log('[maintenance-pdf] reportData.checklist length:', Array.isArray(reportData.checklist) ? reportData.checklist.length : 'N/A');
    
    // También verificar si los datos están anidados en reportData.data
    const nestedData = (reportData.data && typeof reportData.data === 'object') ? reportData.data as Record<string, any> : null;
    if (nestedData) {
      console.log('[maintenance-pdf] nestedData existe');
      console.log('[maintenance-pdf] nestedData.checklist existe?', Array.isArray(nestedData.checklist));
      console.log('[maintenance-pdf] nestedData.checklist length:', Array.isArray(nestedData.checklist) ? nestedData.checklist.length : 'N/A');
    }
    
    // Verificar también reportData.data.checklist
    if (reportData.data && typeof reportData.data === 'object') {
      const dataData = reportData.data as Record<string, any>;
      console.log('[maintenance-pdf] reportData.data.checklist existe?', Array.isArray(dataData.checklist));
      console.log('[maintenance-pdf] reportData.data.checklist length:', Array.isArray(dataData.checklist) ? dataData.checklist.length : 'N/A');
    }
    
    console.log('[maintenance-pdf] =========================================');
    
    // ========== DETECCIÓN DE EQUIPMENT TYPE ==========
    // IMPORTANTE: El equipmentType guardado es la FUENTE DE VERDAD
    // NO inferir ni cambiar el tipo si ya existe uno guardado
    
    // Buscar equipmentType en todos los lugares posibles
    const savedEquipmentType = 
      reportData.equipmentType ||  // Nivel principal (informes nuevos)
      nestedData?.equipmentType || // Por si hay doble anidación
      undefined;
    
    console.log('[maintenance-pdf] ========== BÚSQUEDA DE EQUIPMENT TYPE ==========');
    console.log('[maintenance-pdf] reportData.equipmentType:', reportData.equipmentType);
    console.log('[maintenance-pdf] nestedData?.equipmentType:', nestedData?.equipmentType);
    console.log('[maintenance-pdf] savedEquipmentType encontrado:', savedEquipmentType);
    
    let equipmentType: string | undefined = undefined;
    
    // Si hay un equipmentType guardado, usarlo SIEMPRE sin modificar
    if (savedEquipmentType && typeof savedEquipmentType === 'string' && savedEquipmentType.trim() !== '') {
      equipmentType = savedEquipmentType;
      console.log('[maintenance-pdf] ✅ Usando equipmentType GUARDADO:', equipmentType);
    } else {
      // SOLO para informes LEGACY (sin equipmentType): intentar inferir
      console.log('[maintenance-pdf] ⚠️ No hay equipmentType guardado, inferiendo para informe legacy...');
      
      const checklistToCheck = Array.isArray(reportData.checklist) ? reportData.checklist : 
                               (nestedData && Array.isArray(nestedData.checklist) ? nestedData.checklist : []);
      
      // Verificar procedimientos para mantenimientos generales
      const hasProcedimientos = Array.isArray(reportData.procedimientos) || 
                                (nestedData && Array.isArray(nestedData.procedimientos));
      const procedimientosCount = Array.isArray(reportData.procedimientos) ? reportData.procedimientos.length :
                                  (nestedData && Array.isArray(nestedData.procedimientos) ? nestedData.procedimientos.length : 0);
      
      // Buscar items característicos de cada tipo
      const hasMotorDeElevacion = checklistToCheck.some((item: any) => 
        item?.name?.toLowerCase()?.includes('motor de elevación') || 
        item?.name?.toLowerCase()?.includes('motor de elevacion')
      );
      const hasMotorElevacion = checklistToCheck.some((item: any) => 
        item?.name?.toLowerCase() === 'motor elevación' || 
        item?.name?.toLowerCase() === 'motor elevacion'
      );
      
      console.log('[maintenance-pdf] Inferencia - checklistToCheck.length:', checklistToCheck.length);
      console.log('[maintenance-pdf] Inferencia - hasProcedimientos:', hasProcedimientos);
      console.log('[maintenance-pdf] Inferencia - procedimientosCount:', procedimientosCount);
      console.log('[maintenance-pdf] Inferencia - hasMotorDeElevacion:', hasMotorDeElevacion);
      console.log('[maintenance-pdf] Inferencia - hasMotorElevacion:', hasMotorElevacion);
      
      // Inferir tipo solo para informes legacy
      if (hasProcedimientos && procedimientosCount > 0 && checklistToCheck.length === 0) {
        equipmentType = 'mantenimientos-generales';
      } else if (hasMotorDeElevacion) {
        equipmentType = 'puentes-grua';
      } else if (hasMotorElevacion) {
        equipmentType = 'elevadores';
      }
      
      console.log('[maintenance-pdf] ⚠️ equipmentType INFERIDO para legacy:', equipmentType);
    }
    
    const dynamicChecklistFallback = getChecklistItems(equipmentType);
    console.log('[maintenance-pdf] ========== RESULTADO FINAL EQUIPMENT TYPE ==========');
    console.log('[maintenance-pdf] Equipment type FINAL:', equipmentType);
    console.log('[maintenance-pdf] Es puentes-grua?', equipmentType === 'puentes-grua');
    console.log('[maintenance-pdf] Es elevadores?', equipmentType === 'elevadores');
    console.log('[maintenance-pdf] Es mantenimientos-generales?', equipmentType === 'mantenimientos-generales');
    console.log('[maintenance-pdf] Using checklist con', dynamicChecklistFallback.length, 'items');
    console.log('[maintenance-pdf] ==================================================');
    
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

    // Función auxiliar para normalizar nombres (remover acentos y convertir a minúsculas)
    // Definirla ANTES de usarla
    const normalizeName = (str: string): string => {
      return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };
    
    // Intentar obtener el checklist de todas las ubicaciones posibles
    let checklistEntriesRaw: any[] = [];
    
    if (Array.isArray(reportData.checklist) && reportData.checklist.length > 0) {
      checklistEntriesRaw = reportData.checklist;
      console.log('[maintenance-pdf] ✅ Checklist encontrado en reportData.checklist');
    } else if (nestedData && Array.isArray(nestedData.checklist) && nestedData.checklist.length > 0) {
      checklistEntriesRaw = nestedData.checklist;
      console.log('[maintenance-pdf] ✅ Checklist encontrado en nestedData.checklist');
    } else if (reportData.data && typeof reportData.data === 'object') {
      const dataData = reportData.data as Record<string, any>;
      if (Array.isArray(dataData.checklist) && dataData.checklist.length > 0) {
        checklistEntriesRaw = dataData.checklist;
        console.log('[maintenance-pdf] ✅ Checklist encontrado en reportData.data.checklist');
      }
    }
    
    if (checklistEntriesRaw.length === 0) {
      console.log('[maintenance-pdf] ⚠️ No se encontró checklist en ninguna ubicación, usando array vacío');
    }
    
    // Log específico para verificar "Motorreductor" en checklistEntriesRaw
    console.log('[maintenance-pdf] ========== VERIFICANDO checklistEntriesRaw ==========');
    console.log('[maintenance-pdf] Total items en checklistEntriesRaw:', checklistEntriesRaw.length);
    const motorreductorInRaw = checklistEntriesRaw.find((entry: any) => 
      entry && typeof entry.name === 'string' && 
      normalizeName(entry.name) === normalizeName('Motorreductor')
    );
    if (motorreductorInRaw) {
      console.log('[maintenance-pdf] ✅ "Motorreductor" encontrado en checklistEntriesRaw:');
      console.log('[maintenance-pdf]   - name:', motorreductorInRaw.name);
      console.log('[maintenance-pdf]   - status:', motorreductorInRaw.status);
      console.log('[maintenance-pdf]   - observation:', motorreductorInRaw.observation);
      console.log('[maintenance-pdf]   - id:', motorreductorInRaw.id);
    } else {
      console.log('[maintenance-pdf] ⚠️ "Motorreductor" NO encontrado en checklistEntriesRaw');
      console.log('[maintenance-pdf] Items en checklistEntriesRaw:', checklistEntriesRaw.map((e: any) => e?.name || 'unknown').slice(0, 10));
    }
    console.log('[maintenance-pdf] ====================================================');

    // Obtener datos del trolleyGroup, carrosTesteros y motorreductor ANTES de construir el mapa
    const reportWithColumns = report as any;
    let trolleyGroup: any = null;
    let carrosTesteros: any = null;
    let motorreductor: any = null;
    
    // Buscar trolleyGroup, carrosTesteros y motorreductor
    if (reportWithColumns.trolley_group && typeof reportWithColumns.trolley_group === 'object') {
      trolleyGroup = reportWithColumns.trolley_group;
    } else if (reportData.trolleyGroup && typeof reportData.trolleyGroup === 'object') {
      trolleyGroup = reportData.trolleyGroup;
    } else if (nestedData?.trolleyGroup && typeof nestedData.trolleyGroup === 'object') {
      trolleyGroup = nestedData.trolleyGroup;
    }
    
    // AGREGAR items del trolley al checklistEntriesRaw (igual que "Motor de elevación")
    // Esto hace que funcionen exactamente igual
    if (trolleyGroup && typeof trolleyGroup === 'object') {
      const trolleyItemsToAdd = [
        { name: 'Trolley', data: trolleyGroup.trolley },
        { name: 'Motor Trolley', data: trolleyGroup.motorTrolley },
        { name: 'Freno motor Trolley', data: trolleyGroup.frenoMotorTrolley },
        { name: 'Guias de Trolley', data: trolleyGroup.guiasTrolley },
        { name: 'Ruedas Trolley', data: trolleyGroup.ruedasTrolley },
      ];
      
      trolleyItemsToAdd.forEach((item) => {
        if (item.data && typeof item.data === 'object') {
          // Verificar si ya existe en checklistEntriesRaw
          const existingIndex = checklistEntriesRaw.findIndex((entry: any) => 
            entry && typeof entry.name === 'string' && 
            entry.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
            item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          );
          
          const trolleyEntry = {
            id: item.data.id || `trolley-${item.name}`,
            name: item.name,
            status: item.data.status || null,
            observation: (trolleyGroup.observation && typeof trolleyGroup.observation === 'string') 
              ? trolleyGroup.observation 
              : '',
          };
          
          if (existingIndex >= 0) {
            // Actualizar el existente
            checklistEntriesRaw[existingIndex] = trolleyEntry;
          } else {
            // Agregar al array
            checklistEntriesRaw.push(trolleyEntry);
          }
        }
      });
      
      console.log('[maintenance-pdf] ✅ Items del trolley agregados al checklistEntriesRaw');
    }
    
    // Buscar carrosTesteros
    if (reportWithColumns.carros_testeros && typeof reportWithColumns.carros_testeros === 'object') {
      carrosTesteros = reportWithColumns.carros_testeros;
    } else if (reportData.carrosTesteros && typeof reportData.carrosTesteros === 'object') {
      carrosTesteros = reportData.carrosTesteros;
    } else if (nestedData?.carrosTesteros && typeof nestedData.carrosTesteros === 'object') {
      carrosTesteros = nestedData.carrosTesteros;
    }
    
    // Buscar motorreductor
    if (reportWithColumns.motorreductor && typeof reportWithColumns.motorreductor === 'object') {
      motorreductor = reportWithColumns.motorreductor;
    } else if (reportData.motorreductor && typeof reportData.motorreductor === 'object') {
      motorreductor = reportData.motorreductor;
    } else if (nestedData?.motorreductor && typeof nestedData.motorreductor === 'object') {
      motorreductor = nestedData.motorreductor;
    }
    
    // AGREGAR item principal de carros testeros y sus sub-items al checklistEntriesRaw
    // (igual que "Motor de elevación")
    if (carrosTesteros && typeof carrosTesteros === 'object') {
      // Agregar el item principal "Carros testeros"
      const carrosMainEntry = {
        id: 'carros-testeros-main',
        name: 'Carros testeros',
        status: carrosTesteros.mainStatus || null,
        observation: (carrosTesteros.observation && typeof carrosTesteros.observation === 'string') 
          ? carrosTesteros.observation 
          : '',
      };
      
      const existingCarrosIndex = checklistEntriesRaw.findIndex((entry: any) => 
        entry && typeof entry.name === 'string' && 
        entry.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
        'carros testeros'.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      
      if (existingCarrosIndex >= 0) {
        checklistEntriesRaw[existingCarrosIndex] = carrosMainEntry;
      } else {
        checklistEntriesRaw.push(carrosMainEntry);
      }
      
      // Agregar los sub-items
      if (carrosTesteros.subItems && Array.isArray(carrosTesteros.subItems)) {
        carrosTesteros.subItems.forEach((subItem: any) => {
          if (subItem && typeof subItem === 'object' && subItem.name) {
            const subItemEntry = {
              id: subItem.id || `carros-testeros-${subItem.name}`,
              name: subItem.name,
              status: subItem.status || null,
              observation: (subItem.observation && typeof subItem.observation === 'string' && subItem.observation.trim())
                ? subItem.observation.trim()
                : ((carrosTesteros.observation && typeof carrosTesteros.observation === 'string') 
                  ? carrosTesteros.observation 
                  : ''),
            };
            
            // Verificar si ya existe
            const existingSubItemIndex = checklistEntriesRaw.findIndex((entry: any) => 
              entry && typeof entry.name === 'string' && 
              entry.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
              subItem.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            );
            
            if (existingSubItemIndex >= 0) {
              checklistEntriesRaw[existingSubItemIndex] = subItemEntry;
            } else {
              checklistEntriesRaw.push(subItemEntry);
            }
          }
        });
      }
      
      console.log('[maintenance-pdf] ✅ Items de carros testeros agregados al checklistEntriesRaw');
    }
    
    
    console.log('[maintenance-pdf] checklistEntriesRaw tiene', checklistEntriesRaw.length, 'items (incluye trolley y testero)');

    // Construir el checklistMap EXACTAMENTE como funciona para "Freno motor de elevación"
    // Primero, construir el mapa con los items del checklist normal
    const checklistMap = new Map<string, MaintenanceReportPdfPayload['checklist'][number]>();

    console.log('[maintenance-pdf] ========== CONSTRUYENDO MAPA DESDE checklistEntriesRaw ==========');
    console.log('[maintenance-pdf] Total items en checklistEntriesRaw:', checklistEntriesRaw.length);
    
    (checklistEntriesRaw ?? []).forEach((entry: any, index: number) => {
      // Usar dynamicChecklistFallback si está disponible, sino usar checklistFallback
      const fallbackList = dynamicChecklistFallback || checklistFallback;
      const entryName = typeof entry?.name === 'string' ? entry.name : fallbackList[index] ?? `Ítem ${index + 1}`;
      const key = normalizeName(entryName);
      if (!key) {
        console.log(`[maintenance-pdf] ⚠️ Saltando entry sin nombre válido en índice ${index}:`, entry);
        return;
      }
      
      // Log específico para "Motorreductor" cuando se construye el mapa
      if (key.includes('motorreductor') || entryName?.toLowerCase().includes('motorreductor')) {
        console.log(`[maintenance-pdf] 🔍 Agregando "Motorreductor" al mapa:`);
        console.log(`[maintenance-pdf]   - entry completo:`, JSON.stringify(entry, null, 2));
        console.log(`[maintenance-pdf]   - entryName: "${entryName}"`);
        console.log(`[maintenance-pdf]   - key normalizado: "${key}"`);
        console.log(`[maintenance-pdf]   - status: ${entry?.status || 'null'} (tipo: ${typeof entry?.status})`);
        console.log(`[maintenance-pdf]   - observation: ${entry?.observation ? 'yes' : 'no'} (tipo: ${typeof entry?.observation})`);
        console.log(`[maintenance-pdf]   - id: ${entry?.id || 'sin id'}`);
      }
      
      // NOTA: "Motorreductor" ya no es un sub-item de "Carros testeros", es un item independiente
      // Por lo tanto, todos los items de "Motorreductor" se agregan al mapa normalmente
      
      // Para todos los demás items (incluyendo el item independiente "Motorreductor"), agregar al mapa
      // USAR EXACTAMENTE LA MISMA LÓGICA que funciona para "Carros testeros" y otros items
      // Si ya existe en el mapa, actualizar con los datos más recientes (priorizar datos no nulos)
      if (checklistMap.has(key)) {
        const existing = checklistMap.get(key);
        const newStatus = entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : entry?.status === 'na' ? 'na' : null;
        const newObservation = typeof entry?.observation === 'string' ? entry.observation : '';
        
        // Actualizar si el nuevo tiene datos (priorizar datos nuevos sobre existentes)
        // Para "Motorreductor", siempre usar los datos más recientes
        const finalStatus = newStatus || existing?.status || null;
        const finalObservation = newObservation || existing?.observation || '';
        
          checklistMap.set(key, {
            index,
            name: entryName,
          status: finalStatus,
          observation: finalObservation,
        });
        
        // Log específico para "Motorreductor" cuando se actualiza
        if (key.includes('motorreductor')) {
          console.log(`[maintenance-pdf] 🔄 "Motorreductor" actualizado en mapa:`);
          console.log(`[maintenance-pdf]   - Status anterior: ${existing?.status || 'null'}, nuevo: ${newStatus || 'null'}, final: ${finalStatus || 'null'}`);
          console.log(`[maintenance-pdf]   - Observation anterior: ${existing?.observation ? 'yes' : 'no'}, nuevo: ${newObservation ? 'yes' : 'no'}, final: ${finalObservation ? 'yes' : 'no'}`);
        }
      } else {
        // Agregar al mapa (igual que "Carros testeros")
        const status = entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : entry?.status === 'na' ? 'na' : null;
        const observation = typeof entry?.observation === 'string' ? entry.observation : '';
        
        checklistMap.set(key, {
          index,
          name: entryName,
          status,
          observation,
        });
        
        // Log específico para "Motorreductor" cuando se agrega por primera vez
        if (key.includes('motorreductor')) {
          console.log(`[maintenance-pdf] ➕ "Motorreductor" agregado al mapa por primera vez:`);
          console.log(`[maintenance-pdf]   - Status: ${status || 'null'}`);
          console.log(`[maintenance-pdf]   - Observation: ${observation ? 'yes' : 'no'}`);
        }
      }
    });
    
    // Verificar si "Motorreductor" está en el mapa después de construirlo
    const motorreductorInMap = checklistMap.has(normalizeName('Motorreductor'));
    console.log(`[maintenance-pdf] 🔍 "Motorreductor" en mapa después de construcción: ${motorreductorInMap}`);
    if (motorreductorInMap) {
      const motorreductorEntry = checklistMap.get(normalizeName('Motorreductor'));
      console.log(`[maintenance-pdf]   - Entry:`, motorreductorEntry);
    }
    

    // Obtener datos de trolleyData para el PDF
    let trolleyData: any = null;
    if (reportData.trolleyData && typeof reportData.trolleyData === 'object') {
      trolleyData = reportData.trolleyData;
    } else if (nestedData?.trolleyData && typeof nestedData.trolleyData === 'object') {
      trolleyData = nestedData.trolleyData;
    } else if ((report as any).trolley_data && typeof (report as any).trolley_data === 'object') {
      trolleyData = (report as any).trolley_data;
    }
    
    console.log('[maintenance-pdf] trolleyData:', trolleyData);

    // Obtener datos de carrosTesteros para el PDF
    let carrosTesterosData: any = null;
    if (reportData.carrosTesteros && typeof reportData.carrosTesteros === 'object') {
      carrosTesterosData = reportData.carrosTesteros;
    } else if (nestedData?.carrosTesteros && typeof nestedData.carrosTesteros === 'object') {
      carrosTesterosData = nestedData.carrosTesteros;
    } else if ((report as any).carros_testeros && typeof (report as any).carros_testeros === 'object') {
      carrosTesterosData = (report as any).carros_testeros;
    }
    
    console.log('[maintenance-pdf] carrosTesterosData:', carrosTesterosData);

    // Obtener procedimientos para informe general
    let procedimientosData: any[] = [];
    if (reportData.procedimientos && Array.isArray(reportData.procedimientos)) {
      procedimientosData = reportData.procedimientos;
    } else if (nestedData?.procedimientos && Array.isArray(nestedData.procedimientos)) {
      procedimientosData = nestedData.procedimientos;
    }
    console.log('[maintenance-pdf] procedimientosData:', procedimientosData.length, 'items');

    // CONSTRUIR CHECKLIST
    const fallbackList = dynamicChecklistFallback || checklistFallback;
    const checklist: MaintenanceReportPdfPayload['checklist'] = [];
    
    // Si es INFORME GENERAL, usar procedimientos dinámicos
    if (isGeneralMaintenance(equipmentType)) {
      console.log('[maintenance-pdf] Tipo: Mantenimiento General - usando procedimientos dinámicos');
      procedimientosData.forEach((proc: any, idx: number) => {
        if (proc && typeof proc.procedimiento === 'string') {
          checklist.push({
            index: idx,
            name: proc.procedimiento || `Procedimiento ${idx + 1}`,
            status: null, // No aplica para procedimientos
            observation: typeof proc.observacion === 'string' ? proc.observacion : '',
          });
        }
      });
    } else {
      // PARA ELEVADORES Y PUENTES GRÚA: usar lista de chequeo normal
    
    // IMPORTANTE: Guardar una copia del checklist original ANTES de agregar items del trolley/carros testeros
    // Esto asegura que los índices correspondan correctamente a los items del fallbackList
    const originalChecklistItems = checklistEntriesRaw.slice(0, Math.min(checklistEntriesRaw.length, fallbackList.length));
    
    console.log('[maintenance-pdf] ========== CHECKLIST ORIGINAL (sin trolley/carros) ==========');
    console.log('[maintenance-pdf] originalChecklistItems tiene', originalChecklistItems.length, 'items');
    originalChecklistItems.forEach((entry: any, idx: number) => {
      const name = entry?.name || 'SIN NOMBRE';
      const status = entry?.status || 'null';
      console.log(`[maintenance-pdf]   ${idx}: "${name}" -> status=${status}`);
    });
    console.log('[maintenance-pdf] ==============================================================');
    
    // Crear un mapa de todos los items guardados por nombre normalizado
    const savedItemsMap = new Map<string, any>();
    // También crear un mapa por índice para fallback (usando el checklist original)
    const savedItemsByIndex = new Map<number, any>();
    
    // Primero, agregar los items del checklist original por índice
    originalChecklistItems.forEach((entry: any, idx: number) => {
      if (entry) {
        savedItemsByIndex.set(idx, entry);
        if (typeof entry.name === 'string') {
          const key = normalizeName(entry.name);
          savedItemsMap.set(key, entry);
          
          // Si es puentes-grua, también agregar con el nombre mapeado
          if (equipmentType === 'puentes-grua') {
            const mappedKey = normalizeNameWithMapping(entry.name, equipmentType);
            if (mappedKey !== key) {
              console.log(`[maintenance-pdf] 🔄 Mapeando "${entry.name}" (${key}) -> (${mappedKey})`);
              savedItemsMap.set(mappedKey, entry);
            }
          }
        }
      }
    });
    
    // También agregar items adicionales (trolley, carros testeros) al mapa por nombre
    checklistEntriesRaw.forEach((entry: any) => {
      if (entry && typeof entry.name === 'string') {
        const key = normalizeName(entry.name);
        if (!savedItemsMap.has(key)) {
          savedItemsMap.set(key, entry);
        }
      }
    });
    
    console.log('[maintenance-pdf] savedItemsByIndex tiene', savedItemsByIndex.size, 'items');
    
    // DEBUG: Verificar TODOS los items del checklist guardado
    console.log('[maintenance-pdf] ========== DEBUG ITEMS DEL CHECKLIST ==========');
    console.log('[maintenance-pdf] Total items en checklistEntriesRaw:', checklistEntriesRaw.length);
    console.log('[maintenance-pdf] Items guardados (primeros 20):');
    checklistEntriesRaw.slice(0, 20).forEach((entry: any, idx: number) => {
      const name = entry?.name || 'SIN NOMBRE';
      const status = entry?.status || 'null';
      const obs = entry?.observation?.substring(0, 20) || '';
      console.log(`[maintenance-pdf]   ${idx}: "${name}" -> status=${status}${obs ? `, obs="${obs}..."` : ''}`);
    });
    
    // DEBUG: Verificar items problemáticos específicos
    console.log('[maintenance-pdf] -----');
    console.log('[maintenance-pdf] Verificando items de fallbackList en savedItemsMap:');
    fallbackList.forEach((itemName: string, idx: number) => {
      const key = normalizeName(itemName);
      const found = savedItemsMap.get(key);
      const rawItem = checklistEntriesRaw[idx];
      console.log(`[maintenance-pdf]   ${idx}: "${itemName}" (key: "${key}"): ${found ? `✅ mapa` : '❌ mapa'} | raw[${idx}]: ${rawItem?.name ? `"${rawItem.name}"` : 'undefined'}`);
    });
    console.log('[maintenance-pdf] Todos los keys en savedItemsMap:', Array.from(savedItemsMap.keys()).join(', '));
    console.log('[maintenance-pdf] ==================================================');
    
    // Determinar si este tipo de equipo tiene items especiales (Trolley, Carros testeros)
    const useSpecialItems = hasSpecialItems(equipmentType);
    
    // Función auxiliar para agregar Trolley y sus sub-items
    const addTrolleyItems = () => {
      if (!useSpecialItems) return;
      
      // Obtener datos de trolleyData
      const mainStatus = trolleyData?.mainStatus || null;
      const mainObservation = trolleyData?.observation || '';
      
      // Agregar "Trolley" principal
      checklist.push({
        index: checklist.length,
        name: 'Trolley',
        status: mainStatus === 'good' ? 'good' : mainStatus === 'bad' ? 'bad' : mainStatus === 'na' ? 'na' : null,
        observation: typeof mainObservation === 'string' ? mainObservation : '',
      });
      
      // Solo agregar sub-items si el estado principal NO es 'na'
      if (mainStatus !== 'na') {
        const trolleySubItemNames = ['Motor Trolley', 'Freno motor Trolley', 'Guías de Trolley', 'Ruedas de Trolley'];
        const subItemsFromData = Array.isArray(trolleyData?.subItems) ? trolleyData.subItems : [];
        
        trolleySubItemNames.forEach((subName) => {
          const subItemData = subItemsFromData.find((si: any) => 
            si && si.name && normalizeName(si.name) === normalizeName(subName)
          );
          
          if (subItemData) {
            checklist.push({
              index: checklist.length,
              name: subName,
              status: subItemData.status === 'good' ? 'good' : subItemData.status === 'bad' ? 'bad' : subItemData.status === 'na' ? 'na' : null,
              observation: typeof subItemData.observation === 'string' ? subItemData.observation : '',
            });
          }
        });
      }
    };
    
    // Función auxiliar para agregar Carros testeros y sus sub-items
    const addCarrosTesterosItems = () => {
      if (!useSpecialItems) return;
      
      // Obtener datos de carrosTesterosData
      const mainStatus = carrosTesterosData?.mainStatus || null;
      const mainObservation = carrosTesterosData?.observation || '';
      
      // Agregar "Carros testeros" principal
      checklist.push({
        index: checklist.length,
        name: 'Carros testeros',
        status: mainStatus === 'good' ? 'good' : mainStatus === 'bad' ? 'bad' : mainStatus === 'na' ? 'na' : null,
        observation: typeof mainObservation === 'string' ? mainObservation : '',
      });
      
      // Solo agregar sub-items si el estado principal NO es 'na'
      if (mainStatus !== 'na') {
        const carrosTesterosSubItemNames = ['Motorreductor', 'Freno', 'Ruedas y palanquilla', 'Chumaceras'];
        const subItemsFromData = Array.isArray(carrosTesterosData?.subItems) ? carrosTesterosData.subItems : [];
        
        carrosTesterosSubItemNames.forEach((subName) => {
          const subItemData = subItemsFromData.find((si: any) => 
            si && si.name && normalizeName(si.name) === normalizeName(subName)
          );
          
          if (subItemData) {
            checklist.push({
              index: checklist.length,
              name: subName,
              status: subItemData.status === 'good' ? 'good' : subItemData.status === 'bad' ? 'bad' : subItemData.status === 'na' ? 'na' : null,
              observation: typeof subItemData.observation === 'string' ? subItemData.observation : '',
            });
          }
        });
      }
    };
    
    // Iterar sobre fallbackList para mantener el orden correcto
    for (let i = 0; i < fallbackList.length; i++) {
      const name = fallbackList[i];
      const nameLower = normalizeName(name);
      
      // ESTRATEGIA DE BÚSQUEDA MEJORADA:
      // 1. Primero usar el índice directo (más confiable para puentes grúa)
      // 2. Luego buscar por nombre normalizado
      // 3. Finalmente buscar por coincidencia parcial
      
      let savedItem: any = null;
      
      // 1. BÚSQUEDA POR ÍNDICE DIRECTO (prioridad máxima para puentes grúa)
      if (savedItemsByIndex.has(i)) {
        savedItem = savedItemsByIndex.get(i);
        if (savedItem) {
          console.log(`[maintenance-pdf] 📌 Item ${i} "${name}" encontrado por índice: name="${savedItem.name}", status=${savedItem.status || 'null'}`);
        }
      }
      
      // 2. Si no se encontró por índice, buscar por nombre normalizado
      if (!savedItem) {
        savedItem = savedItemsMap.get(nameLower);
        if (savedItem) {
          console.log(`[maintenance-pdf] ✅ Item ${i} "${name}" encontrado por nombre: status=${savedItem.status || 'null'}`);
        }
      }
      
      // 3. Si aún no se encontró, buscar por coincidencia parcial
      if (!savedItem) {
        const partialMatch = originalChecklistItems.find((entry: any) => {
          if (!entry || typeof entry.name !== 'string') return false;
          const entryNameNorm = normalizeName(entry.name);
          const firstWord = nameLower.split(' ')[0];
          return entryNameNorm.startsWith(firstWord) || nameLower.startsWith(entryNameNorm.split(' ')[0]);
        });
        
        if (partialMatch) {
          console.log(`[maintenance-pdf] 🔍 Item ${i} "${name}" encontrado por coincidencia parcial: "${partialMatch.name}", status=${partialMatch.status || 'null'}`);
          savedItem = partialMatch;
        }
      }
      
      // Si no se encontró, log de advertencia
      if (!savedItem) {
        console.log(`[maintenance-pdf] ❌ Item ${i} "${name}" NO ENCONTRADO en ninguna búsqueda`);
      }
      
      // Agregar item normal
      checklist.push({
        index: checklist.length,
        name,
        status: savedItem?.status === 'good' ? 'good' : savedItem?.status === 'bad' ? 'bad' : savedItem?.status === 'na' ? 'na' : null,
        observation: typeof savedItem?.observation === 'string' ? savedItem.observation : '',
      });
      
      // Después de "Freno motor de elevación", insertar Trolley y Carros testeros (solo para puentes grúa)
      if (useSpecialItems && nameLower === normalizeName('Freno motor de elevación')) {
        addTrolleyItems();
        addCarrosTesterosItems();
      }
    }
    } // Fin del else (elevadores y puentes grúa)
    
    // Re-indexar
    const finalChecklist = checklist.map((item, idx) => ({
      ...item,
      index: idx,
    }));

    console.log('[maintenance-pdf] ========== CHECKLIST FINAL ==========');
    console.log('[maintenance-pdf] Checklist final:', finalChecklist.length, 'items');
    console.log('[maintenance-pdf] Items con status:');
    finalChecklist.forEach(item => {
      console.log(`[maintenance-pdf]   ${item.index}: "${item.name}" -> status=${item.status || 'NULL'}, obs=${item.observation?.substring(0, 20) || 'vacío'}`);
    });
    console.log('[maintenance-pdf] =====================================');

    const payload: MaintenanceReportPdfPayload = {
      title: 'Informe de Mantenimiento',
      reportId,
      equipmentType: equipmentType || 'elevadores',
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
      checklist: finalChecklist,
      photos,
    };
    
    // Log del payload.checklist para verificar
    console.log('[maintenance-pdf] payload.checklist.length:', payload.checklist.length);
    const tornilloInPayload = payload.checklist.find(i => normalizeName(i.name) === normalizeName('Tornillo'));
    const motorreductorInPayload = payload.checklist.find(i => normalizeName(i.name) === normalizeName('Motorreductor'));
    console.log('[maintenance-pdf] "Tornillo" en payload.checklist:', tornilloInPayload ? `✅` : '❌');
    console.log('[maintenance-pdf] "Motorreductor" en payload.checklist:', motorreductorInPayload ? `✅` : '❌');

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
