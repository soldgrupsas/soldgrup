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
import { ArrowLeft } from "lucide-react";

const CreateProposal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

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
