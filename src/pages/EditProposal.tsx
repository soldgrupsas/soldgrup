import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const proposalSchema = z.object({
  client_name: z.string().min(1, "El nombre del cliente es requerido"),
  project_name: z.string().min(1, "El nombre del proyecto es requerido"),
  client_contact: z.string().optional(),
  client_email: z.string().email("Email inválido").optional().or(z.literal("")),
  client_phone: z.string().optional(),
  project_location: z.string().optional(),
  status: z.enum(["draft", "published"]),
  payment_terms: z.string().optional(),
  delivery_time: z.string().optional(),
  terms_conditions: z.string().optional(),
  notes: z.string().optional(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

const EditProposal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      client_name: "",
      project_name: "",
      client_contact: "",
      client_email: "",
      client_phone: "",
      project_location: "",
      status: "draft",
      payment_terms: "",
      delivery_time: "",
      terms_conditions: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchProposal();
    }
  }, [user, id]);

  const fetchProposal = async () => {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          client_name: data.client_name || "",
          project_name: data.project_name || "",
          client_contact: data.client_contact || "",
          client_email: data.client_email || "",
          client_phone: data.client_phone || "",
          project_location: data.project_location || "",
          status: (data.status === "published" ? "published" : "draft") as "draft" | "published",
          payment_terms: data.payment_terms || "",
          delivery_time: data.delivery_time || "",
          terms_conditions: data.terms_conditions || "",
          notes: data.notes || "",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProposalFormData) => {
    try {
      // Si se está publicando y no hay slug, generar uno
      let updateData: any = {
        client_name: data.client_name,
        project_name: data.project_name,
        client_contact: data.client_contact || null,
        client_email: data.client_email || null,
        client_phone: data.client_phone || null,
        project_location: data.project_location || null,
        status: data.status,
        payment_terms: data.payment_terms || null,
        delivery_time: data.delivery_time || null,
        terms_conditions: data.terms_conditions || null,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      };

      // Si se está publicando y no tiene slug, generar uno
      if (data.status === "published") {
        const { data: currentProposal } = await supabase
          .from("proposals")
          .select("public_url_slug")
          .eq("id", id)
          .single();

        if (!currentProposal?.public_url_slug) {
          const { data: slugData } = await supabase.rpc("generate_proposal_slug");
          updateData.public_url_slug = slugData;
        }
      }

      const { error } = await supabase
        .from("proposals")
        .update(updateData)
        .eq("id", id);

      if (error) {
        console.error("Error updating proposal:", error);
        throw error;
      }

      toast({
        title: "Propuesta actualizada",
        description: data.status === "published" 
          ? "La propuesta ha sido publicada y está disponible públicamente"
          : "La propuesta ha sido actualizada exitosamente",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la propuesta",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Dashboard
        </Button>

        <h1 className="text-4xl font-bold mb-8">Editar Propuesta</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado de la Propuesta</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="published">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Publicada (Visible públicamente)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Las propuestas publicadas generan una URL pública que puedes compartir con tus clientes
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Cliente *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Proyecto *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona de Contacto</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email del Cliente</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono del Cliente</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="project_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ubicación del Proyecto</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Términos de Pago</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delivery_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tiempo de Entrega</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terms_conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Términos y Condiciones</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={6} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas Adicionales</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="submit" size="lg">
                Guardar Cambios
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => navigate("/dashboard")}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default EditProposal;
