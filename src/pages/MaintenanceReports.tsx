import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Download, Edit2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

type MaintenanceReportListItem = {
  id: string;
  company: string | null;
  technician_name: string | null;
  start_date: string | null;
  equipment: string | null;
  location_pg: string | null;
  created_at: string;
};

const MaintenanceReports = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<MaintenanceReportListItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("maintenance_reports")
        .select("id, company, technician_name, start_date, equipment, location_pg, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data ?? []);
    } catch (error) {
      console.error("Error loading maintenance reports:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los informes de mantenimiento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    setDeletingId(reportId);
    try {
      const { data: photoRecords, error: photosError } = await supabase
        .from("maintenance_report_photos")
        .select("storage_path")
        .eq("report_id", reportId);

      if (photosError) throw photosError;

      const pathsToRemove = (photoRecords ?? [])
        .map((record) => record.storage_path)
        .filter(Boolean);

      if (pathsToRemove.length > 0) {
        const { error: removeError } = await supabase.storage
          .from("maintenance-report-photos")
          .remove(pathsToRemove);

        if (removeError) {
          console.warn("No se pudieron eliminar algunas fotos del almacenamiento:", removeError);
        }
      }

      const { error } = await supabase.from("maintenance_reports").delete().eq("id", reportId);
      if (error) throw error;

      setReports((prev) => prev.filter((report) => report.id !== reportId));
      toast({
        title: "Informe eliminado",
        description: "El informe de mantenimiento fue eliminado correctamente.",
      });
    } catch (error) {
      console.error("Error deleting maintenance report:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el informe. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formattedReports = useMemo(
    () =>
      reports.map((report) => ({
        ...report,
        displayStartDate: report.start_date
          ? new Date(report.start_date).toLocaleDateString("es-CO", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Sin fecha",
      })),
    [reports],
  );

  return (
    <div className="min-h-screen bg-gradient-industrial">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/home")}
              variant="outline"
              size="icon"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-1">Informes de Mantenimiento</h1>
              <p className="text-muted-foreground">
                Registros y seguimiento de mantenimiento industrial
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => navigate("/maintenance-reports/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Informe de Mantenimiento
          </Button>
        </div>

        {loading ? (
          <Card className="p-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <ClipboardList className="h-12 w-12 text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground">Cargando informes de mantenimiento...</p>
            </div>
          </Card>
        ) : formattedReports.length === 0 ? (
          <Card className="p-12 text-center">
            <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No hay informes registrados</h3>
            <p className="text-muted-foreground mb-6">
              Crea tu primer informe para comenzar a llevar el control de mantenimiento.
            </p>
            <Button onClick={() => navigate("/maintenance-reports/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Informe
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {formattedReports.map((report) => (
              <Card key={report.id} className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">
                      Empresa: {report.company || "Sin especificar"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {[
                        report.technician_name || "Técnico sin registrar",
                        report.displayStartDate,
                        report.equipment || "Equipo no indicado",
                        report.location_pg || "Ubicación no registrada",
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/maintenance-reports/${report.id}/edit`)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" disabled>
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este informe?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará permanentemente el informe de mantenimiento y sus
                            fotografías asociadas. ¿Deseas continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(report.id)}
                            disabled={deletingId === report.id}
                          >
                            {deletingId === report.id ? "Eliminando..." : "Eliminar"}
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
      </div>
    </div>
  );
};

export default MaintenanceReports;
