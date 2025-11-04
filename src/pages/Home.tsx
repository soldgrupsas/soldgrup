import { useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Settings, ClipboardList, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MODULES } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut, loading, isAdmin, isAdminLoading, permissionsLoading } = useAuth();
  const { toast } = useToast();
  
  // Check module access
  const hasDashboardAccess = useModuleAccess(MODULES.DASHBOARD);
  const hasEquipmentAccess = useModuleAccess(MODULES.EQUIPMENT);
  const hasMaintenanceAccess = useModuleAccess(MODULES.MAINTENANCE_REPORTS);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleAdminPanelClick = () => {
    if (isAdminLoading) {
      return;
    }

    if (isAdmin) {
      navigate("/admin");
      return;
    }

    toast({
      title: "Acceso restringido",
      description: "Esta sección está restringida a administradores de la plataforma",
      variant: "destructive",
    });
  };

  const menuItems = useMemo(() => {
    const items = [];
    
    if (hasDashboardAccess) {
      items.push({
        title: "Propuestas Comerciales",
        description: "Crea y gestiona propuestas para tus clientes",
        icon: FileText,
        path: "/dashboard",
        color: "from-primary/20 to-primary/5",
        moduleKey: MODULES.DASHBOARD,
      });
    }
    
    if (hasEquipmentAccess) {
      items.push({
        title: "Equipos",
        description: "Gestión de equipos industriales",
        icon: Settings,
        path: "/equipment",
        color: "from-accent/20 to-accent/5",
        moduleKey: MODULES.EQUIPMENT,
      });
    }
    
    if (hasMaintenanceAccess) {
      items.push({
        title: "Informes de Mantenimiento",
        description: "Registros y seguimiento de mantenimiento",
        icon: ClipboardList,
        path: "/maintenance-reports",
        color: "from-secondary/20 to-secondary/5",
        moduleKey: MODULES.MAINTENANCE_REPORTS,
      });
    }
    
    return items;
  }, [hasDashboardAccess, hasEquipmentAccess, hasMaintenanceAccess]);

  // Fase 3 & 6: Renderizado progresivo - Solo bloquear por loading inicial, no por permissionsLoading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-industrial">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">Panel Principal</h1>
            <p className="text-muted-foreground">
              Bienvenido al sistema de gestión industrial
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleAdminPanelClick}
              size="lg"
              variant="secondary"
              disabled={isAdminLoading}
            >
              {isAdminLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Panel de administración
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="lg">
              <LogOut className="mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Fase 3: Renderizado progresivo - Mostrar skeleton mientras cargan permisos */}
        {permissionsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-8">
                <Skeleton className="h-16 w-16 rounded-lg mb-4" />
                <Skeleton className="h-7 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </div>
        ) : menuItems.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                No tienes acceso a ningún módulo. Contacta al administrador para obtener permisos.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {menuItems.map((item) => (
              <Card
                key={item.title}
                className="p-8 hover:shadow-elegant transition-all duration-300 cursor-pointer hover:scale-105"
                onClick={() => navigate(item.path)}
              >
                <div className={`bg-gradient-to-br ${item.color} rounded-lg p-4 w-fit mb-4`}>
                  <item.icon className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground mb-4">{item.description}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
