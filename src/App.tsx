import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
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
          <Route path="/maintenance-reports/new" element={<ProtectedRoute><MaintenanceReportWizard /></ProtectedRoute>} />
          <Route path="/maintenance-reports/:id/edit" element={<ProtectedRoute><MaintenanceReportWizard /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
