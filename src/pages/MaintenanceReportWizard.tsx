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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const CHECKLIST_ITEMS = [
  "Motor de elevación",
  "Freno motor de elevación",
  "Trolley",
  "Motor trolley",
  "Freno motor trolley",
  "Guías de trolley",
  "Ruedas trolley",
  "Monorriel",
  "Gancho",
  "Cadena",
  "Gabinete eléctrico",
  "Aceite",
  "Estructura y aparellaje",
  "Topes mecánicos",
  "Botonera",
  "Pines de seguridad",
  "Polipasto",
  "Límite de elevación",
  "Carro porta escobillas",
  "Carros intermedios, y cables planos",
  "Carcazas",
];

type ChecklistStatus = "good" | "bad" | null;

type ChecklistEntry = {
  id: string;
  name: string;
  status: ChecklistStatus;
  observation: string;
};

type PhotoEntry = {
  id: string;
  storagePath: string | null;
  url: string | null;
  description: string;
};

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

const buildDefaultChecklist = (): ChecklistEntry[] =>
  CHECKLIST_ITEMS.map((name, index) => ({
    id: crypto.randomUUID(),
    name,
    status: null,
    observation: "",
  }));

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

const steps: StepDefinition[] = [
  {
    key: "intro",
    title: "Procedimiento de llenado de Informe de Mantenimiento",
    subtitle:
      "A continuación, podrá llenar paso a paso su informe de mantenimiento. Asegúrese de completar todos los campos.",
  },
  { key: "basicInfo", title: "Información Básica" },
  { key: "initialState", title: "Estado Inicial" },
  ...CHECKLIST_ITEMS.map((name, index) => ({
    key: `checklist-${index}`,
    title: "Lista de Chequeo",
    subtitle: `${index + 1}. ${name}`,
    checklistIndex: index,
  })),
  { key: "recommendations", title: "Recomendaciones" },
  { key: "tests", title: "Pruebas sin carga" },
  { key: "photos", title: "Soporte Fotográfico" },
  { key: "finish", title: "Fin del Informe de Mantenimiento" },
];

const totalSteps = steps.length;

const MaintenanceReportWizard = () => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const isEditMode = Boolean(params.id);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState<MaintenanceReportForm>(defaultForm);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (authLoading || !user) return;

    const initialize = async () => {
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

  useEffect(() => {
    if (initialLoadRef.current || !reportId) return;
    setPendingAutoSave(true);

    const handler = setTimeout(() => {
      void persistReport();
    }, 800);

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

  const loadExistingReport = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("maintenance_reports")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const parsedData: MaintenanceReportForm = {
        ...defaultForm,
        ...(typeof data.data === "object" && data.data !== null
          ? (data.data as MaintenanceReportForm)
          : {}),
      };

      setReportId(data.id);
      setFormData(parsedData);
      setCurrentStepIndex(Math.max((data.current_step ?? 1) - 1, 0));
      if (data.updated_at) {
        setLastSavedAt(new Date(data.updated_at));
      }
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
    const payload = {
      data,
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
      if (!reportId) return;
      const dataToSave = overrideData ?? formData;
      setIsSaving(true);
      try {
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
    [reportId, formData, currentStepIndex, toast],
  );

  const handleSaveAndExit = async () => {
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
    const newId = await createDraftReport();
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
          url: null,
          description: "",
        },
      ],
    }));
  };

  const handlePhotoFileUpload = async (photoId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    let activeReportId = reportId;
    if (!activeReportId) {
      activeReportId = await ensureReportExists();
      if (!activeReportId) {
        toast({
          title: "No se pudo preparar el informe",
          description:
            "Intenta nuevamente crear el informe antes de adjuntar fotografías.",
          variant: "destructive",
        });
        return;
      }
      setReportId(activeReportId);
    }
    const file = fileList[0];
    setPhotoUploading((prev) => ({ ...prev, [photoId]: true }));

    try {
      const compressedFile = await compressImageFile(file);
      const extension = compressedFile.name.split(".").pop() || "webp";
      const sanitizedName = `${photoId}.${extension}`;
      const storagePath = `${activeReportId}/${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("maintenance-report-photos")
        .upload(storagePath, compressedFile, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      await supabase
        .from("maintenance_report_photos")
        .upsert(
          [
            {
              id: photoId,
              report_id: activeReportId,
              storage_path: storagePath,
              description:
                formData.photos.find((photo) => photo.id === photoId)?.description ?? "",
            },
          ],
          { onConflict: "id" },
        );

      const {
        data: { publicUrl },
      } = supabase.storage.from("maintenance-report-photos").getPublicUrl(storagePath);

      setFormData((prev) => ({
        ...prev,
        photos: prev.photos.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                storagePath,
                url: publicUrl,
              }
            : photo,
        ),
      }));

      toast({
        title: "Foto cargada",
        description: "La fotografía se guardó correctamente.",
      });
    } catch (error) {
      console.error("Error subiendo la fotografía:", error);
      toast({
        title: "Error al subir la foto",
        description: "No se pudo subir la fotografía. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setPhotoUploading((prev) => ({ ...prev, [photoId]: false }));
    }
  };

  const handleRemovePhoto = async (photo: PhotoEntry) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((item) => item.id !== photo.id),
    }));

    if (photo.storagePath) {
      const { error: storageError } = await supabase.storage
        .from("maintenance-report-photos")
        .remove([photo.storagePath]);
      if (storageError) {
        console.warn("No se pudo eliminar la imagen del almacenamiento:", storageError);
      }
    }

    await supabase.from("maintenance_report_photos").delete().eq("id", photo.id);
  };

  const progressValue = ((currentStepIndex + 1) / totalSteps) * 100;
  const currentStep = steps[currentStepIndex];

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
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
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

  const renderStepContent = () => {
    switch (currentStep.key) {
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
                <Label htmlFor="locationPg">Ubicación PG</Label>
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
                          disabled={photoUploading[photo.id]}
                        >
                          <Upload className="h-4 w-4" />
                          {photoUploading[photo.id]
                            ? "Subiendo..."
                            : photo.url
                              ? "Reemplazar"
                              : "Subir foto"}
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
                    {photoUploading[photo.id] && (
                      <p className="text-xs text-muted-foreground">Cargando fotografía...</p>
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
      default:
        if (currentStep.checklistIndex !== undefined) {
          return renderChecklistStep(currentStep.checklistIndex);
        }
        return null;
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
              <h2 className="text-2xl font-semibold">{currentStep.title}</h2>
              {currentStep.subtitle && (
                <p className="text-muted-foreground mt-2">{currentStep.subtitle}</p>
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
