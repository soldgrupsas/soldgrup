import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";

const CHECKLIST_ITEMS = [
  "Motor de elevación",
  "Freno motor de elevación",
  // Trolley y sus componentes se agrupan en un paso especial
  "Estructura",
  "Tornillo",
  "Gancho",
  "Cadena",
  "Guaya",
  "Gabinete eléctrico",
  "Aceite",
  "Sistema de cables planos",
  "Topes mecánicos",
  "Botonera",
  "Pines de seguridad",
  "Polipasto",
  "Límite de elevación",
  "Limitador de carga",
  "Sistema de alimentación de línea blindada",
  "Carcazas",
  "Motorreductor",
];

type ChecklistStatus = "good" | "bad" | "na" | null;

type ChecklistEntry = {
  id: string;
  name: string;
  status: ChecklistStatus;
  observation: string;
};

type TrolleyGroupEntry = {
  id: string;
  name: string;
  status: ChecklistStatus;
};

type CarrosTesterosSubItem = {
  id: string;
  name: string;
  status: ChecklistStatus;
};

type PhotoEntry = {
  id: string;
  storagePath: string | null;
  optimizedPath?: string | null;
  thumbnailPath?: string | null;
  url: string | null;
  description: string;
};

type PhotoUploadState = {
  status: 'idle' | 'preparing' | 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  attempts: number;
  message?: string;
};

type UploadTask = {
  photoId: string;
  file: File;
  reportId: string;
  attempts: number;
};

const PHOTO_BUCKET = "maintenance-report-photos";
const LARGE_FILE_THRESHOLD = 8 * 1024 * 1024;

const uploadButtonCopy: Record<PhotoUploadState['status'], string> = {
  idle: "Subir foto",
  preparing: "Preparando...",
  queued: "En cola",
  uploading: "Subiendo...",
  processing: "Optimizando...",
  done: "Reemplazar",
  error: "Reintentar",
};

const uploadMessageCopy: Record<PhotoUploadState['status'], string> = {
  idle: "",
  preparing: "Preparando la imagen antes de subirla...",
  queued: "La fotografía está en cola para subirse.",
  uploading: "Subiendo fotografía...",
  processing: "Optimizando fotografía en el servidor...",
  done: "Fotografía procesada correctamente.",
  error: "No se pudo cargar la fotografía.",
};

type UploadWithProgressParams = {
  bucket: string;
  path: string;
  file: File;
  token: string;
  onProgress: (progress: number) => void;
  signal?: AbortSignal;
};

