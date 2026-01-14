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
  entry_latitude: number | null;
  entry_longitude: number | null;
  exit_latitude: number | null;
  exit_longitude: number | null;
  time_adjustment_minutes: number | null; // Ajuste de tiempo: + = trabajó más, - = trabajó menos
  adjustment_note: string | null;          // Nota explicativa del ajuste
  worker?: Worker;
};

type PhotoViewData = {
  url: string;
  latitude: number | null;
  longitude: number | null;
  type: "entry" | "exit";
} | null;

const PHOTO_BUCKET = "attendance-photos";

// Festivos Colombia 2025 y 2026
const HOLIDAYS = [
  // 2025
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  "2025-03-24", // San José
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-06-02", // Ascensión del Señor
  "2025-06-23", // Corpus Christi
  "2025-06-30", // Sagrado Corazón
  "2025-07-20", // Independencia
  "2025-08-07", // Batalla de Boyacá
  "2025-08-18", // Asunción de la Virgen
  "2025-10-13", // Día de la Raza
  "2025-11-03", // Todos los Santos
  "2025-11-17", // Independencia de Cartagena
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad
  // 2026
  "2026-01-01", // Año Nuevo
  "2026-01-12", // Reyes Magos
  "2026-03-23", // San José
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-18", // Ascensión del Señor
  "2026-06-08", // Corpus Christi
  "2026-06-15", // Sagrado Corazón
  "2026-07-20", // Independencia
  "2026-08-07", // Batalla de Boyacá
  "2026-08-17", // Asunción de la Virgen
  "2026-10-12", // Día de la Raza
  "2026-11-02", // Todos los Santos
  "2026-11-16", // Independencia de Cartagena
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
];

