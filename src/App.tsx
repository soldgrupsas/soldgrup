import { Toaster } from "@/components/ui/toaster";
// Build version: v2.2.0 - 2026-02-17T00:00:00 - DEPLOY WITH AUTH_PROVIDER AND TZ FIXES
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";

// Auth se carga de inmediato porque es la primera pantalla; el resto se carga
// bajo demanda (code-splitting) para aligerar la descarga inicial en gama baja.
// lazyWithRetry reintenta ante fallos de red y recarga si el chunk quedó obsoleto.
import Auth from "@/pages/Auth";
const Home = lazyWithRetry(() => import("@/pages/Home"), "Home");
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"), "Dashboard");
const CreateProposal = lazyWithRetry(() => import("@/pages/CreateProposal"), "CreateProposal");
const PublicProposal = lazyWithRetry(() => import("@/pages/PublicProposal"), "PublicProposal");
const UserManagement = lazyWithRetry(() => import("@/pages/UserManagement"), "UserManagement");
const EquipmentList = lazyWithRetry(() => import("@/pages/EquipmentList"), "EquipmentList");
const CreateEquipment = lazyWithRetry(() => import("@/pages/CreateEquipment"), "CreateEquipment");
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"), "NotFound");
const AdminPanel = lazyWithRetry(() => import("@/pages/admin/AdminPanel"), "AdminPanel");
const AdminRoles = lazyWithRetry(() => import("@/pages/admin/AdminRoles"), "AdminRoles");
const MaintenanceReports = lazyWithRetry(() => import("@/pages/MaintenanceReports"), "MaintenanceReports");
const MaintenanceReportTypeSelector = lazyWithRetry(() => import("@/pages/MaintenanceReportTypeSelector"), "MaintenanceReportTypeSelector");
const ElevatorMaintenanceReportWizard = lazyWithRetry(() => import("@/pages/ElevatorMaintenanceReportWizard"), "ElevatorMaintenanceReportWizard");
const GeneralMaintenanceReport = lazyWithRetry(() => import("@/pages/GeneralMaintenanceReport"), "GeneralMaintenanceReport");
const BridgeCraneMaintenanceReport = lazyWithRetry(() => import("@/pages/BridgeCraneMaintenanceReport"), "BridgeCraneMaintenanceReport");
const MaintenanceReportEditRouter = lazyWithRetry(() => import("@/pages/MaintenanceReportEditRouter"), "MaintenanceReportEditRouter");
const TimeControl = lazyWithRetry(() => import("@/pages/TimeControl"), "TimeControl");

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-xl">Cargando...</div>
  </div>
);

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

// Ruta base (debe coincidir con vite.config base: "/" en Coolify, "/soldgrup/" en GitHub Pages)
const baseUrl = import.meta.env.BASE_URL || "/";

const App = () => {
  // Log para debugging
  console.log("App iniciando...", { baseUrl, env: import.meta.env.MODE });
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter basename={baseUrl}>
              <Suspense fallback={<PageLoader />}>
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
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
