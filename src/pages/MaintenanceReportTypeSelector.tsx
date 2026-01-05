import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Wrench, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const MaintenanceReportTypeSelector = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Bloqueos temporales
  const ELEVATORS_BLOCKED = true;
  const GENERAL_BLOCKED = true;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, navigate, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-industrial">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-industrial">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate("/maintenance-reports")}
            variant="outline"
            size="icon"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold mb-1">Nuevo Informe de Mantenimiento</h1>
            <p className="text-muted-foreground">
              Seleccione el tipo de informe que desea crear
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Puentes grúa */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/maintenance-reports/new/puentes-grua")}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Building2 className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Puentes grúa</h3>
              <p className="text-sm text-muted-foreground">
                Informe de mantenimiento para puentes grúa
              </p>
              <Button className="w-full mt-4">
                Seleccionar
              </Button>
            </div>
          </Card>

          {/* Elevadores */}
          <Card className={`p-6 transition-shadow ${
            ELEVATORS_BLOCKED
              ? "opacity-60 cursor-not-allowed"
              : "hover:shadow-lg cursor-pointer"
          }`} onClick={() => {
            if (ELEVATORS_BLOCKED) {
              return;
            }
            navigate("/maintenance-reports/new/elevadores");
          }}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-blue-500/10">
                <Wrench className="h-12 w-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold">Elevadores</h3>
              <p className="text-sm text-muted-foreground">
                Informe de mantenimiento para elevadores
              </p>
              <Button className="w-full mt-4" disabled={ELEVATORS_BLOCKED}>
                Seleccionar
              </Button>
              {ELEVATORS_BLOCKED && (
                <div className="mt-2 p-2 bg-muted rounded-lg text-center">
                  <p className="text-xs font-semibold text-muted-foreground">Próximamente</p>
                </div>
              )}
            </div>
          </Card>

          {/* Generales */}
          <Card className={`p-6 transition-shadow ${
            GENERAL_BLOCKED
              ? "opacity-60 cursor-not-allowed"
              : "hover:shadow-lg cursor-pointer"
          }`} onClick={() => {
            if (GENERAL_BLOCKED) {
              return;
            }
            navigate("/maintenance-reports/new/mantenimientos-generales");
          }}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-gray-500/10">
                <Settings className="h-12 w-12 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold">Generales</h3>
              <p className="text-sm text-muted-foreground">
                Informe de mantenimientos generales
              </p>
              <Button className="w-full mt-4" disabled={GENERAL_BLOCKED}>
                Seleccionar
              </Button>
              {GENERAL_BLOCKED && (
                <div className="mt-2 p-2 bg-muted rounded-lg text-center">
                  <p className="text-xs font-semibold text-muted-foreground">Próximamente</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceReportTypeSelector;

