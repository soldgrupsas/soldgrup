import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EquipmentWithDetails {
  id: string;
  name: string;
  description: string;
  images: { image_url: string; image_order: number }[];
  tables: { title: string; table_data: any; table_order: number }[];
}

const CreateProposal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [availableEquipment, setAvailableEquipment] = useState<EquipmentWithDetails[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails[]>([]);
  const [equipmentToAdd, setEquipmentToAdd] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      toast({
        title: "Acceso denegado",
        description: "Debes iniciar sesión para crear propuestas",
        variant: "destructive",
      });
    }
  }, [user, authLoading, navigate, toast]);

  useEffect(() => {
    if (user) {
      fetchAvailableEquipment();
    }
  }, [user]);

  const fetchAvailableEquipment = async () => {
    try {
      const { data: equipment, error: equipmentError } = await supabase
        .from("equipment")
        .select("*")
        .order("name");

      if (equipmentError) throw equipmentError;

      const equipmentWithDetails = await Promise.all(
        (equipment || []).map(async (eq) => {
          const [imagesResult, tablesResult] = await Promise.all([
            supabase
              .from("equipment_images")
              .select("image_url, image_order")
              .eq("equipment_id", eq.id)
              .order("image_order"),
            supabase
              .from("equipment_tables")
              .select("title, table_data, table_order")
              .eq("equipment_id", eq.id)
              .order("table_order"),
          ]);

          return {
            id: eq.id,
            name: eq.name,
            description: eq.description || "",
            images: imagesResult.data || [],
            tables: tablesResult.data || [],
          };
        })
      );

      setAvailableEquipment(equipmentWithDetails);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el listado de equipos",
        variant: "destructive",
      });
    }
  };

  const handleAddEquipment = () => {
    if (!equipmentToAdd) return;
    
    const equipment = availableEquipment.find((eq) => eq.id === equipmentToAdd);
    if (equipment) {
      setSelectedEquipment([...selectedEquipment, equipment]);
      setEquipmentToAdd("");
    }
  };

  const handleRemoveEquipment = (index: number) => {
    setSelectedEquipment(selectedEquipment.filter((_, i) => i !== index));
  };
  const [formData, setFormData] = useState({
    client_name: "",
    client_contact: "",
    client_email: "",
    client_phone: "",
    project_name: "",
    project_location: "",
    engineer_name: "",
    engineer_title: "",
    notes: "",
    terms_conditions: "",
    payment_terms: "",
    delivery_time: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("proposals")
        .insert([formData])
        .select()
        .single();

      if (error) {
        // Provide more specific error messages for RLS policy violations
        if (error.code === '42501' || error.message.includes('row-level security')) {
          throw new Error(
            'No tienes permisos para crear propuestas. Por favor, contacta al administrador para que te asigne un rol de usuario.'
          );
        }
        throw error;
      }

      // Save selected equipment
      if (selectedEquipment.length > 0) {
        const equipmentDetails = selectedEquipment.map((eq) => ({
          proposal_id: data.id,
          equipment_name: eq.name,
          equipment_specs: {
            description: eq.description,
            images: eq.images,
            tables: eq.tables,
          },
        }));

        const { error: equipmentError } = await supabase
          .from("equipment_details")
          .insert(equipmentDetails);

        if (equipmentError) throw equipmentError;
      }

      toast({
        title: "Propuesta creada",
        description: "La propuesta ha sido creada exitosamente",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Dashboard
        </Button>

        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-6">Nueva Propuesta Comercial</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="client_name">Nombre del Cliente *</Label>
                <Input
                  id="client_name"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_contact">Contacto</Label>
                <Input
                  id="client_contact"
                  name="client_contact"
                  value={formData.client_contact}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_email">Email</Label>
                <Input
                  id="client_email"
                  name="client_email"
                  type="email"
                  value={formData.client_email}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_phone">Teléfono</Label>
                <Input
                  id="client_phone"
                  name="client_phone"
                  value={formData.client_phone}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_name">Nombre del Proyecto *</Label>
                <Input
                  id="project_name"
                  name="project_name"
                  value={formData.project_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_location">Ubicación del Proyecto</Label>
                <Input
                  id="project_location"
                  name="project_location"
                  value={formData.project_location}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engineer_name">Nombre del Ingeniero</Label>
                <Input
                  id="engineer_name"
                  name="engineer_name"
                  value={formData.engineer_name}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engineer_title">Cargo del Ingeniero</Label>
                <Input
                  id="engineer_title"
                  name="engineer_title"
                  value={formData.engineer_title}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_terms">Términos de Pago</Label>
                <Input
                  id="payment_terms"
                  name="payment_terms"
                  value={formData.payment_terms}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_time">Tiempo de Entrega</Label>
                <Input
                  id="delivery_time"
                  name="delivery_time"
                  value={formData.delivery_time}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms_conditions">Términos y Condiciones</Label>
              <Textarea
                id="terms_conditions"
                name="terms_conditions"
                value={formData.terms_conditions}
                onChange={handleChange}
                rows={4}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Equipos</Label>
                <div className="flex gap-2">
                  <Select value={equipmentToAdd} onValueChange={setEquipmentToAdd}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Seleccionar equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEquipment.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={handleAddEquipment}
                    disabled={!equipmentToAdd}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Equipo
                  </Button>
                </div>
              </div>

              {selectedEquipment.map((equipment, index) => (
                <Card key={index} className="p-6 relative">
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-4 right-4"
                    onClick={() => handleRemoveEquipment(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <h3 className="text-xl font-bold mb-2">{equipment.name}</h3>
                  
                  {equipment.description && (
                    <p className="text-muted-foreground mb-4">
                      {equipment.description}
                    </p>
                  )}

                  {equipment.images.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Imágenes</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {equipment.images.map((img, imgIndex) => (
                          <img
                            key={imgIndex}
                            src={img.image_url}
                            alt={`${equipment.name} - ${imgIndex + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {equipment.tables.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold">Tablas</h4>
                      {equipment.tables.map((table, tableIndex) => (
                        <div key={tableIndex} className="border rounded-lg p-4">
                          <h5 className="font-medium mb-2">{table.title}</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <tbody>
                                {table.table_data.map((row: any[], rowIndex: number) => (
                                  <tr key={rowIndex}>
                                    {row.map((cell: any, cellIndex: number) => (
                                      <td
                                        key={cellIndex}
                                        className="border border-border p-2"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear Propuesta"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreateProposal;
