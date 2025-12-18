import ElevatorMaintenanceReportWizard from "./ElevatorMaintenanceReportWizard";

// Usa el mismo wizard de elevadores para puentes grúa
// Por ahora, ambos tipos de informes usan la misma estructura
const BridgeCraneMaintenanceReport = () => {
  return <ElevatorMaintenanceReportWizard equipmentType="puentes-grua" />;
};

export default BridgeCraneMaintenanceReport;