// Horario laboral de la empresa
// Lunes a Viernes: 8am - 12pm y 1pm - 5pm (8 horas con 1 hora almuerzo)
// Sábado: 8am - 12pm (4 horas)
// Domingo: No se trabaja
const SCHEDULE_BY_DAY: Record<string, { start: string; end: string }[]> = {
  "0": [], // Domingo - no se trabaja
  "1": [   // Lunes
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "2": [   // Martes
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "3": [   // Miércoles
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "4": [   // Jueves
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "5": [   // Viernes
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
  "6": [{ start: "08:00", end: "12:00" }], // Sábado
};

// Constantes de legislación laboral colombiana
const MONTHLY_WORK_HOURS = 220; // Intensidad laboral mensual en Colombia

// Recargos según ley colombiana (porcentajes sobre hora ordinaria)
const SURCHARGES = {
  EXTRA_DIURNA: 0.25,           // 25% - Hora extra diurna (solo en rangos 6-8am y 5-7pm)
  EXTRA_NOCTURNA: 0.75,         // 75% - Hora extra nocturna (7pm-6am)
  RECARGO_NOCTURNO: 0.35,       // 35% - Recargo por trabajo nocturno ordinario
  DOMINICAL_FESTIVO: 0.80,      // 80% - Recargo dominical o festivo
  EXTRA_DIURNA_DOMINICAL: 1.15, // 115% - Hora extra diurna dominical/festivo (solo en rangos 6-8am y 5-7pm)
  EXTRA_NOCTURNA_DOMINICAL: 1.65, // 165% - Hora extra nocturna dominical/festivo
};

// Horario nocturno: 7pm (19:00) a 6am (06:00)
const NIGHT_START_HOUR = 19; // 7 PM
const NIGHT_END_HOUR = 6;    // 6 AM

// Tipo para el desglose detallado de horas
type HoursBreakdown = {
  // Minutos trabajados por tipo
  normalMinutes: number;           // Horas ordinarias dentro del horario laboral (8am-5pm)
  extraDiurnaMinutes: number;      // Horas extra diurnas (solo en rangos 6-8am y 5-7pm) días normales
  extraNocturnaMinutes: number;    // Horas extra nocturnas (7pm-6am) días normales
  recargoNocturnoMinutes: number;  // Minutos con recargo nocturno (trabajo ordinario nocturno)
  dominicalFestivoMinutes: number; // Minutos trabajados en dominical/festivo (horario 8am-5pm)
  extraDiurnaDominicalMinutes: number;   // Horas extra diurnas en dominical/festivo (solo en rangos 6-8am y 5-7pm)
  extraNocturnaDominicalMinutes: number; // Horas extra nocturnas en dominical/festivo
  totalMinutes: number;            // Total de minutos trabajados
};

// Tipo para el cálculo de valores en dinero
type HoursValue = HoursBreakdown & {
  hourlyRate: number;              // Valor hora ordinaria (sueldo / 220)
  normalValue: number;             // Valor horas ordinarias
  extraDiurnaValue: number;        // Valor horas extra diurnas
  extraNocturnaValue: number;      // Valor horas extra nocturnas
  recargoNocturnoValue: number;    // Valor recargo nocturno
  dominicalFestivoValue: number;   // Valor recargo dominical/festivo
  extraDiurnaDominicalValue: number;   // Valor extra diurna dominical
  extraNocturnaDominicalValue: number; // Valor extra nocturna dominical
  totalExtraValue: number;         // Total valor extras y recargos
  totalValue: number;              // Valor total (normal + extras)
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

// Verifica si una fecha es festivo
const isHoliday = (date: Date) => HOLIDAYS.includes(toDateKey(date));

// Verifica si es domingo (día 0)
const isSunday = (date: Date) => date.getDay() === 0;

// Verifica si es domingo o festivo
const isDominicalOrHoliday = (date: Date) => isSunday(date) || isHoliday(date);

// Verifica si una hora específica está en horario nocturno (7pm - 6am)
const isNightHour = (hour: number): boolean => {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
};

// Obtiene los intervalos de trabajo para una fecha
const intervalsForDate = (date: Date) => {
  // En festivos no hay horario laboral normal
  if (isHoliday(date)) return [];
  const day = date.getDay().toString();
  return SCHEDULE_BY_DAY[day] ?? [];
};

const timeStringToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
};

// Calcula los minutos nocturnos dentro de un rango de tiempo
const calculateNightMinutes = (startTime: Date, endTime: Date): number => {
  let nightMinutes = 0;
  const current = new Date(startTime);
  
  while (current < endTime) {
    const hour = current.getHours();
    if (isNightHour(hour)) {
      nightMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  
  return nightMinutes;
};

// Función principal para calcular el desglose de horas de un registro
const computeRecordHours = (record: AttendanceRecord): HoursBreakdown => {
  const entry = record.entry_time ? new Date(record.entry_time) : null;
  const exit = record.exit_time ? new Date(record.exit_time) : null;
  
  const emptyResult: HoursBreakdown = {
    normalMinutes: 0,
    extraDiurnaMinutes: 0,
    extraNocturnaMinutes: 0,
    recargoNocturnoMinutes: 0,
    dominicalFestivoMinutes: 0,
    extraDiurnaDominicalMinutes: 0,
    extraNocturnaDominicalMinutes: 0,
    totalMinutes: 0,
  };
  
  if (!entry || !exit) {
    return emptyResult;
  }

  // Calcular minutos totales trabajados + ajuste de tiempo (si existe)
  const adjustment = typeof record.time_adjustment_minutes === 'number' ? record.time_adjustment_minutes : 0;
  const totalMinutes = Math.max(0, (exit.getTime() - entry.getTime()) / 60000 + adjustment);
  const isDomFestivo = isDominicalOrHoliday(entry);
  const intervals = intervalsForDate(entry);
  
  let normalMinutes = 0;
  let recargoNocturnoMinutes = 0;
  
  // Calcular minutos dentro del horario laboral normal
  intervals.forEach((interval) => {
    const intervalStart = new Date(entry);
    intervalStart.setHours(
      Number(interval.start.split(":")[0]),
      Number(interval.start.split(":")[1]),
      0, 0
    );
    const intervalEnd = new Date(entry);
    intervalEnd.setHours(
      Number(interval.end.split(":")[0]),
      Number(interval.end.split(":")[1]),
      0, 0
    );

    const overlapStart = new Date(Math.max(entry.getTime(), intervalStart.getTime()));
    const overlapEnd = new Date(Math.min(exit.getTime(), intervalEnd.getTime()));

    if (overlapEnd > overlapStart) {
      const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
      normalMinutes += overlapMinutes;
      
      // Calcular recargo nocturno dentro del horario normal (si aplica)
      // Por ejemplo, si el horario normal fuera hasta las 8pm, habría recargo nocturno
      const nightInOverlap = calculateNightMinutes(overlapStart, overlapEnd);
      recargoNocturnoMinutes += nightInOverlap;
    }
  });

  // Minutos extra son los que están fuera del horario normal
  const extraMinutes = Math.max(0, totalMinutes - normalMinutes);
  
  // Calcular minutos nocturnos en las horas extra
  let extraNightMinutes = 0;
  if (extraMinutes > 0) {
    // Calcular nocturnos en todo el período y restar los del horario normal
    const totalNightMinutes = calculateNightMinutes(entry, exit);
    extraNightMinutes = Math.max(0, totalNightMinutes - recargoNocturnoMinutes);
  }
  
  // Calcular minutos en rangos de horas extras diurnas (6-8am y 5-7pm) que están fuera del horario normal
  // Solo estos minutos se cobran como horas extras diurnas
  let extraDiurnaMinutesInRanges = 0;
  const current = new Date(entry);
  while (current < exit) {
    const hour = current.getHours();
    const minute = current.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    // Verificar si está en los rangos de horas extras diurnas (6-8am y 5-7pm)
    const isInRange1 = timeInMinutes >= 360 && timeInMinutes < 480; // 6am - 8am
    const isInRange2 = timeInMinutes >= 1020 && timeInMinutes < 1140; // 5pm - 7pm
    
    if (isInRange1 || isInRange2) {
      // Verificar que este minuto NO está en el horario normal
      let isInNormalSchedule = false;
      intervals.forEach((interval) => {
        const intervalStart = new Date(entry);
        intervalStart.setHours(
          Number(interval.start.split(":")[0]),
          Number(interval.start.split(":")[1]),
          0, 0
        );
        const intervalEnd = new Date(entry);
        intervalEnd.setHours(
          Number(interval.end.split(":")[0]),
          Number(interval.end.split(":")[1]),
          0, 0
        );
        
        if (current >= intervalStart && current < intervalEnd) {
          isInNormalSchedule = true;
        }
      });
      
      // Solo contar si está fuera del horario normal y no es nocturno
      if (!isInNormalSchedule && !isNightHour(hour)) {
        extraDiurnaMinutesInRanges++;
      }
    }
    
    current.setMinutes(current.getMinutes() + 1);
  }
  
  // Las horas extras diurnas son solo las que están en los rangos específicos (6-8am y 5-7pm)
  // y que no son nocturnas
  const extraDiurnaMinutes = extraDiurnaMinutesInRanges;
  
  // Los minutos restantes fuera del horario normal pero fuera de los rangos de extra diurna
  // no se cobran como extra diurna (se consideran como tiempo trabajado pero sin recargo extra)
  const extraDayMinutes = extraDiurnaMinutes;

  // Si es dominical o festivo, todo tiene recargo especial
  if (isDomFestivo) {
    // En días festivos, el horario "normal" conceptual es 8am-5pm (aunque no haya horario laboral)
    // Las horas extras diurnas solo se cobran en 6-8am y 5-7pm
    // Calcular minutos en el horario "normal" conceptual (8am-12pm y 1pm-5pm)
    let normalConceptualMinutes = 0;
    const conceptualIntervals = [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "17:00" }
    ];
    
    conceptualIntervals.forEach((interval) => {
      const intervalStart = new Date(entry);
      intervalStart.setHours(
        Number(interval.start.split(":")[0]),
        Number(interval.start.split(":")[1]),
        0, 0
      );
      const intervalEnd = new Date(entry);
      intervalEnd.setHours(
        Number(interval.end.split(":")[0]),
        Number(interval.end.split(":")[1]),
        0, 0
      );

      const overlapStart = new Date(Math.max(entry.getTime(), intervalStart.getTime()));
      const overlapEnd = new Date(Math.min(exit.getTime(), intervalEnd.getTime()));

      if (overlapEnd > overlapStart) {
        const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
        normalConceptualMinutes += overlapMinutes;
      }
    });
    
    // En festivos, el trabajo en horario "normal" conceptual (8am-5pm) se cobra como dominicalFestivoMinutes
    // Las horas extras diurnas solo se cobran en los rangos 6-8am y 5-7pm
    return {
      normalMinutes: 0,
      extraDiurnaMinutes: 0,
      extraNocturnaMinutes: 0,
      recargoNocturnoMinutes: 0,
      dominicalFestivoMinutes: normalConceptualMinutes, // Trabajo en horario 8am-5pm en festivo
      extraDiurnaDominicalMinutes: extraDiurnaMinutes, // Solo en rangos 6-8am y 5-7pm
      extraNocturnaDominicalMinutes: extraNightMinutes,
      totalMinutes,
    };
  }

  // Día normal (no festivo ni domingo)
  return {
    normalMinutes: normalMinutes - recargoNocturnoMinutes, // Horas normales sin recargo
    extraDiurnaMinutes: extraDayMinutes,
    extraNocturnaMinutes: extraNightMinutes,
    recargoNocturnoMinutes, // Horas normales con recargo nocturno
    dominicalFestivoMinutes: 0,
    extraDiurnaDominicalMinutes: 0,
    extraNocturnaDominicalMinutes: 0,
    totalMinutes,
  };
};

// Calcula el valor en dinero del desglose de horas
const computeHoursValue = (breakdown: HoursBreakdown, monthlySalary: number): HoursValue => {
  const hourlyRate = monthlySalary / MONTHLY_WORK_HOURS;
  const minuteRate = hourlyRate / 60;
  
  // Valor de horas normales (sin recargo)
  const normalValue = breakdown.normalMinutes * minuteRate;
  
  // Valor horas extra diurnas: hora ordinaria + 25%
  const extraDiurnaValue = breakdown.extraDiurnaMinutes * minuteRate * (1 + SURCHARGES.EXTRA_DIURNA);
  
  // Valor horas extra nocturnas: hora ordinaria + 75%
  const extraNocturnaValue = breakdown.extraNocturnaMinutes * minuteRate * (1 + SURCHARGES.EXTRA_NOCTURNA);
  
  // Valor recargo nocturno: solo el 35% adicional (la hora base ya está en normalMinutes conceptualmente)
  // Pero en realidad aquí contamos los minutos completos con recargo
  const recargoNocturnoValue = breakdown.recargoNocturnoMinutes * minuteRate * (1 + SURCHARGES.RECARGO_NOCTURNO);
  
  // Valor trabajo dominical/festivo ordinario: hora ordinaria + 80%
  const dominicalFestivoValue = breakdown.dominicalFestivoMinutes * minuteRate * (1 + SURCHARGES.DOMINICAL_FESTIVO);
  
  // Valor hora extra diurna dominical/festivo: hora ordinaria + 115%
  const extraDiurnaDominicalValue = breakdown.extraDiurnaDominicalMinutes * minuteRate * (1 + SURCHARGES.EXTRA_DIURNA_DOMINICAL);
  
  // Valor hora extra nocturna dominical/festivo: hora ordinaria + 165%
  const extraNocturnaDominicalValue = breakdown.extraNocturnaDominicalMinutes * minuteRate * (1 + SURCHARGES.EXTRA_NOCTURNA_DOMINICAL);
  
  // Total de extras y recargos (sin incluir horas normales)
  const totalExtraValue = 
    extraDiurnaValue + 
    extraNocturnaValue + 
    (breakdown.recargoNocturnoMinutes * minuteRate * SURCHARGES.RECARGO_NOCTURNO) + // Solo el recargo, no la hora completa
    (breakdown.dominicalFestivoMinutes * minuteRate * SURCHARGES.DOMINICAL_FESTIVO) +
    extraDiurnaDominicalValue + 
    extraNocturnaDominicalValue;
  
  // Valor total
  const totalValue = normalValue + extraDiurnaValue + extraNocturnaValue + 
    recargoNocturnoValue + dominicalFestivoValue + 
    extraDiurnaDominicalValue + extraNocturnaDominicalValue;

  return {
    ...breakdown,
    hourlyRate,
    normalValue,
    extraDiurnaValue,
    extraNocturnaValue,
    recargoNocturnoValue,
    dominicalFestivoValue,
    extraDiurnaDominicalValue,
    extraNocturnaDominicalValue,
    totalExtraValue,
    totalValue,
  };
};

// Función legacy para compatibilidad (retorna formato simplificado)
const computeRecordHoursSimple = (record: AttendanceRecord) => {
  const breakdown = computeRecordHours(record);
  const extraMinutes = breakdown.extraDiurnaMinutes + breakdown.extraNocturnaMinutes +
    breakdown.extraDiurnaDominicalMinutes + breakdown.extraNocturnaDominicalMinutes;
  return {
    normalMinutes: breakdown.normalMinutes + breakdown.recargoNocturnoMinutes + breakdown.dominicalFestivoMinutes,
    extraMinutes,
    totalMinutes: breakdown.totalMinutes,
  };
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

// Helper function to get current GPS location with detailed error handling
const getCurrentLocation = (): Promise<{ latitude: number; longitude: number; error?: string } | { latitude: null; longitude: null; error: string }> => {
  return new Promise((resolve) => {
    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      console.warn("Geolocation requires HTTPS");
      resolve({ latitude: null, longitude: null, error: "La geolocalización requiere conexión HTTPS segura" });
      return;
    }

    if (!navigator.geolocation) {
      console.warn("Geolocation not supported by browser");
      resolve({ latitude: null, longitude: null, error: "Tu navegador no soporta geolocalización" });
      return;
    }

    // First check permission status if available
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        console.log("Geolocation permission status:", result.state);
        if (result.state === 'denied') {
          resolve({ latitude: null, longitude: null, error: "Permiso de ubicación denegado. Actívalo en la configuración del navegador." });
          return;
        }
        // Continue to get position
        requestPosition();
      }).catch(() => {
        // Permissions API not available, try directly
        requestPosition();
      });
    } else {
      requestPosition();
    }

    function requestPosition() {
      // Usar watchPosition para obtener la mejor precisión posible
      let watchId: number | null = null;
      const positions: Array<{ lat: number; lng: number; accuracy: number; timestamp: number }> = [];
      let bestPosition: { lat: number; lng: number; accuracy: number } | null = null;
      let timeoutId: NodeJS.Timeout;
      let hasResolved = false;
      let positionCount = 0;
      let lastImprovementTime = Date.now();

      const cleanup = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      // Timeout total de 15 segundos para dar tiempo suficiente al GPS
      timeoutId = setTimeout(() => {
        if (hasResolved) return;
        cleanup();
        
        if (bestPosition) {
          console.log("Location obtained (timeout, best found):", bestPosition.lat, bestPosition.lng, "accuracy:", bestPosition.accuracy, "m");
          hasResolved = true;
          resolve({
            latitude: bestPosition.lat,
            longitude: bestPosition.lng,
          });
        } else if (positions.length > 0) {
          // Si no tenemos una "mejor" posición, usar el promedio de las últimas 3 lecturas más precisas
          const sortedPositions = [...positions].sort((a, b) => a.accuracy - b.accuracy);
          const bestPositions = sortedPositions.slice(0, Math.min(3, sortedPositions.length));
          const avgLat = bestPositions.reduce((sum, p) => sum + p.lat, 0) / bestPositions.length;
          const avgLng = bestPositions.reduce((sum, p) => sum + p.lng, 0) / bestPositions.length;
          console.log("Location obtained (averaged from", positions.length, "readings):", avgLat, avgLng);
          hasResolved = true;
          resolve({
            latitude: avgLat,
            longitude: avgLng,
          });
        } else {
          // Fallback a getCurrentPosition si watchPosition no funcionó
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (hasResolved) return;
              console.log("Location obtained (fallback):", position.coords.latitude, position.coords.longitude, "accuracy:", position.coords.accuracy, "m");
              hasResolved = true;
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => {
              if (hasResolved) return;
              console.warn("Error getting location:", error.code, error.message);
              let errorMsg = "No se pudo obtener la ubicación";
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMsg = "Permiso de ubicación denegado. Actívalo en la configuración del navegador.";
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMsg = "Ubicación no disponible. Verifica que el GPS esté activado.";
                  break;
                case error.TIMEOUT:
                  errorMsg = "Tiempo de espera agotado. Intenta en un lugar con mejor señal GPS.";
                  break;
              }
              hasResolved = true;
              resolve({ latitude: null, longitude: null, error: errorMsg });
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
        }
      }, 15000);

      // Usar watchPosition para obtener múltiples lecturas y elegir la más precisa
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coords = position.coords;
          positionCount++;
          
          const pos = {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy || Infinity,
            timestamp: Date.now(),
          };

          positions.push(pos);

          // Actualizar la mejor posición si esta es más precisa (menor accuracy = mejor)
          if (!bestPosition || pos.accuracy < bestPosition.accuracy) {
            bestPosition = { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy };
            lastImprovementTime = Date.now();
            console.log("Better position found:", pos.lat, pos.lng, "accuracy:", pos.accuracy, "m");
          }

          // Si tenemos una posición con excelente precisión (< 10 metros), usar esa inmediatamente
          if (bestPosition && bestPosition.accuracy < 10) {
            cleanup();
            if (hasResolved) return;
            console.log("Location obtained (excellent accuracy):", bestPosition.lat, bestPosition.lng, "accuracy:", bestPosition.accuracy, "m");
            hasResolved = true;
            resolve({
              latitude: bestPosition.lat,
              longitude: bestPosition.lng,
            });
            return;
          }

          // Si tenemos una posición con muy buena precisión (< 20 metros) y al menos 2 lecturas, usar esa
          if (bestPosition && bestPosition.accuracy < 20 && positionCount >= 2) {
            cleanup();
            if (hasResolved) return;
            console.log("Location obtained (high accuracy):", bestPosition.lat, bestPosition.lng, "accuracy:", bestPosition.accuracy, "m");
            hasResolved = true;
            resolve({
              latitude: bestPosition.lat,
              longitude: bestPosition.lng,
            });
            return;
          }

          // Si tenemos una posición con buena precisión (< 30 metros) y al menos 3 lecturas, usar esa
          if (bestPosition && bestPosition.accuracy < 30 && positionCount >= 3) {
            cleanup();
            if (hasResolved) return;
            console.log("Location obtained (good accuracy):", bestPosition.lat, bestPosition.lng, "accuracy:", bestPosition.accuracy, "m");
            hasResolved = true;
            resolve({
              latitude: bestPosition.lat,
              longitude: bestPosition.lng,
            });
            return;
          }

          // Si no ha habido mejoras en los últimos 2 segundos y tenemos al menos 3 lecturas con precisión aceptable
          if (bestPosition && positionCount >= 3 && (Date.now() - lastImprovementTime) > 2000 && bestPosition.accuracy < 50) {
            cleanup();
            if (hasResolved) return;
            console.log("Location obtained (stable, acceptable accuracy):", bestPosition.lat, bestPosition.lng, "accuracy:", bestPosition.accuracy, "m");
            hasResolved = true;
            resolve({
              latitude: bestPosition.lat,
              longitude: bestPosition.lng,
            });
            return;
          }
        },
        (error) => {
          console.warn("Error in watchPosition:", error.code, error.message);
          // No resolver aquí, dejar que el timeout maneje el fallback
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    }
  });
};

// Generate Google Maps URL from coordinates
const getGoogleMapsUrl = (latitude: number, longitude: number): string => {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
};

const TimeControl = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, session } = useAuth();
  const { toast } = useToast();
  
  // Verificar si es el usuario de asistencia (solo puede registrar entrada/salida)
  const isAttendanceUser = user?.email === "asistencia@soldgrup.com";
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
  
  // Estados para ajuste de tiempo en salida (almuerzo)
  const [showExitAdjustmentDialog, setShowExitAdjustmentDialog] = useState(false);
  const [pendingExitFile, setPendingExitFile] = useState<File | null>(null);
  const [pendingExitLocation, setPendingExitLocation] = useState<{ latitude: number | null; longitude: number | null } | null>(null);
  const [lunchWasNormal, setLunchWasNormal] = useState<boolean>(true);
  const [lunchMinutesTaken, setLunchMinutesTaken] = useState<string>("60");
  
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
  const [viewingPhoto, setViewingPhoto] = useState<PhotoViewData>(null);
  const [dateFilter, setDateFilter] = useState<"all" | "fortnight" | "month" | "custom">("fortnight");
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>("all");
  
  // Estados para selección de quincena y mes
  const [selectedFortnight, setSelectedFortnight] = useState<1 | 2>(() => {
    const today = new Date();
    return today.getDate() <= 15 ? 1 : 2;
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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
        // Normalizar registros para asegurar que tengan todos los campos
        const records = (recordsData || []).map((r: any) => ({
          ...r,
          entry_latitude: r.entry_latitude ?? null,
          entry_longitude: r.entry_longitude ?? null,
          exit_latitude: r.exit_latitude ?? null,
          exit_longitude: r.exit_longitude ?? null,
          time_adjustment_minutes: r.time_adjustment_minutes ?? null,
          adjustment_note: r.adjustment_note ?? null,
        })) as AttendanceRecord[];
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

  // Tipo para totales detallados por trabajador
  type WorkerTotals = HoursBreakdown & {
    hourlyRate: number;
    totalExtraValue: number;
    totalValue: number;
  };

  const weeklyTotals = useMemo(() => {
    const totals: Record<string, WorkerTotals> = {};
    
    attendanceRecords.forEach((record) => {
      const key = record.worker_id;
      const stats = computeRecordHours(record);
      const worker = workers.find(w => w.id === key);
      const salary = worker?.sueldo || 0;
      
      if (!totals[key]) {
        totals[key] = {
          normalMinutes: 0,
          extraDiurnaMinutes: 0,
          extraNocturnaMinutes: 0,
          recargoNocturnoMinutes: 0,
          dominicalFestivoMinutes: 0,
          extraDiurnaDominicalMinutes: 0,
          extraNocturnaDominicalMinutes: 0,
          totalMinutes: 0,
          hourlyRate: salary / MONTHLY_WORK_HOURS,
          totalExtraValue: 0,
          totalValue: 0,
        };
      }
      
      // Acumular minutos por tipo
      totals[key].normalMinutes += stats.normalMinutes;
      totals[key].extraDiurnaMinutes += stats.extraDiurnaMinutes;
      totals[key].extraNocturnaMinutes += stats.extraNocturnaMinutes;
      totals[key].recargoNocturnoMinutes += stats.recargoNocturnoMinutes;
      totals[key].dominicalFestivoMinutes += stats.dominicalFestivoMinutes;
      totals[key].extraDiurnaDominicalMinutes += stats.extraDiurnaDominicalMinutes;
      totals[key].extraNocturnaDominicalMinutes += stats.extraNocturnaDominicalMinutes;
      totals[key].totalMinutes += stats.totalMinutes;
    });
    
    // Calcular valores en dinero para cada trabajador
    Object.keys(totals).forEach((workerId) => {
      const worker = workers.find(w => w.id === workerId);
      const salary = worker?.sueldo || 0;
      const t = totals[workerId];
      const values = computeHoursValue(t, salary);
      t.totalExtraValue = values.totalExtraValue;
      t.totalValue = values.totalValue;
    });
    
    return totals;
  }, [attendanceRecords, workers]);

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
    if (uploadingEntry || uploadingExit || isFileInputOpenRef.current) {
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

    // DESHABILITAR EL BOTÓN INMEDIATAMENTE para prevenir múltiples clics
    if (type === "entry") {
      setUploadingEntry(true);
    } else {
      setUploadingExit(true);
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
        // Restaurar estado si se cancela sin seleccionar archivo
        if (type === "entry") {
          setUploadingEntry(false);
        } else {
          setUploadingExit(false);
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

          // OBTENER UBICACIÓN AHORA (en paralelo con la subida de la foto)
          toast({
            title: "Obteniendo ubicación...",
            description: "Procesando foto y obteniendo ubicación GPS.",
          });
          
          // Obtener ubicación en paralelo mientras se sube la foto
          const locationPromise = getCurrentLocation().catch((error) => {
            console.error("Error obteniendo ubicación:", error);
            return { latitude: null, longitude: null, error: "Error al obtener ubicación" };
          });

          // Si es salida, guardar archivo y obtener ubicación, luego mostrar diálogo de almuerzo
          if (type === "exit") {
            const location = await locationPromise;
            setPendingExitFile(file);
            setPendingExitLocation({
              latitude: location.latitude,
              longitude: location.longitude,
            });
            setLunchWasNormal(true);
            setLunchMinutesTaken("60");
            setShowExitAdjustmentDialog(true);
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

            // Subir foto y obtener ubicación en paralelo
            const [photoUrl, location] = await Promise.all([
              uploadPhoto(file, type),
              locationPromise
            ]);
            
            const today = toDateKey(new Date());
            const now = new Date().toISOString();

            if (location.latitude && location.longitude) {
              console.log("Ubicación obtenida:", location.latitude, location.longitude);
            } else {
              console.warn("No se pudo obtener ubicación:", location.error);
            }

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
                updateData.entry_latitude = location?.latitude ?? null;
                updateData.entry_longitude = location?.longitude ?? null;
                // Preserve existing exit data
                updateData.exit_time = existingRecord.exit_time || null;
                updateData.exit_photo_url = existingRecord.exit_photo_url || null;
                updateData.exit_latitude = existingRecord.exit_latitude || null;
                updateData.exit_longitude = existingRecord.exit_longitude || null;
              }
              // If we're updating exit, set exit fields (overwrite existing)
              if (type === "exit") {
                updateData.exit_time = now;
                updateData.exit_photo_url = photoUrl;
                updateData.exit_latitude = location?.latitude ?? null;
                updateData.exit_longitude = location?.longitude ?? null;
                // Preserve existing entry data
                updateData.entry_time = existingRecord.entry_time || null;
                updateData.entry_photo_url = existingRecord.entry_photo_url || null;
                updateData.entry_latitude = existingRecord.entry_latitude || null;
                updateData.entry_longitude = existingRecord.entry_longitude || null;
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
                entry_latitude: type === "entry" ? (location?.latitude ?? null) : null,
                entry_longitude: type === "entry" ? (location?.longitude ?? null) : null,
                exit_latitude: type === "exit" ? (location?.latitude ?? null) : null,
                exit_longitude: type === "exit" ? (location?.longitude ?? null) : null,
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
          // Restaurar estado
          if (type === "entry") {
            setUploadingEntry(false);
          } else {
            setUploadingExit(false);
          }
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
      // Restaurar estado
      if (type === "entry") {
        setUploadingEntry(false);
      } else {
        setUploadingExit(false);
      }
      toast({
        title: "Error",
        description: "No se pudo crear el selector de archivos. Por favor, intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  // Función para procesar la foto de salida con el ajuste de tiempo
  const processExitWithAdjustment = async () => {
    if (!pendingExitFile || !selectedWorkerId) {
      setShowExitAdjustmentDialog(false);
      setPendingExitFile(null);
      setPendingExitLocation(null);
      return;
    }

    setShowExitAdjustmentDialog(false);
    setUploadingExit(true);

    try {
      // Validar que selectedWorkerId todavía sea válido
      if (!selectedWorkerId.trim()) {
        throw new Error("ID de trabajador inválido");
      }

      // Verificar sesión
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError && !sessionError.message?.includes("Refresh Token")) {
          toast({
            title: "Sesión expirada",
            description: "Por favor, inicia sesión nuevamente.",
            variant: "destructive",
          });
          setTimeout(() => { window.location.href = "/auth"; }, 100);
          return;
        }
      } catch (sessionCheckError) {
        console.warn("Error al verificar sesión, continuando:", sessionCheckError);
      }

      const photoUrl = await uploadPhoto(pendingExitFile, "exit");
      const today = toDateKey(new Date());
      const now = new Date().toISOString();

      // Usar la ubicación capturada antes de abrir la cámara
      const location = pendingExitLocation || { latitude: null, longitude: null };
      if (location.latitude && location.longitude) {
        console.log("Usando ubicación capturada para salida:", location.latitude, location.longitude);
      }

      // Calcular ajuste basado en tiempo de almuerzo
      // Almuerzo normal = 60 minutos. Si tomó menos, la diferencia son minutos extra trabajados.
      let adjustmentMins = 0;
      let adjustmentNoteText: string | null = null;
      
      if (!lunchWasNormal) {
        const lunchTaken = parseInt(lunchMinutesTaken, 10) || 60;
        adjustmentMins = 60 - lunchTaken; // Diferencia: minutos extra trabajados
        if (adjustmentMins !== 0) {
          adjustmentNoteText = `Almuerzo: ${lunchTaken} min (${adjustmentMins > 0 ? '+' : ''}${adjustmentMins} min)`;
        }
      }

      // Check if record exists for today
      const { data: existingRecords, error: queryError } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("worker_id", selectedWorkerId)
        .eq("date", today);

      if (queryError && queryError.code !== "PGRST116") {
        throw queryError;
      }

      const existingRecord = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

      if (existingRecord) {
        // Update existing record
        const updateData: any = {
          exit_time: now,
          exit_photo_url: photoUrl,
          exit_latitude: location?.latitude ?? null,
          exit_longitude: location?.longitude ?? null,
          entry_time: existingRecord.entry_time || null,
          entry_photo_url: existingRecord.entry_photo_url || null,
          entry_latitude: existingRecord.entry_latitude || null,
          entry_longitude: existingRecord.entry_longitude || null,
          time_adjustment_minutes: adjustmentMins,
          adjustment_note: adjustmentNoteText,
        };

        const { data: updatedData, error } = await supabase
          .from("attendance_records")
          .update(updateData)
          .eq("id", existingRecord.id)
          .select();

        if (error) throw error;

        if (updatedData && updatedData[0]) {
          const updatedRecord = updatedData[0] as unknown as AttendanceRecord;
          updateAttendanceRecord(updatedRecord);
        }
      } else {
        // Create new record (shouldn't happen for exit, but just in case)
        const newRecord = {
          worker_id: selectedWorkerId,
          date: today,
          entry_time: null,
          exit_time: now,
          entry_photo_url: null,
          exit_photo_url: photoUrl,
          entry_latitude: null,
          entry_longitude: null,
          exit_latitude: location?.latitude ?? null,
          exit_longitude: location?.longitude ?? null,
          time_adjustment_minutes: adjustmentMins,
          adjustment_note: adjustmentNoteText,
        };

        const { data: insertedData, error } = await supabase
          .from("attendance_records")
          .insert(newRecord)
          .select();

        if (error) throw error;

        if (insertedData && insertedData[0]) {
          const newRecordData = insertedData[0] as unknown as AttendanceRecord;
          updateAttendanceRecord(newRecordData);
        }
      }

      // Show success message
      let successMessage = "La salida fue registrada correctamente.";
      if (adjustmentMins !== 0) {
        const sign = adjustmentMins > 0 ? "+" : "";
        successMessage += ` Ajuste: ${sign}${adjustmentMins} minutos.`;
      }

      toast({
        title: "Salida registrada",
        description: successMessage,
      });

    } catch (error: any) {
      console.error("Error uploading exit photo:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar la salida.",
        variant: "destructive",
      });
    } finally {
      setUploadingExit(false);
      setPendingExitFile(null);
      setPendingExitLocation(null);
      setLunchWasNormal(true);
      setLunchMinutesTaken("60");
      isUpdatingRecordsRef.current = false;
    }
  };

  // Cancelar el registro de salida
  const cancelExitUpload = () => {
    setShowExitAdjustmentDialog(false);
    setPendingExitFile(null);
    setPendingExitLocation(null);
    setLunchWasNormal(true);
    setLunchMinutesTaken("60");
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
    switch (dateFilter) {
      case "fortnight": {
        // Quincena seleccionada: 1-15 o 16-fin de mes
        if (selectedFortnight === 1) {
          // Primera quincena: 1-15
          const start = new Date(selectedYear, selectedMonth, 1);
          const end = new Date(selectedYear, selectedMonth, 15);
          return { start, end };
        } else {
          // Segunda quincena: 16-fin de mes
          const start = new Date(selectedYear, selectedMonth, 16);
          const end = new Date(selectedYear, selectedMonth + 1, 0); // Último día del mes
          return { start, end };
        }
      }
      case "month": {
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0);
        return { start, end };
      }
      default:
        return { start: null, end: null };
    }
  }, [dateFilter, selectedFortnight, selectedMonth, selectedYear]);

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

  // Calculate fortnight (quincena) summary
  const fortnightSummary = useMemo(() => {
    const { start, end } = dateRange;
    if (!start || !end || dateFilter !== "fortnight") return null;

    const fortnightRecords = attendanceRecords.filter((record) => {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate >= start && recordDate <= end;
    });

    const byWorker = fortnightRecords.reduce((acc, record) => {
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

  const summary = fortnightSummary;

  // Get fortnight days (quincena: 1-15 or 16-end of month)
  const fortnightDays = useMemo(() => {
    const { start, end } = dateRange;
    if (!start || !end) return [];
    
    const days = [];
    const current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
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
            {!isAttendanceUser && (
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
            )}
            <div>
              <h1 className="text-4xl font-bold mb-1">Control entrada/salida</h1>
              <p className="text-muted-foreground">
                {isAttendanceUser 
                  ? "Registra tu entrada y salida" 
                  : "Gestión de horarios de entrada y salida de trabajadores"}
              </p>
            </div>
          </div>
        </div>

        {/* Worker Management - Oculto para usuario de asistencia */}
        {!isAttendanceUser && (
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
        )}

        {/* Edit Worker Dialog */}
        {editingWorker && !isAttendanceUser && (
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
        {viewingWorkerProfile && !isAttendanceUser && (
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
                        onClick={() => setViewingPhoto({
                          url: todaysRecordForSelectedWorker.entry_photo_url!,
                          latitude: todaysRecordForSelectedWorker.entry_latitude,
                          longitude: todaysRecordForSelectedWorker.entry_longitude,
                          type: "entry"
                        })}
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
                        onClick={() => setViewingPhoto({
                          url: todaysRecordForSelectedWorker.exit_photo_url!,
                          latitude: todaysRecordForSelectedWorker.exit_latitude,
                          longitude: todaysRecordForSelectedWorker.exit_longitude,
                          type: "exit"
                        })}
                        title="Clic para ver foto completa"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Attendance Records Table - Oculto para usuario de asistencia */}
        {!isAttendanceUser && (
        <Card className="p-6">
          {Object.entries(weeklyTotals).length > 0 && (
            <div className="mb-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                <Clock className="h-5 w-5 text-primary" />
                <span>Resumen de Horas - Quincena {selectedFortnight}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  ({dateRange.start ? `${dateRange.start.getDate()}` : ''} - {dateRange.end ? `${dateRange.end.getDate()} de ${dateRange.end.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}` : ''})
                </span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(weeklyTotals).map(([workerId, totals]) => {
                  const worker = workers.find((w) => w.id === workerId);
                  const hasSalary = worker?.sueldo && worker.sueldo > 0;
                  const formatMoney = (value: number) => 
                    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
                  
                  // Calcular totales de extras
                  const totalExtraMinutes = totals.extraDiurnaMinutes + totals.extraNocturnaMinutes + 
                    totals.extraDiurnaDominicalMinutes + totals.extraNocturnaDominicalMinutes;
                  
                  return (
                    <Card key={`totals-${workerId}`} className="p-4 bg-gradient-to-br from-muted/50 to-muted/30 border-l-4 border-l-primary">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">
                            {worker ? `${worker.first_name} ${worker.last_name}` : "Trabajador"}
                          </h4>
                          {hasSalary && (
                            <p className="text-xs text-muted-foreground">
                              Sueldo: {formatMoney(worker.sueldo!)} | Hora ordinaria: {formatMoney(totals.hourlyRate)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">Total trabajado</p>
                          <p className="text-xl font-bold text-primary">{formatMinutes(totals.totalMinutes)}</p>
                        </div>
                      </div>
                      
                      {/* Desglose de horas */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="p-2 bg-background/50 rounded">
                          <p className="text-muted-foreground">Horas ordinarias</p>
                          <p className="font-medium">{formatMinutes(totals.normalMinutes + totals.recargoNocturnoMinutes)}</p>
                        </div>
                        <div className="p-2 bg-background/50 rounded">
                          <p className="text-muted-foreground">Total horas extra</p>
                          <p className="font-medium text-amber-600">{formatMinutes(totalExtraMinutes)}</p>
                        </div>
                      </div>
                      
                      {/* Desglose detallado de extras */}
                      {totalExtraMinutes > 0 && (
                        <div className="space-y-1 text-xs border-t pt-2">
                          <p className="font-medium text-muted-foreground mb-1">Desglose de extras y recargos:</p>
                          {totals.extraDiurnaMinutes > 0 && (
                            <div className="flex justify-between">
                              <span>Extra diurna (+25%)</span>
                              <span className="font-medium">{formatMinutes(totals.extraDiurnaMinutes)}</span>
                            </div>
                          )}
                          {totals.extraNocturnaMinutes > 0 && (
                            <div className="flex justify-between">
                              <span>Extra nocturna (+75%)</span>
                              <span className="font-medium">{formatMinutes(totals.extraNocturnaMinutes)}</span>
                            </div>
                          )}
                          {totals.recargoNocturnoMinutes > 0 && (
                            <div className="flex justify-between">
                              <span>Recargo nocturno (+35%)</span>
                              <span className="font-medium">{formatMinutes(totals.recargoNocturnoMinutes)}</span>
                            </div>
                          )}
                          {totals.dominicalFestivoMinutes > 0 && (
                            <div className="flex justify-between">
                              <span>Dominical/Festivo (+80%)</span>
                              <span className="font-medium">{formatMinutes(totals.dominicalFestivoMinutes)}</span>
                            </div>
                          )}
                          {totals.extraDiurnaDominicalMinutes > 0 && (
                            <div className="flex justify-between">
                              <span>Extra diurna dom/fest (+115%)</span>
                              <span className="font-medium">{formatMinutes(totals.extraDiurnaDominicalMinutes)}</span>
                            </div>
                          )}
                          {totals.extraNocturnaDominicalMinutes > 0 && (
                            <div className="flex justify-between">
                              <span>Extra nocturna dom/fest (+165%)</span>
                              <span className="font-medium">{formatMinutes(totals.extraNocturnaDominicalMinutes)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Valores en dinero */}
                      {hasSalary && totalExtraMinutes > 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Valor extras y recargos:</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatMoney(totals.totalExtraValue)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {!hasSalary && totalExtraMinutes > 0 && (
                        <p className="text-xs text-amber-600 mt-2 italic">
                          ⚠️ Registra el sueldo del trabajador para ver el valor en dinero
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
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
                  <TabsTrigger value="fortnight">
                    <Calendar className="h-4 w-4 mr-2" />
                    Quincena
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
              
              {/* Selector de Quincena */}
              {dateFilter === "fortnight" && (
                <Select 
                  value={selectedFortnight.toString()} 
                  onValueChange={(v) => setSelectedFortnight(parseInt(v) as 1 | 2)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Quincena" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1-15 (Q1)</SelectItem>
                    <SelectItem value="2">16-{new Date(selectedYear, selectedMonth + 1, 0).getDate()} (Q2)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {/* Selector de Mes */}
              {(dateFilter === "fortnight" || dateFilter === "month") && (
                <Select 
                  value={selectedMonth.toString()} 
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Enero</SelectItem>
                    <SelectItem value="1">Febrero</SelectItem>
                    <SelectItem value="2">Marzo</SelectItem>
                    <SelectItem value="3">Abril</SelectItem>
                    <SelectItem value="4">Mayo</SelectItem>
                    <SelectItem value="5">Junio</SelectItem>
                    <SelectItem value="6">Julio</SelectItem>
                    <SelectItem value="7">Agosto</SelectItem>
                    <SelectItem value="8">Septiembre</SelectItem>
                    <SelectItem value="9">Octubre</SelectItem>
                    <SelectItem value="10">Noviembre</SelectItem>
                    <SelectItem value="11">Diciembre</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {/* Selector de Año */}
              {(dateFilter === "fortnight" || dateFilter === "month") && (
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Fortnight Summary */}
          {dateFilter === "fortnight" && summary && Object.keys(summary).length > 0 && (
            <Card className="p-4 mb-6 bg-muted/50">
              <h3 className="font-semibold mb-3">Resumen de la Quincena</h3>
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

          {dateFilter === "fortnight" ? (
            // Vista quincenal tipo calendario
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background min-w-[150px]">
                        Trabajador
                      </TableHead>
                      {fortnightDays.map((day) => (
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
                        {fortnightDays.map((day) => {
                          const record = getRecordForWorkerAndDate(worker.id, day);
                          return (
                            <TableCell key={day.toISOString()} className="p-2">
                              <div className="flex flex-col gap-1 min-h-[60px]">
                                {/* Entrada */}
                                <div className="flex items-center justify-center p-2 rounded border border-green-200 bg-green-50/50 min-h-[28px]">
                                  {record?.entry_time ? (
                                    <button
                                      onClick={() => record.entry_photo_url && setViewingPhoto({
                                        url: record.entry_photo_url,
                                        latitude: record.entry_latitude,
                                        longitude: record.entry_longitude,
                                        type: "entry"
                                      })}
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
                                      onClick={() => record.exit_photo_url && setViewingPhoto({
                                        url: record.exit_photo_url,
                                        latitude: record.exit_latitude,
                                        longitude: record.exit_longitude,
                                        type: "exit"
                                      })}
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
                                  {/* Mostrar ajuste de tiempo si existe */}
                                  {record?.time_adjustment_minutes != null && record.time_adjustment_minutes !== 0 && (
                                    <span 
                                      className={`text-[10px] font-medium px-1 rounded ${
                                        record.time_adjustment_minutes > 0 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                      title={record.adjustment_note || "Ajuste de tiempo"}
                                    >
                                      {record.time_adjustment_minutes > 0 ? '+' : ''}{record.time_adjustment_minutes}m
                                    </span>
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
                            <TableHead>Ajuste</TableHead>
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
                                    onClick={() => record.entry_photo_url && setViewingPhoto({
                                      url: record.entry_photo_url,
                                      latitude: record.entry_latitude,
                                      longitude: record.entry_longitude,
                                      type: "entry"
                                    })}
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
                                <div className="flex items-center gap-2">
                                  {record.exit_time ? (
                                    <button
                                      onClick={() => record.exit_photo_url && setViewingPhoto({
                                        url: record.exit_photo_url,
                                        latitude: record.exit_latitude,
                                        longitude: record.exit_longitude,
                                        type: "exit"
                                      })}
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
                                  {/* Indicador de ajuste */}
                                  {record?.time_adjustment_minutes != null && record.time_adjustment_minutes !== 0 && (
                                    <span 
                                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                        record.time_adjustment_minutes > 0 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                      title={record.adjustment_note || "Ajuste de tiempo"}
                                    >
                                      {record.time_adjustment_minutes > 0 ? '+' : ''}{record.time_adjustment_minutes}min
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {record?.time_adjustment_minutes != null && record.time_adjustment_minutes !== 0 ? (
                                  <div className="flex flex-col">
                                    <span 
                                      className={`text-sm font-medium ${
                                        record.time_adjustment_minutes > 0 
                                          ? 'text-green-600' 
                                          : 'text-amber-600'
                                      }`}
                                    >
                                      {record.time_adjustment_minutes > 0 ? '+' : ''}{record.time_adjustment_minutes} min
                                    </span>
                                    {record.adjustment_note && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={record.adjustment_note}>
                                        {record.adjustment_note}
                                      </span>
                                    )}
                                  </div>
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
                                      onClick={() => setViewingPhoto({
                                        url: record.entry_photo_url!,
                                        latitude: record.entry_latitude,
                                        longitude: record.entry_longitude,
                                        type: "entry"
                                      })}
                                      title="Ver foto de entrada"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {record.exit_photo_url && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setViewingPhoto({
                                        url: record.exit_photo_url!,
                                        latitude: record.exit_latitude,
                                        longitude: record.exit_longitude,
                                        type: "exit"
                                      })}
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
        )}

        {/* Exit Time Adjustment Dialog - Almuerzo */}
        <Dialog open={showExitAdjustmentDialog} onOpenChange={(open) => !open && cancelExitUpload()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Registrar Salida
              </DialogTitle>
              <DialogDescription>
                Indica cómo fue el tiempo de almuerzo hoy.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Opción de almuerzo normal */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">¿Tomó la hora de almuerzo completa?</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLunchWasNormal(true);
                      setLunchMinutesTaken("60");
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      lunchWasNormal 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="text-2xl mb-1">✅</div>
                    <div className="font-medium">Sí</div>
                    <div className="text-xs text-muted-foreground">1 hora normal</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setLunchWasNormal(false);
                      setLunchMinutesTaken("30");
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      !lunchWasNormal 
                        ? 'border-amber-500 bg-amber-50 text-amber-700' 
                        : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="text-2xl mb-1">⏱️</div>
                    <div className="font-medium">No</div>
                    <div className="text-xs text-muted-foreground">Tiempo diferente</div>
                  </button>
                </div>
              </div>
              
              {/* Input de minutos si no fue normal */}
              {!lunchWasNormal && (
                <div className="space-y-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <Label htmlFor="lunch-minutes" className="text-sm font-medium text-amber-800">
                    ¿Cuántos minutos de almuerzo tomó?
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="lunch-minutes"
                      type="number"
                      min="0"
                      max="60"
                      value={lunchMinutesTaken}
                      onChange={(e) => setLunchMinutesTaken(e.target.value)}
                      className="w-24 text-center text-lg font-medium"
                    />
                    <span className="text-sm text-amber-700">minutos</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[0, 15, 30, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setLunchMinutesTaken(mins.toString())}
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          lunchMinutesTaken === mins.toString()
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Resumen del ajuste */}
              {!lunchWasNormal && (() => {
                const lunchTaken = parseInt(lunchMinutesTaken) || 60;
                const extraMinutes = 60 - lunchTaken;
                return (
                  <div className={`p-3 rounded-lg ${extraMinutes >= 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <p className={`text-sm font-medium ${extraMinutes >= 0 ? 'text-green-800' : 'text-amber-800'}`}>
                      {extraMinutes > 0 && (
                        <span>✅ Se sumarán <strong>{extraMinutes} minutos</strong> extra por almuerzo reducido</span>
                      )}
                      {extraMinutes < 0 && (
                        <span>⚠️ Se restarán <strong>{Math.abs(extraMinutes)} minutos</strong> por almuerzo extendido</span>
                      )}
                      {extraMinutes === 0 && (
                        <span>Sin ajuste de tiempo</span>
                      )}
                    </p>
                  </div>
                );
              })()}
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={cancelExitUpload}>
                Cancelar
              </Button>
              <Button onClick={processExitWithAdjustment} disabled={uploadingExit}>
                {uploadingExit ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registrando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Registrar Salida
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Photo Viewer Dialog */}
        {viewingPhoto && (
          <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  Foto de {viewingPhoto.type === "entry" ? "Entrada" : "Salida"}
                </DialogTitle>
              </DialogHeader>
              <div className="relative">
                <img
                  src={viewingPhoto.url}
                  alt="Foto de asistencia"
                  className="w-full h-auto rounded-lg"
                />
              </div>
              
              {/* Location Info */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  Ubicación de la foto
                </h4>
                {viewingPhoto.latitude && viewingPhoto.longitude ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Coordenadas: {viewingPhoto.latitude.toFixed(6)}, {viewingPhoto.longitude.toFixed(6)}
                    </p>
                    <a
                      href={getGoogleMapsUrl(viewingPhoto.latitude, viewingPhoto.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" x2="21" y1="14" y2="3"/>
                      </svg>
                      Ver en Google Maps
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                    ⚠️ Esta foto no tiene ubicación registrada. Las fotos nuevas incluirán automáticamente la ubicación GPS.
                  </p>
                )}
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

