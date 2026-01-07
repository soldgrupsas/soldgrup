import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Importar los diferentes wizards
import MaintenanceReportWizard from "./MaintenanceReportWizard";
import ElevatorMaintenanceReportWizard from "./ElevatorMaintenanceReportWizard";

type EquipmentType = "elevadores" | "puentes-grua" | "mantenimientos-generales" | "legacy";

/**
 * Este componente detecta el tipo de informe y renderiza el wizard correcto.
 * 
 * - Informes con equipmentType "puentes-grua" -> ElevatorMaintenanceReportWizard con equipmentType="puentes-grua"
 * - Informes con equipmentType "elevadores" -> ElevatorMaintenanceReportWizard con equipmentType="elevadores"
 * - Informes con equipmentType "mantenimientos-generales" -> ElevatorMaintenanceReportWizard con equipmentType="mantenimientos-generales"
 * - Informes antiguos sin equipmentType -> Se detecta automáticamente basándose en los datos (trolleyGroup, carrosTesteros)
 * - Si tiene datos de puente grúa pero equipmentType="elevadores" -> Se corrige a "puentes-grua"
 */
const MaintenanceReportEditRouter = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [equipmentType, setEquipmentType] = useState<EquipmentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (!params.id || authLoading || !user) return;

    const detectReportType = async () => {
      try {
        // Obtener también las columnas dedicadas para detectar mejor el tipo
        const { data, error } = await supabase
          .from("maintenance_reports")
          .select("data, trolley_group, carros_testeros, motorreductor")
          .eq("id", params.id)
          .single();

        if (error) {
          console.error("Error cargando informe:", error);
          setError("No se pudo cargar el informe");
          setLoading(false);
          return;
        }

        if (!data) {
          setError("Informe no encontrado");
          setLoading(false);
          return;
        }

        // Detectar el tipo de equipo desde los datos guardados
        const reportData = data.data as any;
        
        console.log("[MaintenanceReportEditRouter] reportData.equipmentType:", reportData?.equipmentType);
        
        // LÓGICA SIMPLE Y DIRECTA:
        // 1. Si tiene equipmentType = "puentes-grua" → usar puentes-grua
        // 2. Si tiene equipmentType = "elevadores" → verificar si tiene datos de puente grúa
        // 3. Si tiene equipmentType = "mantenimientos-generales" → usar ese tipo
        // 4. Si no tiene equipmentType → usar legacy
        
        if (reportData?.equipmentType === "puentes-grua") {
          // Tipo explícito: puentes-grua
          console.log("[MaintenanceReportEditRouter] equipmentType es puentes-grua, usando wizard puentes-grua");
          setEquipmentType("puentes-grua");
        } else if (reportData?.equipmentType === "mantenimientos-generales") {
          // Tipo explícito: mantenimientos-generales
          console.log("[MaintenanceReportEditRouter] equipmentType es mantenimientos-generales");
          setEquipmentType("mantenimientos-generales");
        } else if (reportData?.equipmentType === "elevadores") {
          // Verificar si realmente es elevador o si tiene datos de puente grúa
          const hasBridgeCraneData = 
            (data.trolley_group && typeof data.trolley_group === 'object' && Object.keys(data.trolley_group as object).length > 0) ||
            (data.carros_testeros && typeof data.carros_testeros === 'object' && Object.keys(data.carros_testeros as object).length > 0) ||
            (reportData?.trolleyGroup && typeof reportData.trolleyGroup === 'object') ||
            (reportData?.trolleyData && typeof reportData.trolleyData === 'object');
          
          if (hasBridgeCraneData) {
            console.log("[MaintenanceReportEditRouter] Dice elevadores pero tiene datos de puente grúa, corrigiendo...");
            setEquipmentType("puentes-grua");
          } else {
            console.log("[MaintenanceReportEditRouter] equipmentType es elevadores");
            setEquipmentType("elevadores");
          }
        } else {
          // Sin equipmentType definido - usar legacy para no perder datos
          console.log("[MaintenanceReportEditRouter] Sin equipmentType, usando wizard legacy");
          setEquipmentType("legacy");
        }

        setLoading(false);
      } catch (err) {
        console.error("Error detectando tipo de informe:", err);
        setError("Error al detectar tipo de informe");
        setLoading(false);
      }
    };

    detectReportType();
  }, [params.id, authLoading, user, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Cargando informe...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-xl text-destructive mb-4">{error}</div>
          <button 
            onClick={() => navigate("/maintenance-reports")}
            className="text-primary hover:underline"
          >
            Volver a la lista de informes
          </button>
        </div>
      </div>
    );
  }

  // Renderizar el wizard correcto según el tipo detectado
  switch (equipmentType) {
    case "legacy":
      // Usar el MaintenanceReportWizard original para informes antiguos
      return <MaintenanceReportWizard />;
    
    case "puentes-grua":
      return <ElevatorMaintenanceReportWizard equipmentType="puentes-grua" />;
    
    case "elevadores":
      return <ElevatorMaintenanceReportWizard equipmentType="elevadores" />;
    
    case "mantenimientos-generales":
      return <ElevatorMaintenanceReportWizard equipmentType="mantenimientos-generales" />;
    
    default:
      // Por defecto usar el wizard legacy para no perder datos
      return <MaintenanceReportWizard />;
  }
};

export default MaintenanceReportEditRouter;

