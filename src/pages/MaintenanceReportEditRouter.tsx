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
        
        // Verificar si tiene datos de puente grúa (en columnas dedicadas o en data)
        const hasBridgeCraneData = 
          // Verificar columnas dedicadas
          (data.trolley_group && typeof data.trolley_group === 'object' && Object.keys(data.trolley_group as object).length > 0) ||
          (data.carros_testeros && typeof data.carros_testeros === 'object' && Object.keys(data.carros_testeros as object).length > 0) ||
          (data.motorreductor && typeof data.motorreductor === 'object' && Object.keys(data.motorreductor as object).length > 0) ||
          // Verificar en el campo data
          (reportData?.trolleyGroup && typeof reportData.trolleyGroup === 'object') ||
          (reportData?.trolleyData && typeof reportData.trolleyData === 'object' && reportData.trolleyData.mainStatus !== null) ||
          (reportData?.carrosTesteros && typeof reportData.carrosTesteros === 'object' && 
           (reportData.carrosTesteros.mainStatus !== null || 
            (Array.isArray(reportData.carrosTesteros.subItems) && reportData.carrosTesteros.subItems.some((item: any) => item.status !== null))));
        
        console.log("[MaintenanceReportEditRouter] hasBridgeCraneData:", hasBridgeCraneData);
        
        // LÓGICA MEJORADA:
        // 1. Si tiene datos de puente grúa → SIEMPRE usar puentes-grua (incluso si equipmentType dice elevadores)
        // 2. Si tiene equipmentType guardado y NO tiene datos de puente grúa → usar el tipo guardado
        // 3. Si NO tiene equipmentType ni datos de puente grúa → usar legacy
        
        if (hasBridgeCraneData) {
          // IMPORTANTE: Si tiene datos de puente grúa, usar el wizard de puentes grúa
          // Esto corrige informes que fueron convertidos incorrectamente
          console.log("[MaintenanceReportEditRouter] Detectados datos de puente grúa, usando wizard puentes-grua");
          setEquipmentType("puentes-grua");
        } else if (reportData?.equipmentType) {
          // Informe con equipmentType guardado y sin datos de puente grúa
          console.log("[MaintenanceReportEditRouter] Usando tipo guardado:", reportData.equipmentType);
          setEquipmentType(reportData.equipmentType);
        } else {
          // Informe EXISTENTE sin equipmentType ni datos de puente grúa
          // Usar el wizard original para no perder datos
          console.log("[MaintenanceReportEditRouter] Informe sin tipo definido, usando wizard legacy");
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

