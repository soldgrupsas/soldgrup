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
  'Motor Trolley',
  'Freno motor Trolley',
  'Guias de Trolley',
  'Ruedas Trolley',
  'Carros testeros',
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
    console.log('[maintenance-pdf] Full reportData structure:', JSON.stringify(reportData, null, 2));
    console.log('[maintenance-pdf] reportData keys:', Object.keys(reportData));
    
    // También verificar si los datos están anidados en reportData.data
    const nestedData = (reportData.data && typeof reportData.data === 'object') ? reportData.data as Record<string, any> : null;
    
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

    let checklistEntriesRaw = Array.isArray(reportData.checklist)
      ? reportData.checklist
      : Array.isArray(nestedData?.checklist)
      ? nestedData.checklist
      : Array.isArray(reportData?.data?.checklist)
      ? reportData.data.checklist
      : [];

    // Obtener datos del trolleyGroup y carrosTesteros ANTES de construir el mapa
    const reportWithColumns = report as any;
    let trolleyGroup: any = null;
    let carrosTesteros: any = null;
    
    // Buscar trolleyGroup y carrosTesteros
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
    
    // Función auxiliar para normalizar nombres (remover acentos y convertir a minúsculas)
    // Definirla aquí para usarla antes de construir el mapa
    const normalizeName = (str: string): string => {
      return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };
    
    // Buscar carrosTesteros
    if (reportWithColumns.carros_testeros && typeof reportWithColumns.carros_testeros === 'object') {
      carrosTesteros = reportWithColumns.carros_testeros;
    } else if (reportData.carrosTesteros && typeof reportData.carrosTesteros === 'object') {
      carrosTesteros = reportData.carrosTesteros;
    } else if (nestedData?.carrosTesteros && typeof nestedData.carrosTesteros === 'object') {
      carrosTesteros = nestedData.carrosTesteros;
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
      const entryName = typeof entry?.name === 'string' ? entry.name : checklistFallback[index] ?? `Ítem ${index + 1}`;
      const key = normalizeName(entryName);
      if (!key) return;
      
      // Para "Motorreductor" (sub-item de Carros testeros), verificar que no se agregue al mapa
      // El sub-item tiene id que incluye "carros-testeros" o "carros" o "testeros"
      const entryId = entry?.id || '';
      const isMotorreductorSubItem = normalizeName(entryName) === normalizeName('Motorreductor') && 
                                      (entryId.includes('carros-testeros') || entryId.includes('carros') || entryId.includes('testeros'));
      
      // Si es el sub-item de Motorreductor de Carros testeros, NO agregarlo al mapa
      // (se buscará directamente en checklistEntriesRaw cuando se procesen los sub-items)
      if (isMotorreductorSubItem) {
        return;
      }
      
      // Para todos los demás items (incluyendo el item independiente "Motorreductor"), agregar al mapa
      // USAR EXACTAMENTE LA MISMA LÓGICA que funciona para "Carros testeros" y otros items
      // Si ya existe en el mapa, solo actualizar si el nuevo tiene datos (status u observation)
      if (checklistMap.has(key)) {
        const existing = checklistMap.get(key);
        const newStatus = entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : entry?.status === 'na' ? 'na' : null;
        const newObservation = typeof entry?.observation === 'string' ? entry.observation : '';
        
        // Solo actualizar si el nuevo tiene datos y el existente no
        if ((!existing?.status && newStatus) || (!existing?.observation && newObservation)) {
          checklistMap.set(key, {
            index,
            name: entryName,
            status: newStatus || existing?.status || null,
            observation: newObservation || existing?.observation || '',
          });
        }
      } else {
        // Agregar al mapa (igual que "Carros testeros")
        checklistMap.set(key, {
          index,
          name: entryName,
          status: entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : entry?.status === 'na' ? 'na' : null,
          observation: typeof entry?.observation === 'string' ? entry.observation : '',
        });
        
      }
    });
    

    // Los items del trolley y testero ya están en checklistEntriesRaw, 
    // así que el mapa ya los incluye automáticamente (igual que "Motor de elevación")

    // Construir el checklist usando la misma lógica simple para todos los items
    // Ahora todos los items (incluidos trolley y sub-items de carro testero) están en el checklistMap
    const checklist: MaintenanceReportPdfPayload['checklist'] = [];
    let currentIndex = 0;
    
    // Los sub-items de carros testeros ya están en checklistEntriesRaw y en el mapa
    // Solo necesitamos buscarlos en el mapa cuando encontremos "Carros testeros"
    
    console.log('[maintenance-pdf] ========== INICIANDO CONSTRUCCIÓN DE CHECKLIST ==========');
    console.log('[maintenance-pdf] Construyendo checklist desde checklistFallback con', checklistFallback.length, 'items base');
    console.log('[maintenance-pdf] checklistMap tiene', checklistMap.size, 'entradas');
    console.log('[maintenance-pdf] checklistFallback contiene "Carros testeros":', checklistFallback.includes('Carros testeros'));
    
    for (let i = 0; i < checklistFallback.length; i++) {
      const name = checklistFallback[i];
      const nameLower = normalizeName(name);
      const entry = checklistMap.get(nameLower);
      
      // Solo loguear cada 5 items para no saturar, pero SIEMPRE loguear "Carros testeros"
      if (i % 5 === 0 || nameLower.includes('carros') || nameLower.includes('testeros')) {
        console.log(`[maintenance-pdf] Procesando item ${i + 1}/${checklistFallback.length}: "${name}" - encontrado en mapa: ${!!entry}, status: ${entry?.status ?? 'null'}`);
      }
      
      // Si es "Carros testeros", agregar los sub-items inmediatamente después
      // Los sub-items ya están en el mapa (desde checklistEntriesRaw)
      const isCarrosTesteros = (nameLower.includes('carros') && nameLower.includes('testeros')) || 
                               (normalizeName('Carros testeros') === nameLower) ||
                               (name === 'Carros testeros');
      
      if (isCarrosTesteros) {
        // Agregar "Carros testeros" primero
        checklist.push({
          index: currentIndex,
          name,
          status: entry?.status ?? null,
          observation: entry?.observation ?? '',
        });
        currentIndex++;
        
        console.log(`[maintenance-pdf] ✅ Encontrado "Carros testeros", agregando sub-items desde el mapa...`);
        
        // Buscar los sub-items directamente en checklistEntriesRaw (no en el mapa para evitar conflictos)
        // Los sub-items de "Carros testeros" son: Motorreductor, Freno, Ruedas, Chumaceras, Palanquilla
        const expectedSubItemNames = ['Motorreductor', 'Freno', 'Ruedas', 'Chumaceras', 'Palanquilla'];
        expectedSubItemNames.forEach((subItemName) => {
          // Buscar en checklistEntriesRaw el sub-item que tenga id relacionado con carros-testeros
          let subItemEntry = null;
          for (const rawEntry of checklistEntriesRaw) {
            if (rawEntry && typeof rawEntry.name === 'string' && 
                normalizeName(rawEntry.name) === normalizeName(subItemName)) {
              const entryId = rawEntry.id || '';
              // Verificar que sea el sub-item de Carros testeros (tiene id relacionado)
              if (entryId.includes('carros-testeros') || entryId.includes('carros') || entryId.includes('testeros')) {
                subItemEntry = rawEntry;
                break;
              }
            }
          }
          
          if (subItemEntry) {
            // Encontrado el sub-item en checklistEntriesRaw
            checklist.push({
              index: currentIndex,
              name: subItemName,
              status: subItemEntry.status === 'good' ? 'good' : subItemEntry.status === 'bad' ? 'bad' : subItemEntry.status === 'na' ? 'na' : null,
              observation: typeof subItemEntry.observation === 'string' ? subItemEntry.observation : '',
            });
            console.log(`[maintenance-pdf] ✅ Sub-item de Carros testeros agregado desde checklistEntriesRaw: "${subItemName}" - status: ${subItemEntry.status || 'null'}`);
            currentIndex++;
          } else {
            // Si no está en checklistEntriesRaw, crearlo con datos por defecto
            checklist.push({
              index: currentIndex,
              name: subItemName,
              status: null,
              observation: '',
            });
            console.log(`[maintenance-pdf] ⚠️ Sub-item de Carros testeros agregado por defecto: "${subItemName}" (no estaba en checklistEntriesRaw)`);
            currentIndex++;
          }
        });
        
        console.log(`[maintenance-pdf] ✅✅✅ COMPLETADO: 5 sub-items agregados después de "Carros testeros"`);
      } else {
        // Para todos los demás items, agregar normalmente
        // Usar la MISMA lógica que funciona para "Freno motor de elevación" y otros items
        const itemStatus = entry?.status ?? null;
        const itemObservation = entry?.observation ?? '';
        
        checklist.push({
          index: currentIndex,
          name,
          status: itemStatus,
          observation: itemObservation,
        });
        
        currentIndex++;
      }
      
    }
    
    // Logs finales para verificar
    console.log('[maintenance-pdf] ====== CHECKLIST FINAL CONSTRUIDO ======');
    console.log('[maintenance-pdf] Total items en checklist:', checklist.length);
    const trolleyChecklistItems = checklist.filter(item => {
      const nameLower = normalizeName(item.name);
      return nameLower.includes('trolley');
    });
    console.log('[maintenance-pdf] Items del trolley en checklist:', trolleyChecklistItems.length);
    trolleyChecklistItems.forEach(item => {
      console.log(`[maintenance-pdf] - ${item.name}: status=${item.status}, observation=${item.observation ? 'yes' : 'no'}`);
    });
    
    const carrosChecklistItems = checklist.filter(item => {
      const nameLower = normalizeName(item.name);
      return nameLower.includes('carros') || nameLower.includes('motorreductor') || nameLower.includes('freno') || 
             (nameLower.includes('ruedas') && !nameLower.includes('trolley')) || 
             nameLower.includes('chumacera') || nameLower.includes('palanquilla');
    });
    console.log('[maintenance-pdf] Items de carros testeros en checklist:', carrosChecklistItems.length);
    carrosChecklistItems.forEach(item => {
      console.log(`[maintenance-pdf] - ${item.name}: status=${item.status}, observation=${item.observation ? 'yes' : 'no'}`);
    });
    console.log('[maintenance-pdf] ========================================');
    
    // VERIFICACIÓN FINAL: Asegurarse de que los sub-items de carros testeros estén en el checklist
    const expectedSubItemNames = ['Motorreductor', 'Freno', 'Ruedas', 'Chumaceras', 'Palanquilla'];
    const foundSubItems = expectedSubItemNames.filter(subItemName => {
      return checklist.some(item => normalizeName(item.name) === normalizeName(subItemName));
    });
    
    console.log('[maintenance-pdf] 🔍 VERIFICACIÓN: Sub-items esperados:', expectedSubItemNames.length);
    console.log('[maintenance-pdf] 🔍 VERIFICACIÓN: Sub-items encontrados:', foundSubItems.length, '-', foundSubItems.join(', '));
    
    if (foundSubItems.length < expectedSubItemNames.length) {
      console.log('[maintenance-pdf] ⚠️⚠️⚠️ PROBLEMA: Faltan sub-items! Agregando manualmente...');
      
      // Buscar la posición de "Carros testeros" en el checklist
      const carrosTesterosIndex = checklist.findIndex(item => {
        const nameLower = normalizeName(item.name);
        return nameLower.includes('carros') && nameLower.includes('testeros');
      });
      
      if (carrosTesterosIndex !== -1) {
        console.log(`[maintenance-pdf] ✅ Encontrado "Carros testeros" en índice ${carrosTesterosIndex} del checklist`);
        const carrosTesterosItem = checklist[carrosTesterosIndex];
        
        // Buscar los sub-items en el mapa (ya están ahí desde checklistEntriesRaw)
        const subItemsToInsert: any[] = [];
        expectedSubItemNames.forEach((subItemName) => {
          const subItemKey = normalizeName(subItemName);
          const subItemEntry = checklistMap.get(subItemKey);
          if (subItemEntry) {
            subItemsToInsert.push(subItemEntry);
          } else {
            // Si no está en el mapa, crear uno por defecto
            subItemsToInsert.push({
              name: subItemName,
              status: null,
              observation: '',
            });
          }
        });
        
        console.log(`[maintenance-pdf] Insertando ${subItemsToInsert.length} sub-items después de "Carros testeros"...`);
        
        // Reconstruir el checklist agregando los sub-items después de "Carros testeros"
        const newChecklist: MaintenanceReportPdfPayload['checklist'] = [];
        let newIndex = 0;
        
        // Copiar todos los items hasta "Carros testeros"
        for (let i = 0; i <= carrosTesterosIndex; i++) {
          newChecklist.push({
            ...checklist[i],
            index: newIndex,
          });
          newIndex++;
        }
        
        // Agregar los sub-items después de "Carros testeros"
        subItemsToInsert.forEach((subItem: any, idx: number) => {
          const subItemName = (subItem.name && typeof subItem.name === 'string') ? subItem.name : expectedSubItemNames[idx] || `Componente ${idx + 1}`;
          
          // Verificar si ya existe en el checklist original (para evitar duplicados)
          const alreadyExists = checklist.some(item => normalizeName(item.name) === normalizeName(subItemName));
          if (!alreadyExists) {
            const subItemStatus = (subItem.status === 'good' || subItem.status === 'bad' || subItem.status === 'na') ? subItem.status : null;
            const subItemObs = (subItem.observation && typeof subItem.observation === 'string' && subItem.observation.trim()) 
              ? subItem.observation.trim()
              : ((carrosTesteros && typeof carrosTesteros === 'object' && carrosTesteros.observation && typeof carrosTesteros.observation === 'string') 
                ? carrosTesteros.observation 
                : '');
            
            newChecklist.push({
              index: newIndex,
              name: subItemName,
              status: subItemStatus,
              observation: subItemObs,
            });
            
            console.log(`[maintenance-pdf] ✅ Agregado sub-item "${subItemName}" con index ${newIndex}`);
            newIndex++;
          } else {
            console.log(`[maintenance-pdf] ⚠️ Sub-item "${subItemName}" ya existe, copiando desde checklist original...`);
            // Si ya existe, copiarlo del checklist original con el nuevo índice
            const existingItem = checklist.find(item => normalizeName(item.name) === normalizeName(subItemName));
            if (existingItem) {
              newChecklist.push({
                ...existingItem,
                index: newIndex,
              });
              newIndex++;
            }
          }
        });
        
        // Copiar todos los items restantes después de "Carros testeros"
      for (let i = carrosTesterosIndex + 1; i < checklist.length; i++) {
          // Verificar que no sea un sub-item que ya agregamos
          const itemNameLower = normalizeName(checklist[i].name);
          const isSubItem = expectedSubItemNames.some(subName => normalizeName(subName) === itemNameLower);
          
          if (!isSubItem) {
            newChecklist.push({
              ...checklist[i],
              index: newIndex,
            });
            newIndex++;
          }
        }
        
        // Reemplazar el checklist con el nuevo
        checklist.length = 0;
        checklist.push(...newChecklist);
        
        console.log(`[maintenance-pdf] ✅✅✅ COMPLETADO: ${subItemsToInsert.length} sub-items agregados manualmente después de "Carros testeros"`);
        console.log(`[maintenance-pdf] Total items en checklist ahora: ${checklist.length}`);
    } else {
        console.log('[maintenance-pdf] ❌ No se encontró "Carros testeros" en el checklist para agregar sub-items');
      }
    }

    // Log final del checklist generado
    console.log('[maintenance-pdf] Final checklist items count:', checklist.length);
    const trolleyItems = checklist.filter(item => {
      const nameLower = normalizeName(item.name);
      return nameLower.includes('trolley') || nameLower.includes('carros');
    });
    console.log('[maintenance-pdf] Trolley and carros items found:', trolleyItems.length);
    trolleyItems.forEach(item => {
      console.log(`[maintenance-pdf] - ${item.name}: status=${item.status}, observation=${item.observation ? 'yes' : 'no'}`);
    });

    // VERIFICACIÓN FINAL ABSOLUTA: Asegurar que los sub-items estén antes de crear el payload
    const finalExpectedSubItems = ['Motorreductor', 'Freno', 'Ruedas', 'Chumaceras', 'Palanquilla'];
    const finalCarrosIndex = checklist.findIndex(item => {
      const nameLower = normalizeName(item.name);
      return nameLower.includes('carros') && nameLower.includes('testeros');
    });
    
    // Verificar qué sub-items ya están presentes
    const existingSubItemNames = new Set<string>();
    checklist.forEach(item => {
      const nameLower = normalizeName(item.name);
      finalExpectedSubItems.forEach(subName => {
        if (normalizeName(subName) === nameLower) {
          existingSubItemNames.add(subName);
        }
      });
    });
    
    const missingSubItems = finalExpectedSubItems.filter(subName => !existingSubItemNames.has(subName));
    
    console.log('[maintenance-pdf] ========== VERIFICACIÓN FINAL DE SUB-ITEMS ==========');
    console.log('[maintenance-pdf] Sub-items esperados:', finalExpectedSubItems.length);
    console.log('[maintenance-pdf] Sub-items encontrados:', existingSubItemNames.size, '-', Array.from(existingSubItemNames).join(', '));
    console.log('[maintenance-pdf] Sub-items faltantes:', missingSubItems.length, '-', missingSubItems.join(', '));
    
    if (finalCarrosIndex !== -1 && missingSubItems.length > 0) {
      console.log(`[maintenance-pdf] 🔴 AGREGANDO ${missingSubItems.length} SUB-ITEMS FALTANTES...`);
      
      // Obtener datos de carrosTesteros
      let subItemsData: any[] = [];
      if (carrosTesteros && typeof carrosTesteros === 'object' && carrosTesteros.subItems && Array.isArray(carrosTesteros.subItems)) {
        subItemsData = carrosTesteros.subItems;
      }
      
      // Crear un nuevo checklist con los sub-items agregados
      const finalChecklist: MaintenanceReportPdfPayload['checklist'] = [];
      
      // Copiar items hasta "Carros testeros"
      for (let i = 0; i <= finalCarrosIndex; i++) {
        finalChecklist.push({
          ...checklist[i],
          index: finalChecklist.length,
        });
      }
      
      // Agregar TODOS los sub-items esperados
      finalExpectedSubItems.forEach((subItemName, idx) => {
        // Buscar si ya existe en el checklist original
        const existingItem = checklist.find(item => normalizeName(item.name) === normalizeName(subItemName));
        
        if (existingItem) {
          // Si ya existe, usarlo
          finalChecklist.push({
            ...existingItem,
            index: finalChecklist.length,
          });
        } else {
          // Si no existe, buscar en carrosTesteros o crear uno nuevo
          const subItemData = subItemsData.find((item: any) => 
            normalizeName(item.name || '') === normalizeName(subItemName)
          );
          
          finalChecklist.push({
            index: finalChecklist.length,
            name: subItemName,
            status: subItemData?.status === 'good' || subItemData?.status === 'bad' || subItemData?.status === 'na' 
              ? subItemData.status 
              : null,
            observation: subItemData?.observation && typeof subItemData.observation === 'string' && subItemData.observation.trim()
              ? subItemData.observation.trim()
              : ((carrosTesteros && typeof carrosTesteros === 'object' && carrosTesteros.observation && typeof carrosTesteros.observation === 'string') 
                ? carrosTesteros.observation 
                : ''),
          });
        }
        
        console.log(`[maintenance-pdf] ✅ Sub-item "${subItemName}" agregado (index: ${finalChecklist.length - 1})`);
      });
      
      // Copiar el resto de items después de los sub-items
      for (let i = finalCarrosIndex + 1; i < checklist.length; i++) {
        const itemNameLower = normalizeName(checklist[i].name);
        const isSubItem = finalExpectedSubItems.some(subName => normalizeName(subName) === itemNameLower);
        
        if (!isSubItem) {
          finalChecklist.push({
            ...checklist[i],
            index: finalChecklist.length,
          });
        }
      }
      
      // Reemplazar el checklist con el nuevo
      checklist.length = 0;
      checklist.push(...finalChecklist);
      
      console.log(`[maintenance-pdf] ✅✅✅ COMPLETADO: Checklist reconstruido con ${checklist.length} items`);
    }
    
    // VERIFICACIÓN Y AGREGADO DE SUB-ITEMS DE MOTORREDUCTOR (item independiente)
    // Buscar el item "Motorreductor" en el checklist (no confundir con el sub-item de carrosTesteros)
    // Si motorreductor tiene subItems propios, buscar el item principal "Motorreductor"
    // que debería estar en el checklist (agregado desde checklistEntriesRaw con id 'motorreductor-main')
    let motorreductorMainIndex = -1;
    
    if (motorreductor && typeof motorreductor === 'object' && motorreductor.subItems && Array.isArray(motorreductor.subItems) && motorreductor.subItems.length > 0) {
      // Buscar el item "Motorreductor" que sea el principal (no el sub-item de carrosTesteros)
      // El principal debería estar antes de los sub-items de carrosTesteros o después de ellos
      // Buscamos el primer "Motorreductor" que no esté inmediatamente después de "Carros testeros"
      const carrosTesterosIndex = checklist.findIndex(item => {
        const nameLower = normalizeName(item.name);
        return nameLower.includes('carros') && nameLower.includes('testeros');
      });
      
      // Buscar todos los items "Motorreductor"
      const allMotorreductorIndices = checklist
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => normalizeName(item.name) === normalizeName('Motorreductor'));
      
      if (allMotorreductorIndices.length > 0) {
        // Si hay "Carros testeros", el motorreductor principal probablemente esté después de sus sub-items
        // o antes de "Carros testeros". Buscamos el que tenga el status del motorreductor principal
        const motorreductorMainStatus = motorreductor.mainStatus;
        
        for (const { item, index } of allMotorreductorIndices) {
          // Verificar si este item tiene el mismo status que el motorreductor principal
          if (item.status === motorreductorMainStatus) {
            motorreductorMainIndex = index;
            console.log(`[maintenance-pdf] ✅ Encontrado item principal "Motorreductor" en índice ${index} (coincide con mainStatus)`);
            break;
          }
        }
        
        // Si no encontramos por status, usar el primero que no esté inmediatamente después de carrosTesteros
        if (motorreductorMainIndex === -1 && allMotorreductorIndices.length > 0) {
          if (carrosTesterosIndex !== -1) {
            // Buscar el que esté más lejos de carrosTesteros (probablemente el principal)
            const distances = allMotorreductorIndices.map(({ index }) => Math.abs(index - carrosTesterosIndex));
            const maxDistanceIndex = distances.indexOf(Math.max(...distances));
            motorreductorMainIndex = allMotorreductorIndices[maxDistanceIndex].index;
            console.log(`[maintenance-pdf] ✅ Encontrado item principal "Motorreductor" en índice ${motorreductorMainIndex} (más lejos de Carros testeros)`);
          } else {
            // Si no hay carrosTesteros, usar el primero
            motorreductorMainIndex = allMotorreductorIndices[0].index;
            console.log(`[maintenance-pdf] ✅ Encontrado item principal "Motorreductor" en índice ${motorreductorMainIndex} (único encontrado)`);
          }
        }
      }
    }
    
    if (motorreductorMainIndex !== -1 && motorreductor && typeof motorreductor === 'object' && 
        motorreductor.subItems && Array.isArray(motorreductor.subItems) && motorreductor.subItems.length > 0) {
      console.log(`[maintenance-pdf] 🔧 Procesando sub-items de Motorreductor (item independiente) en índice ${motorreductorMainIndex}`);
      
      // Obtener los nombres de los sub-items de motorreductor
      const motorreductorSubItemNames = motorreductor.subItems
        .filter((subItem: any) => subItem && typeof subItem === 'object' && subItem.name)
        .map((subItem: any) => subItem.name);
      
      console.log(`[maintenance-pdf] 📋 Sub-items esperados de Motorreductor:`, motorreductorSubItemNames);
      
      // Verificar qué sub-items ya están presentes después del item principal
      const existingMotorreductorSubItems = new Set<string>();
      for (let i = motorreductorMainIndex + 1; i < checklist.length; i++) {
        const itemNameLower = normalizeName(checklist[i].name);
        motorreductorSubItemNames.forEach((subName: string) => {
          if (normalizeName(subName) === itemNameLower) {
            existingMotorreductorSubItems.add(subName);
          }
        });
      }
      
      const missingMotorreductorSubItems = motorreductorSubItemNames.filter(
        (subName: string) => !existingMotorreductorSubItems.has(subName)
      );
      
      console.log(`[maintenance-pdf] Sub-items de Motorreductor encontrados:`, Array.from(existingMotorreductorSubItems));
      console.log(`[maintenance-pdf] Sub-items de Motorreductor faltantes:`, missingMotorreductorSubItems);
      
      if (missingMotorreductorSubItems.length > 0) {
        console.log(`[maintenance-pdf] 🔴 AGREGANDO ${missingMotorreductorSubItems.length} SUB-ITEMS DE MOTORREDUCTOR...`);
        
        // Crear un nuevo checklist con los sub-items agregados después de Motorreductor
        const motorreductorChecklist: MaintenanceReportPdfPayload['checklist'] = [];
        
        // Copiar items hasta "Motorreductor"
        for (let i = 0; i <= motorreductorMainIndex; i++) {
          motorreductorChecklist.push({
            ...checklist[i],
            index: motorreductorChecklist.length,
          });
        }
        
        // Agregar los sub-items de motorreductor
        motorreductorSubItemNames.forEach((subItemName: string) => {
          // Buscar si ya existe en el checklist original
          const existingItem = checklist.find(item => normalizeName(item.name) === normalizeName(subItemName));
          
          if (existingItem) {
            // Si ya existe, usarlo
            motorreductorChecklist.push({
              ...existingItem,
              index: motorreductorChecklist.length,
            });
          } else {
            // Si no existe, buscar en motorreductor.subItems
            const subItemData = motorreductor.subItems.find((item: any) => 
              normalizeName(item.name || '') === normalizeName(subItemName)
            );
            
            motorreductorChecklist.push({
              index: motorreductorChecklist.length,
              name: subItemName,
              status: subItemData?.status === 'good' || subItemData?.status === 'bad' || subItemData?.status === 'na' 
                ? subItemData.status 
                : null,
              observation: subItemData?.observation && typeof subItemData.observation === 'string' && subItemData.observation.trim()
                ? subItemData.observation.trim()
                : ((motorreductor.observation && typeof motorreductor.observation === 'string') 
                  ? motorreductor.observation 
                  : ''),
            });
          }
          
          console.log(`[maintenance-pdf] ✅ Sub-item de Motorreductor "${subItemName}" agregado (index: ${motorreductorChecklist.length - 1})`);
        });
        
        // Copiar el resto de items después de los sub-items de motorreductor
        for (let i = motorreductorMainIndex + 1; i < checklist.length; i++) {
          const itemNameLower = normalizeName(checklist[i].name);
          const isMotorreductorSubItem = motorreductorSubItemNames.some(
            (subName: string) => normalizeName(subName) === itemNameLower
          );
          
          if (!isMotorreductorSubItem) {
            motorreductorChecklist.push({
              ...checklist[i],
              index: motorreductorChecklist.length,
            });
          }
        }
        
        // Reemplazar el checklist con el nuevo
        checklist.length = 0;
        checklist.push(...motorreductorChecklist);
        
        console.log(`[maintenance-pdf] ✅✅✅ COMPLETADO: Sub-items de Motorreductor agregados, checklist ahora tiene ${checklist.length} items`);
      } else {
        console.log(`[maintenance-pdf] ✅ Todos los sub-items de Motorreductor ya están presentes`);
      }
    } else if (motorreductorMainIndex === -1) {
      console.log(`[maintenance-pdf] ⚠️ No se encontró el item principal "Motorreductor" en el checklist`);
    } else if (!motorreductor || !motorreductor.subItems || !Array.isArray(motorreductor.subItems) || motorreductor.subItems.length === 0) {
      console.log(`[maintenance-pdf] ⚠️ Motorreductor no tiene subItems o está vacío`);
    }
    
    // Log final antes de crear el payload
    console.log('[maintenance-pdf] ========== CHECKLIST FINAL ANTES DEL PDF ==========');
    console.log('[maintenance-pdf] Total items:', checklist.length);
    
    // Verificar items del trolley
    const trolleyItemsFinal = checklist.filter(item => {
      const nameLower = normalizeName(item.name);
      return nameLower.includes('trolley');
    });
    console.log('[maintenance-pdf] Items del trolley encontrados:', trolleyItemsFinal.length);
    trolleyItemsFinal.forEach(item => {
      console.log(`[maintenance-pdf] - ${item.index + 1}. ${item.name}: status=${item.status || 'null'}, observation=${item.observation ? 'yes' : 'no'}`);
    });
    
    // Verificar sub-items de carros testeros
    const allSubItemsFinal = checklist.filter(item => {
      const nameLower = normalizeName(item.name);
      return finalExpectedSubItems.some(subName => normalizeName(subName) === nameLower);
    });
    console.log('[maintenance-pdf] Sub-items de carros testeros encontrados:', allSubItemsFinal.length);
    allSubItemsFinal.forEach(item => {
      console.log(`[maintenance-pdf] - ${item.index + 1}. ${item.name}: status=${item.status || 'null'}, observation=${item.observation ? 'yes' : 'no'}`);
    });
    
    // IMPORTANTE: Re-indexar el checklist final para asegurar índices consecutivos
    const finalChecklistReindexed = checklist.map((item, idx) => ({
      ...item,
      index: idx, // Asegurar índices consecutivos desde 0
    }));
    
    console.log('[maintenance-pdf] Checklist re-indexado con', finalChecklistReindexed.length, 'items');
    console.log('[maintenance-pdf] Primeros 10 items:', JSON.stringify(finalChecklistReindexed.slice(0, 10).map(i => ({ index: i.index, name: i.name, status: i.status })), null, 2));
    console.log('[maintenance-pdf] ==================================================');

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
      checklist: finalChecklistReindexed, // Usar el checklist re-indexado
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
