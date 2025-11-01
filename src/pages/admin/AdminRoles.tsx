import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

const AdminRoles = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al panel de administración
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">Administrar Roles</h1>
          <p className="text-muted-foreground">
            Esta sección estará disponible próximamente.
          </p>
        </div>

        <Card className="p-6">
          <p className="text-muted-foreground">
            Placeholder: aquí podrás crear, editar y asignar permisos avanzados para los roles
            del sistema.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default AdminRoles;
