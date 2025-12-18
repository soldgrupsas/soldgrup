import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Plus, ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Equipment {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

const EquipmentList = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchEquipment();
    }
  }, [user]);

  const fetchEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el listado de equipos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      // IMPORTANTE: Primero eliminar las referencias en equipment_details
      // Esto asegura que las propuestas no queden con referencias huérfanas
      const { error: deleteDetailsError } = await supabase
        .from("equipment_details")
        .delete()
        .eq("equipment_id", id);

      if (deleteDetailsError) {
        console.warn("Error eliminando referencias en propuestas:", deleteDetailsError);
        // Continuar de todas formas, la foreign key puede manejar esto
      }

      // Ahora eliminar el equipo
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;

      setEquipment((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: "Equipo eliminado",
        description: "El equipo fue eliminado correctamente de todas las propuestas.",
      });
    } catch (error) {
      console.error("Error deleting equipment:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el equipo. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || loading) {
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
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/home")}
              variant="outline"
              size="icon"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-2">Equipos</h1>
              <p className="text-muted-foreground">
                Gestión de equipos industriales
              </p>
            </div>
          </div>
          <Button onClick={() => navigate("/equipment/create")} size="lg">
            <Plus className="mr-2" />
            Crear Nuevo Equipo
          </Button>
        </div>

        {equipment.length === 0 ? (
          <Card className="p-12 text-center">
            <Settings className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              No hay equipos registrados
            </h3>
            <p className="text-muted-foreground mb-6">
              Comienza creando tu primer equipo
            </p>
            <Button onClick={() => navigate("/equipment/create")}>
              <Plus className="mr-2" />
              Crear Primer Equipo
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {equipment.map((item) => (
              <Card
                key={item.id}
                className="p-6 hover:shadow-elegant transition-all duration-300 cursor-pointer hover:scale-105"
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("[data-action='delete-equipment']")) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  navigate(`/equipment/edit/${item.id}`);
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg p-4 w-fit">
                    <Settings className="h-8 w-8" />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(event) => event.stopPropagation()}
                        data-action="delete-equipment"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent
                      onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          ¿Eliminar este equipo?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Eliminaremos el equipo
                          seleccionado y todos sus datos asociados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-action="delete-equipment"
                          onClick={() => handleDelete(item.id)}
                        >
                          {deletingId === item.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <h3 className="text-xl font-bold mb-2">{item.name}</h3>
                <p className="text-muted-foreground line-clamp-2">
                  {item.description || "Sin descripción"}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Creado: {new Date(item.created_at).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentList;
