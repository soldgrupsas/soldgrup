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
  CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Función helper para extraer solo la parte de fecha (YYYY-MM-DD) de un valor
// Sin crear objetos Date para evitar problemas de zona horaria
const normalizeDateToLocalString = (date: string | Date | null | undefined): string | null => {
  if (!date) return null;
  
  // Convertir a string primero
  const dateStr = typeof date === "string" 
    ? date.trim() 
    : (date instanceof Date ? date.toISOString().split('T')[0] : String(date));
  
  // Extraer solo YYYY-MM-DD usando regex (sin crear objetos Date)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  
  return null;
};

// Items para ELEVADORES (lista simple, sin sub-items especiales)
const ELEVATOR_CHECKLIST_ITEMS = [
  "Motor elevación",
  "Freno elevación",
  "Estructura",
  "Gancho",
  "Cadena",
  "Guaya",
  "Gabinete eléctrico",
  "Guías laterales",
  "Finales de carrera",
  "Topes mecánicos",
  "Aceite",
  "Botoneras",
  "Pines de seguridad",
  "Cabina o canasta",
  "Puertas",
];

// Items para PUENTES GRÚA
// NOTA: "Trolley" y "Carros testeros" tienen pasos especiales con sub-items
const BRIDGE_CRANE_CHECKLIST_ITEMS = [
  "Motor de elevación",
  "Freno motor de elevación",
  "Estructura",
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
];

// Función para obtener los items según el tipo de equipo
const getChecklistItems = (equipmentType?: EquipmentType): string[] => {
  if (equipmentType === "puentes-grua") {
    return BRIDGE_CRANE_CHECKLIST_ITEMS;
  }
  return ELEVATOR_CHECKLIST_ITEMS;
};

// Indica si el tipo de equipo tiene pasos especiales (Trolley, Carros testeros)
const hasSpecialSteps = (equipmentType?: EquipmentType): boolean => {
  return equipmentType === "puentes-grua";
};

// Mantener CHECKLIST_ITEMS para compatibilidad
const CHECKLIST_ITEMS = ELEVATOR_CHECKLIST_ITEMS;

type ChecklistStatus = "good" | "bad" | "na" | null;

type ChecklistEntry = {
  id: string;
  name: string;
  status: ChecklistStatus;
  observation: string;
};

type CarrosTesterosSubItem = {
  id: string;
  name: string;
  status: ChecklistStatus;
  observation: string;
};

type CarrosTesterosData = {
  mainStatus: ChecklistStatus;
  subItems: CarrosTesterosSubItem[];
  observation: string;
};

type TrolleySubItem = {
  id: string;
  name: string;
  status: ChecklistStatus;
  observation: string;
};

type TrolleyData = {
  mainStatus: ChecklistStatus;
  subItems: TrolleySubItem[];
  observation: string;
};

// Tipo para procedimientos dinámicos (informe general)
type ProcedimientoEntry = {
  id: string;
  procedimiento: string;
  observacion: string;
};

type EquipmentType = "elevadores" | "puentes-grua" | "mantenimientos-generales";




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
  trolleyData: TrolleyData;
  carrosTesteros: CarrosTesterosData;
  procedimientos: ProcedimientoEntry[]; // Para informe general
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
};

const buildDefaultChecklist = (equipmentType?: EquipmentType): ChecklistEntry[] =>
  getChecklistItems(equipmentType).map((name, index) => ({
    id: crypto.randomUUID(),
    name,
    status: null,
    observation: "",
  }));

const buildDefaultTrolley = (): TrolleyData => ({
  mainStatus: null as ChecklistStatus,
  subItems: [
    { id: crypto.randomUUID(), name: "Motor Trolley", status: null, observation: "" },
    { id: crypto.randomUUID(), name: "Freno motor Trolley", status: null, observation: "" },
    { id: crypto.randomUUID(), name: "Guías de Trolley", status: null, observation: "" },
    { id: crypto.randomUUID(), name: "Ruedas de Trolley", status: null, observation: "" },
  ],
  observation: "",
});

const buildDefaultCarrosTesteros = (): CarrosTesterosData => ({
  mainStatus: null as ChecklistStatus,
  subItems: [
    { id: crypto.randomUUID(), name: "Motorreductor", status: null, observation: "" },
    { id: crypto.randomUUID(), name: "Freno", status: null, observation: "" },
    { id: crypto.randomUUID(), name: "Ruedas y palanquilla", status: null, observation: "" },
    { id: crypto.randomUUID(), name: "Chumaceras", status: null, observation: "" },
  ],
  observation: "",
});

const buildDefaultForm = (equipmentType?: EquipmentType): MaintenanceReportForm => ({
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
  checklist: buildDefaultChecklist(equipmentType),
  trolleyData: buildDefaultTrolley(),
  carrosTesteros: buildDefaultCarrosTesteros(),
  procedimientos: [], // Para informe general
  recommendations: "",
  tests: {
    voltage: "",
    polipasto: {
      subir: { l1: "", l2: "", l3: "" },
      bajar: { l1: "", l2: "", l3: "" },
    },
  },
  photos: [],
});

const defaultForm: MaintenanceReportForm = buildDefaultForm();

