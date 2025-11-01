import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Settings, ClipboardList, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut, loading, isAdmin, isAdminLoading } = useAuth();
  const { toast } = useToast();

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

  const menuItems = [
    {
      title: "Propuestas Comerciales",
      description: "Crea y gestiona propuestas para tus clientes",
      icon: FileText,
      path: "/dashboard",
      color: "from-primary/20 to-primary/5",
    },
    {
      title: "Equipos",
      description: "Gestión de equipos industriales",
      icon: Settings,
      path: "/equipment",
      color: "from-accent/20 to-accent/5",
    },
    {
      title: "Informes de Mantenimiento",
      description: "Registros y seguimiento de mantenimiento",
      icon: ClipboardList,
      path: "/maintenance-reports",
      color: "from-secondary/20 to-secondary/5",
      disabled: false,
    },
  ];

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
              {item.disabled && (
                <span className="text-xs text-muted-foreground italic">
                  Próximamente disponible
                </span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
