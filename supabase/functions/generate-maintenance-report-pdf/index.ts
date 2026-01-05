import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { createMaintenanceReportPDF, type MaintenanceReportPdfPayload } from '../_shared/maintenance-report-pdf.ts';
import { buildPdfResponseHeaders } from '../_shared/response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Items base para elevadores
const ELEVATOR_CHECKLIST_ITEMS = [
  'Motor de elevación',
  'Freno motor de elevación',
  'Trolley',
  'Motor Trolley',
  'Freno motor Trolley',
  'Guias de Trolley',
  'Ruedas Trolley',
  'Carros testeros',
  'Motorreductor',
  'Estructura',
  'Tornillo',
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

// Items adicionales para puentes grúa
// TODO: Agregar aquí los items específicos que necesites para puentes grúa
const BRIDGE_CRANE_ADDITIONAL_ITEMS = [
  // Ejemplo: 'Sistema de iluminación',
  // Ejemplo: 'Carril de desplazamiento',
  // Agregar más items según necesidad
];

// Función para obtener los items según el tipo de equipo
const getChecklistItems = (equipmentType?: string): string[] => {
  if (equipmentType === 'puentes-grua') {
    return [...ELEVATOR_CHECKLIST_ITEMS, ...BRIDGE_CRANE_ADDITIONAL_ITEMS];
  }
  return ELEVATOR_CHECKLIST_ITEMS;
};

// Mantener checklistFallback para compatibilidad (se actualizará dinámicamente)
const checklistFallback = ELEVATOR_CHECKLIST_ITEMS;

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
    
    // Detectar el tipo de equipo para usar la lista correcta de items
    // Puede estar en reportData.equipmentType o inferirse de la ruta/contexto
    // Por ahora, detectar desde reportData.equipmentType si existe
    const equipmentType = reportData.equipmentType || nestedData?.equipmentType || undefined;
    const dynamicChecklistFallback = getChecklistItems(equipmentType);
    console.log('[maintenance-pdf] Equipment type detected:', equipmentType);
    console.log('[maintenance-pdf] Using checklist with', dynamicChecklistFallback.length, 'items');
    
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
    

    // Los items del trolley y testero ya están en checklistEntriesRaw, 
    // así que el mapa ya los incluye automáticamente (igual que "Motor de elevación")

    // CONSTRUIR CHECKLIST DIRECTAMENTE DESDE checklistEntriesRaw (lo que el usuario guardó)
    const fallbackList = dynamicChecklistFallback || checklistFallback;
    const checklist: MaintenanceReportPdfPayload['checklist'] = [];
    
    // Crear un mapa de todos los items guardados por nombre normalizado
    const savedItemsMap = new Map<string, any>();
    checklistEntriesRaw.forEach((entry: any) => {
      if (entry && typeof entry.name === 'string') {
        const key = normalizeName(entry.name);
        savedItemsMap.set(key, entry);
      }
    });
    
    // Iterar sobre fallbackList para mantener el orden correcto
    for (let i = 0; i < fallbackList.length; i++) {
      const name = fallbackList[i];
      const nameLower = normalizeName(name);
      const savedItem = savedItemsMap.get(nameLower);
      
      if (nameLower.includes('carros') && nameLower.includes('testeros')) {
        // Agregar "Carros testeros" principal
        checklist.push({
          index: checklist.length,
          name,
          status: savedItem?.status === 'good' ? 'good' : savedItem?.status === 'bad' ? 'bad' : savedItem?.status === 'na' ? 'na' : null,
          observation: typeof savedItem?.observation === 'string' ? savedItem.observation : '',
        });
        
        // Agregar sub-items
        const subItems = ['Freno', 'Ruedas', 'Chumaceras', 'Palanquilla'];
        subItems.forEach((subName) => {
          const subKey = normalizeName(subName);
          const subSaved = Array.from(savedItemsMap.entries()).find(([key, entry]: [string, any]) => 
            key === subKey && (entry.id?.includes('carros-testeros') || entry.id?.includes('carros') || entry.id?.includes('testeros'))
          )?.[1];
          
          checklist.push({
            index: checklist.length,
            name: subName,
            status: subSaved?.status === 'good' ? 'good' : subSaved?.status === 'bad' ? 'bad' : subSaved?.status === 'na' ? 'na' : null,
            observation: typeof subSaved?.observation === 'string' ? subSaved.observation : '',
          });
        });
      } else {
        // Agregar item normal
        checklist.push({
          index: checklist.length,
          name,
          status: savedItem?.status === 'good' ? 'good' : savedItem?.status === 'bad' ? 'bad' : savedItem?.status === 'na' ? 'na' : null,
          observation: typeof savedItem?.observation === 'string' ? savedItem.observation : '',
        });
      }
    }
    
    // Agregar cualquier item adicional guardado que no esté en fallbackList
    savedItemsMap.forEach((entry, key) => {
      const alreadyAdded = checklist.some(item => normalizeName(item.name) === key);
      if (!alreadyAdded) {
        const isSubItem = entry.id?.includes('carros-testeros') || entry.id?.includes('carros') || entry.id?.includes('testeros');
        if (!isSubItem) {
          checklist.push({
            index: checklist.length,
            name: entry.name,
            status: entry.status === 'good' ? 'good' : entry.status === 'bad' ? 'bad' : entry.status === 'na' ? 'na' : null,
            observation: typeof entry.observation === 'string' ? entry.observation : '',
          });
        }
      }
    });
    
    // Re-indexar
    const finalChecklist = checklist.map((item, idx) => ({
      ...item,
      index: idx,
    }));

    console.log('[maintenance-pdf] Checklist final:', finalChecklist.length, 'items');
    console.log('[maintenance-pdf] Items:', finalChecklist.map(i => `${i.index}: ${i.name}`).join(', '));

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