const buildSteps = (equipmentType?: EquipmentType): StepDefinition[] => {
  // MANTENIMIENTOS GENERALES: solo un paso de procedimientos dinámicos
  if (equipmentType === "mantenimientos-generales") {
    return [
      {
        key: "intro",
        title: "Procedimiento de llenado de Informe de Mantenimiento",
        subtitle:
          "A continuación, podrá llenar paso a paso su informe de mantenimiento. Asegúrese de completar todos los campos.",
      },
      { key: "basicInfo", title: "Información Básica" },
      { key: "initialState", title: "Estado Inicial" },
      { key: "procedimientos", title: "Procedimientos Realizados", subtitle: "Agregue los procedimientos realizados" },
      { key: "recommendations", title: "Recomendaciones" },
      { key: "photos", title: "Soporte Fotográfico" },
      { key: "finish", title: "Fin del Informe de Mantenimiento" },
    ];
  }

  const items = getChecklistItems(equipmentType);
  const includeSpecialSteps = hasSpecialSteps(equipmentType);
  
  // Construir los pasos del checklist
  // Para puentes grúa: incluye Trolley y Carros testeros con sub-items
  // Para elevadores: lista simple sin pasos especiales
  const checklistSteps: StepDefinition[] = [];
  let displayNumber = 1;
  
  if (includeSpecialSteps) {
    // PUENTES GRÚA: incluir Trolley y Carros testeros después de "Freno motor de elevación"
    const frenoMotorIndex = items.findIndex(item => 
      item.toLowerCase().includes("freno") && item.toLowerCase().includes("motor") && item.toLowerCase().includes("elevación")
    );
    const insertAfterIndex = frenoMotorIndex !== -1 ? frenoMotorIndex : 0;
    
    let specialStepsInserted = false;
    
    for (let i = 0; i < items.length; i++) {
      checklistSteps.push({
        key: `checklist-${i}`,
        title: "Lista de Chequeo",
        subtitle: `${displayNumber}. ${items[i]}`,
        checklistIndex: i,
      });
      displayNumber++;
      
      // Insertar "Trolley" y "Carros testeros" después de "Freno motor de elevación"
      if (i === insertAfterIndex && !specialStepsInserted) {
        checklistSteps.push({
          key: "trolley",
          title: "Lista de Chequeo",
          subtitle: `${displayNumber}. Trolley`,
        });
        displayNumber++;
        
        checklistSteps.push({
          key: "carros-testeros",
          title: "Lista de Chequeo",
          subtitle: `${displayNumber}. Carros testeros`,
        });
        displayNumber++;
        specialStepsInserted = true;
      }
    }
  } else {
    // ELEVADORES: lista simple sin pasos especiales
    for (let i = 0; i < items.length; i++) {
      checklistSteps.push({
        key: `checklist-${i}`,
        title: "Lista de Chequeo",
        subtitle: `${displayNumber}. ${items[i]}`,
        checklistIndex: i,
      });
      displayNumber++;
    }
  }
  
  return [
    {
      key: "intro",
      title: "Procedimiento de llenado de Informe de Mantenimiento",
      subtitle:
        "A continuación, podrá llenar paso a paso su informe de mantenimiento. Asegúrese de completar todos los campos.",
    },
    { key: "basicInfo", title: "Información Básica" },
    { key: "initialState", title: "Estado Inicial" },
    ...checklistSteps,
    { key: "recommendations", title: "Recomendaciones" },
    { key: "tests", title: "Pruebas sin carga" },
    { key: "photos", title: "Soporte Fotográfico" },
    { key: "finish", title: "Fin del Informe de Mantenimiento" },
  ];
};

const steps: StepDefinition[] = buildSteps();
const totalSteps = steps.length;

interface MaintenanceReportWizardProps {
  equipmentType?: EquipmentType;
}

