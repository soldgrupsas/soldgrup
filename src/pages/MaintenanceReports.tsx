import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";

const MaintenanceReports = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-industrial">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/home")}
              variant="outline"
              size="icon"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Informes de Mantenimiento
              </h1>
              <p className="text-muted-foreground">
                Registros y seguimiento de mantenimiento industrial
              </p>
            </div>
          </div>
          <Button size="lg">
            <Plus className="mr-2" />
            Nuevo Informe de Mantenimiento
          </Button>
        </div>

        <Card className="p-12 text-center">
          <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">
            Aquí podrás gestionar tus informes
          </h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Esta sección estará disponible próximamente. Podrás registrar,
            consultar y descargar los informes de mantenimiento de todos tus
            equipos industriales.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default MaintenanceReports;
