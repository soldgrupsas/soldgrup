import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Users, ShieldCheck } from "lucide-react";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, isAdminLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !isAdminLoading && !isAdmin) {
      toast({
        title: "Acceso restringido",
        description: "Esta sección está restringida a administradores de la plataforma",
        variant: "destructive",
      });
      navigate("/home");
    }
  }, [isAdmin, loading, navigate, toast]);

  if (loading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const menuItems = [
    {
      title: "Administrar Usuarios",
      description: "Gestiona los accesos y credenciales del equipo",
      icon: Users,
      action: () => navigate("/admin/users"),
    },
    {
      title: "Administrar Roles",
      description: "Configura los permisos disponibles en la plataforma",
      icon: ShieldCheck,
      action: () => navigate("/admin/roles"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" onClick={() => navigate("/home")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Button>

        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold mb-2">Panel de administración</h1>
          <p className="text-muted-foreground mb-8">
            Selecciona la sección que deseas gestionar.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {menuItems.map((item) => (
              <Card
                key={item.title}
                className="p-6 hover:shadow-xl transition-shadow cursor-pointer"
                onClick={item.action}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-muted rounded-full p-3">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{item.title}</h2>
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