const MaintenanceReportWizard = ({ equipmentType = "elevadores" }: MaintenanceReportWizardProps = {}) => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const isEditMode = Boolean(params.id);
  const { toast } = useToast();
  const { user, session, loading: authLoading } = useAuth();

  // Construir steps y formData según el tipo de equipo
  const [steps] = useState<StepDefinition[]>(() => buildSteps(equipmentType));
  const [totalSteps] = useState(() => steps.length);
  
  const [formData, setFormData] = useState<MaintenanceReportForm>(() => buildDefaultForm(equipmentType));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const [photoUploads, setPhotoUploads] = useState<Record<string, PhotoUploadState>>({});
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const uploadQueueRef = useRef<UploadTask[]>([]);
  const activeUploadRef = useRef<{ task: UploadTask; controller: AbortController } | null>(null);
  const reportIdRef = useRef<string | null>(null);
  const formDataRef = useRef<MaintenanceReportForm>(defaultForm);
  const initialFormDataRef = useRef<MaintenanceReportForm>(defaultForm);
  const hasBeenModifiedRef = useRef(false);

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

      setFormData((prev) => ({
        ...prev,
        photos: prev.photos.map((photo) =>
          photo.id === task.photoId
            ? {
                ...photo,
                storagePath,
                optimizedPath,
                thumbnailPath,
                url: photoUrl,
              }
            : photo,
        ),
      }));

      updatePhotoUploadState(task.photoId, {
        status: "done",
        progress: 100,
        message: undefined,
      });

      toast({
        title: "Foto cargada",
        description: "La fotografía se optimizó correctamente.",
      });
    },
    [logPhotoMetric, session, toast, updatePhotoUploadState],
  );

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
        setTimeout(() => scheduleUploadProcessing(), 250);
      });
  }, [handleUploadTask, session, updatePhotoUploadState]);

  useEffect(() => {
    return () => {
      activeUploadRef.current?.controller.abort();
      uploadQueueRef.current = [];
    };
  }, []);

  useEffect(() => {
    scheduleUploadProcessing();
  }, [scheduleUploadProcessing]);

  const initialLoadRef = useRef(true);

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

  const initializedRef = useRef(false);

  useEffect(() => {
    if (authLoading || !user) return;
    
    // Si ya se inicializó, no volver a inicializar (incluso si authLoading cambia)
    if (initializedRef.current) return;

    const initialize = async () => {
      setLoading(true);
      try {
        if (isEditMode && params.id) {
          await loadExistingReport(params.id);
        } else {
          // No crear el informe automáticamente, solo inicializar el estado
          setFormData(defaultForm);
          initialFormDataRef.current = defaultForm;
          setCurrentStepIndex(0);
        }
      } finally {
        initialLoadRef.current = false;
        initializedRef.current = true;
        setLoading(false);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isEditMode, params.id]);

  // Detectar si hay cambios y crear el informe si es necesario
  useEffect(() => {
    if (initialLoadRef.current || isEditMode || reportId) return;
    
    // Comparar solo los campos relevantes, no todo el objeto (que incluye arrays/objetos anidados)
    const hasChanges = 
      formData.startDate !== initialFormDataRef.current.startDate ||
      formData.endDate !== initialFormDataRef.current.endDate ||
      formData.company !== initialFormDataRef.current.company ||
      formData.address !== initialFormDataRef.current.address ||
      formData.phone !== initialFormDataRef.current.phone ||
      formData.contact !== initialFormDataRef.current.contact ||
      formData.technicianName !== initialFormDataRef.current.technicianName ||
      formData.equipment !== initialFormDataRef.current.equipment ||
      formData.brand !== initialFormDataRef.current.brand ||
      formData.model !== initialFormDataRef.current.model ||
      formData.serial !== initialFormDataRef.current.serial ||
      formData.capacity !== initialFormDataRef.current.capacity ||
      formData.locationPg !== initialFormDataRef.current.locationPg ||
      formData.voltage !== initialFormDataRef.current.voltage ||
      formData.initialState !== initialFormDataRef.current.initialState ||
      formData.recommendations !== initialFormDataRef.current.recommendations ||
      formData.tests.voltage !== initialFormDataRef.current.tests.voltage ||
      formData.tests.polipasto.subir.l1 !== initialFormDataRef.current.tests.polipasto.subir.l1 ||
      formData.tests.polipasto.subir.l2 !== initialFormDataRef.current.tests.polipasto.subir.l2 ||
      formData.tests.polipasto.subir.l3 !== initialFormDataRef.current.tests.polipasto.subir.l3 ||
      formData.tests.polipasto.bajar.l1 !== initialFormDataRef.current.tests.polipasto.bajar.l1 ||
      formData.tests.polipasto.bajar.l2 !== initialFormDataRef.current.tests.polipasto.bajar.l2 ||
      formData.tests.polipasto.bajar.l3 !== initialFormDataRef.current.tests.polipasto.bajar.l3 ||
      formData.checklist.some((item, idx) => 
        item.status !== initialFormDataRef.current.checklist[idx]?.status ||
        item.observation !== initialFormDataRef.current.checklist[idx]?.observation
      ) ||
      formData.photos.length !== initialFormDataRef.current.photos.length;
    
    if (hasChanges && !hasBeenModifiedRef.current) {
      hasBeenModifiedRef.current = true;
      // Crear el informe cuando se detecta el primer cambio con los datos actuales
      createDraftReportWithData(formData).then((id) => {
        if (id) {
          setReportId(id);
        }
      });
    }
  }, [formData, isEditMode, reportId]);

  // Autoguardado solo si ya existe el informe
  useEffect(() => {
    if (initialLoadRef.current || !reportId) return;
    setPendingAutoSave(true);

    const handler = setTimeout(() => {
      void persistReport();
    }, 3000);

    return () => clearTimeout(handler);
  }, [formData, currentStepIndex, reportId]);

  const createDraftReport = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const payload = buildDbPayload(defaultForm, 0, user.id);
      const { data, error } = await supabase
        .from("maintenance_reports")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      setReportId(data.id);
      setFormData(defaultForm);
      setCurrentStepIndex(Math.max((data.current_step ?? 1) - 1, 0));
      setLastSavedAt(new Date(data.updated_at));
      return data.id;
    } catch (error) {
      console.error("Error creando borrador de informe:", error);
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

  const createDraftReportWithData = async (data: MaintenanceReportForm): Promise<string | null> => {
    if (!user) return null;
    try {
      const payload = buildDbPayload(data, currentStepIndex, user.id);
      const { data: result, error } = await supabase
        .from("maintenance_reports")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      setReportId(result.id);
      setLastSavedAt(new Date(result.updated_at));
      return result.id;
    } catch (error) {
      console.error("Error creando borrador de informe:", error);
      toast({
        title: "Error",
        description:
          "No se pudo crear el informe de mantenimiento. Intenta nuevamente.",
        variant: "destructive",
      });
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

      if (error) {
        console.error("Error obteniendo informe de la base de datos:", error);
        throw error;
      }

      if (!data) {
        throw new Error("No se encontró el informe solicitado");
      }

      // Extraer datos de manera segura con validación
      let parsedData: MaintenanceReportForm = { ...defaultForm };
      
      try {
        if (typeof data.data === "object" && data.data !== null) {
          const dataObj = data.data as any;
          // Validar y asignar cada campo de manera segura
          parsedData = {
            ...defaultForm,
            startDate: typeof dataObj.startDate === 'string' ? dataObj.startDate : defaultForm.startDate,
            endDate: typeof dataObj.endDate === 'string' ? dataObj.endDate : defaultForm.endDate,
            company: typeof dataObj.company === 'string' ? dataObj.company : defaultForm.company,
            address: typeof dataObj.address === 'string' ? dataObj.address : defaultForm.address,
            phone: typeof dataObj.phone === 'string' ? dataObj.phone : defaultForm.phone,
            contact: typeof dataObj.contact === 'string' ? dataObj.contact : defaultForm.contact,
            technicianName: typeof dataObj.technicianName === 'string' ? dataObj.technicianName : defaultForm.technicianName,
            equipment: typeof dataObj.equipment === 'string' ? dataObj.equipment : defaultForm.equipment,
            brand: typeof dataObj.brand === 'string' ? dataObj.brand : defaultForm.brand,
            model: typeof dataObj.model === 'string' ? dataObj.model : defaultForm.model,
            serial: typeof dataObj.serial === 'string' ? dataObj.serial : defaultForm.serial,
            capacity: typeof dataObj.capacity === 'string' ? dataObj.capacity : defaultForm.capacity,
            locationPg: typeof dataObj.locationPg === 'string' ? dataObj.locationPg : defaultForm.locationPg,
            voltage: typeof dataObj.voltage === 'string' ? dataObj.voltage : defaultForm.voltage,
            initialState: typeof dataObj.initialState === 'string' ? dataObj.initialState : defaultForm.initialState,
            recommendations: typeof dataObj.recommendations === 'string' ? dataObj.recommendations : defaultForm.recommendations,
            checklist: (() => {
              // IMPORTANTE: Preservar el checklist guardado TAL CUAL para no perder datos
              // Solo usar el checklist por defecto si no hay datos guardados
              if (Array.isArray(dataObj.checklist) && dataObj.checklist.length > 0) {
                console.log(`[ElevatorMaintenanceReportWizard] Usando checklist guardado con ${dataObj.checklist.length} items`);
                return dataObj.checklist;
              }
              
              // Si no hay checklist guardado, usar el por defecto según el tipo de equipo
              const expectedItems = getChecklistItems(equipmentType);
              console.log(`[ElevatorMaintenanceReportWizard] No hay checklist guardado, creando uno nuevo con ${expectedItems.length} items`);
              return buildDefaultChecklist(equipmentType);
            })(),
            trolleyData: (() => {
              // Intentar cargar trolleyData (formato nuevo)
              if (typeof dataObj.trolleyData === 'object' && dataObj.trolleyData !== null) {
                return {
                  mainStatus: (dataObj.trolleyData.mainStatus === 'good' || dataObj.trolleyData.mainStatus === 'bad' || dataObj.trolleyData.mainStatus === 'na')
                    ? dataObj.trolleyData.mainStatus
                    : null,
                  subItems: Array.isArray(dataObj.trolleyData.subItems) 
                    ? dataObj.trolleyData.subItems 
                    : buildDefaultTrolley().subItems,
                  observation: typeof dataObj.trolleyData.observation === 'string' ? dataObj.trolleyData.observation : '',
                };
              }
              // Intentar cargar trolleyGroup (formato antiguo del MaintenanceReportWizard)
              if (typeof dataObj.trolleyGroup === 'object' && dataObj.trolleyGroup !== null) {
                console.log('[ElevatorMaintenanceReportWizard] Convirtiendo trolleyGroup (formato antiguo) a trolleyData');
                const oldGroup = dataObj.trolleyGroup;
                // Determinar el mainStatus basado en el estado del trolley principal
                const mainStatus = oldGroup.trolley?.status ?? null;
                // Convertir los sub-items del formato antiguo al nuevo
                const subItems = [
                  { id: crypto.randomUUID(), name: "Motor Trolley", status: oldGroup.motorTrolley?.status ?? null, observation: "" },
                  { id: crypto.randomUUID(), name: "Freno motor Trolley", status: oldGroup.frenoMotorTrolley?.status ?? null, observation: "" },
                  { id: crypto.randomUUID(), name: "Guías de Trolley", status: oldGroup.guiasTrolley?.status ?? null, observation: "" },
                  { id: crypto.randomUUID(), name: "Ruedas de Trolley", status: oldGroup.ruedasTrolley?.status ?? null, observation: "" },
                ];
                return {
                  mainStatus,
                  subItems,
                  observation: oldGroup.observation ?? '',
                };
              }
              return buildDefaultTrolley();
            })(),
            carrosTesteros: (typeof dataObj.carrosTesteros === 'object' && dataObj.carrosTesteros !== null)
              ? {
                  mainStatus: (dataObj.carrosTesteros.mainStatus === 'good' || dataObj.carrosTesteros.mainStatus === 'bad' || dataObj.carrosTesteros.mainStatus === 'na')
                    ? dataObj.carrosTesteros.mainStatus
                    : null,
                  subItems: Array.isArray(dataObj.carrosTesteros.subItems) 
                    ? dataObj.carrosTesteros.subItems 
                    : buildDefaultCarrosTesteros().subItems,
                  observation: typeof dataObj.carrosTesteros.observation === 'string' ? dataObj.carrosTesteros.observation : '',
                }
              : buildDefaultCarrosTesteros(),
            procedimientos: Array.isArray(dataObj.procedimientos) ? dataObj.procedimientos : [],
            tests: typeof dataObj.tests === 'object' && dataObj.tests !== null 
              ? {
                  voltage: typeof dataObj.tests.voltage === 'string' ? dataObj.tests.voltage : defaultForm.tests.voltage,
                  polipasto: typeof dataObj.tests.polipasto === 'object' && dataObj.tests.polipasto !== null
                    ? dataObj.tests.polipasto
                    : defaultForm.tests.polipasto,
                }
              : defaultForm.tests,
            photos: Array.isArray(dataObj.photos) ? dataObj.photos : defaultForm.photos,
          };
        }
      } catch (parseError) {
        console.error("Error parseando datos del informe:", parseError);
        // Continuar con defaultForm si hay error
        parsedData = { ...defaultForm };
      }

      // Normalizar fechas desde la base de datos
      // Extraer solo la parte de fecha (YYYY-MM-DD) sin usar objetos Date para evitar problemas de timezone
      const extractDateOnly = (dateValue: any): string | null => {
        if (!dateValue) return null;
        try {
          const dateStr = String(dateValue);
          // Extraer solo YYYY-MM-DD del string, sin importar si tiene hora o timezone
          const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
          return match ? match[1] : null;
        } catch (error) {
          console.error("Error extrayendo fecha:", error);
          return null;
        }
      };
      
      // Priorizar fechas de las columnas directas (start_date, end_date) sobre las del objeto data
      if (data.start_date) {
        parsedData.startDate = extractDateOnly(data.start_date);
      } else if (parsedData.startDate) {
        parsedData.startDate = extractDateOnly(parsedData.startDate);
      }
      
      if (data.end_date) {
        parsedData.endDate = extractDateOnly(data.end_date);
      } else if (parsedData.endDate) {
        parsedData.endDate = extractDateOnly(parsedData.endDate);
      }
      
      // Cargar trolleyData desde la columna dedicada o desde data.trolleyData
      if (data.trolley_data && typeof data.trolley_data === 'object') {
        const td = data.trolley_data as any;
        parsedData.trolleyData = {
          mainStatus: (td.mainStatus === 'good' || td.mainStatus === 'bad' || td.mainStatus === 'na')
            ? td.mainStatus
            : null,
          subItems: Array.isArray(td.subItems) ? td.subItems : buildDefaultTrolley().subItems,
          observation: typeof td.observation === 'string' ? td.observation : '',
        };
      }
      
      // Cargar carrosTesteros desde la columna dedicada o desde data.carrosTesteros
      if (data.carros_testeros && typeof data.carros_testeros === 'object') {
        const ct = data.carros_testeros as any;
        parsedData.carrosTesteros = {
          mainStatus: (ct.mainStatus === 'good' || ct.mainStatus === 'bad' || ct.mainStatus === 'na')
            ? ct.mainStatus
            : null,
          subItems: Array.isArray(ct.subItems) ? ct.subItems : buildDefaultCarrosTesteros().subItems,
          observation: typeof ct.observation === 'string' ? ct.observation : '',
        };
      }

      setReportId(data.id);
      
      // Validar que parsedData tenga una estructura válida antes de establecerlo
      setFormData(parsedData);
      // Asegurar que el índice del paso esté dentro del rango válido de steps
      // Esto evita errores cuando se editan informes creados con versiones anteriores del wizard
      const savedStepIndex = Math.max((data.current_step ?? 1) - 1, 0);
      const maxValidStepIndex = steps.length - 1;
      setCurrentStepIndex(Math.min(savedStepIndex, maxValidStepIndex));
      if (data.updated_at) {
        try {
          setLastSavedAt(new Date(data.updated_at));
        } catch (dateError) {
          console.warn("Error parseando fecha de actualización:", dateError);
        }
      }
    } catch (error) {
      console.error("Error cargando informe de mantenimiento:", error);
      setLoading(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cargar el informe solicitado.",
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
    // Normalizar fechas antes de guardar para evitar problemas de zona horaria
    // Estrategia: Enviar como string YYYY-MM-DD puro (PostgreSQL DATE maneja esto correctamente)
    // Sin crear objetos Date para evitar conversiones de timezone
    const normalizeDateString = (dateStr: string | null | undefined): string | null => {
      if (!dateStr) return null;
      
      // Extraer solo YYYY-MM-DD del string
      const cleanMatch = String(dateStr).trim().match(/^(\d{4}-\d{2}-\d{2})/);
      if (cleanMatch) {
        const normalized = cleanMatch[1];
        console.log('[Date Debug] Normalizing date for save:', dateStr, '->', normalized);
        return normalized;
      }
      
      return null;
    };
    
    const normalizedStartDate = normalizeDateString(data.startDate);
    const normalizedEndDate = normalizeDateString(data.endDate);
    
    console.log('[Date Debug] Saving dates - start:', normalizedStartDate, 'end:', normalizedEndDate);
    
    // Verificar que trolleyData y carrosTesteros estén en los datos antes de guardar
    console.log('[buildDbPayload] Verificando datos especiales:', {
      hasTrolleyData: 'trolleyData' in data,
      trolleyMainStatus: data.trolleyData?.mainStatus,
      hasCarrosTesteros: 'carrosTesteros' in data,
      carrosTesterosMainStatus: data.carrosTesteros?.mainStatus,
    });
    
    console.log('[buildDbPayload] Verificando checklist:', {
      checklistLength: data.checklist.length,
      checklistItemNames: data.checklist.map(item => item.name)
    });
    
    // Incluir equipmentType en los datos para que el PDF pueda detectarlo
    const dataWithEquipmentType = {
      ...data,
      equipmentType: equipmentType || 'elevadores',
    };
    
    const payload = {
      data: dataWithEquipmentType,
      current_step: stepIndex + 1,
      start_date: normalizedStartDate,
      end_date: normalizedEndDate,
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
    
    // Verificar que carrosTesteros esté en el payload.data
    console.log('[buildDbPayload] Verificando carrosTesteros en payload.data:', {
      hasCarrosTesteros: 'carrosTesteros' in (payload.data as any),
      carrosTesterosValue: (payload.data as any)?.carrosTesteros,
    });

    if (userId) {
      payload.user_id = userId;
    }

    return payload;
  };

  const persistReport = useCallback(
    async (overrideData?: MaintenanceReportForm, options?: { silent?: boolean }) => {
      if (!reportId) return;
      const dataToSave = overrideData ?? formDataRef.current;
      
      // Verificar datos especiales antes de guardar
      console.log('[persistReport] Verificando datos especiales en dataToSave:', {
        hasTrolleyData: 'trolleyData' in dataToSave,
        hasCarrosTesteros: 'carrosTesteros' in dataToSave,
      });
      
      setIsSaving(true);
      setPendingAutoSave(true);
      try {
        const payload = buildDbPayload(dataToSave, currentStepIndex);
        
        // Verificar datos especiales en payload.data antes de enviar
        console.log('[persistReport] Verificando datos en payload.data:', {
          hasTrolleyData: 'trolleyData' in (payload.data as any),
          hasCarrosTesteros: 'carrosTesteros' in (payload.data as any),
        });
        
        const { error, data } = await supabase
          .from("maintenance_reports")
          .update(payload)
          .eq("id", reportId)
          .select("updated_at")
          .single();

        if (error) throw error;

        if (data?.updated_at) {
          setLastSavedAt(new Date(data.updated_at));
        } else {
          setLastSavedAt(new Date());
        }
        setPendingAutoSave(false);
        setIsSaving(false);
        if (!options?.silent) {
          console.info("Informe guardado correctamente.");
        }
      } catch (error) {
        console.error("Error guardando informe:", error);
        setPendingAutoSave(false);
        setIsSaving(false);
        toast({
          title: "Error al guardar",
          description:
            "No se pudo guardar el informe automáticamente. Revisa tu conexión e intenta nuevamente.",
          variant: "destructive",
        });
      }
    },
    [reportId, currentStepIndex, toast],
  );

  const handleSaveAndExit = async () => {
    // Si no hay reportId, significa que no se modificó nada, solo salir
    if (!reportId) {
      navigate("/maintenance-reports");
      return;
    }
    
    await persistReport(undefined, { silent: true });
    toast({
      title: "Cambios guardados",
      description: "Puedes continuar más tarde desde la lista de informes.",
    });
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

  // Función helper para formatear fecha para mostrar en el botón
  const formatDateForDisplay = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    try {
      const dateParts = dateStr.split('-');
      if (dateParts.length === 3) {
        const [year, month, day] = dateParts.map(Number);
        const dateObj = new Date(year, month - 1, day);
        // Usar el mismo formato que en el listado: "día de mes abreviado de año"
        return dateObj.toLocaleDateString("es-CO", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    } catch (error) {
      console.error("Error formateando fecha:", error);
    }
    return dateStr;
  };

  // Función helper para convertir string a Date para el calendario
  const stringToDate = (dateStr: string | null | undefined): Date | undefined => {
    if (!dateStr) return undefined;
    try {
      const dateParts = dateStr.split('-');
      if (dateParts.length === 3) {
        const [year, month, day] = dateParts.map(Number);
        return new Date(year, month - 1, day);
      }
    } catch (error) {
      console.error("Error convirtiendo fecha para calendario:", error);
    }
    return undefined;
  };

  const handleBasicInfoChange = (field: keyof MaintenanceReportForm, value: string) => {
    // Para campos de fecha, asegurarse de que el valor se guarde exactamente como viene del input
    // El input type="date" devuelve un string en formato YYYY-MM-DD
    if (field === "startDate" || field === "endDate") {
      // Extraer solo YYYY-MM-DD si viene con información adicional
      const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
      const cleanValue = dateMatch ? dateMatch[1] : value;
      
      setFormData((prev) => ({
        ...prev,
        [field]: cleanValue || null,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
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
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.map((photo) =>
        photo.id === photoId ? { ...photo, description: value } : photo,
      ),
    }));
    if (reportId) {
      void supabase
        .from("maintenance_report_photos")
        .update({ description: value })
        .eq("id", photoId);
    }
  };

  const ensureReportExists = async () => {
    if (reportId) return reportId;
    hasBeenModifiedRef.current = true;
    const newId = await createDraftReportWithData(formData);
    if (newId) {
      setReportId(newId);
    }
    return newId;
  };

  const handleAddPhoto = async () => {
    const id = crypto.randomUUID();
    setFormData((prev) => ({
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
    }));
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

    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.map((photo) =>
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
    }));
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
    scheduleUploadProcessing();
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
    // Asegurar que el checklist tenga suficientes items
    if (formData.checklist.length <= index) {
      console.warn(`[ElevatorMaintenanceReportWizard] Checklist too short (${formData.checklist.length}), completing to index ${index}`);
      const expectedItems = getChecklistItems(equipmentType);
      setFormData(prev => {
        const newChecklist = [...prev.checklist];
        while (newChecklist.length <= index) {
          const idx = newChecklist.length;
          newChecklist.push({
            id: crypto.randomUUID(),
            name: expectedItems[idx] || `Item ${idx + 1}`,
            status: null,
            observation: "",
          });
        }
        return { ...prev, checklist: newChecklist };
      });
      // Retornar un mensaje temporal mientras se actualiza
      return (
        <div className="space-y-6">
          <p className="text-muted-foreground">Cargando item...</p>
        </div>
      );
    }
    
    const entry = formData.checklist[index];
    if (!entry) {
      console.error(`[ElevatorMaintenanceReportWizard] Entry at index ${index} is undefined`);
      return (
        <div className="space-y-6">
          <p className="text-destructive">Error: No se pudo cargar el item del checklist.</p>
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

  // Renderizar interfaz de procedimientos dinámicos (informe general)
  const renderProcedimientos = () => {
    const procedimientos = formData.procedimientos || [];

    const addProcedimiento = () => {
      setFormData((prev) => ({
        ...prev,
        procedimientos: [
          ...prev.procedimientos,
          { id: crypto.randomUUID(), procedimiento: "", observacion: "" },
        ],
      }));
    };

    const removeProcedimiento = (id: string) => {
      setFormData((prev) => ({
        ...prev,
        procedimientos: prev.procedimientos.filter((p) => p.id !== id),
      }));
    };

    const updateProcedimiento = (id: string, field: "procedimiento" | "observacion", value: string) => {
      setFormData((prev) => ({
        ...prev,
        procedimientos: prev.procedimientos.map((p) =>
          p.id === id ? { ...p, [field]: value } : p
        ),
      }));
    };

    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Agregue los procedimientos realizados durante el mantenimiento. Puede agregar tantos como necesite.
        </p>

        {procedimientos.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground mb-4">No hay procedimientos agregados</p>
            <Button onClick={addProcedimiento} variant="outline">
              + Agregar primer procedimiento
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {procedimientos.map((proc, index) => (
              <div key={proc.id} className="p-4 border rounded-lg space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-muted-foreground">
                    Procedimiento #{index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeProcedimiento(proc.id)}
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`proc-${proc.id}`}>Procedimiento</Label>
                  <Input
                    id={`proc-${proc.id}`}
                    placeholder="Ej: Cambio de carcaza, Lubricación de rodamientos..."
                    value={proc.procedimiento}
                    onChange={(e) => updateProcedimiento(proc.id, "procedimiento", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`obs-${proc.id}`}>Observación</Label>
                  <Textarea
                    id={`obs-${proc.id}`}
                    placeholder="Ej: Se cambia la carcaza debido a que presentaba fisuras..."
                    rows={2}
                    value={proc.observacion}
                    onChange={(e) => updateProcedimiento(proc.id, "observacion", e.target.value)}
                  />
                </div>
              </div>
            ))}
            
            <Button onClick={addProcedimiento} variant="outline" className="w-full">
              + Agregar otro procedimiento
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderTrolley = () => {
    const { trolleyData } = formData;
    
    // Validación defensiva - usar valores por defecto si no existen
    const safeTrolley = trolleyData || buildDefaultTrolley();
    const showSubItems = safeTrolley.mainStatus === "good" || safeTrolley.mainStatus === "bad";

    const updateMainStatus = (status: ChecklistStatus) => {
      setFormData((prev) => {
        const currentTrolley = prev.trolleyData || buildDefaultTrolley();
        return {
          ...prev,
          trolleyData: {
            ...currentTrolley,
            mainStatus: status,
          },
        };
      });
    };

    const updateSubItemStatus = (subItemId: string, status: ChecklistStatus) => {
      setFormData((prev) => {
        const currentTrolley = prev.trolleyData || buildDefaultTrolley();
        return {
          ...prev,
          trolleyData: {
            ...currentTrolley,
            subItems: currentTrolley.subItems.map((item) =>
              item.id === subItemId ? { ...item, status } : item
            ),
          },
        };
      });
    };

    const updateSubItemObservation = (subItemId: string, observation: string) => {
      setFormData((prev) => {
        const currentTrolley = prev.trolleyData || buildDefaultTrolley();
        return {
          ...prev,
          trolleyData: {
            ...currentTrolley,
            subItems: currentTrolley.subItems.map((item) =>
              item.id === subItemId ? { ...item, observation } : item
            ),
          },
        };
      });
    };

    const updateObservation = (value: string) => {
      setFormData((prev) => {
        const currentTrolley = prev.trolleyData || buildDefaultTrolley();
        return {
          ...prev,
          trolleyData: {
            ...currentTrolley,
            observation: value,
          },
        };
      });
    };

    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Revise el estado del Trolley. Al seleccionar Buen estado o Mal estado, aparecerán los sub-items para evaluar.
        </p>

        {/* Estado principal de Trolley */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Trolley</h4>
          <RadioGroup
            value={safeTrolley.mainStatus ?? ""}
            onValueChange={(value: ChecklistStatus) => updateMainStatus(value)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <Label
              htmlFor="trolley-main-good"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                safeTrolley.mainStatus === "good" && "border-green-500 bg-green-500/10",
              )}
            >
              <RadioGroupItem value="good" id="trolley-main-good" />
              Buen estado
            </Label>
            <Label
              htmlFor="trolley-main-bad"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                safeTrolley.mainStatus === "bad" && "border-destructive bg-destructive/10",
              )}
            >
              <RadioGroupItem value="bad" id="trolley-main-bad" />
              Mal estado
            </Label>
            <Label
              htmlFor="trolley-main-na"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                safeTrolley.mainStatus === "na" && "border-blue-500 bg-blue-500/10",
              )}
            >
              <RadioGroupItem value="na" id="trolley-main-na" />
              N/A
            </Label>
          </RadioGroup>
        </div>

        {/* Sub-items - solo se muestran si mainStatus es good o bad */}
        {showSubItems && (
          <div className="space-y-6 border-l-4 border-primary/30 pl-4 ml-2">
            <h4 className="font-semibold text-base text-muted-foreground">Sub-componentes de Trolley:</h4>
            
            {safeTrolley.subItems.map((subItem) => (
              <div key={subItem.id} className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <h5 className="font-medium">{subItem.name}</h5>
                <RadioGroup
                  value={subItem.status ?? ""}
                  onValueChange={(value: ChecklistStatus) => updateSubItemStatus(subItem.id, value)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  <Label
                    htmlFor={`trolley-subitem-${subItem.id}-good`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                      subItem.status === "good" && "border-green-500 bg-green-500/10",
                    )}
                  >
                    <RadioGroupItem value="good" id={`trolley-subitem-${subItem.id}-good`} />
                    Buen estado
                  </Label>
                  <Label
                    htmlFor={`trolley-subitem-${subItem.id}-bad`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                      subItem.status === "bad" && "border-destructive bg-destructive/10",
                    )}
                  >
                    <RadioGroupItem value="bad" id={`trolley-subitem-${subItem.id}-bad`} />
                    Mal estado
                  </Label>
                  <Label
                    htmlFor={`trolley-subitem-${subItem.id}-na`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                      subItem.status === "na" && "border-blue-500 bg-blue-500/10",
                    )}
                  >
                    <RadioGroupItem value="na" id={`trolley-subitem-${subItem.id}-na`} />
                    N/A
                  </Label>
                </RadioGroup>
                <Textarea
                  placeholder={`Observación de ${subItem.name}`}
                  rows={2}
                  value={subItem.observation}
                  onChange={(e) => updateSubItemObservation(subItem.id, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* Observación general */}
        <div className="space-y-2">
          <Label htmlFor="trolley-observation">Observaciones generales del Trolley</Label>
          <Textarea
            id="trolley-observation"
            rows={4}
            placeholder="Escriba observaciones generales sobre el Trolley."
            value={safeTrolley.observation}
            onChange={(event) => updateObservation(event.target.value)}
          />
        </div>
      </div>
    );
  };

  const renderCarrosTesteros = () => {
    const { carrosTesteros } = formData;
    
    // Validación defensiva - usar valores por defecto si no existen
    const safeCarrosTesteros = carrosTesteros || buildDefaultCarrosTesteros();
    const showSubItems = safeCarrosTesteros.mainStatus === "good" || safeCarrosTesteros.mainStatus === "bad";

    const updateMainStatus = (status: ChecklistStatus) => {
      setFormData((prev) => {
        const currentCarrosTesteros = prev.carrosTesteros || buildDefaultCarrosTesteros();
        return {
          ...prev,
          carrosTesteros: {
            ...currentCarrosTesteros,
            mainStatus: status,
          },
        };
      });
    };

    const updateSubItemStatus = (subItemId: string, status: ChecklistStatus) => {
      setFormData((prev) => {
        const currentCarrosTesteros = prev.carrosTesteros || buildDefaultCarrosTesteros();
        return {
          ...prev,
          carrosTesteros: {
            ...currentCarrosTesteros,
            subItems: currentCarrosTesteros.subItems.map((item) =>
              item.id === subItemId ? { ...item, status } : item
            ),
          },
        };
      });
    };

    const updateSubItemObservation = (subItemId: string, observation: string) => {
      setFormData((prev) => {
        const currentCarrosTesteros = prev.carrosTesteros || buildDefaultCarrosTesteros();
        return {
          ...prev,
          carrosTesteros: {
            ...currentCarrosTesteros,
            subItems: currentCarrosTesteros.subItems.map((item) =>
              item.id === subItemId ? { ...item, observation } : item
            ),
          },
        };
      });
    };

    const updateObservation = (value: string) => {
      setFormData((prev) => {
        const currentCarrosTesteros = prev.carrosTesteros || buildDefaultCarrosTesteros();
        return {
          ...prev,
          carrosTesteros: {
            ...currentCarrosTesteros,
            observation: value,
          },
        };
      });
    };

    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Revise el estado de Carros testeros. Al seleccionar Buen estado o Mal estado, aparecerán los sub-items para evaluar.
        </p>

        {/* Estado principal de Carros testeros */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Carros testeros</h4>
          <RadioGroup
            value={safeCarrosTesteros.mainStatus ?? ""}
            onValueChange={(value: ChecklistStatus) => updateMainStatus(value)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <Label
              htmlFor="carros-testeros-main-good"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                safeCarrosTesteros.mainStatus === "good" && "border-green-500 bg-green-500/10",
              )}
            >
              <RadioGroupItem value="good" id="carros-testeros-main-good" />
              Buen estado
            </Label>
            <Label
              htmlFor="carros-testeros-main-bad"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                safeCarrosTesteros.mainStatus === "bad" && "border-destructive bg-destructive/10",
              )}
            >
              <RadioGroupItem value="bad" id="carros-testeros-main-bad" />
              Mal estado
            </Label>
            <Label
              htmlFor="carros-testeros-main-na"
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                safeCarrosTesteros.mainStatus === "na" && "border-blue-500 bg-blue-500/10",
              )}
            >
              <RadioGroupItem value="na" id="carros-testeros-main-na" />
              N/A
            </Label>
          </RadioGroup>
        </div>

        {/* Sub-items - solo se muestran si mainStatus es good o bad */}
        {showSubItems && (
          <div className="space-y-6 border-l-4 border-primary/30 pl-4 ml-2">
            <h4 className="font-semibold text-base text-muted-foreground">Sub-componentes de Carros testeros:</h4>
            
            {safeCarrosTesteros.subItems.map((subItem) => (
              <div key={subItem.id} className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <h5 className="font-medium">{subItem.name}</h5>
                <RadioGroup
                  value={subItem.status ?? ""}
                  onValueChange={(value: ChecklistStatus) => updateSubItemStatus(subItem.id, value)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  <Label
                    htmlFor={`subitem-${subItem.id}-good`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                      subItem.status === "good" && "border-green-500 bg-green-500/10",
                    )}
                  >
                    <RadioGroupItem value="good" id={`subitem-${subItem.id}-good`} />
                    Buen estado
                  </Label>
                  <Label
                    htmlFor={`subitem-${subItem.id}-bad`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                      subItem.status === "bad" && "border-destructive bg-destructive/10",
                    )}
                  >
                    <RadioGroupItem value="bad" id={`subitem-${subItem.id}-bad`} />
                    Mal estado
                  </Label>
                  <Label
                    htmlFor={`subitem-${subItem.id}-na`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                      subItem.status === "na" && "border-blue-500 bg-blue-500/10",
                    )}
                  >
                    <RadioGroupItem value="na" id={`subitem-${subItem.id}-na`} />
                    N/A
                  </Label>
                </RadioGroup>
                <Textarea
                  placeholder={`Observación de ${subItem.name}`}
                  rows={2}
                  value={subItem.observation}
                  onChange={(e) => updateSubItemObservation(subItem.id, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* Observación general */}
        <div className="space-y-2">
          <Label htmlFor="carros-testeros-observation">Observaciones generales de Carros testeros</Label>
          <Textarea
            id="carros-testeros-observation"
            rows={4}
            placeholder="Escriba observaciones generales sobre Carros testeros."
            value={safeCarrosTesteros.observation}
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
                <Label>Fecha Inicio</Label>
                <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      key={`start-date-${formData.startDate || 'empty'}`}
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? formatDateForDisplay(formData.startDate) : (
                        <span>Seleccione una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={stringToDate(formData.startDate)}
                      onSelect={(date) => {
                        if (date) {
                          // Convertir Date a string YYYY-MM-DD usando zona horaria local
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          const dateString = `${year}-${month}-${day}`;
                          
                          // Actualizar el estado directamente
                          setFormData((prev) => {
                            const updated = {
                              ...prev,
                              startDate: dateString,
                            };
                            // Sincronizar el ref inmediatamente
                            formDataRef.current = updated;
                            return updated;
                          });
                          
                          // Cerrar el popover después de permitir que React procese el cambio
                          requestAnimationFrame(() => {
                            setStartDatePickerOpen(false);
                          });
                        }
                      }}
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Fecha Final</Label>
                <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      key={`end-date-${formData.endDate || 'empty'}`}
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.endDate ? formatDateForDisplay(formData.endDate) : (
                        <span>Seleccione una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={stringToDate(formData.endDate)}
                      onSelect={(date) => {
                        if (date) {
                          // Convertir Date a string YYYY-MM-DD usando zona horaria local
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          const dateString = `${year}-${month}-${day}`;
                          
                          // Actualizar el estado directamente
                          setFormData((prev) => {
                            const updated = {
                              ...prev,
                              endDate: dateString,
                            };
                            // Sincronizar el ref inmediatamente
                            formDataRef.current = updated;
                            return updated;
                          });
                          
                          // Cerrar el popover después de permitir que React procese el cambio
                          requestAnimationFrame(() => {
                            setEndDatePickerOpen(false);
                          });
                        }
                      }}
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
            <Textarea
              rows={5}
              value={formData.initialState}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, initialState: event.target.value }))
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
            <Textarea
              rows={10}
              value={formData.recommendations}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  recommendations: event.target.value,
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
              {formData.photos.map((photo) => {
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
              })}
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
      case "procedimientos":
        return renderProcedimientos();
      case "trolley":
        return renderTrolley();
      case "carros-testeros":
        return renderCarrosTesteros();
      default:
        if (safeCurrentStep.checklistIndex !== undefined) {
          return renderChecklistStep(safeCurrentStep.checklistIndex);
        }
        return null;
    }
  };

  // Solo mostrar loading en la carga inicial, no cuando authLoading cambia después
  if (loading && initialLoadRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-industrial">
        <p className="text-muted-foreground">Preparando el asistente...</p>
      </div>
    );
  }
  
  // Si no hay usuario y no está cargando, redirigir
  if (!authLoading && !user) {
    return null; // El useEffect de navegación se encargará de redirigir
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
              <h1 className="text-3xl font-bold">
                Informe de Mantenimiento - {equipmentType === "puentes-grua" ? "Puentes Grúa" : "Elevadores"}
              </h1>
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