const encodeStoragePath = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const sanitizeFileName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const uploadWithProgress = ({ bucket, path, file, token, onProgress, signal }: UploadWithProgressParams) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`,
    );
    xhr.responseType = "json";
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };
    xhr.onerror = () => reject(new Error("No se pudo cargar la fotografía."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(xhr.response?.message ?? "Falló la carga de la fotografía"));
      }
    };
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          xhr.abort();
          reject(new DOMException("Upload aborted", "AbortError"));
        },
        { once: true },
      );
    }
    xhr.send(file);
  });

type MaintenanceReportForm = {
  startDate: string | null;
  endDate: string | null;
  company: string;
  address: string;
  phone: string;
  contact: string;
  technicianName: string;
  equipment: string;
  brand: string;
  model: string;
  serial: string;
  capacity: string;
  locationPg: string;
  voltage: string;
  initialState: string;
  checklist: ChecklistEntry[];
  trolleyGroup: {
    trolley: TrolleyGroupEntry;
    motorTrolley: TrolleyGroupEntry;
    frenoMotorTrolley: TrolleyGroupEntry;
    guiasTrolley: TrolleyGroupEntry;
    ruedasTrolley: TrolleyGroupEntry;
    observation: string;
  };
  carrosTesteros: {
    mainStatus: ChecklistStatus;
    subItems: CarrosTesterosSubItem[];
    observation: string;
  };
  recommendations: string;
  tests: {
    voltage: string;
    polipasto: {
      subir: { l1: string; l2: string; l3: string };
      bajar: { l1: string; l2: string; l3: string };
    };
  };
  photos: PhotoEntry[];
};

type StepDefinition = {
  key: string;
  title: string;
  subtitle?: string;
  checklistIndex?: number;
  specialStep?: "trolley-group" | "carros-testeros";
};

// Función auxiliar para generar UUIDs de forma segura
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para navegadores que no soportan crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const buildDefaultChecklist = (): ChecklistEntry[] =>
  CHECKLIST_ITEMS.map((name, index) => ({
    id: generateUUID(),
    name,
    status: null,
    observation: "",
  }));

const buildDefaultTrolleyGroup = () => ({
  trolley: { id: generateUUID(), name: "Trolley", status: null as ChecklistStatus },
  motorTrolley: { id: generateUUID(), name: "Motor Trolley", status: null as ChecklistStatus },
  frenoMotorTrolley: { id: generateUUID(), name: "Freno motor Trolley", status: null as ChecklistStatus },
  guiasTrolley: { id: generateUUID(), name: "Guias de Trolley", status: null as ChecklistStatus },
  ruedasTrolley: { id: generateUUID(), name: "Ruedas Trolley", status: null as ChecklistStatus },
  observation: "",
});

const buildDefaultCarrosTesteros = () => ({
  mainStatus: null as ChecklistStatus,
  subItems: [
    // NOTA: "Motorreductor" ya no es un sub-item, es un item independiente después de "Carros testeros"
    { id: generateUUID(), name: "Freno", status: null as ChecklistStatus },
    { id: generateUUID(), name: "Ruedas", status: null as ChecklistStatus },
    { id: generateUUID(), name: "Chumaceras", status: null as ChecklistStatus },
    { id: generateUUID(), name: "Palanquilla", status: null as ChecklistStatus },
  ],
  observation: "",
});

const defaultForm: MaintenanceReportForm = {
  startDate: null,
  endDate: null,
  company: "",
  address: "",
  phone: "",
  contact: "",
  technicianName: "",
  equipment: "",
  brand: "",
  model: "",
  serial: "",
  capacity: "",
  locationPg: "",
  voltage: "",
  initialState: "",
  checklist: buildDefaultChecklist(),
  trolleyGroup: buildDefaultTrolleyGroup(),
  carrosTesteros: buildDefaultCarrosTesteros(),
  recommendations: "",
  tests: {
    voltage: "",
    polipasto: {
      subir: { l1: "", l2: "", l3: "" },
      bajar: { l1: "", l2: "", l3: "" },
    },
  },
  photos: [],
};

// Opciones para generar steps
type BuildStepsOptions = {
  includeTrolley?: boolean;
  includeCarrosTesteros?: boolean;
};

// Función para generar steps dinámicamente basándose en el checklist
const buildStepsFromChecklist = (
  checklist: ChecklistEntry[], 
  options: BuildStepsOptions = { includeTrolley: true, includeCarrosTesteros: true }
): StepDefinition[] => {
  const { includeTrolley = true, includeCarrosTesteros = true } = options;
  
  const baseSteps: StepDefinition[] = [
    {
      key: "intro",
      title: "Procedimiento de llenado de Informe de Mantenimiento",
      subtitle:
        "A continuación, podrá llenar paso a paso su informe de mantenimiento. Asegúrese de completar todos los campos.",
    },
    { key: "basicInfo", title: "Información Básica" },
    { key: "initialState", title: "Estado Inicial" },
  ];

  // Buscar posiciones de items especiales para insertar pasos de trolley y carros testeros
  const frenoMotorIndex = checklist.findIndex(item => 
    item.name.toLowerCase().includes("freno motor") && 
    item.name.toLowerCase().includes("elevación")
  );
  const carcazasIndex = checklist.findIndex(item => 
    item.name.toLowerCase().includes("carcaza")
  );
  const motorreductorIndex = checklist.findIndex(item => 
    item.name.toLowerCase().includes("motorreductor")
  );

  // Determinar dónde insertar trolley (después de freno motor de elevación, o en posición 1)
  const insertTrolleyAfterIndex = frenoMotorIndex >= 0 ? frenoMotorIndex : 1;
  
  // Determinar dónde insertar carros testeros (después de carcazas, antes de motorreductor, o cerca del final)
  let insertCarrosAfterIndex = -1;
  if (carcazasIndex >= 0) {
    insertCarrosAfterIndex = carcazasIndex;
  } else if (motorreductorIndex >= 0 && motorreductorIndex > 0) {
    insertCarrosAfterIndex = motorreductorIndex - 1;
  } else if (checklist.length > 15) {
    insertCarrosAfterIndex = checklist.length - 2;
  }

  // Generar steps para cada item del checklist
  const checklistSteps: StepDefinition[] = [];
  let displayNumber = 1;
  let trolleyInserted = false;
  let carrosInserted = false;

  for (let i = 0; i < checklist.length; i++) {
    const item = checklist[i];
    
    // Agregar el item del checklist
    checklistSteps.push({
      key: `checklist-${i}`,
      title: "Lista de Chequeo",
      subtitle: `${displayNumber}. ${item.name}`,
      checklistIndex: i,
    });
    displayNumber++;

    // Insertar paso especial de Trolley SOLO si el informe tiene trolleyGroup
    if (includeTrolley && !trolleyInserted && i === insertTrolleyAfterIndex) {
      checklistSteps.push({
        key: "trolley-group",
        title: "Lista de Chequeo",
        subtitle: `${displayNumber}. Trolley y componentes`,
        specialStep: "trolley-group",
      });
      displayNumber++;
      trolleyInserted = true;
    }

    // Insertar paso especial de Carros testeros SOLO si el informe tiene carrosTesteros
    if (includeCarrosTesteros && !carrosInserted && insertCarrosAfterIndex >= 0 && i === insertCarrosAfterIndex) {
      checklistSteps.push({
        key: "carros-testeros",
        title: "Lista de Chequeo",
        subtitle: `${displayNumber}. Carros testeros`,
        specialStep: "carros-testeros",
      });
      displayNumber++;
      carrosInserted = true;
    }
  }

  // Si no se insertó carros testeros y debía incluirse, agregarlo al final
  if (includeCarrosTesteros && !carrosInserted) {
    checklistSteps.push({
      key: "carros-testeros",
      title: "Lista de Chequeo",
      subtitle: `${displayNumber}. Carros testeros`,
      specialStep: "carros-testeros",
    });
    displayNumber++;
  }

  const endSteps: StepDefinition[] = [
    { key: "recommendations", title: "Recomendaciones" },
    { key: "tests", title: "Pruebas sin carga" },
    { key: "photos", title: "Soporte Fotográfico" },
    { key: "finish", title: "Fin del Informe de Mantenimiento" },
  ];

  return [...baseSteps, ...checklistSteps, ...endSteps];
};

// Steps por defecto para nuevos informes
const defaultSteps = buildStepsFromChecklist(buildDefaultChecklist());

const MaintenanceReportWizard = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const isEditMode = Boolean(params.id);
  const { toast } = useToast();
  const { user, session, loading: authLoading } = useAuth();

  // Steps dinámicos - se actualizan cuando se carga un informe existente
  const [steps, setSteps] = useState<StepDefinition[]>(defaultSteps);
  const totalSteps = steps.length;

  // Inicializar formData con una copia profunda de defaultForm para evitar mutaciones
  const [formData, setFormData] = useState<MaintenanceReportForm>(() => {
    // Asegurar que los campos de grupos estén siempre inicializados
    return {
      ...defaultForm,
      trolleyGroup: defaultForm.trolleyGroup ? { ...defaultForm.trolleyGroup } : buildDefaultTrolleyGroup(),
      carrosTesteros: defaultForm.carrosTesteros ? { 
        ...defaultForm.carrosTesteros,
        subItems: defaultForm.carrosTesteros.subItems ? [...defaultForm.carrosTesteros.subItems] : []
      } : buildDefaultCarrosTesteros(),
    };
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const [photoUploads, setPhotoUploads] = useState<Record<string, PhotoUploadState>>({});
  const uploadQueueRef = useRef<UploadTask[]>([]);
  const activeUploadRef = useRef<{ task: UploadTask; controller: AbortController } | null>(null);
  const reportIdRef = useRef<string | null>(null);
  const formDataRef = useRef<MaintenanceReportForm>(defaultForm);
  const initializedRef = useRef(false);
  const initialLoadRef = useRef(true);
  const lastSavedFormDataRef = useRef<string>(""); // Para evitar autoguardados innecesarios

  useEffect(() => {
    reportIdRef.current = reportId ?? null;
  }, [reportId]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const updatePhotoUploadState = useCallback(
    (photoId: string, partial: Partial<PhotoUploadState>) => {
      setPhotoUploads((prev) => {
        const current = prev[photoId] ?? { status: "idle", progress: 0, attempts: 0 };
        return {
          ...prev,
          [photoId]: {
            ...current,
            ...partial,
          },
        };
      });
    },
    [],
  );

  const logPhotoMetric = useCallback(
    async (
      photoId: string,
      event: string,
      payload?: { durationMs?: number; sizeBytes?: number; metadata?: Record<string, any> },
    ) => {
      try {
        await supabase.from("maintenance_photo_upload_metrics").insert({
          photo_id: photoId,
          event,
          duration_ms: payload?.durationMs ? Math.round(payload.durationMs) : null,
          size_bytes: payload?.sizeBytes ?? null,
          metadata: payload?.metadata ?? {},
        });
      } catch (error) {
        console.warn("No se pudo registrar la métrica de la foto", error);
      }
    },
    [],
  );

  // Función para recargar fotos desde la base de datos - debe estar antes de handleUploadTask
  const reloadPhotosFromDatabase = useCallback(async (reportIdToLoad: string) => {
    try {
      const { data: photosData, error: photosError } = await supabase
        .from("maintenance_report_photos")
        .select("id, storage_path, optimized_path, thumbnail_path, description")
        .eq("report_id", reportIdToLoad)
        .order("created_at", { ascending: true });

      if (photosError) {
        console.warn("Error cargando fotos desde la tabla:", photosError);
        return;
      }

      if (photosData && photosData.length > 0) {
        // Crear un Map para evitar duplicados
        const photosMap = new Map<string, PhotoEntry>();
        
        photosData.forEach((photo) => {
          const { data: optimizedPublic } = supabase.storage
            .from(PHOTO_BUCKET)
            .getPublicUrl(photo.optimized_path || photo.storage_path || "");
          const { data: fallbackPublic } = supabase.storage
            .from(PHOTO_BUCKET)
            .getPublicUrl(photo.storage_path || "");
          const photoUrl = optimizedPublic?.publicUrl || fallbackPublic?.publicUrl || null;

          photosMap.set(photo.id, {
            id: photo.id,
            storagePath: photo.storage_path,
            optimizedPath: photo.optimized_path || null,
            thumbnailPath: photo.thumbnail_path || null,
            url: photoUrl,
            description: photo.description || "",
          });
        });

        // Actualizar solo las fotos, manteniendo el resto del formData
        setFormData((prev) => {
          // Combinar fotos existentes (que no están en la BD) con las de la BD
          const existingPhotoIds = new Set(photosMap.keys());
          const newPhotos = Array.from(photosMap.values());
          
          // Mantener fotos que no están en la BD (fotos nuevas que aún no se han guardado)
          const photosNotInDb = prev.photos.filter(p => !existingPhotoIds.has(p.id));
          
          // Combinar ambas listas, evitando duplicados
          const allPhotos = [...photosNotInDb, ...newPhotos];
          const uniquePhotos = Array.from(
            new Map(allPhotos.map(p => [p.id, p])).values()
          );
          
          return {
            ...prev,
            photos: uniquePhotos,
          };
        });
      } else {
        // Si no hay fotos en la BD, mantener las fotos locales que no tienen storagePath
        setFormData((prev) => ({
          ...prev,
          photos: prev.photos.filter(p => !p.storagePath),
        }));
      }
    } catch (error) {
      console.error("Error recargando fotos desde la base de datos:", error);
    }
  }, []);

  const handleUploadTask = useCallback(
    async (task: UploadTask, controller: AbortController) => {
      if (!session) throw new Error("Debes iniciar sesión para subir fotografías");
      const activeReportId = reportIdRef.current ?? task.reportId;
      if (!activeReportId) throw new Error("No se encontró el informe asociado a la fotografía");

      const description =
        formDataRef.current.photos.find((photo) => photo.id === task.photoId)?.description ?? "";

      const sanitizedName = sanitizeFileName(task.file.name || `${task.photoId}.jpg`);
      const storagePath = `${activeReportId}/${task.photoId}/${Date.now()}-${sanitizedName || "foto.jpg"}`;

      updatePhotoUploadState(task.photoId, {
        status: "uploading",
        progress: 0,
        attempts: task.attempts + 1,
        message: undefined,
      });

      const uploadStart = performance.now();
      await uploadWithProgress({
        bucket: PHOTO_BUCKET,
        path: storagePath,
        file: task.file,
        token: session.access_token,
        onProgress: (progress) => updatePhotoUploadState(task.photoId, { progress }),
        signal: controller.signal,
      });
      await logPhotoMetric(task.photoId, "upload", {
        durationMs: performance.now() - uploadStart,
        sizeBytes: task.file.size,
        metadata: { attempts: task.attempts + 1 },
      });

      await supabase
        .from("maintenance_report_photos")
        .upsert(
          [
            {
              id: task.photoId,
              report_id: activeReportId,
              storage_path: storagePath,
              description,
              original_size_bytes: task.file.size,
              processing_status: "processing",
            },
          ],
          { onConflict: "id" },
        );

      updatePhotoUploadState(task.photoId, { status: "processing", progress: 100 });

      const processStart = performance.now();
      const { data: processData, error: processError } = await supabase.functions.invoke(
        "process-maintenance-photo",
        {
          body: {
            photoId: task.photoId,
            storagePath,
          },
        },
      );
      if (processError) {
        throw new Error(processError.message ?? "No se pudo optimizar la fotografía");
      }
      await logPhotoMetric(task.photoId, "process", {
        durationMs: performance.now() - processStart,
        metadata: processData ?? {},
      });

      const optimizedPath = processData?.optimizedPath ?? `optimized/${storagePath}`;
      const thumbnailPath = processData?.thumbnailPath ?? `thumbnails/${storagePath}`;

      const { data: optimizedPublic } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(optimizedPath);
      const { data: fallbackPublic } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
      const photoUrl = optimizedPublic?.publicUrl ?? fallbackPublic?.publicUrl ?? null;

      // Usar una función de actualización que evite re-renders innecesarios
      setFormData((prev) => {
        // Primero, eliminar cualquier duplicado por ID antes de actualizar
        const uniquePhotos = prev.photos.filter((photo, index, self) =>
          index === self.findIndex((p) => p.id === photo.id)
        );
        
        // Verificar si la foto existe antes de actualizar
        const photoIndex = uniquePhotos.findIndex(p => p.id === task.photoId);
        if (photoIndex === -1) {
          console.warn(`Foto con ID ${task.photoId} no encontrada en el estado, no se actualizará`);
          return prev; // Retornar el mismo objeto para evitar re-render
        }
        
        // Verificar si realmente hay cambios antes de actualizar
        const existingPhoto = uniquePhotos[photoIndex];
        if (existingPhoto.storagePath === storagePath && 
            existingPhoto.optimizedPath === optimizedPath &&
            existingPhoto.thumbnailPath === thumbnailPath &&
            existingPhoto.url === photoUrl) {
          return prev; // No hay cambios, retornar el mismo objeto
        }
        
        // Actualizar solo la foto existente, creando un nuevo array solo si es necesario
        const updatedPhotos = [...uniquePhotos];
        updatedPhotos[photoIndex] = {
          ...existingPhoto,
          storagePath,
          optimizedPath,
          thumbnailPath,
          url: photoUrl,
        };
        
        return {
          ...prev,
          photos: updatedPhotos,
        };
      });

      updatePhotoUploadState(task.photoId, {
        status: "done",
        progress: 100,
        message: undefined,
      });

      // Recargar fotos desde la base de datos para asegurar sincronización
      // Esto actualiza la vista sin necesidad de refrescar la página
      if (activeReportId) {
        await reloadPhotosFromDatabase(activeReportId);
      }

      toast({
        title: "Foto cargada",
        description: "La fotografía se optimizó correctamente.",
      });
    },
    [logPhotoMetric, session, toast, updatePhotoUploadState, reloadPhotosFromDatabase],
  );

  // Ref para evitar re-renders innecesarios del scheduleUploadProcessing
  const scheduleUploadProcessingRef = useRef<() => void>(() => {});

  const scheduleUploadProcessing = useCallback(() => {
    if (activeUploadRef.current) return;
    if (!session) return;
    const nextTask = uploadQueueRef.current.shift();
    if (!nextTask) return;

    const controller = new AbortController();
    activeUploadRef.current = { task: nextTask, controller };

    handleUploadTask(nextTask, controller)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          updatePhotoUploadState(nextTask.photoId, { status: "idle", progress: 0 });
          return;
        }

        const attempts = nextTask.attempts + 1;
        const message = error instanceof Error ? error.message : "No se pudo cargar la fotografía";
        if (attempts < 3) {
          uploadQueueRef.current.unshift({ ...nextTask, attempts });
          updatePhotoUploadState(nextTask.photoId, {
            status: "queued",
            progress: 0,
            attempts,
            message: `Reintentando (${attempts}/3)…`,
          });
        } else {
          updatePhotoUploadState(nextTask.photoId, {
            status: "error",
            progress: 0,
            attempts,
            message,
          });
          void supabase
            .from("maintenance_report_photos")
            .update({ processing_status: "error", processing_error: message })
            .eq("id", nextTask.photoId);
        }
        console.error("Error al subir la fotografía", error);
      })
      .finally(() => {
        activeUploadRef.current = null;
        // Usar el ref en lugar de la función directamente para evitar dependencias
        setTimeout(() => scheduleUploadProcessingRef.current(), 250);
      });
  }, [handleUploadTask, session, updatePhotoUploadState]);

  // Actualizar el ref cuando cambie la función
  useEffect(() => {
    scheduleUploadProcessingRef.current = scheduleUploadProcessing;
  }, [scheduleUploadProcessing]);

  useEffect(() => {
    return () => {
      activeUploadRef.current?.controller.abort();
      uploadQueueRef.current = [];
    };
  }, []);

  // Procesar la cola de uploads de forma controlada, sin causar re-renders
  useEffect(() => {
    // Solo ejecutar una vez al montar, no en cada cambio de scheduleUploadProcessing
    const intervalId = setInterval(() => {
      if (uploadQueueRef.current.length > 0 && !activeUploadRef.current && session) {
        scheduleUploadProcessingRef.current();
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [session]); // Solo depende de session, no de la función

  const compressImageFile = async (file: File): Promise<File> => {
    const MAX_DIMENSION = 1600;
    const QUALITY = 0.82;

    const loadImage = (): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = (error) => {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        };
        img.src = objectUrl;
      });

    try {
      const image = await loadImage();
      const scale = Math.min(
        MAX_DIMENSION / image.width,
        MAX_DIMENSION / image.height,
        1,
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", QUALITY),
      );

      if (!blob) {
        return file;
      }

      const compressedFile = new File([blob], `${file.name.split(".")[0]}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      return compressedFile;
    } catch (error) {
      console.warn("No se pudo comprimir la imagen, se usará el archivo original.", error);
      return file;
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // Evitar que la inicialización se ejecute múltiples veces
    if (authLoading || !user || initializedRef.current) return;

    const initialize = async () => {
      // Marcar como inicializado ANTES de ejecutar para evitar ejecuciones paralelas
      initializedRef.current = true;
      setLoading(true);
      try {
        if (isEditMode && params.id) {
          await loadExistingReport(params.id);
        } else {
          await createDraftReport();
        }
      } finally {
        initialLoadRef.current = false;
        setLoading(false);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isEditMode, params.id]);

  // Ref para almacenar persistReport y evitar dependencias circulares
  const persistReportRef = useRef<((overrideData?: MaintenanceReportForm, options?: { silent?: boolean }) => Promise<void>) | null>(null);

  const createDraftReport = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      // Crear una copia fresca del formulario por defecto con nuevos UUIDs
      // NO crear el reporte en la base de datos todavía - solo se creará cuando haya cambios
      const freshForm: MaintenanceReportForm = {
        ...defaultForm,
        checklist: buildDefaultChecklist(),
        trolleyGroup: buildDefaultTrolleyGroup(),
        carrosTesteros: buildDefaultCarrosTesteros(),
        photos: [],
      };
      
      // NO insertar en la base de datos todavía
      // El reporte se creará cuando el usuario haga el primer cambio
      setReportId(null); // No hay reportId hasta que se haga el primer cambio
      setFormData(freshForm);
      setCurrentStepIndex(0);
      setLastSavedAt(null); // No hay fecha de guardado porque no se ha guardado
      return null; // Retornar null porque no se creó ningún reporte todavía
    } catch (error) {
      console.error("Error inicializando formulario:", error);
      toast({
        title: "Error",
        description:
          "No se pudo iniciar el informe de mantenimiento. Intenta nuevamente.",
        variant: "destructive",
      });
      navigate("/maintenance-reports");
      return null;
    }
  };

  const loadExistingReport = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("maintenance_reports")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const loadedData = typeof data.data === "object" && data.data !== null
        ? (data.data as Partial<MaintenanceReportForm>)
        : {};
      
      // Función para normalizar nombres antiguos a los nuevos - SIEMPRE normaliza
      const normalizeTrolleyNames = (group: any) => {
        if (!group || typeof group !== 'object') return defaultForm.trolleyGroup;
        
        const normalized: any = { ...group };
        
        // Normalizar nombres - SIEMPRE forzar los nombres correctos
        normalized.trolley = normalized.trolley ? { ...normalized.trolley, name: "Trolley" } : defaultForm.trolleyGroup.trolley;
        normalized.motorTrolley = normalized.motorTrolley ? { ...normalized.motorTrolley, name: "Motor Trolley" } : defaultForm.trolleyGroup.motorTrolley;
        normalized.frenoMotorTrolley = normalized.frenoMotorTrolley ? { ...normalized.frenoMotorTrolley, name: "Freno motor Trolley" } : defaultForm.trolleyGroup.frenoMotorTrolley;
        normalized.guiasTrolley = normalized.guiasTrolley ? { ...normalized.guiasTrolley, name: "Guias de Trolley" } : defaultForm.trolleyGroup.guiasTrolley;
        normalized.ruedasTrolley = normalized.ruedasTrolley ? { ...normalized.ruedasTrolley, name: "Ruedas Trolley" } : defaultForm.trolleyGroup.ruedasTrolley;
        
        // Asegurar que observation existe
        if (!normalized.observation) {
          normalized.observation = "";
        }
        
        return normalized;
      };
      
      // Validar y construir trolleyGroup - SIEMPRE normalizar
      let trolleyGroup = defaultForm.trolleyGroup;
      if (loadedData.trolleyGroup && typeof loadedData.trolleyGroup === 'object') {
        trolleyGroup = normalizeTrolleyNames(loadedData.trolleyGroup);
      }
      
      // Validar y construir carrosTesteros con valores por defecto si faltan
      // Normalizar nombres si vienen incorrectos (ej: "Carros de prueba" -> "Carros testeros")
      let carrosTesteros = loadedData.carrosTesteros && 
        typeof loadedData.carrosTesteros === 'object' &&
        Array.isArray(loadedData.carrosTesteros.subItems)
        ? loadedData.carrosTesteros
        : defaultForm.carrosTesteros;
      
      // Asegurar que carrosTesteros siempre tenga la estructura correcta
      if (!carrosTesteros || !Array.isArray(carrosTesteros.subItems)) {
        carrosTesteros = defaultForm.carrosTesteros;
      }
      
      // IMPORTANTE: Cargar el checklist TAL CUAL está guardado para no perder datos
      // Solo usar el checklist por defecto si no hay datos guardados
      let checklist = Array.isArray(loadedData.checklist) && loadedData.checklist.length > 0 
        ? loadedData.checklist 
        : defaultForm.checklist;
      
      console.log(`[MaintenanceReportWizard] Checklist cargado con ${checklist.length} items`);
      
      // Detectar si el informe tiene trolleyGroup y carrosTesteros con datos reales
      const hasTrolleyGroup = loadedData.trolleyGroup && 
        typeof loadedData.trolleyGroup === 'object' &&
        loadedData.trolleyGroup.trolley?.status !== null;
      
      const hasCarrosTesteros = loadedData.carrosTesteros && 
        typeof loadedData.carrosTesteros === 'object' &&
        Array.isArray(loadedData.carrosTesteros.subItems) &&
        loadedData.carrosTesteros.subItems.length > 0;
      
      console.log(`[MaintenanceReportWizard] hasTrolleyGroup: ${hasTrolleyGroup}, hasCarrosTesteros: ${hasCarrosTesteros}`);
      
      // Regenerar los steps basándose en el checklist cargado
      // Solo incluir pasos especiales si el informe tiene esos datos
      const dynamicSteps = buildStepsFromChecklist(checklist, {
        includeTrolley: hasTrolleyGroup,
        includeCarrosTesteros: hasCarrosTesteros,
      });
      setSteps(dynamicSteps);
      console.log(`[MaintenanceReportWizard] Steps regenerados: ${dynamicSteps.length} pasos`);
      
      const parsedData: MaintenanceReportForm = {
        ...defaultForm,
        ...loadedData,
        checklist, // Usar el checklist completado
        // Asegurar que los nuevos campos de grupos existan y estén bien formados con nombres normalizados
        trolleyGroup,
        carrosTesteros,
      };
      
      // NOTA: Ya NO guardamos automáticamente después de cargar para evitar sobrescribir datos
      // Los datos solo se guardan cuando el usuario hace cambios explícitos

      // Asegurar que el índice del paso esté dentro del rango válido de steps
      // Esto evita errores cuando se editan informes creados con versiones anteriores del wizard
      // Usar dynamicSteps.length porque setSteps es asíncrono y aún no se ha aplicado
      const savedStepIndex = Math.max((data.current_step ?? 1) - 1, 0);
      const maxValidStepIndex = dynamicSteps.length - 1;
      const stepIndex = Math.min(savedStepIndex, maxValidStepIndex);
      setReportId(data.id);
      
      // Usar los datos TAL CUAL fueron cargados, sin normalizar nombres
      // Esto preserva los datos originales del informe
      setFormData(parsedData);
      setCurrentStepIndex(stepIndex);
      if (data.updated_at) {
        setLastSavedAt(new Date(data.updated_at));
      }

      // Inicializar lastSavedFormDataRef para evitar guardados innecesarios al cargar
      const formDataForComparison = {
        ...parsedData,
        photos: parsedData.photos.map(p => ({ id: p.id, description: p.description })),
      };
      lastSavedFormDataRef.current = JSON.stringify(formDataForComparison) + stepIndex;

      // Cargar fotos desde la tabla después de cargar el reporte
      await reloadPhotosFromDatabase(data.id);
    } catch (error) {
      console.error("Error cargando informe de mantenimiento:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el informe solicitado.",
        variant: "destructive",
      });
      navigate("/maintenance-reports");
    }
  };

  const buildDbPayload = (
    data: MaintenanceReportForm,
    stepIndex: number,
    userId?: string,
  ) => {
    // Log para verificar que trolleyGroup y carrosTesteros se están guardando
    console.log('[MaintenanceReportWizard] Saving report with trolleyGroup:', !!data.trolleyGroup);
    console.log('[MaintenanceReportWizard] Saving report with carrosTesteros:', !!data.carrosTesteros);
    if (data.trolleyGroup) {
      console.log('[MaintenanceReportWizard] trolleyGroup.trolley.status:', data.trolleyGroup.trolley?.status);
      console.log('[MaintenanceReportWizard] trolleyGroup.motorTrolley.status:', data.trolleyGroup.motorTrolley?.status);
    }
    if (data.carrosTesteros) {
      console.log('[MaintenanceReportWizard] carrosTesteros.mainStatus:', data.carrosTesteros.mainStatus);
      console.log('[MaintenanceReportWizard] carrosTesteros.subItems count:', data.carrosTesteros.subItems?.length ?? 0);
    }
    
    // IMPORTANTE: El wizard legacy se usa para puentes grúa antiguos
    // Incluir equipmentType para que el PDF lo detecte correctamente
    const dataWithEquipmentType = {
      ...data,
      equipmentType: 'puentes-grua' as const, // Este wizard legacy es SOLO para puentes grúa
    };
    
    const payload = {
      data: dataWithEquipmentType,
      current_step: stepIndex + 1,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      company: data.company || null,
      address: data.address || null,
      phone: data.phone || null,
      contact: data.contact || null,
      technician_name: data.technicianName || null,
      equipment: data.equipment || null,
      brand: data.brand || null,
      model: data.model || null,
      serial: data.serial || null,
      capacity: data.capacity || null,
      location_pg: data.locationPg || null,
      voltage: data.voltage || null,
      initial_state: data.initialState || null,
      recommendations: data.recommendations || null,
      tests: data.tests,
    } as Record<string, unknown>;

    if (userId) {
      payload.user_id = userId;
    }

    return payload;
  };

  const persistReport = useCallback(
    async (overrideData?: MaintenanceReportForm, options?: { silent?: boolean }) => {
      if (!user) return;
      
      // Usar formDataRef.current en lugar de formData para evitar dependencias innecesarias
      const dataToSave = overrideData ?? formDataRef.current;
      setIsSaving(true);
      try {
        if (!reportId) {
          // Si no hay reportId, crear el reporte por primera vez
          const payload = buildDbPayload(dataToSave, currentStepIndex, user.id);
          const { data, error } = await supabase
            .from("maintenance_reports")
            .insert(payload)
            .select()
            .single();

          if (error) throw error;
          
          setReportId(data.id);
          if (data.updated_at) {
            setLastSavedAt(new Date(data.updated_at));
          } else {
            setLastSavedAt(new Date());
          }
        } else {
          // Si ya existe reportId, actualizar el reporte existente
          const { error, data } = await supabase
            .from("maintenance_reports")
            .update(buildDbPayload(dataToSave, currentStepIndex))
            .eq("id", reportId)
            .select("updated_at")
            .single();

          if (error) throw error;

          if (data?.updated_at) {
            setLastSavedAt(new Date(data.updated_at));
          } else {
            setLastSavedAt(new Date());
          }
        }
        
        setPendingAutoSave(false);
        if (!options?.silent) {
          console.info("Informe guardado correctamente.");
        }
      } catch (error) {
        console.error("Error guardando informe:", error);
        toast({
          title: "Error al guardar",
          description:
            "No se pudo guardar el informe automáticamente. Revisa tu conexión e intenta nuevamente.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [reportId, currentStepIndex, user, toast],
  );

  // Actualizar el ref cuando cambie persistReport
  useEffect(() => {
    persistReportRef.current = persistReport;
  }, [persistReport]);

  // useEffect para normalizar nombres del trolley y carros testeros - SIEMPRE ejecutar después de la carga inicial
  useEffect(() => {
    if (initialLoadRef.current) return;
    
    // Usar un ref para evitar actualizaciones innecesarias
    const currentTrolleyName = formData.trolleyGroup?.trolley?.name;
    const currentMotorName = formData.trolleyGroup?.motorTrolley?.name;
    const currentFrenoName = formData.trolleyGroup?.frenoMotorTrolley?.name;
    const currentGuiasName = formData.trolleyGroup?.guiasTrolley?.name;
    const currentRuedasName = formData.trolleyGroup?.ruedasTrolley?.name;
    
    // Verificar si algún nombre es incorrecto
    const hasIncorrectNames = 
      (currentTrolleyName && currentTrolleyName !== "Trolley") ||
      (currentMotorName && currentMotorName !== "Motor Trolley") ||
      (currentFrenoName && currentFrenoName !== "Freno motor Trolley") ||
      (currentGuiasName && currentGuiasName !== "Guias de Trolley") ||
      (currentRuedasName && currentRuedasName !== "Ruedas Trolley");
    
    if (hasIncorrectNames && formData.trolleyGroup) {
      setFormData((prev) => ({
        ...prev,
        trolleyGroup: {
          ...prev.trolleyGroup,
          trolley: { ...prev.trolleyGroup.trolley, name: "Trolley" },
          motorTrolley: { ...prev.trolleyGroup.motorTrolley, name: "Motor Trolley" },
          frenoMotorTrolley: { ...prev.trolleyGroup.frenoMotorTrolley, name: "Freno motor Trolley" },
          guiasTrolley: { ...prev.trolleyGroup.guiasTrolley, name: "Guias de Trolley" },
          ruedasTrolley: { ...prev.trolleyGroup.ruedasTrolley, name: "Ruedas Trolley" },
        },
      }));
    }
    
    // Normalizar nombres de carros testeros
    if (formData.carrosTesteros && Array.isArray(formData.carrosTesteros.subItems)) {
      // NOTA: "Motorreductor" ya no es un sub-item, es un item independiente después de "Carros testeros"
      const correctCarrosNames = ["Freno", "Ruedas", "Chumaceras", "Palanquilla"];
      const hasIncorrectCarrosNames = formData.carrosTesteros.subItems.some((item, index) => {
        const correctName = correctCarrosNames[index];
        return correctName && item.name !== correctName;
      });
      
      if (hasIncorrectCarrosNames) {
        setFormData((prev) => ({
          ...prev,
          carrosTesteros: {
            ...prev.carrosTesteros,
            subItems: prev.carrosTesteros.subItems.map((item, index) => ({
              ...item,
              name: correctCarrosNames[index] || item.name,
            })),
          },
        }));
      }
    }
  }, [formData.trolleyGroup, formData.carrosTesteros]);

  // useEffect para autoguardado - debe estar después de que persistReport esté definido
  useEffect(() => {
    if (initialLoadRef.current) return;
    
    // Serializar formData para comparar cambios (excluyendo fotos que se guardan por separado)
    const formDataForComparison = {
      ...formData,
      photos: formData.photos.map(p => ({ id: p.id, description: p.description })), // Solo comparar ID y descripción
    };
    const serialized = JSON.stringify(formDataForComparison) + currentStepIndex;
    
    // Solo guardar si realmente hay cambios
    if (serialized === lastSavedFormDataRef.current) {
      return;
    }
    
    // Verificar si el formulario está en su estado inicial (sin cambios)
    const isInitialState = 
      !formData.company &&
      !formData.technicianName &&
      !formData.equipment &&
      !formData.startDate &&
      formData.checklist.every(item => item.status === null && !item.observation) &&
      formData.trolleyGroup.trolley.status === null &&
      formData.carrosTesteros.mainStatus === null &&
      formData.carrosTesteros.subItems.every(item => item.status === null) &&
      !formData.recommendations &&
      formData.photos.length === 0;
    
    // Si está en estado inicial y no hay reportId, no guardar
    if (isInitialState && !reportId) {
      return;
    }
    
    lastSavedFormDataRef.current = serialized;
    setPendingAutoSave(true);

    const handler = setTimeout(() => {
      // Usar el ref para evitar dependencias circulares
      if (persistReportRef.current) {
        void persistReportRef.current();
      }
    }, 3000);

    return () => clearTimeout(handler);
  }, [formData, currentStepIndex, reportId]);

  const handleSaveAndExit = async () => {
    // Si no hay reportId, verificar si hay cambios para guardar
    if (!reportId) {
      // Verificar si el formulario tiene cambios
      const hasChanges = 
        formData.company ||
        formData.technicianName ||
        formData.equipment ||
        formData.startDate ||
        formData.checklist.some(item => item.status !== null || item.observation) ||
        formData.trolleyGroup.trolley.status !== null ||
        formData.carrosTesteros.mainStatus !== null ||
        formData.carrosTesteros.subItems.some(item => item.status !== null) ||
        formData.recommendations ||
        formData.photos.length > 0;
      
      if (hasChanges) {
        // Si hay cambios, guardar por primera vez
        await persistReport(undefined, { silent: true });
        toast({
          title: "Cambios guardados",
          description: "Puedes continuar más tarde desde la lista de informes.",
        });
      } else {
        // Si no hay cambios, simplemente salir sin guardar
        toast({
          title: "Sin cambios",
          description: "No se guardó ningún informe porque no se realizaron cambios.",
        });
      }
    } else {
      // Si ya existe reportId, guardar normalmente
      await persistReport(undefined, { silent: true });
      toast({
        title: "Cambios guardados",
        description: "Puedes continuar más tarde desde la lista de informes.",
      });
    }
    navigate("/maintenance-reports");
  };

  const handleNext = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const updateChecklistEntry = (
    index: number,
    updates: Partial<ChecklistEntry>,
  ) => {
    setFormData((prev) => {
      const updated = [...prev.checklist];
      updated[index] = { ...updated[index], ...updates };
      return { ...prev, checklist: updated };
    });
  };

  const handleBasicInfoChange = (field: keyof MaintenanceReportForm, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTestChange = (
    section: "subir" | "bajar",
    phase: "l1" | "l2" | "l3",
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      tests: {
        ...prev.tests,
        polipasto: {
          ...prev.tests.polipasto,
          [section]: {
            ...prev.tests.polipasto[section],
            [phase]: value,
          },
        },
      },
    }));
  };

  const handlePhotoDescriptionChange = (photoId: string, value: string) => {
    setFormData((prev) => {
      // Eliminar duplicados antes de actualizar
      const uniquePhotos = prev.photos.filter((photo, index, self) =>
        index === self.findIndex((p) => p.id === photo.id)
      );
      
      return {
        ...prev,
        photos: uniquePhotos.map((photo) =>
          photo.id === photoId ? { ...photo, description: value } : photo,
        ),
      };
    });
    if (reportId) {
      void supabase
        .from("maintenance_report_photos")
        .update({ description: value })
        .eq("id", photoId);
    }
  };

  const ensureReportExists = async () => {
    if (reportId) return reportId;
    const newId = await createDraftReport();
    return newId;
  };

  const handleAddPhoto = async () => {
    const id = generateUUID();
    setFormData((prev) => {
      // Verificar que no exista ya una foto con este ID (aunque es muy improbable con UUID)
      // También verificar que no haya fotos duplicadas sin ID válido
      const existingIds = new Set(prev.photos.map(p => p.id));
      if (existingIds.has(id)) {
        console.warn("Intento de agregar foto con ID duplicado, ignorando");
        return prev;
      }
      
      return {
        ...prev,
        photos: [
          ...prev.photos,
          {
            id,
            storagePath: null,
            optimizedPath: null,
            thumbnailPath: null,
            url: null,
            description: "",
          },
        ],
      };
    });
  };

  const handlePhotoFileUpload = async (photoId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!session) {
      toast({
        title: "Sesión requerida",
        description: "Vuelve a iniciar sesión para cargar fotografías.",
        variant: "destructive",
      });
      return;
    }

    let activeReportId = reportId;
    if (!activeReportId) {
      activeReportId = await ensureReportExists();
      if (!activeReportId) {
        toast({
          title: "No se pudo preparar el informe",
          description: "Intenta nuevamente crear el informe antes de adjuntar fotografías.",
          variant: "destructive",
        });
        return;
      }
      setReportId(activeReportId);
    }

    const originalFile = fileList[0];

    setFormData((prev) => {
      // Eliminar duplicados antes de actualizar
      const uniquePhotos = prev.photos.filter((photo, index, self) =>
        index === self.findIndex((p) => p.id === photo.id)
      );
      
      // Verificar que la foto existe antes de actualizar
      const photoExists = uniquePhotos.some(p => p.id === photoId);
      if (!photoExists) {
        console.warn(`Foto con ID ${photoId} no encontrada, no se actualizará`);
        return prev;
      }
      
      return {
        ...prev,
        photos: uniquePhotos.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                url: null,
                storagePath: null,
                optimizedPath: null,
                thumbnailPath: null,
              }
            : photo,
        ),
      };
    });
    if (originalFile.size > LARGE_FILE_THRESHOLD) {
      updatePhotoUploadState(photoId, {
        status: "preparing",
        progress: 0,
        message: "Optimizando la imagen antes de subirla...",
      });
    }

    let preparedFile = originalFile;
    if (originalFile.size > LARGE_FILE_THRESHOLD) {
      try {
        preparedFile = await compressImageFile(originalFile);
      } catch (error) {
        console.warn("No se pudo comprimir la imagen localmente", error);
        preparedFile = originalFile;
      }
    }

    uploadQueueRef.current = [...uploadQueueRef.current, {
      photoId,
      file: preparedFile,
      reportId: activeReportId,
      attempts: 0,
    }];

    updatePhotoUploadState(photoId, {
      status: "queued",
      progress: 0,
      attempts: 0,
      message: undefined,
    });
    // Usar el ref para evitar re-renders innecesarios
    scheduleUploadProcessingRef.current();
  };

  const handleRemovePhoto = async (photo: PhotoEntry) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((item) => item.id !== photo.id),
    }));

    uploadQueueRef.current = uploadQueueRef.current.filter((task) => task.photoId !== photo.id);
    if (activeUploadRef.current?.task.photoId === photo.id) {
      activeUploadRef.current.controller.abort();
    }

    setPhotoUploads((prev) => {
      const next = { ...prev };
      delete next[photo.id];
      return next;
    });

    const pathsToRemove = [photo.storagePath, photo.optimizedPath, photo.thumbnailPath].filter(
      (path): path is string => Boolean(path),
    );
    if (pathsToRemove.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove(pathsToRemove);
      if (storageError) {
        console.warn("No se pudo eliminar la imagen del almacenamiento:", storageError);
      }
    }

    await supabase.from("maintenance_report_photos").delete().eq("id", photo.id);
  };

  const progressValue = ((currentStepIndex + 1) / totalSteps) * 100;
  const currentStep = steps[currentStepIndex];
  
  // Validación defensiva: si currentStep es undefined (por ejemplo, si currentStepIndex está fuera de rango)
  // usar el primer paso como fallback para evitar errores
  const safeCurrentStep = currentStep ?? steps[0] ?? { key: "intro", title: "Informe de Mantenimiento" };

  const isLastStep = currentStepIndex === totalSteps - 1;
  const isFirstStep = currentStepIndex === 0;

  const savedTimestamp = lastSavedAt
    ? new Intl.DateTimeFormat("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(lastSavedAt)
    : null;

  const renderChecklistStep = (index: number) => {
    const entry = formData.checklist[index];
    
    // Validar que el entry existe, si no, crear uno por defecto
    if (!entry) {
      console.warn(`[MaintenanceReportWizard] Entry at index ${index} not found, creating default`);
      const defaultEntry: ChecklistEntry = {
        id: generateUUID(),
        name: CHECKLIST_ITEMS[index] || `Item ${index + 1}`,
        status: null,
        observation: "",
      };
      // Agregar al checklist
      setFormData(prev => ({
        ...prev,
        checklist: [
          ...prev.checklist,
          ...Array(index + 1 - prev.checklist.length).fill(null).map((_, i) => {
            const idx = prev.checklist.length + i;
            return {
              id: generateUUID(),
              name: CHECKLIST_ITEMS[idx] || `Item ${idx + 1}`,
              status: null,
              observation: "",
            };
          })
        ]
      }));
      // Usar el entry por defecto temporalmente
      const tempEntry = defaultEntry;
      return (
        <div className="space-y-6">
          <p className="text-muted-foreground">
            Cargando item...
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Seleccione el estado del elemento inspeccionado y registre observaciones relevantes.
        </p>

        <RadioGroup
          value={entry.status ?? ""}
          onValueChange={(value: ChecklistStatus) =>
            updateChecklistEntry(index, { status: value })
          }
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <Label
            htmlFor={`status-good-${entry.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
              entry.status === "good" && "border-green-500 bg-green-500/10",
            )}
          >
            <RadioGroupItem value="good" id={`status-good-${entry.id}`} />
            Buen estado
          </Label>
          <Label
            htmlFor={`status-bad-${entry.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
              entry.status === "bad" && "border-destructive bg-destructive/10",
            )}
          >
            <RadioGroupItem value="bad" id={`status-bad-${entry.id}`} />
            Mal estado
          </Label>
          <Label
            htmlFor={`status-na-${entry.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
              entry.status === "na" && "border-blue-500 bg-blue-500/10",
            )}
          >
            <RadioGroupItem value="na" id={`status-na-${entry.id}`} />
            N/A
          </Label>
        </RadioGroup>

        <div className="space-y-2">
          <Label htmlFor={`observation-${entry.id}`}>Observación</Label>
          <Textarea
            id={`observation-${entry.id}`}
            rows={5}
            placeholder="Escriba observaciones relevantes del estado del componente."
            value={entry.observation}
            onChange={(event) =>
              updateChecklistEntry(index, { observation: event.target.value })
            }
          />
        </div>
      </div>
    );
  };

  const renderTrolleyGroup = () => {
    const { trolleyGroup } = formData;
    
    // Validación defensiva - usar valores por defecto si no existen
    const safeTrolleyGroup = trolleyGroup && trolleyGroup.trolley 
      ? trolleyGroup 
      : defaultForm.trolleyGroup;
    
    // Normalizar nombres solo para mostrar (sin modificar estado durante render)
    const displayGroup = {
      ...safeTrolleyGroup,
      trolley: { ...safeTrolleyGroup.trolley, name: "Trolley" },
      motorTrolley: { ...safeTrolleyGroup.motorTrolley, name: "Motor Trolley" },
      frenoMotorTrolley: { ...safeTrolleyGroup.frenoMotorTrolley, name: "Freno motor Trolley" },
      guiasTrolley: { ...safeTrolleyGroup.guiasTrolley, name: "Guias de Trolley" },
      ruedasTrolley: { ...safeTrolleyGroup.ruedasTrolley, name: "Ruedas Trolley" },
    };
    
    const isTrolleyNA = displayGroup.trolley.status === "na";
    
    const updateTrolleyItem = (key: "trolley" | "motorTrolley" | "frenoMotorTrolley" | "guiasTrolley" | "ruedasTrolley", updates: Partial<TrolleyGroupEntry>) => {
      // Mapear nombres correctos según la clave
      const correctNames: Record<typeof key, string> = {
        trolley: "Trolley",
        motorTrolley: "Motor Trolley",
        frenoMotorTrolley: "Freno motor Trolley",
        guiasTrolley: "Guias de Trolley",
        ruedasTrolley: "Ruedas Trolley",
      };
      
      setFormData((prev) => ({
        ...prev,
        trolleyGroup: {
          ...prev.trolleyGroup,
          [key]: { 
            ...prev.trolleyGroup[key], 
            ...updates,
            name: correctNames[key], // Siempre usar el nombre correcto
          },
        },
      }));
    };

    const updateTrolleyObservation = (value: string) => {
      setFormData((prev) => ({
        ...prev,
        trolleyGroup: {
          ...prev.trolleyGroup,
          observation: value,
        },
      }));
    };

    const renderTrolleyItem = (key: "trolley" | "motorTrolley" | "frenoMotorTrolley" | "guiasTrolley" | "ruedasTrolley", item: TrolleyGroupEntry) => {
      const isDisabled = key !== "trolley" && isTrolleyNA;
      
      // Mapear nombres correctos según la clave
      const correctNames: Record<typeof key, string> = {
        trolley: "Trolley",
        motorTrolley: "Motor Trolley",
        frenoMotorTrolley: "Freno motor Trolley",
        guiasTrolley: "Guias de Trolley",
        ruedasTrolley: "Ruedas Trolley",
      };
      
      const displayName = correctNames[key];
      
      return (
        <div key={item.id} className="space-y-3">
          <h4 className="font-semibold text-lg">{displayName}</h4>
          <RadioGroup
            value={item.status ?? ""}
            onValueChange={(value: ChecklistStatus) => {
              updateTrolleyItem(key, { status: value });
              // Si se selecciona N/A en Trolley, limpiar otros estados
              if (key === "trolley" && value === "na") {
                setFormData((prev) => ({
                  ...prev,
                  trolleyGroup: {
                    ...prev.trolleyGroup,
                    motorTrolley: { ...prev.trolleyGroup.motorTrolley, status: null },
                    frenoMotorTrolley: { ...prev.trolleyGroup.frenoMotorTrolley, status: null },
                    guiasTrolley: { ...prev.trolleyGroup.guiasTrolley, status: null },
                    ruedasTrolley: { ...prev.trolleyGroup.ruedasTrolley, status: null },
                  },
                }));
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <Label
              htmlFor={`trolley-${key}-good`}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                item.status === "good" && "border-green-500 bg-green-500/10",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <RadioGroupItem value="good" id={`trolley-${key}-good`} disabled={isDisabled} />
              Buen estado
            </Label>
            <Label
              htmlFor={`trolley-${key}-bad`}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                item.status === "bad" && "border-destructive bg-destructive/10",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <RadioGroupItem value="bad" id={`trolley-${key}-bad`} disabled={isDisabled} />
              Mal estado
            </Label>
            <Label
              htmlFor={`trolley-${key}-na`}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                item.status === "na" && "border-blue-500 bg-blue-500/10",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <RadioGroupItem value="na" id={`trolley-${key}-na`} disabled={isDisabled} />
              N/A
            </Label>
          </RadioGroup>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Revise cada componente del Trolley y seleccione su estado. Si el Trolley completo es N/A, los demás componentes se deshabilitarán automáticamente.
        </p>
        
        {renderTrolleyItem("trolley", displayGroup.trolley)}
        {renderTrolleyItem("motorTrolley", displayGroup.motorTrolley)}
        {renderTrolleyItem("frenoMotorTrolley", displayGroup.frenoMotorTrolley)}
        {renderTrolleyItem("guiasTrolley", displayGroup.guiasTrolley)}
        {renderTrolleyItem("ruedasTrolley", displayGroup.ruedasTrolley)}

        <div className="space-y-2">
          <Label htmlFor="trolley-observation">Observaciones generales del Trolley</Label>
          <Textarea
            id="trolley-observation"
            rows={5}
            placeholder="Escriba observaciones relevantes sobre el Trolley y sus componentes."
            value={displayGroup.observation}
            onChange={(event) => updateTrolleyObservation(event.target.value)}
          />
        </div>
      </div>
    );
  };

  const renderCarrosTesteros = () => {
    const { carrosTesteros } = formData;
    
    // Validación defensiva - usar valores por defecto si no existen
    const safeCarrosTesteros = carrosTesteros && Array.isArray(carrosTesteros.subItems)
      ? carrosTesteros
      : defaultForm.carrosTesteros;
    
    // Normalizar nombres solo para mostrar (sin modificar estado durante render)
    const correctNames = ["Motorreductor", "Freno", "Ruedas", "Chumaceras", "Palanquilla"];
    const displayCarrosTesteros = {
      ...safeCarrosTesteros,
      subItems: safeCarrosTesteros.subItems.map((item, index) => ({
        ...item,
        name: correctNames[index] || item.name,
      })),
    };
    
    const isMainNA = displayCarrosTesteros.mainStatus === "na";

    const updateMainStatus = (status: ChecklistStatus) => {
      setFormData((prev) => {
        const newCarrosTesteros = {
          ...prev.carrosTesteros,
          mainStatus: status,
        };
        // Si se selecciona N/A, limpiar todos los sub-items
        if (status === "na") {
          newCarrosTesteros.subItems = prev.carrosTesteros.subItems.map((item) => ({
            ...item,
            status: null,
          }));
        }
        return {
          ...prev,
          carrosTesteros: newCarrosTesteros,
        };
      });
    };

    const updateSubItem = (index: number, status: ChecklistStatus) => {
      setFormData((prev) => ({
        ...prev,
        carrosTesteros: {
          ...prev.carrosTesteros,
          subItems: prev.carrosTesteros.subItems.map((item, i) =>
            i === index ? { ...item, status } : item
          ),
        },
      }));
    };

    const updateObservation = (value: string) => {
      setFormData((prev) => ({
        ...prev,
        carrosTesteros: {
          ...prev.carrosTesteros,
          observation: value,
        },
      }));
    };

    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Revise el estado general de los Carros testeros y cada uno de sus componentes. Si los Carros testeros son N/A, los componentes se deshabilitarán automáticamente.
        </p>

        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Carros testeros (Estado general)</h4>
          <RadioGroup
            value={displayCarrosTesteros.mainStatus ?? ""}
            onValueChange={(value: ChecklistStatus) => updateMainStatus(value)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <Label
              htmlFor="carros-main-good"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                displayCarrosTesteros.mainStatus === "good" && "border-green-500 bg-green-500/10",
              )}
            >
              <RadioGroupItem value="good" id="carros-main-good" />
              Buen estado
            </Label>
            <Label
              htmlFor="carros-main-bad"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                displayCarrosTesteros.mainStatus === "bad" && "border-destructive bg-destructive/10",
              )}
            >
              <RadioGroupItem value="bad" id="carros-main-bad" />
              Mal estado
            </Label>
            <Label
              htmlFor="carros-main-na"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                displayCarrosTesteros.mainStatus === "na" && "border-blue-500 bg-blue-500/10",
              )}
            >
              <RadioGroupItem value="na" id="carros-main-na" />
              N/A
            </Label>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Componentes de Carros testeros</h4>
          {displayCarrosTesteros.subItems.map((item, index) => (
            <div key={item.id} className="space-y-3">
              <h5 className="font-medium">{item.name}</h5>
              <RadioGroup
                value={item.status ?? ""}
                onValueChange={(value: ChecklistStatus) => updateSubItem(index, value)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                disabled={isMainNA}
              >
                <Label
                  htmlFor={`carros-${index}-good`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                    item.status === "good" && "border-green-500 bg-green-500/10",
                    isMainNA && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <RadioGroupItem value="good" id={`carros-${index}-good`} disabled={isMainNA} />
                  Buen estado
                </Label>
                <Label
                  htmlFor={`carros-${index}-bad`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                    item.status === "bad" && "border-destructive bg-destructive/10",
                    isMainNA && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <RadioGroupItem value="bad" id={`carros-${index}-bad`} disabled={isMainNA} />
                  Mal estado
                </Label>
                <Label
                  htmlFor={`carros-${index}-na`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                    item.status === "na" && "border-blue-500 bg-blue-500/10",
                    isMainNA && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <RadioGroupItem value="na" id={`carros-${index}-na`} disabled={isMainNA} />
                  N/A
                </Label>
              </RadioGroup>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="carros-observation">Observaciones generales de Carros testeros</Label>
          <Textarea
            id="carros-observation"
            rows={5}
            placeholder="Escriba observaciones relevantes sobre los Carros testeros y sus componentes."
            value={displayCarrosTesteros.observation}
            onChange={(event) => updateObservation(event.target.value)}
          />
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (safeCurrentStep.key) {
      case "intro":
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              A continuación se presenta un asistente paso a paso para completar el informe de
              mantenimiento. Los datos se guardarán automáticamente a medida que avance.
            </p>
            <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
              Consejo: si necesita pausar el ingreso de información, utilice el botón
              &quot;Guardar y salir&quot;. Podrá continuar desde el listado de informes en
              cualquier momento.
            </p>
          </div>
        );
      case "basicInfo":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  lang="es"
                  value={formData.startDate ?? ""}
                  onChange={(event) =>
                    handleBasicInfoChange("startDate", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  lang="es"
                  value={formData.endDate ?? ""}
                  onChange={(event) =>
                    handleBasicInfoChange("endDate", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(event) => handleBasicInfoChange("company", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(event) => handleBasicInfoChange("address", event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(event) => handleBasicInfoChange("phone", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contacto</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(event) => handleBasicInfoChange("contact", event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="technicianName">Nombre del Técnico</Label>
                <Input
                  id="technicianName"
                  value={formData.technicianName}
                  onChange={(event) =>
                    handleBasicInfoChange("technicianName", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment">Equipo</Label>
                <Input
                  id="equipment"
                  value={formData.equipment}
                  onChange={(event) =>
                    handleBasicInfoChange("equipment", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(event) => handleBasicInfoChange("brand", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(event) => handleBasicInfoChange("model", event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serial">Serie</Label>
                <Input
                  id="serial"
                  value={formData.serial}
                  onChange={(event) => handleBasicInfoChange("serial", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  value={formData.capacity}
                  onChange={(event) => handleBasicInfoChange("capacity", event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="locationPg">Código Activo</Label>
                <Input
                  id="locationPg"
                  value={formData.locationPg}
                  onChange={(event) =>
                    handleBasicInfoChange("locationPg", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voltage">Voltaje</Label>
                <Input
                  id="voltage"
                  value={formData.voltage}
                  onChange={(event) => handleBasicInfoChange("voltage", event.target.value)}
                />
              </div>
            </div>
          </div>
        );
      case "initialState":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describa cómo encontró el equipo antes de iniciar las labores de mantenimiento.
            </p>
            <RichTextEditor
              value={formData.initialState || ""}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, initialState: value }))
              }
              placeholder="Ejemplo: El polipasto presentaba ruidos inusuales en el motor de elevación y se observaron fugas de aceite en la carcasa."
            />
          </div>
        );
      case "recommendations":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ponga en la siguiente caja de texto todas las recomendaciones para el cliente. Separe
              diferentes recomendaciones por líneas y enumeradas. Ejemplo:
            </p>
            <pre className="rounded-md bg-muted/70 p-4 text-sm text-muted-foreground">
              1. Se debe reemplazar el botón del paro de emergencia.
              {"\n"}2. Revisar fuga de aceite del Polipasto.
            </pre>
            <RichTextEditor
              value={formData.recommendations || ""}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  recommendations: value,
                }))
              }
              placeholder="1. ...&#10;2. ..."
            />
          </div>
        );
      case "tests":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-voltage">Voltaje</Label>
                <Input
                  id="test-voltage"
                  value={formData.tests.voltage}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      tests: { ...prev.tests, voltage: event.target.value },
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Polipasto</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border px-3 py-2 text-left"> </th>
                      <th className="border px-3 py-2 text-left">L1</th>
                      <th className="border px-3 py-2 text-left">L2</th>
                      <th className="border px-3 py-2 text-left">L3</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border px-3 py-2 font-medium">SUBIR</td>
                      {(["l1", "l2", "l3"] as const).map((phase) => (
                        <td key={`subir-${phase}`} className="border px-3 py-2">
                          <Input
                            value={formData.tests.polipasto.subir[phase]}
                            onChange={(event) =>
                              handleTestChange("subir", phase, event.target.value)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="border px-3 py-2 font-medium">BAJAR</td>
                      {(["l1", "l2", "l3"] as const).map((phase) => (
                        <td key={`bajar-${phase}`} className="border px-3 py-2">
                          <Input
                            value={formData.tests.polipasto.bajar[phase]}
                            onChange={(event) =>
                              handleTestChange("bajar", phase, event.target.value)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case "photos":
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Adjunte fotografías relevantes del mantenimiento realizado. Puede subir múltiples
              imágenes y agregar una descripción para cada una.
            </p>

            <div className="space-y-4">
              {(() => {
                // Eliminar duplicados antes de renderizar usando un Map para mantener el orden
                const uniquePhotosMap = new Map<string, PhotoEntry>();
                formData.photos.forEach((photo) => {
                  if (photo.id && !uniquePhotosMap.has(photo.id)) {
                    uniquePhotosMap.set(photo.id, photo);
                  }
                });
                const uniquePhotos = Array.from(uniquePhotosMap.values());
                
                return uniquePhotos.map((photo) => {
                  const inputId = `photo-upload-${photo.id}`;
                  const uploadState = photoUploads[photo.id];
                  const isBusy = uploadState
                    ? ["preparing", "queued", "uploading", "processing"].includes(uploadState.status)
                    : false;
                  const buttonLabel = uploadState && uploadState.status !== "idle" && uploadState.status !== "done"
                    ? uploadButtonCopy[uploadState.status]
                    : photo.url
                    ? "Reemplazar"
                    : "Subir foto";
                  return (
                    <Card key={photo.id} className="p-4 space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        {photo.url ? (
                          <img
                            src={photo.url}
                            alt={photo.description || "Fotografía de mantenimiento"}
                            className="h-16 w-16 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {photo.url ? "Fotografía cargada" : "Fotografía pendiente"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {photo.url
                              ? "La imagen está guardada en el sistema."
                              : "Sube una fotografía para completar esta sección."}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() =>
                            (document.getElementById(inputId) as HTMLInputElement | null)?.click()
                          }
                          disabled={isBusy}
                        >
                          <Upload className="h-4 w-4" />
                          {buttonLabel}
                        </Button>
                        <Input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) =>
                            handlePhotoFileUpload(photo.id, event.target.files)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemovePhoto(photo)}
                        >
                          <X className="h-4 w-4" />
                          Borrar foto
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`photo-desc-${photo.id}`}>Descripción</Label>
                      <Textarea
                        id={`photo-desc-${photo.id}`}
                        rows={3}
                        value={photo.description}
                        onChange={(event) =>
                          handlePhotoDescriptionChange(photo.id, event.target.value)
                        }
                        placeholder="Describe la fotografía para futuras referencias."
                      />
                    </div>
                    {uploadState && uploadState.status !== "idle" && (
                      <div className="space-y-2">
                        {!["done", "error"].includes(uploadState.status) && (
                          <Progress value={uploadState.progress} />
                        )}
                        <p
                          className={cn(
                            "text-xs",
                            uploadState.status === "error"
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {uploadState.message ?? uploadMessageCopy[uploadState.status]}
                        </p>
                      </div>
                    )}
                  </Card>
                  );
                });
              })()}
            </div>

            <Button type="button" variant="outline" onClick={handleAddPhoto}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Foto
            </Button>
          </div>
        );
      case "finish":
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Asegúrese de completar todos los pasos requeridos antes de generar el PDF para el
              cliente con el informe terminado.
            </p>
            <p className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">
              Utilice el botón &quot;Guardar y cerrar&quot; para finalizar esta sesión. Podrá
              regresar al listado para editar o descargar el informe cuando la funcionalidad esté
              disponible.
            </p>
            <Button variant="secondary" onClick={handleSaveAndExit}>
              Guardar y cerrar
            </Button>
          </div>
        );
      default:
        try {
          if (safeCurrentStep.specialStep === "trolley-group") {
            return renderTrolleyGroup();
          }
          if (safeCurrentStep.specialStep === "carros-testeros") {
            return renderCarrosTesteros();
          }
          if (safeCurrentStep.checklistIndex !== undefined) {
            return renderChecklistStep(safeCurrentStep.checklistIndex);
          }
          return null;
        } catch (error) {
          console.error("Error renderizando paso:", error, safeCurrentStep);
          return (
            <div className="space-y-4">
              <p className="text-destructive">
                Error al renderizar este paso. Por favor, recarga la página.
              </p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : String(error)}
              </p>
              <Button onClick={() => window.location.reload()}>Recargar página</Button>
            </div>
          );
        }
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-industrial">
        <p className="text-muted-foreground">Preparando el asistente...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-industrial">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
        <div className="flex flex-col-reverse gap-4 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/maintenance-reports")}
              variant="outline"
              size="icon"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Informe de Mantenimiento</h1>
              <p className="text-muted-foreground">
                {isEditMode ? "Editando informe existente" : "Nuevo informe"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleSaveAndExit}>
              Guardar y salir
            </Button>
            <div className="text-xs text-muted-foreground">
              {isSaving
                ? "Guardando..."
                : pendingAutoSave
                  ? "Cambios pendientes por guardar"
                  : savedTimestamp
                    ? `Guardado a las ${savedTimestamp}`
                    : "Sincronización pendiente"}
            </div>
          </div>
        </div>

        <Card className="flex-1 p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">{safeCurrentStep.title}</h2>
              {safeCurrentStep.subtitle && (
                <p className="text-muted-foreground mt-2">{safeCurrentStep.subtitle}</p>
              )}
            </div>
            {renderStepContent()}
          </div>

          <div className="mt-10 space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>
                Paso {currentStepIndex + 1} de {totalSteps}
              </span>
              <span>{Math.round(progressValue)}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={isFirstStep}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={isLastStep}
                  className="flex items-center gap-2"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" onClick={handleSaveAndExit}>
                Guardar y salir
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MaintenanceReportWizard;
