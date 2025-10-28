import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import CreateProposal from "./pages/CreateProposal";
import EditProposal from "./pages/EditProposal";
import PublicProposal from "./pages/PublicProposal";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import EquipmentList from "./pages/EquipmentList";
import CreateEquipment from "./pages/CreateEquipment";
import NotFound from "./pages/NotFound";

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
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<CreateProposal />} />
          <Route path="/edit/:id" element={<EditProposal />} />
          <Route path="/view/:slug" element={<PublicProposal />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/equipment" element={<EquipmentList />} />
          <Route path="/equipment/create" element={<CreateEquipment />} />
          <Route path="/equipment/edit/:id" element={<CreateEquipment />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
