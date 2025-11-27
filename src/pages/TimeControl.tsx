import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Upload,
  Clock,
  UserPlus,
  Edit2,
  Trash2,
  Eye,
  X,
  Calendar,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  cedula: string | null;
  fecha_nacimiento: string | null;
  fecha_ingreso: string | null;
  eps: string | null;
  arl: string | null;
  cargo: string | null;
  sueldo: number | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  worker_id: string;
  date: string;
  entry_time: string | null;
  exit_time: string | null;
  entry_photo_url: string | null;
  exit_photo_url: string | null;
  worker?: Worker;
};

const PHOTO_BUCKET = "attendance-photos";

const HOLIDAYS = [
  "2025-01-01",
  "2025-01-06",
  "2025-03-24",
  "2025-03-25",
  "2025-05-01",
  "2025-05-12",
  "2025-06-16",
  "2025-07-07",
  "2025-07-20",
  "2025-08-07",
  "2025-08-17",
  "2025-10-13",
  "2025-11-03",
  "2025-11-17",
  "2025-12-08",
  "2025-12-25",
];

const SCHEDULE_BY_DAY: Record<string, { start: string; end: string }[]> = {
  "1": [
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "2": [
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "3": [
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "4": [
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "5": [
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "6": [{ start: "08:00", end: "12:00" }],
};

// Función helper para obtener la fecha en formato YYYY-MM-DD usando zona horaria local
// Evita problemas de conversión UTC que pueden cambiar la fecha
const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Función helper para normalizar una fecha (string o Date) a formato YYYY-MM-DD usando zona horaria local
const normalizeDateToKey = (date: string | Date): string => {
  if (typeof date === "string") {
    // Si ya es un string en formato YYYY-MM-DD, devolverlo directamente
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Si es un string de fecha, convertir a Date y luego a key
    return toDateKey(new Date(date));
  }
  // Si es un objeto Date, usar toDateKey directamente
  return toDateKey(date);
};

const isHoliday = (date: Date) => HOLIDAYS.includes(toDateKey(date));

const intervalsForDate = (date: Date) => {
  if (isHoliday(date)) return [];
  const day = date.getDay().toString();
  return SCHEDULE_BY_DAY[day] ?? [];
};

const timeStringToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
};

const computeRecordHours = (record: AttendanceRecord) => {
  const entry = record.entry_time ? new Date(record.entry_time) : null;
  const exit = record.exit_time ? new Date(record.exit_time) : null;
  if (!entry || !exit) {
    return { normalMinutes: 0, extraMinutes: 0, totalMinutes: 0 };
  }

  const intervals = intervalsForDate(entry);
  const totalMinutes = Math.max(0, (exit.getTime() - entry.getTime()) / 60000);

  let normalMinutes = 0;

  intervals.forEach((interval) => {
    const intervalStart = new Date(entry);
    intervalStart.setHours(Number(interval.start.split(":")[0]), Number(interval.start.split(":")[1]));
    const intervalEnd = new Date(entry);
    intervalEnd.setHours(Number(interval.end.split(":")[0]), Number(interval.end.split(":")[1]));

    const overlapStart = Math.max(entry.getTime(), intervalStart.getTime());
    const overlapEnd = Math.min(exit.getTime(), intervalEnd.getTime());

    if (overlapEnd > overlapStart) {
      normalMinutes += (overlapEnd - overlapStart) / 60000;
    }
  });

  const extraMinutes = Math.max(0, totalMinutes - normalMinutes);
  return { normalMinutes, extraMinutes, totalMinutes };
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

const TimeControl = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, session } = useAuth();
  const { toast } = useToast();
  const [initialLoading, setInitialLoading] = useState(false); // Cambiado a false para evitar bloqueo
  const initialLoadRef = useRef(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerFirstName, setNewWorkerFirstName] = useState("");
  const [newWorkerLastName, setNewWorkerLastName] = useState("");
  const [newWorkerCedula, setNewWorkerCedula] = useState("");
  const [newWorkerFechaNacimiento, setNewWorkerFechaNacimiento] = useState("");
  const [newWorkerFechaIngreso, setNewWorkerFechaIngreso] = useState("");
  const [newWorkerEps, setNewWorkerEps] = useState("");
  const [newWorkerArl, setNewWorkerArl] = useState("");
  const [newWorkerCargo, setNewWorkerCargo] = useState("");
  const [newWorkerSueldo, setNewWorkerSueldo] = useState("");
  const [newWorkerPhoto, setNewWorkerPhoto] = useState<File | null>(null);
  const [newWorkerPhotoPreview, setNewWorkerPhotoPreview] = useState<string | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editingWorkerPhoto, setEditingWorkerPhoto] = useState<File | null>(null);
  const [editingWorkerPhotoPreview, setEditingWorkerPhotoPreview] = useState<string | null>(null);
  const [viewingWorkerProfile, setViewingWorkerProfile] = useState<Worker | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [isAutoSavingNewWorker, setIsAutoSavingNewWorker] = useState(false);
  const [autoSaveErrorNewWorker, setAutoSaveErrorNewWorker] = useState<string | null>(null);
  const [lastAutoSavedAtNewWorker, setLastAutoSavedAtNewWorker] = useState<Date | null>(null);
  const [creatingWorkerId, setCreatingWorkerId] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number>();
  const autoSaveNewWorkerTimerRef = useRef<number>();
  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = undefined;
    }
  }, []);
  const clearAutoSaveNewWorkerTimer = useCallback(() => {
    if (autoSaveNewWorkerTimerRef.current) {
      window.clearTimeout(autoSaveNewWorkerTimerRef.current);
      autoSaveNewWorkerTimerRef.current = undefined;
    }
  }, []);
  const [uploadingEntry, setUploadingEntry] = useState(false);
  const [uploadingExit, setUploadingExit] = useState(false);
  const isUpdatingRecordsRef = useRef(false);
  
  // Timeout para resetear estados de uploading si se quedan atascados
  useEffect(() => {
    if (uploadingEntry || uploadingExit) {
      const timeout = setTimeout(() => {
        console.warn("Resetando estados de uploading después de 30 segundos");
        setUploadingEntry(false);
        setUploadingExit(false);
        isUpdatingRecordsRef.current = false;
      }, 30000);
      return () => clearTimeout(timeout);
    }
  }, [uploadingEntry, uploadingExit]);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month" | "custom">("week");
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/auth";
    }
  }, [authLoading, user]);

  // Verificar si hay un error de refresh token bloqueando y limpiarlo
  useEffect(() => {
    const checkAndClearInvalidTokens = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error && (error.message?.includes("Refresh Token") || error.message?.includes("JWT") || error.name === "AuthApiError")) {
          console.warn("Token inválido detectado, limpiando localStorage");
          Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
              localStorage.removeItem(key);
            }
          });
        }
      } catch (e) {
        // Ignorar errores silenciosamente
      }
    };
    
    // Verificar una vez al montar el componente
    checkAndClearInvalidTokens();
  }, []);

  // Listener para errores de autenticación globales - simplificado para evitar bloqueos
  useEffect(() => {
    let isMounted = true;
    let redirectTimeout: NodeJS.Timeout | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // Solo redirigir en SIGNED_OUT explícito, no en TOKEN_REFRESHED
      if (event === "SIGNED_OUT" && !session && user) {
        console.warn("Sesión cerrada, redirigiendo al login");
        // Limpiar timeout anterior si existe
        if (redirectTimeout) {
          clearTimeout(redirectTimeout);
        }
        // Usar window.location para forzar recarga completa
        redirectTimeout = setTimeout(() => {
          if (isMounted) {
            window.location.href = "/auth";
          }
        }, 500);
      }
    });

    return () => {
      isMounted = false;
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn("Error al desuscribirse del listener de auth:", error);
      }
    };
  }, [user]);

  const fetchData = useCallback(async (showLoading = false) => {
    if (!user) {
      if (initialLoadRef.current) {
        setInitialLoading(false);
      }
      return;
    }
    
    try {
      // Solo mostrar loading si es la carga inicial
      if (showLoading && initialLoadRef.current) {
        setInitialLoading(true);
      }

      const { data: workersData, error: workersError } = await supabase
        .from("workers")
        .select("*")
        .order("created_at", { ascending: false });

      if (workersError) {
        console.error("Error loading workers:", workersError);
        throw new Error(`Error al cargar trabajadores: ${workersError.message}`);
      }
      // Cargar trabajadores - SIMPLE
      setWorkers(workersData || []);

      const { data: recordsData, error: recordsError } = await supabase
        .from("attendance_records")
        .select("*")
        .order("date", { ascending: false });

      if (recordsError) {
        console.error("Error loading attendance records:", recordsError);
        console.warn("No se pudieron cargar registros de asistencia:", recordsError.message);
        setAttendanceRecords([]);
      } else {
        // Cargar registros usando función anti-duplicados
        const records = (recordsData || []) as unknown as AttendanceRecord[];
        const deduplicated = removeDuplicateRecords(records);
        setAttendanceRecords(deduplicated);
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los datos.",
        variant: "destructive",
      });
      setWorkers([]);
      setAttendanceRecords([]);
    } finally {
      // Solo resetear loading inicial si es la primera carga
      if (initialLoadRef.current) {
        setInitialLoading(false);
        initialLoadRef.current = false;
      }
    }
  }, [toast, user]);

  useEffect(() => {
    // Solo cargar datos cuando el usuario esté autenticado y sea la carga inicial
    if (!authLoading && user && initialLoadRef.current) {
      void fetchData();
    } else if (!authLoading && !user) {
      setInitialLoading(false);
      initialLoadRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);


  const isFileInputOpenRef = useRef(false);

  // DESACTIVADO: El intervalo y visibilitychange estaban causando duplicaciones
  // Solo se cargarán datos en la carga inicial
  // Los cambios se reflejan inmediatamente mediante actualizaciones de estado local

  const uploadWorkerPhoto = async (file: File, workerId: string): Promise<string> => {
    if (!session) {
      throw new Error("No hay sesión activa");
    }

    const fileName = `${workerId}/photo_${Date.now()}_${sanitizeFileName(file.name)}`;
    const storagePath = encodeStoragePath(fileName);

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const handleAddWorker = async () => {
    if (!newWorkerFirstName.trim() || !newWorkerLastName.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa nombre y apellido.",
        variant: "destructive",
      });
      return;
    }

    try {
      let workerData;
      
      if (creatingWorkerId) {
        // Si ya existe un trabajador borrador, actualizarlo
        const payload = {
          first_name: newWorkerFirstName.trim(),
          last_name: newWorkerLastName.trim(),
          cedula: newWorkerCedula.trim() || null,
          fecha_nacimiento: newWorkerFechaNacimiento || null,
          fecha_ingreso: newWorkerFechaIngreso || null,
          eps: newWorkerEps.trim() || null,
          arl: newWorkerArl.trim() || null,
          cargo: newWorkerCargo.trim() || null,
          sueldo: parsePesoInput(newWorkerSueldo),
        };

        const { data: updatedData, error: updateError } = await supabase
          .from("workers")
          .update(payload)
          .eq("id", creatingWorkerId)
          .select()
          .single();

        if (updateError) {
          if (updateError.code === "23505" || updateError.message?.includes("idx_workers_cedula")) {
            throw new Error("Ya existe un trabajador con esta cédula. Por favor, verifica la información.");
          }
          throw updateError;
        }

        workerData = updatedData;
      } else {
        // Crear nuevo trabajador
        const { data: insertedData, error: insertError } = await supabase
          .from("workers")
          .insert({
            first_name: newWorkerFirstName.trim(),
            last_name: newWorkerLastName.trim(),
            cedula: newWorkerCedula.trim() || null,
            fecha_nacimiento: newWorkerFechaNacimiento || null,
            fecha_ingreso: newWorkerFechaIngreso || null,
            eps: newWorkerEps.trim() || null,
            arl: newWorkerArl.trim() || null,
            cargo: newWorkerCargo.trim() || null,
            sueldo: parsePesoInput(newWorkerSueldo),
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.code === "23505" || insertError.message?.includes("idx_workers_cedula")) {
            throw new Error("Ya existe un trabajador con esta cédula. Por favor, verifica la información.");
          }
          throw insertError;
        }

        workerData = insertedData;
      }

      // Upload photo if provided
      let photoUrl = null;
      if (newWorkerPhoto && workerData) {
        try {
          photoUrl = await uploadWorkerPhoto(newWorkerPhoto, workerData.id);
          // Update worker with photo URL
          const { error: updateError } = await supabase
            .from("workers")
            .update({ photo_url: photoUrl })
            .eq("id", workerData.id);

          if (updateError) {
            console.warn("Error updating photo URL:", updateError);
          }
        } catch (photoError: any) {
          console.warn("Error uploading photo:", photoError);
          toast({
            title: "Advertencia",
            description: "El trabajador fue creado pero no se pudo subir la foto.",
            variant: "default",
          });
        }
      }

      // Actualizar el estado local INMEDIATAMENTE para que el nuevo trabajador aparezca sin recargar
      if (workerData) {
        const newWorker: Worker = {
          ...workerData,
          photo_url: photoUrl || workerData.photo_url || null,
        };
        
        // Agregar trabajador - SIMPLE Y DIRECTO
        setWorkers((prev) => {
          // Si ya existe, reemplazarlo; si no, agregarlo
          const exists = prev.find((w) => w.id === newWorker.id);
          if (exists) {
            return prev.map((w) => (w.id === newWorker.id ? newWorker : w));
          }
          return [newWorker, ...prev];
        });
      }

      toast({
        title: "Trabajador agregado",
        description: "El trabajador fue agregado correctamente.",
      });

      // Reset form
      setNewWorkerFirstName("");
      setNewWorkerLastName("");
      setNewWorkerCedula("");
      setNewWorkerFechaNacimiento("");
      setNewWorkerFechaIngreso("");
      setNewWorkerEps("");
      setNewWorkerArl("");
      setNewWorkerCargo("");
      setNewWorkerSueldo("");
      setNewWorkerPhoto(null);
      setNewWorkerPhotoPreview(null);
      setCreatingWorkerId(null);
      setIsAutoSavingNewWorker(false);
      setAutoSaveErrorNewWorker(null);
      setLastAutoSavedAtNewWorker(null);
      clearAutoSaveNewWorkerTimer();
      setShowAddWorker(false);
      
      // NO llamar fetchData() aquí - el estado local ya está actualizado
    } catch (error: any) {
      console.error("Error adding worker:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el trabajador.",
        variant: "destructive",
      });
    }
  };

  const persistWorkerChanges = useCallback(
    async (worker: Worker) => {
      if (!worker.id) return;
      const payload = {
        first_name: worker.first_name.trim(),
        last_name: worker.last_name.trim(),
        cedula: worker.cedula?.trim() || null,
        fecha_nacimiento: worker.fecha_nacimiento || null,
        fecha_ingreso: worker.fecha_ingreso || null,
        eps: worker.eps?.trim() || null,
        arl: worker.arl?.trim() || null,
        cargo: worker.cargo?.trim() || null,
        sueldo: worker.sueldo ?? null,
      };
      const { error } = await supabase.from("workers").update(payload).eq("id", worker.id);
      if (error) {
        console.error("Error persisting worker changes:", error);
        if (error.code === "23505" || error.message?.includes("idx_workers_cedula")) {
          throw new Error("Ya existe otro trabajador con esta cédula. Por favor, verifica la información.");
        }
        throw error;
      }
      // Actualizar el estado local de workers inmediatamente
      setWorkers((prev) => {
        const updated = prev.map((current) => 
          current.id === worker.id ? { ...current, ...payload } : current
        );
        return updated;
      });
      
      // También actualizar editingWorker si está siendo editado
      setEditingWorker((prev) => {
        if (prev && prev.id === worker.id) {
          return { ...prev, ...payload };
        }
        return prev;
      });
    },
    [],
  );

  const persistNewWorkerChanges = useCallback(
    async () => {
      // Si no hay nombre ni apellido, no crear todavía
      if (!newWorkerFirstName.trim() && !newWorkerLastName.trim()) {
        return;
      }

      const payload = {
        first_name: newWorkerFirstName.trim() || "Nuevo",
        last_name: newWorkerLastName.trim() || "Trabajador",
        cedula: newWorkerCedula.trim() || null,
        fecha_nacimiento: newWorkerFechaNacimiento || null,
        fecha_ingreso: newWorkerFechaIngreso || null,
        eps: newWorkerEps.trim() || null,
        arl: newWorkerArl.trim() || null,
        cargo: newWorkerCargo.trim() || null,
        sueldo: parsePesoInput(newWorkerSueldo),
      };

      if (creatingWorkerId) {
        // Actualizar trabajador existente
        const { error } = await supabase
          .from("workers")
          .update(payload)
          .eq("id", creatingWorkerId);
        
        if (error) {
          console.error("Error persisting new worker changes:", error);
          if (error.code === "23505" || error.message?.includes("idx_workers_cedula")) {
            throw new Error("Ya existe otro trabajador con esta cédula. Por favor, verifica la información.");
          }
          throw error;
        }

        // Actualizar el estado local
        setWorkers((prev) => {
          const updated = prev.map((current) => 
            current.id === creatingWorkerId ? { ...current, ...payload } : current
          );
          return updated;
        });
      } else {
        // Crear nuevo trabajador borrador
        const { data: workerData, error: insertError } = await supabase
          .from("workers")
          .insert(payload)
          .select()
          .single();

        if (insertError) {
          if (insertError.code === "23505" || insertError.message?.includes("idx_workers_cedula")) {
            throw new Error("Ya existe un trabajador con esta cédula. Por favor, verifica la información.");
          }
          throw insertError;
        }

        if (workerData) {
          setCreatingWorkerId(workerData.id);
          // Actualizar el estado local
          setWorkers((prev) => {
            const exists = prev.find((w) => w.id === workerData.id);
            if (exists) {
              return prev.map((w) => (w.id === workerData.id ? workerData : w));
            }
            return [workerData, ...prev];
          });
        }
      }
    },
    [creatingWorkerId, newWorkerFirstName, newWorkerLastName, newWorkerCedula, newWorkerFechaNacimiento, newWorkerFechaIngreso, newWorkerEps, newWorkerArl, newWorkerCargo, newWorkerSueldo],
  );

  const handleEditWorker = async () => {
    if (!editingWorker || !editingWorker.first_name.trim() || !editingWorker.last_name.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa nombre y apellido.",
        variant: "destructive",
      });
      return;
    }

    try {
      await persistWorkerChanges(editingWorker);

      let photoUrl: string | null = null;
      if (editingWorkerPhoto && editingWorker) {
        try {
          photoUrl = await uploadWorkerPhoto(editingWorkerPhoto, editingWorker.id);
          await supabase
            .from("workers")
            .update({ photo_url: photoUrl })
            .eq("id", editingWorker.id);
        } catch (photoError) {
          console.warn("Error uploading worker photo:", photoError);
          toast({
            title: "Advertencia",
            description: "No se pudo actualizar la foto del trabajador.",
            variant: "default",
          });
        }
      }

      // Actualizar el estado local INMEDIATAMENTE - SIMPLE Y DIRECTO
      const workerId = editingWorker.id;
      const updatedWorker: Worker = {
        ...editingWorker,
        first_name: editingWorker.first_name.trim(),
        last_name: editingWorker.last_name.trim(),
        cedula: editingWorker.cedula?.trim() || null,
        fecha_nacimiento: editingWorker.fecha_nacimiento || null,
        fecha_ingreso: editingWorker.fecha_ingreso || null,
        eps: editingWorker.eps?.trim() || null,
        arl: editingWorker.arl?.trim() || null,
        cargo: editingWorker.cargo?.trim() || null,
        sueldo: editingWorker.sueldo ?? null,
        photo_url: photoUrl || editingWorker.photo_url || null,
      };
      
      setWorkers((prev) => {
        return prev.map((w) => (w.id === workerId ? updatedWorker : w));
      });
      
      toast({
        title: "Trabajador actualizado",
        description: "El trabajador fue actualizado correctamente.",
      });
      
      // Resetear estados de edición
      resetEditingForm();
    } catch (error: any) {
      console.error("Error updating worker:", error);
      const errorMessage = error.message || "No se pudo actualizar el trabajador.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      // No resetear el formulario si hay error, para que el usuario pueda corregir
    }
  };

  const calculateAge = (fechaNacimiento: string | null): number | null => {
    if (!fechaNacimiento) return null;
    const birthDate = new Date(fechaNacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewWorkerPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewWorkerPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditingPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditingWorkerPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingWorkerPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetEditingForm = () => {
    setEditingWorker(null);
    setEditingWorkerPhoto(null);
    setEditingWorkerPhotoPreview(null);
    setIsAutoSaving(false);
    setAutoSaveError(null);
    setLastAutoSavedAt(null);
    clearAutoSaveTimer();
  };

  useEffect(() => {
    if (!editingWorker?.id) {
      clearAutoSaveTimer();
      setIsAutoSaving(false);
      return;
    }

    // Prevenir múltiples timers
    clearAutoSaveTimer();
    
    const timerId = window.setTimeout(async () => {
      setIsAutoSaving(true);
      setAutoSaveError(null);
      try {
        await persistWorkerChanges(editingWorker);
        const savedAt = new Date();
        setLastAutoSavedAt(savedAt);
        setAutoSaveError(null);
      } catch (error: any) {
        console.error("Error auto guardando trabajador:", error);
        const errorMessage = error.message || "No se pudo guardar automáticamente.";
        setAutoSaveError(errorMessage);
        setLastAutoSavedAt(null);
        // Si es un error de cédula duplicada, no mostrar toast (se mostrará al guardar manualmente)
        if (!errorMessage.includes("cédula")) {
          toast({
            title: "Error en autoguardado",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        // Resetear el estado de guardado después de un breve delay
        setTimeout(() => {
          setIsAutoSaving(false);
        }, 300);
      }
    }, 2000); // Aumentado a 2 segundos para evitar demasiadas llamadas

    autoSaveTimerRef.current = timerId;

    return () => {
      clearAutoSaveTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editingWorker?.id,
    editingWorker?.first_name,
    editingWorker?.last_name,
    editingWorker?.cedula,
    editingWorker?.fecha_nacimiento,
    editingWorker?.fecha_ingreso,
    editingWorker?.eps,
    editingWorker?.arl,
    editingWorker?.cargo,
    editingWorker?.sueldo,
    // No incluir persistWorkerChanges para evitar re-renders innecesarios
  ]);

  // Autoguardado para nuevo trabajador
  useEffect(() => {
    if (!showAddWorker) {
      clearAutoSaveNewWorkerTimer();
      setIsAutoSavingNewWorker(false);
      return;
    }

    // Prevenir múltiples timers
    clearAutoSaveNewWorkerTimer();
    
    const timerId = window.setTimeout(async () => {
      // Si no hay nombre ni apellido, no autoguardar todavía
      if (!newWorkerFirstName.trim() && !newWorkerLastName.trim()) {
        return;
      }

      setIsAutoSavingNewWorker(true);
      setAutoSaveErrorNewWorker(null);
      try {
        await persistNewWorkerChanges();
        const savedAt = new Date();
        setLastAutoSavedAtNewWorker(savedAt);
        setAutoSaveErrorNewWorker(null);
      } catch (error: any) {
        console.error("Error auto guardando nuevo trabajador:", error);
        const errorMessage = error.message || "No se pudo guardar automáticamente.";
        setAutoSaveErrorNewWorker(errorMessage);
        setLastAutoSavedAtNewWorker(null);
        // Si es un error de cédula duplicada, no mostrar toast (se mostrará al guardar manualmente)
        if (!errorMessage.includes("cédula")) {
          toast({
            title: "Error en autoguardado",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        // Resetear el estado de guardado después de un breve delay
        setTimeout(() => {
          setIsAutoSavingNewWorker(false);
        }, 300);
      }
    }, 2000); // 2 segundos de delay para evitar demasiadas llamadas

    autoSaveNewWorkerTimerRef.current = timerId;

    return () => {
      clearAutoSaveNewWorkerTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showAddWorker,
    newWorkerFirstName,
    newWorkerLastName,
    newWorkerCedula,
    newWorkerFechaNacimiento,
    newWorkerFechaIngreso,
    newWorkerEps,
    newWorkerArl,
    newWorkerCargo,
    newWorkerSueldo,
    // No incluir persistNewWorkerChanges para evitar re-renders innecesarios
  ]);

  const openEditWorker = (worker: Worker) => {
    // Crear una copia profunda del trabajador para evitar mutaciones
    const workerCopy = {
      ...worker,
      first_name: worker.first_name || "",
      last_name: worker.last_name || "",
      cedula: worker.cedula || "",
      fecha_nacimiento: worker.fecha_nacimiento || "",
      fecha_ingreso: worker.fecha_ingreso || "",
      eps: worker.eps || "",
      arl: worker.arl || "",
      cargo: worker.cargo || "",
      sueldo: worker.sueldo || null,
      photo_url: worker.photo_url || null,
    };
    setEditingWorker(workerCopy);
    setEditingWorkerPhotoPreview(worker.photo_url || null);
    setEditingWorkerPhoto(null);
    setIsAutoSaving(false);
    setAutoSaveError(null);
    setLastAutoSavedAt(null);
  };

  const handleDeleteWorker = async (workerId: string) => {
    try {
      const { error } = await supabase.from("workers").delete().eq("id", workerId);

      if (error) throw error;

      toast({
        title: "Trabajador eliminado",
        description: "El trabajador fue eliminado correctamente.",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error deleting worker:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el trabajador.",
        variant: "destructive",
      });
    }
  };

  const uploadPhoto = async (file: File, type: "entry" | "exit"): Promise<string> => {
    // Verificar sesión antes de intentar subir
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      // Si no hay sesión, intentar refrescar
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshedSession) {
        console.error("Error de autenticación:", refreshError);
        toast({
          title: "Sesión expirada",
          description: "Por favor, inicia sesión nuevamente.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 100);
        throw new Error("Sesión expirada");
      }
    }

    const today = toDateKey(new Date());
    const timestamp = Date.now();
    const fileName = `${selectedWorkerId}/${today}/${type}_${timestamp}_${sanitizeFileName(file.name)}`;
    const storagePath = encodeStoragePath(fileName);

    try {
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        // Si es un error de autenticación, redirigir al login
        if (uploadError.message?.includes("JWT") || uploadError.message?.includes("token") || uploadError.message?.includes("session")) {
          console.error("Error de autenticación al subir foto:", uploadError);
          toast({
            title: "Sesión expirada",
            description: "Por favor, inicia sesión nuevamente.",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = "/auth";
          }, 100);
          throw new Error("Sesión expirada");
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
      return data.publicUrl;
    } catch (error: any) {
      // Manejar errores de autenticación
      if (error?.message?.includes("JWT") || error?.message?.includes("token") || error?.message?.includes("session") || error?.message?.includes("Refresh Token")) {
        console.error("Error de autenticación:", error);
        toast({
          title: "Sesión expirada",
          description: "Por favor, inicia sesión nuevamente.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 100);
        throw new Error("Sesión expirada");
      }
      throw error;
    }
  };

  // Get today's date key dynamically (using local timezone)
  const getTodayDateKey = () => toDateKey(new Date());

  // Función para eliminar duplicados de registros de asistencia
  const removeDuplicateRecords = useCallback((records: AttendanceRecord[]): AttendanceRecord[] => {
    const seen = new Map<string, AttendanceRecord>();
    
    records.forEach((record) => {
      // Clave única: worker_id + date
      const key = `${record.worker_id}_${record.date}`;
      
      // Si ya existe, mantener el que tenga ID o el más reciente
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, record);
      } else if (record.id && (!existing.id || record.id > existing.id)) {
        // Mantener el registro con ID más reciente o el que tenga más información
        seen.set(key, record);
      }
    });
    
    return Array.from(seen.values());
  }, []);

  // Función helper para actualizar attendanceRecords de manera segura
  const updateAttendanceRecord = useCallback((newRecord: AttendanceRecord) => {
    setAttendanceRecords((prev) => {
      // Crear un mapa para evitar duplicados de manera eficiente
      const recordMap = new Map<string, AttendanceRecord>();
      const updateKey = `${newRecord.worker_id}_${newRecord.date}`;
      
      // Primero agregar todos los registros existentes (excepto el que se está actualizando)
      prev.forEach((r) => {
        const key = `${r.worker_id}_${r.date}`;
        if (key !== updateKey) {
          // Mantener el registro existente solo si no es el que se está actualizando
          recordMap.set(key, r);
        }
      });
      
      // Agregar el registro actualizado (sobrescribe si existe)
      recordMap.set(updateKey, newRecord);
      
      // Convertir el mapa a array - el mapa ya garantiza que no haya duplicados
      return Array.from(recordMap.values());
    });
  }, []);

  const todaysRecordForSelectedWorker = useMemo(() => {
    if (!selectedWorkerId) return null;
    const todayKey = getTodayDateKey();
    const record = attendanceRecords.find((record) => {
      // Normalize both dates to YYYY-MM-DD format for comparison (using local timezone)
      const recordDateStr = record.date ? normalizeDateToKey(record.date) : null;
      return record.worker_id === selectedWorkerId && recordDateStr === todayKey;
    });
    return record;
  }, [attendanceRecords, selectedWorkerId]);

  const weeklyTotals = useMemo(() => {
    const totals: Record<string, { normal: number; extra: number; total: number }> = {};
    attendanceRecords.forEach((record) => {
      const key = record.worker_id;
      const stats = computeRecordHours(record);
      if (!totals[key]) {
        totals[key] = { normal: 0, extra: 0, total: 0 };
      }
      totals[key].normal += stats.normalMinutes;
      totals[key].extra += stats.extraMinutes;
      totals[key].total += stats.totalMinutes;
    });
    return totals;
  }, [attendanceRecords]);

  // Only disable entry button if there's a complete entry record (with photo)
  const entryButtonDisabled =
    !selectedWorkerId ||
    uploadingEntry ||
    uploadingExit ||
    (!!todaysRecordForSelectedWorker?.entry_time && !!todaysRecordForSelectedWorker?.entry_photo_url);
  
  // Only disable exit button if there's a complete exit record (with photo) or no entry
  const exitButtonDisabled =
    !selectedWorkerId ||
    uploadingEntry ||
    uploadingExit ||
    !todaysRecordForSelectedWorker?.entry_time ||
    (!!todaysRecordForSelectedWorker?.exit_time && !!todaysRecordForSelectedWorker?.exit_photo_url);

  const getEntryTimeLabel = () => {
    if (!todaysRecordForSelectedWorker?.entry_time) return null;
    return formatTime(todaysRecordForSelectedWorker.entry_time);
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const handlePhotoUpload = async (type: "entry" | "exit") => {
    // Prevenir múltiples llamadas simultáneas
    if (uploadingEntry || uploadingExit) {
      return;
    }

    if (!selectedWorkerId) {
      toast({
        title: "Error",
        description: "Por favor selecciona un trabajador.",
        variant: "destructive",
      });
      return;
    }

    // Validar que selectedWorkerId sea válido
    if (!selectedWorkerId.trim()) {
      console.error("selectedWorkerId is empty or invalid");
      return;
    }

    const todayDate = new Date();
    if (type === "entry" && isHoliday(todayDate)) {
      toast({
        title: "Feriado",
        description: "No se permiten registros de entrada en días festivos.",
        variant: "destructive",
      });
      return;
    }

    // Only prevent entry if there's a complete entry record with photo
    if (type === "entry" && todaysRecordForSelectedWorker?.entry_time && todaysRecordForSelectedWorker?.entry_photo_url) {
      toast({
        title: "Entrada ya registrada",
        description: "La foto de entrada ya existe para hoy y no se puede reemplazar desde aquí.",
        variant: "destructive",
      });
      return;
    }

    // Only prevent exit if there's no entry record
    if (type === "exit" && !todaysRecordForSelectedWorker?.entry_time) {
      toast({
        title: "Registra la entrada primero",
        description: "Debe existir una foto de entrada antes de subir la salida.",
        variant: "destructive",
      });
      return;
    }

    // Prevent exit if exit is already complete
    if (type === "exit" && todaysRecordForSelectedWorker?.exit_time && todaysRecordForSelectedWorker?.exit_photo_url) {
      toast({
        title: "Salida ya registrada",
        description: "La foto de salida ya existe para hoy y no se puede reemplazar desde aquí.",
        variant: "destructive",
      });
      return;
    }

    // Usar un try-catch global para capturar cualquier error que pueda romper el renderizado
    let input: HTMLInputElement | null = null;
    let inputRemoved = false;
    
    try {
      // Crear el input fuera del DOM de React para evitar conflictos
      input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment"; // Use camera on mobile
      input.style.position = "fixed";
      input.style.top = "-9999px";
      input.style.left = "-9999px";
      input.style.opacity = "0";
      input.style.pointerEvents = "none";

      // Limpiar el input cuando se cierre el diálogo (por si acaso)
      const cleanup = () => {
        if (inputRemoved || !input) return;
        inputRemoved = true;
        isFileInputOpenRef.current = false;
        try {
          // Verificar que el input todavía existe y está en el DOM antes de removerlo
          if (input && input.parentNode && document.body.contains(input)) {
            input.parentNode.removeChild(input);
          } else if (input && input.parentNode) {
            // Intentar remover solo si tiene parentNode
            try {
              input.parentNode.removeChild(input);
            } catch (e) {
              // Ignorar si ya fue removido
            }
          }
          input = null;
        } catch (e) {
          // Ignorar errores de limpieza - el nodo ya fue removido
          input = null;
        }
      };

      input.onchange = async (e) => {
        try {
          isFileInputOpenRef.current = false;
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            cleanup();
            return;
          }

          if (type === "entry") {
            setUploadingEntry(true);
          } else {
            setUploadingExit(true);
          }

          try {
            // Validar que selectedWorkerId todavía sea válido
            if (!selectedWorkerId || !selectedWorkerId.trim()) {
              throw new Error("ID de trabajador inválido");
            }

            // Verificar sesión antes de continuar - sin bloquear
            try {
              const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
              if (sessionError && !sessionError.message?.includes("Refresh Token")) {
                // Solo redirigir si NO es un error de refresh token
                console.error("Error de sesión:", sessionError);
                toast({
                  title: "Sesión expirada",
                  description: "Por favor, inicia sesión nuevamente.",
                  variant: "destructive",
                });
                setTimeout(() => {
                  window.location.href = "/auth";
                }, 100);
                return;
              }
              if (!currentSession && !sessionError?.message?.includes("Refresh Token")) {
                toast({
                  title: "Sesión expirada",
                  description: "Por favor, inicia sesión nuevamente.",
                  variant: "destructive",
                });
                setTimeout(() => {
                  window.location.href = "/auth";
                }, 100);
                return;
              }
            } catch (sessionCheckError) {
              // Ignorar errores de verificación de sesión - continuar
              console.warn("Error al verificar sesión, continuando:", sessionCheckError);
            }

            const photoUrl = await uploadPhoto(file, type);
            const today = toDateKey(new Date());
            const now = new Date().toISOString();

            // Check if record exists for today
            const { data: existingRecords, error: queryError } = await supabase
              .from("attendance_records")
              .select("*")
              .eq("worker_id", selectedWorkerId)
              .eq("date", today);

            if (queryError) {
              // Si es un error de autenticación (pero NO refresh token), redirigir al login
              if (queryError.message?.includes("JWT") || queryError.message?.includes("token") || queryError.message?.includes("session")) {
                if (!queryError.message?.includes("Refresh Token")) {
                  console.error("Error de autenticación al consultar registros:", queryError);
                  toast({
                    title: "Sesión expirada",
                    description: "Por favor, inicia sesión nuevamente.",
                    variant: "destructive",
                  });
                  setTimeout(() => {
                    window.location.href = "/auth";
                  }, 100);
                  return;
                }
              }
              if (queryError.code !== "PGRST116") {
                throw queryError;
              }
            }

            const existingRecord = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

            if (existingRecord) {
              // Update existing record - preserve existing data
              const updateData: any = {};
              
              // If we're updating entry, set entry fields (overwrite existing)
              if (type === "entry") {
                updateData.entry_time = now;
                updateData.entry_photo_url = photoUrl;
                // Preserve existing exit data
                updateData.exit_time = existingRecord.exit_time || null;
                updateData.exit_photo_url = existingRecord.exit_photo_url || null;
              }
              // If we're updating exit, set exit fields (overwrite existing)
              if (type === "exit") {
                updateData.exit_time = now;
                updateData.exit_photo_url = photoUrl;
                // Preserve existing entry data
                updateData.entry_time = existingRecord.entry_time || null;
                updateData.entry_photo_url = existingRecord.entry_photo_url || null;
              }

              const { data: updatedData, error } = await supabase
                .from("attendance_records")
                .update(updateData)
                .eq("id", existingRecord.id)
                .select();

              if (error) {
                // Si es un error de autenticación (pero NO refresh token), redirigir al login
                if (error.message?.includes("JWT") || error.message?.includes("token") || error.message?.includes("session")) {
                  if (!error.message?.includes("Refresh Token")) {
                    console.error("Error de autenticación:", error);
                    toast({
                      title: "Sesión expirada",
                      description: "Por favor, inicia sesión nuevamente.",
                      variant: "destructive",
                    });
                    setTimeout(() => {
                      window.location.href = "/auth";
                    }, 100);
                    return;
                  }
                }
                throw error;
              }
              // Actualizar estado usando función anti-duplicados
              if (updatedData && updatedData[0]) {
                const updatedRecord = updatedData[0] as unknown as AttendanceRecord;
                // Usar función helper para actualizar de manera segura
                updateAttendanceRecord(updatedRecord);
              } else {
                // Si no hay datos actualizados, mostrar error
                console.error("No se recibieron datos actualizados de la base de datos");
                toast({
                  title: "Error",
                  description: "No se pudo actualizar el registro. Intenta nuevamente.",
                  variant: "destructive",
                });
              }
            } else {
              // Create new record
              const newRecord = {
                worker_id: selectedWorkerId,
                date: today,
                entry_time: type === "entry" ? now : null,
                exit_time: type === "exit" ? now : null,
                entry_photo_url: type === "entry" ? photoUrl : null,
                exit_photo_url: type === "exit" ? photoUrl : null,
              };
              const { data: insertedData, error } = await supabase
                .from("attendance_records")
                .insert(newRecord)
                .select();

              if (error) {
                // Si es un error de autenticación (pero NO refresh token), redirigir al login
                if (error.message?.includes("JWT") || error.message?.includes("token") || error.message?.includes("session")) {
                  if (!error.message?.includes("Refresh Token")) {
                    console.error("Error de autenticación:", error);
                    toast({
                      title: "Sesión expirada",
                      description: "Por favor, inicia sesión nuevamente.",
                      variant: "destructive",
                    });
                    setTimeout(() => {
                      window.location.href = "/auth";
                    }, 100);
                    return;
                  }
                }
                throw error;
              }
              // Actualizar estado usando función anti-duplicados
              if (insertedData && insertedData[0]) {
                const newRecord = insertedData[0] as unknown as AttendanceRecord;
                // Usar función helper para actualizar de manera segura
                updateAttendanceRecord(newRecord);
              } else {
                // Si no hay datos insertados, mostrar error
                console.error("No se recibieron datos insertados de la base de datos");
                toast({
                  title: "Error",
                  description: "No se pudo crear el registro. Intenta nuevamente.",
                  variant: "destructive",
                });
              }
            }

            // Mostrar toast - el estado ya se actualizó arriba
            toast({
              title: type === "entry" ? "Entrada registrada" : "Salida registrada",
              description: `La ${type === "entry" ? "entrada" : "salida"} fue registrada correctamente.`,
            });
          } catch (error: any) {
            console.error(`Error uploading ${type} photo:`, error);
            toast({
              title: "Error",
              description: error.message || `No se pudo registrar la ${type === "entry" ? "entrada" : "salida"}.`,
              variant: "destructive",
            });
          } finally {
            // Resetear estados de carga ANTES de limpiar - CRÍTICO
            if (type === "entry") {
              setUploadingEntry(false);
            } else {
              setUploadingExit(false);
            }
            // Resetear el flag de actualización
            isUpdatingRecordsRef.current = false;
            // Limpiar después de un pequeño delay para asegurar que el evento se complete
            setTimeout(() => {
              cleanup();
            }, 100);
          }
        } catch (error: any) {
          console.error("Error in file input onchange:", error);
          cleanup();
          if (type === "entry") {
            setUploadingEntry(false);
          } else {
            setUploadingExit(false);
          }
        }
      };

      // Manejar el caso cuando el usuario cancela el diálogo
      input.oncancel = () => {
        cleanup();
      };

      // Marcar que el selector de archivos está abierto
      isFileInputOpenRef.current = true;

      // Agregar el input al DOM temporalmente para que funcione correctamente
      // Usar un contenedor oculto para evitar conflictos con React
      if (input) {
        try {
          document.body.appendChild(input);
        } catch (appendError) {
          console.error("Error agregando input al DOM:", appendError);
          input = null;
          isFileInputOpenRef.current = false;
          toast({
            title: "Error",
            description: "No se pudo crear el selector de archivos. Por favor, intenta nuevamente.",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Usar requestAnimationFrame para asegurar que el DOM esté listo
      requestAnimationFrame(() => {
        try {
          if (!inputRemoved && input && input.parentNode) {
            input.click();
          } else if (!inputRemoved) {
            cleanup();
          }
        } catch (clickError) {
          console.error("Error clicking input:", clickError);
          cleanup();
          toast({
            title: "Error",
            description: "No se pudo abrir el selector de archivos. Por favor, intenta nuevamente.",
            variant: "destructive",
          });
        }
      });
      
      // Limpiar después de un tiempo si no se selecciona archivo
      setTimeout(() => {
        if (!inputRemoved && isFileInputOpenRef.current && input) {
          cleanup();
        }
      }, 2000);
    } catch (error: any) {
      console.error("Error creating file input:", error);
      isFileInputOpenRef.current = false;
      if (input && !inputRemoved) {
        try {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        } catch (cleanupError) {
          // Ignorar errores de limpieza
        }
        input = null;
      }
      toast({
        title: "Error",
        description: "No se pudo crear el selector de archivos. Por favor, intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId);
    return worker ? `${worker.first_name} ${worker.last_name}` : "Desconocido";
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-";
    const date = new Date(timeString);
    return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPeso = (value?: number | null) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const parsePesoInput = (value: string) => {
    if (!value) return null;
    const numeric = value.replace(/[^\d]/g, "");
    return numeric ? Number(numeric) : null;
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-CO", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const isHolidayDate = (dateString: string) => HOLIDAYS.includes(dateString);

  // Get start and end dates based on filter - usar useMemo para evitar recalcular
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case "week": {
        const start = new Date(today);
        const dayOfWeek = start.getDay();
        const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Sunday
        return { start, end };
      }
      case "month": {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start, end };
      }
      default:
        return { start: null, end: null };
    }
  }, [dateFilter]);

  // Eliminar duplicados antes de filtrar - usar función dedicada
  // Usar un useMemo con una función de comparación más estricta para evitar renders innecesarios
  const uniqueAttendanceRecords = useMemo(() => {
    const deduplicated = removeDuplicateRecords(attendanceRecords);
    return deduplicated;
  }, [attendanceRecords, removeDuplicateRecords]);

  // Filter attendance records - usar useMemo para evitar recalcular en cada render
  const filteredRecords = useMemo(() => {
    return uniqueAttendanceRecords.filter((record) => {
      // Filter by worker
      if (selectedWorkerFilter !== "all" && record.worker_id !== selectedWorkerFilter) {
        return false;
      }

      // Filter by date
      if (dateFilter === "all") {
        return true;
      }

      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      const { start, end } = dateRange;

      if (!start || !end) return true;

      return recordDate >= start && recordDate <= end;
    });
  }, [uniqueAttendanceRecords, selectedWorkerFilter, dateFilter]);

  // Group records by date - SIMPLE
  // Usar useMemo para evitar recalcular en cada render
  const groupedByDate = useMemo(() => {
    return filteredRecords.reduce((acc, record) => {
      const dateKey = record.date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(record);
      return acc;
    }, {} as Record<string, AttendanceRecord[]>);
  }, [filteredRecords]);

  // Sort dates descending - usar useMemo para evitar recalcular en cada render
  const sortedDates = useMemo(() => {
    return Object.keys(groupedByDate).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedByDate]);

  // Calculate weekly summary
  const weeklySummary = useMemo(() => {
    const { start, end } = dateRange;
    if (!start || !end || dateFilter !== "week") return null;

    const weekRecords = attendanceRecords.filter((record) => {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate >= start && recordDate <= end;
    });

    const byWorker = weekRecords.reduce((acc, record) => {
      if (!acc[record.worker_id]) {
        acc[record.worker_id] = { entries: 0, exits: 0, days: new Set() };
      }
      if (record.entry_time) {
        acc[record.worker_id].entries++;
        acc[record.worker_id].days.add(record.date);
      }
      if (record.exit_time) {
        acc[record.worker_id].exits++;
      }
      return acc;
    }, {} as Record<string, { entries: number; exits: number; days: Set<string> }>);

    return byWorker;
  }, [attendanceRecords, dateRange, dateFilter]);

  const summary = weeklySummary;

  // Get week days (Monday to Sunday) - usar useMemo para evitar recalcular
  const weekDays = useMemo(() => {
    const { start } = dateRange;
    if (!start) return [];
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    return days;
  }, [dateRange]);

  // Get records for a specific worker and date
  const getRecordForWorkerAndDate = (workerId: string, date: Date) => {
    const dateStr = toDateKey(date);
    // Search directly in attendanceRecords to avoid filtering issues
    const record = attendanceRecords.find((r) => {
      // Normalize record date to YYYY-MM-DD format for comparison (using local timezone)
      const recordDateStr = r.date ? normalizeDateToKey(r.date) : null;
      return r.worker_id === workerId && recordDateStr === dateStr;
    });
    return record;
  };

  // Timeout de seguridad: si initialLoading está en true por más de 15 segundos, resetearlo
  useEffect(() => {
    if (initialLoading) {
      const safetyTimeout = setTimeout(() => {
        console.warn("Initial loading timeout - forcing reset");
        setInitialLoading(false);
        initialLoadRef.current = false;
      }, 15000);
      return () => clearTimeout(safetyTimeout);
    }
  }, [initialLoading]);

  // Solo mostrar pantalla de carga durante la carga inicial
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-industrial">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => {
                // Limpiar estados y forzar navegación completa
                clearAutoSaveTimer();
                // Usar window.location.href para forzar una recarga completa y evitar problemas de renderizado
                window.location.href = "/home";
              }} 
              variant="outline" 
              size="icon"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-1">Control entrada/salida</h1>
              <p className="text-muted-foreground">
                Gestión de horarios de entrada y salida de trabajadores
              </p>
            </div>
          </div>
        </div>

        {/* Worker Management */}
        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <h2 className="text-2xl font-semibold">Trabajadores</h2>
            <Dialog 
              open={showAddWorker} 
              onOpenChange={(open) => {
                setShowAddWorker(open);
                if (!open) {
                  // Limpiar estado cuando se cierre el diálogo
                  if (creatingWorkerId) {
                    // Si hay un trabajador borrador sin nombre/apellido válidos, eliminarlo
                    const worker = workers.find(w => w.id === creatingWorkerId);
                    if (worker && (!worker.first_name || worker.first_name === "Nuevo" || !worker.last_name || worker.last_name === "Trabajador")) {
                      // Eliminar trabajador borrador vacío
                      supabase.from("workers").delete().eq("id", creatingWorkerId).then(() => {
                        setWorkers(prev => prev.filter(w => w.id !== creatingWorkerId));
                      }).catch(console.error);
                    }
                  }
                  setNewWorkerFirstName("");
                  setNewWorkerLastName("");
                  setNewWorkerCedula("");
                  setNewWorkerFechaNacimiento("");
                  setNewWorkerFechaIngreso("");
                  setNewWorkerEps("");
                  setNewWorkerArl("");
                  setNewWorkerCargo("");
                  setNewWorkerSueldo("");
                  setNewWorkerPhoto(null);
                  setNewWorkerPhotoPreview(null);
                  setCreatingWorkerId(null);
                  setIsAutoSavingNewWorker(false);
                  setAutoSaveErrorNewWorker(null);
                  setLastAutoSavedAtNewWorker(null);
                  clearAutoSaveNewWorkerTimer();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agregar Trabajador
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Agregar Trabajador - Hoja de Vida</DialogTitle>
                  <DialogDescription>
                    Completa la información del trabajador. Los cambios se guardan automáticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Photo Upload */}
                  <div>
                    <Label>Foto del Trabajador</Label>
                    <div className="mt-2 flex items-center gap-4">
                      {newWorkerPhotoPreview ? (
                        <img
                          src={newWorkerPhotoPreview}
                          alt="Preview"
                          className="w-24 h-24 rounded-full object-cover border-2"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2">
                          <UserPlus className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Formatos: JPG, PNG (máx. 5MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">Nombre *</Label>
                      <Input
                        id="firstName"
                        value={newWorkerFirstName}
                        onChange={(e) => setNewWorkerFirstName(e.target.value)}
                        placeholder="Nombre"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Apellido *</Label>
                      <Input
                        id="lastName"
                        value={newWorkerLastName}
                        onChange={(e) => setNewWorkerLastName(e.target.value)}
                        placeholder="Apellido"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cedula">Cédula</Label>
                    <Input
                      id="cedula"
                      value={newWorkerCedula}
                      onChange={(e) => setNewWorkerCedula(e.target.value)}
                      placeholder="Número de cédula"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
                      <Input
                        id="fechaNacimiento"
                        type="date"
                        value={newWorkerFechaNacimiento}
                        onChange={(e) => setNewWorkerFechaNacimiento(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fechaIngreso">Fecha de Ingreso</Label>
                      <Input
                        id="fechaIngreso"
                        type="date"
                        value={newWorkerFechaIngreso}
                        onChange={(e) => setNewWorkerFechaIngreso(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="eps">EPS</Label>
                      <Input
                        id="eps"
                        value={newWorkerEps}
                        onChange={(e) => setNewWorkerEps(e.target.value)}
                        placeholder="Nombre de la EPS"
                      />
                    </div>
                    <div>
                      <Label htmlFor="arl">ARL</Label>
                      <Input
                        id="arl"
                        value={newWorkerArl}
                        onChange={(e) => setNewWorkerArl(e.target.value)}
                        placeholder="Nombre de la ARL"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cargo">Cargo</Label>
                      <Input
                        id="cargo"
                        value={newWorkerCargo}
                        onChange={(e) => setNewWorkerCargo(e.target.value)}
                        placeholder="Ej: Operario, Supervisor..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="sueldo">Sueldo (COP, sin separadores)</Label>
                      <Input
                        id="sueldo"
                        type="text"
                        inputMode="numeric"
                        value={newWorkerSueldo}
                        onChange={(e) => setNewWorkerSueldo(e.target.value)}
                        placeholder="Ej: 2400000"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {autoSaveErrorNewWorker
                      ? autoSaveErrorNewWorker
                      : isAutoSavingNewWorker
                      ? "Guardando automáticamente..."
                      : lastAutoSavedAtNewWorker
                      ? `Guardado automático ${lastAutoSavedAtNewWorker.toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        }).replace(/\./g, "")}`
                      : creatingWorkerId
                      ? "Guardado automático activo"
                      : "Comienza a escribir para activar el autoguardado"}
                  </span>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowAddWorker(false);
                  }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddWorker}>Agregar Trabajador</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {workers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay trabajadores registrados. Agrega uno para comenzar.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workers.map((worker) => (
                <Card key={worker.id} className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    {worker.photo_url ? (
                      <img
                        src={worker.photo_url}
                        alt={`${worker.first_name} ${worker.last_name}`}
                        className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-primary/20">
                        <UserPlus className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {worker.first_name} {worker.last_name}
                      </h3>
                      {worker.cargo && (
                        <p className="text-sm text-muted-foreground capitalize">{worker.cargo}</p>
                      )}
                      {worker.cedula && (
                        <p className="text-sm text-muted-foreground">CC: {worker.cedula}</p>
                      )}
                      {formatPeso(worker.sueldo) && (
                        <p className="text-xs text-muted-foreground">{formatPeso(worker.sueldo)}</p>
                      )}
                      {worker.fecha_ingreso && (
                        <p className="text-xs text-muted-foreground">
                          Ingreso: {new Date(worker.fecha_ingreso).toLocaleDateString("es-CO")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingWorkerProfile(worker)}
                        title="Ver hoja de vida"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditWorker(worker)}
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar trabajador?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminarán todos los registros
                              de asistencia asociados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteWorker(worker.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Edit Worker Dialog */}
        {editingWorker && (
          <Dialog
            open={!!editingWorker}
            onOpenChange={(open) => {
              if (!open) {
                resetEditingForm();
              }
            }}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Trabajador</DialogTitle>
                <DialogDescription>Modifica la información del trabajador.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Foto del Trabajador</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {editingWorkerPhotoPreview ? (
                      <img
                        src={editingWorkerPhotoPreview}
                        alt="Vista previa"
                        className="w-24 h-24 rounded-full object-cover border-2"
                      />
                    ) : editingWorker?.photo_url ? (
                      <img
                        src={editingWorker.photo_url}
                        alt={`${editingWorker.first_name} ${editingWorker.last_name}`}
                        className="w-24 h-24 rounded-full object-cover border-2"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2">
                        <UserPlus className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleEditingPhotoChange}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Reemplaza la foto del trabajador (JPG, PNG, máx. 5MB)
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editFirstName">Nombre *</Label>
                    <Input
                      id="editFirstName"
                      value={editingWorker.first_name}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, first_name: e.target.value })
                      }
                      placeholder="Nombre"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editLastName">Apellido *</Label>
                    <Input
                      id="editLastName"
                      value={editingWorker.last_name}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, last_name: e.target.value })
                      }
                      placeholder="Apellido"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="editCedula">Cédula</Label>
                  <Input
                    id="editCedula"
                    value={editingWorker.cedula || ""}
                    onChange={(e) =>
                      setEditingWorker({ ...editingWorker, cedula: e.target.value })
                    }
                    placeholder="Número de cédula"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editFechaNacimiento">Fecha de Nacimiento</Label>
                    <Input
                      id="editFechaNacimiento"
                      type="date"
                      value={editingWorker.fecha_nacimiento || ""}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, fecha_nacimiento: e.target.value || null })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="editFechaIngreso">Fecha de Ingreso</Label>
                    <Input
                      id="editFechaIngreso"
                      type="date"
                      value={editingWorker.fecha_ingreso || ""}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, fecha_ingreso: e.target.value || null })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editEps">EPS</Label>
                    <Input
                      id="editEps"
                      value={editingWorker.eps || ""}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, eps: e.target.value })
                      }
                      placeholder="Nombre de la EPS"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editArl">ARL</Label>
                    <Input
                      id="editArl"
                      value={editingWorker.arl || ""}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, arl: e.target.value })
                      }
                      placeholder="Nombre de la ARL"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editCargo">Cargo</Label>
                    <Input
                      id="editCargo"
                      value={editingWorker.cargo || ""}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, cargo: e.target.value })
                      }
                      placeholder="Cargo del trabajador"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editSueldo">Sueldo</Label>
                      <Input
                        id="editSueldo"
                        type="text"
                        inputMode="numeric"
                        value={editingWorker.sueldo ?? ""}
                        onChange={(e) =>
                          setEditingWorker({
                            ...editingWorker,
                            sueldo: parsePesoInput(e.target.value ?? ""),
                          })
                        }
                        placeholder="Ej: 2400000"
                      />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {autoSaveError
                    ? autoSaveError
                    : isAutoSaving
                    ? "Guardando automáticamente..."
                    : lastAutoSavedAt
                    ? `Guardado automático ${lastAutoSavedAt.toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      }).replace(/\./g, "")}`
                    : "Guardado automático pendiente"}
                </span>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetEditingForm}>
                  Cancelar
                </Button>
                <Button onClick={handleEditWorker}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* View Worker Profile Dialog */}
        {viewingWorkerProfile && (
          <Dialog open={!!viewingWorkerProfile} onOpenChange={() => setViewingWorkerProfile(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Hoja de Vida - {viewingWorkerProfile.first_name} {viewingWorkerProfile.last_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Photo */}
                <div className="flex justify-center">
                  {viewingWorkerProfile.photo_url ? (
                    <img
                      src={viewingWorkerProfile.photo_url}
                      alt={`${viewingWorkerProfile.first_name} ${viewingWorkerProfile.last_name}`}
                      className="w-32 h-32 rounded-full object-cover border-4 border-primary"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-primary">
                      <UserPlus className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Personal Information */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-4 text-lg">Información Personal</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Nombre</Label>
                      <p className="font-medium">{viewingWorkerProfile.first_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Apellido</Label>
                      <p className="font-medium">{viewingWorkerProfile.last_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cédula</Label>
                      <p className="font-medium">{viewingWorkerProfile.cedula || "No registrada"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Edad</Label>
                      <p className="font-medium">
                        {viewingWorkerProfile.fecha_nacimiento
                          ? `${calculateAge(viewingWorkerProfile.fecha_nacimiento)} años`
                          : "No registrada"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Fecha de Nacimiento</Label>
                      <p className="font-medium">
                        {viewingWorkerProfile.fecha_nacimiento
                          ? new Date(viewingWorkerProfile.fecha_nacimiento).toLocaleDateString("es-CO")
                          : "No registrada"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Fecha de Ingreso</Label>
                      <p className="font-medium">
                        {viewingWorkerProfile.fecha_ingreso
                          ? new Date(viewingWorkerProfile.fecha_ingreso).toLocaleDateString("es-CO")
                          : "No registrada"}
                      </p>
                    </div>
                  <div>
                    <Label className="text-muted-foreground">Cargo</Label>
                    <p className="font-medium">{viewingWorkerProfile.cargo || "No registrado"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Sueldo</Label>
                    <p className="font-medium">
                      {formatPeso(viewingWorkerProfile.sueldo) ?? "No registrado"}
                    </p>
                  </div>
                  </div>
                </Card>

                {/* Health Information */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-4 text-lg">Información de Salud</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">EPS</Label>
                      <p className="font-medium">{viewingWorkerProfile.eps || "No registrada"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">ARL</Label>
                      <p className="font-medium">{viewingWorkerProfile.arl || "No registrada"}</p>
                    </div>
                  </div>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingWorkerProfile(null)}>
                  Cerrar
                </Button>
                <Button onClick={() => {
                  setViewingWorkerProfile(null);
                  openEditWorker(viewingWorkerProfile);
                }}>
                  Editar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Attendance Control */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="workerSelect">Seleccionar Trabajador</Label>
              <select
                id="workerSelect"
                value={selectedWorkerId || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && value !== "no-workers") {
                    setSelectedWorkerId(value);
                  } else {
                    setSelectedWorkerId("");
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Selecciona un trabajador</option>
                {workers.length === 0 ? (
                  <option value="no-workers" disabled>
                    No hay trabajadores disponibles
                  </option>
                ) : (
                  workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </option>
                  ))
                )}
              </select>
              {selectedWorkerId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Trabajador seleccionado: {workers.find(w => w.id === selectedWorkerId)?.first_name} {workers.find(w => w.id === selectedWorkerId)?.last_name}
                </p>
              )}
            </div>
            <div className="flex gap-4">
              <Button
                onClick={() => handlePhotoUpload("entry")}
                disabled={entryButtonDisabled}
                className="flex-1"
                title={entryButtonDisabled ? "Ya registraste la entrada de hoy" : undefined}
              >
                {uploadingEntry ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Registrar Entrada
                  </>
                )}
              </Button>
              <Button
                onClick={() => handlePhotoUpload("exit")}
                disabled={exitButtonDisabled}
                variant="outline"
                className="flex-1"
                title={
                  exitButtonDisabled
                    ? !todaysRecordForSelectedWorker?.entry_time
                      ? "Registra primero una entrada"
                      : "Ya registraste la salida de hoy"
                    : undefined
                }
              >
                {uploadingExit ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Registrar Salida
                  </>
                )}
              </Button>
            </div>
            {todaysRecordForSelectedWorker && (
              <div className="space-y-2 mt-4">
                {todaysRecordForSelectedWorker.entry_time && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Entrada: {getEntryTimeLabel()}
                    </p>
                    {todaysRecordForSelectedWorker.entry_photo_url && (
                      <img
                        src={todaysRecordForSelectedWorker.entry_photo_url}
                        alt="Foto de entrada"
                        className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                        onClick={() => setViewingPhoto(todaysRecordForSelectedWorker.entry_photo_url!)}
                        title="Clic para ver foto completa"
                      />
                    )}
                  </div>
                )}
                {todaysRecordForSelectedWorker.exit_time && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Salida: {formatTime(todaysRecordForSelectedWorker.exit_time)}
                    </p>
                    {todaysRecordForSelectedWorker.exit_photo_url && (
                      <img
                        src={todaysRecordForSelectedWorker.exit_photo_url}
                        alt="Foto de salida"
                        className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                        onClick={() => setViewingPhoto(todaysRecordForSelectedWorker.exit_photo_url!)}
                        title="Clic para ver foto completa"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Attendance Records Table */}
        <Card className="p-6">
          {Object.entries(weeklyTotals).length > 0 && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(weeklyTotals).map(([workerId, totals]) => {
                const worker = workers.find((w) => w.id === workerId);
                return (
                  <Card key={`totals-${workerId}`} className="p-4 bg-muted/70">
                    <p className="text-sm text-muted-foreground">Semana actual</p>
                    <h3 className="font-semibold text-lg">
                      {worker ? `${worker.first_name} ${worker.last_name}` : "Trabajador"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Horas normales: {formatMinutes(totals.normal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Horas extras: {formatMinutes(totals.extra)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total: {formatMinutes(totals.total)}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <h2 className="text-2xl font-semibold">Registros de Asistencia</h2>
            <div className="flex flex-wrap gap-4">
              {/* Worker Filter */}
              <Select value={selectedWorkerFilter} onValueChange={setSelectedWorkerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos los trabajadores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los trabajadores</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Filter */}
              <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as any)}>
                <TabsList>
                  <TabsTrigger value="week">
                    <Calendar className="h-4 w-4 mr-2" />
                    Semana
                  </TabsTrigger>
                  <TabsTrigger value="month">
                    <Calendar className="h-4 w-4 mr-2" />
                    Mes
                  </TabsTrigger>
                  <TabsTrigger value="all">
                    <Filter className="h-4 w-4 mr-2" />
                    Todos
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Weekly Summary */}
          {dateFilter === "week" && summary && Object.keys(summary).length > 0 && (
            <Card className="p-4 mb-6 bg-muted/50">
              <h3 className="font-semibold mb-3">Resumen Semanal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(summary).map(([workerId, data]) => (
                  <div key={workerId} className="p-3 bg-background rounded-lg">
                    <p className="font-medium mb-2">{getWorkerName(workerId)}</p>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">
                        Días trabajados: {data.days.size}
                      </p>
                      <p className="text-muted-foreground">
                        Entradas: {data.entries} | Salidas: {data.exits}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {dateFilter === "week" ? (
            // Vista semanal tipo calendario
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background min-w-[150px]">
                        Trabajador
                      </TableHead>
                      {weekDays.map((day) => (
                      <TableHead
                        key={day.toISOString()}
                        className={`text-center min-w-[120px] ${
                          isHolidayDate(toDateKey(day))
                            ? "bg-destructive/10 text-destructive-foreground"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">
                            {day.toLocaleDateString("es-CO", { weekday: "short" })}
                          </span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {day.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                          </span>
                          {isHolidayDate(toDateKey(day)) && (
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-100 text-destructive">
                              Feriado
                            </span>
                          )}
                        </div>
                      </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedWorkerFilter === "all" ? workers : workers.filter(w => w.id === selectedWorkerFilter)).map((worker) => (
                      <TableRow key={worker.id}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          {worker.first_name} {worker.last_name}
                        </TableCell>
                        {weekDays.map((day) => {
                          const record = getRecordForWorkerAndDate(worker.id, day);
                          return (
                            <TableCell key={day.toISOString()} className="p-2">
                              <div className="flex flex-col gap-1 min-h-[60px]">
                                {/* Entrada */}
                                <div className="flex items-center justify-center p-2 rounded border border-green-200 bg-green-50/50 min-h-[28px]">
                                  {record?.entry_time ? (
                                    <button
                                      onClick={() => record.entry_photo_url && setViewingPhoto(record.entry_photo_url)}
                                      className={`text-sm font-medium ${
                                        record.entry_photo_url
                                          ? "text-green-700 hover:text-green-900 hover:underline cursor-pointer"
                                          : "text-green-700"
                                      }`}
                                      title={record.entry_photo_url ? "Clic para ver foto" : ""}
                                    >
                                      {formatTime(record.entry_time)}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </div>
                                {/* Salida */}
                                <div className="flex items-center justify-center p-2 rounded border border-red-200 bg-red-50/50 min-h-[28px]">
                                  {record?.exit_time ? (
                                    <button
                                      onClick={() => record.exit_photo_url && setViewingPhoto(record.exit_photo_url)}
                                      className={`text-sm font-medium ${
                                        record.exit_photo_url
                                          ? "text-red-700 hover:text-red-900 hover:underline cursor-pointer"
                                          : "text-red-700"
                                      }`}
                                      title={record.exit_photo_url ? "Clic para ver foto" : ""}
                                    >
                                      {formatTime(record.exit_time)}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay registros de asistencia para el filtro seleccionado.
            </p>
          ) : (
            // Vista lista para mes/todos
            <div className="space-y-6">
              {sortedDates.map((date) => {
                const records = groupedByDate[date];
                return (
                  <div key={date} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{formatDate(date)}</h3>
                      {isHolidayDate(date) && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-destructive font-medium">
                          Feriado
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        ({records.length} {records.length === 1 ? "registro" : "registros"})
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Trabajador</TableHead>
                            <TableHead>Hora Entrada</TableHead>
                            <TableHead>Hora Salida</TableHead>
                            <TableHead>Fotos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {getWorkerName(record.worker_id)}
                              </TableCell>
                              <TableCell>
                                {record.entry_time ? (
                                  <button
                                    onClick={() => record.entry_photo_url && setViewingPhoto(record.entry_photo_url)}
                                    className={`text-green-600 font-medium ${
                                      record.entry_photo_url
                                        ? "hover:text-green-800 hover:underline cursor-pointer"
                                        : ""
                                    }`}
                                    title={record.entry_photo_url ? "Clic para ver foto" : ""}
                                  >
                                    {formatTime(record.entry_time)}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {record.exit_time ? (
                                  <button
                                    onClick={() => record.exit_photo_url && setViewingPhoto(record.exit_photo_url)}
                                    className={`text-red-600 font-medium ${
                                      record.exit_photo_url
                                        ? "hover:text-red-800 hover:underline cursor-pointer"
                                        : ""
                                    }`}
                                    title={record.exit_photo_url ? "Clic para ver foto" : ""}
                                  >
                                    {formatTime(record.exit_time)}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {record.entry_photo_url && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setViewingPhoto(record.entry_photo_url!)}
                                      title="Ver foto de entrada"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {record.exit_photo_url && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setViewingPhoto(record.exit_photo_url!)}
                                      title="Ver foto de salida"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {!record.entry_photo_url && !record.exit_photo_url && (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Photo Viewer Dialog */}
        {viewingPhoto && (
          <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Foto</DialogTitle>
              </DialogHeader>
              <div className="relative">
                <img
                  src={viewingPhoto}
                  alt="Foto de asistencia"
                  className="w-full h-auto rounded-lg"
                />
              </div>
              <DialogFooter>
                <Button onClick={() => setViewingPhoto(null)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default TimeControl;

