import ElevatorMaintenanceReportWizard from "./ElevatorMaintenanceReportWizard";

// Usa el mismo wizard de elevadores para mantenimientos generales
// Por ahora, ambos tipos de informes usan la misma estructura
const GeneralMaintenanceReport = () => {
  return <ElevatorMaintenanceReportWizard />;
};

export default GeneralMaintenanceReport;

