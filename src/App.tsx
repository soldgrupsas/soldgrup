import { Toaster } from "@/components/ui/toaster";
// Build timestamp: 2026-01-09T15:30:00 - Force rebuild
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import CreateProposal from "./pages/CreateProposal";
import PublicProposal from "./pages/PublicProposal";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import EquipmentList from "./pages/EquipmentList";
import CreateEquipment from "./pages/CreateEquipment";
import NotFound from "./pages/NotFound";
import AdminPanel from "./pages/admin/AdminPanel";
import AdminRoles from "./pages/admin/AdminRoles";
import MaintenanceReports from "./pages/MaintenanceReports";
import MaintenanceReportWizard from "./pages/MaintenanceReportWizard";
import MaintenanceReportTypeSelector from "./pages/MaintenanceReportTypeSelector";
import ElevatorMaintenanceReportWizard from "./pages/ElevatorMaintenanceReportWizard";
import GeneralMaintenanceReport from "./pages/GeneralMaintenanceReport";
import BridgeCraneMaintenanceReport from "./pages/BridgeCraneMaintenanceReport";
import MaintenanceReportEditRouter from "./pages/MaintenanceReportEditRouter";
import TimeControl from "./pages/TimeControl";

// Crear queryClient FUERA del componente para evitar recreación en cada render
// Esto previene que QueryClientProvider se remonte y cause duplicación de la UI
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

// Obtener la ruta base desde la configuración de Vite
// Si COOLIFY_URL está definido, usar "/" (Coolify con dominio personalizado)
// En producción con GitHub Pages, usar "/soldgrup/", en desarrollo usar "/"
const baseUrl = import.meta.env.BASE_URL || 
                (import.meta.env.PROD ? (import.meta.env.VITE_COOLIFY_URL ? "/" : "/soldgrup/") : "/");

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={baseUrl}>
          <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/view/:slug" element={<PublicProposal />} />
          {/* Protected routes */}
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute><AdminRoles /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateProposal /></ProtectedRoute>} />
          <Route path="/edit/:id" element={<ProtectedRoute><CreateProposal /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/equipment" element={<ProtectedRoute><EquipmentList /></ProtectedRoute>} />
          <Route path="/equipment/create" element={<ProtectedRoute><CreateEquipment /></ProtectedRoute>} />
          <Route path="/equipment/edit/:id" element={<ProtectedRoute><CreateEquipment /></ProtectedRoute>} />
          <Route path="/maintenance-reports" element={<ProtectedRoute><MaintenanceReports /></ProtectedRoute>} />
          <Route path="/maintenance-reports/new" element={<ProtectedRoute><MaintenanceReportTypeSelector /></ProtectedRoute>} />
          <Route path="/maintenance-reports/new/puentes-grua" element={<ProtectedRoute><BridgeCraneMaintenanceReport /></ProtectedRoute>} />
          <Route path="/maintenance-reports/new/elevadores" element={<ProtectedRoute><ElevatorMaintenanceReportWizard equipmentType="elevadores" /></ProtectedRoute>} />
          <Route path="/maintenance-reports/new/mantenimientos-generales" element={<ProtectedRoute><GeneralMaintenanceReport /></ProtectedRoute>} />
          <Route path="/maintenance-reports/:id/edit" element={<ProtectedRoute><MaintenanceReportEditRouter /></ProtectedRoute>} />
          <Route path="/time-control" element={<ProtectedRoute><TimeControl /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
