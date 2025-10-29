import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, X, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ProposalItemsTable } from "@/components/ProposalItemsTable";
import { TechnicalSpecsTable } from "@/components/TechnicalSpecsTable";
import Model3DUploader from "@/components/Model3DUploader";

interface EquipmentWithDetails {
  id: string;
  name: string;
  description: string;
  images: { image_url: string; image_order: number }[];
  tables: { title: string; table_data: any; table_order: number }[];
}

const proposalSchema = z.object({
  offer_id: z.string().min(1, "El ID de la oferta es requerido"),
  presentation_date: z.date(),
  client: z.string().min(1, "El nombre del cliente es requerido"),
  contact_person: z.string().optional(),
  reference: z.string().optional(),
  soldgrup_contact: z.string().optional(),
  observations: z.string().optional(),
  offer_details: z.string().optional(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

const EditProposal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [availableEquipment, setAvailableEquipment] = useState<EquipmentWithDetails[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails[]>([]);
  const [equipmentToAdd, setEquipmentToAdd] = useState<string>("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [model3D, setModel3D] = useState<File | null>(null);
  const [model3DPreview, setModel3DPreview] = useState<string | File | null>(null);
  const [proposalItems, setProposalItems] = useState<any[]>([]);
  const [technicalSpecs, setTechnicalSpecs] = useState<string[][]>([]);

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      offer_id: "",
      presentation_date: new Date(),
      client: "",
      contact_person: "",
      reference: "",
      soldgrup_contact: "",
      observations: "",
      offer_details: "",
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
      fetchAvailableEquipment();
    }
  }, [user, id]);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files);
      setSelectedImages([...selectedImages, ...newImages]);
      
      newImages.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    setImagePreview(imagePreview.filter((_, i) => i !== index));
  };

  const handle3DModelSelect = (file: File) => {
    setModel3D(file);
    setModel3DPreview(file);
  };

  const handleRemove3DModel = () => {
    setModel3D(null);
    setModel3DPreview(null);
  };

  const fetchProposal = async () => {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        // Si la propuesta no tiene slug, generar uno automáticamente (para propuestas antiguas)
        if (!data.public_url_slug) {
          const { data: slugData } = await supabase.rpc("generate_proposal_slug");
          await supabase
            .from("proposals")
            .update({ public_url_slug: slugData })
            .eq("id", id);
        }

        form.reset({
          offer_id: data.offer_id || "",
          presentation_date: data.presentation_date ? new Date(data.presentation_date) : new Date(),
          client: data.client || "",
          contact_person: data.contact_person || "",
          reference: data.reference || "",
          soldgrup_contact: data.soldgrup_contact || "",
          observations: data.observations || "",
          offer_details: data.offer_details || "",
        });

        // Load technical specs
        if (data.technical_specs_table && Array.isArray(data.technical_specs_table)) {
          setTechnicalSpecs(data.technical_specs_table as string[][]);
        }

        // Load 3D model URL
        if (data.model_3d_url) {
          setModel3DPreview(data.model_3d_url);
        }

        // Load existing equipment
        const { data: existingEquipment, error: eqError } = await supabase
          .from("equipment_details")
          .select("*")
          .eq("proposal_id", id);

        if (eqError) throw eqError;

        if (existingEquipment && existingEquipment.length > 0) {
          const loadedEquipment = existingEquipment.map((eq: any) => ({
            id: eq.id,
            name: eq.equipment_name,
            description: eq.equipment_specs.description || "",
            images: eq.equipment_specs.images || [],
            tables: eq.equipment_specs.tables || [],
          }));
          setSelectedEquipment(loadedEquipment);
        }

        // Load proposal items
        const { data: items, error: itemsError } = await supabase
          .from("proposal_items")
          .select("*")
          .eq("proposal_id", id)
          .order("item_number");

        if (itemsError) throw itemsError;
        if (items) {
          setProposalItems(items);
        }

        // Load existing images
        const { data: images, error: imagesError } = await supabase
          .from("proposal_images")
          .select("*")
          .eq("proposal_id", id)
          .order("image_order");

        if (imagesError) throw imagesError;
        if (images) {
          setImagePreview(images.map((img: any) => img.image_url));
        }
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
      let updateData: any = {
        offer_id: data.offer_id,
        presentation_date: format(data.presentation_date, "yyyy-MM-dd"),
        client: data.client,
        contact_person: data.contact_person || null,
        reference: data.reference || null,
        soldgrup_contact: data.soldgrup_contact || null,
        observations: data.observations || null,
        offer_details: data.offer_details || null,
        technical_specs_table: technicalSpecs,
        updated_at: new Date().toISOString(),
      };

      // Upload 3D model if new one is selected
      if (model3D) {
        const fileExt = model3D.name.split(".").pop();
        const fileName = `${id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("3d-models")
          .upload(fileName, model3D);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("3d-models")
          .getPublicUrl(fileName);

        updateData.model_3d_url = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("proposals")
        .update(updateData)
        .eq("id", id);

      if (error) {
        console.error("Error updating proposal:", error);
        throw error;
      }

      // Delete existing equipment and insert new ones
      await supabase
        .from("equipment_details")
        .delete()
        .eq("proposal_id", id);

      if (selectedEquipment.length > 0) {
        const equipmentDetails = selectedEquipment.map((eq) => ({
          proposal_id: id,
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

      // Update proposal items
      await supabase
        .from("proposal_items")
        .delete()
        .eq("proposal_id", id);

      if (proposalItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("proposal_items")
          .insert(
            proposalItems.map((item) => ({
              proposal_id: id,
              item_number: item.item_number,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unit_price,
              total_price: item.total_price,
            }))
          );

        if (itemsError) throw itemsError;
      }

      // Upload new images if any
      if (selectedImages.length > 0) {
        await supabase
          .from("proposal_images")
          .delete()
          .eq("proposal_id", id);

        for (let i = 0; i < selectedImages.length; i++) {
          const file = selectedImages[i];
          const fileExt = file.name.split(".").pop();
          const fileName = `${id}-${i}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("proposal-images")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("proposal-images")
            .getPublicUrl(fileName);

          await supabase.from("proposal_images").insert({
            proposal_id: id,
            image_url: urlData.publicUrl,
            image_order: i,
          });
        }
      }

      toast({
        title: "Propuesta actualizada",
        description: "Los cambios se han guardado y están disponibles públicamente",
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
            <Card className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="offer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID de la Oferta *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="DEE - 001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="presentation_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Presentación *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <FormField
                  control={form.control}
                  name="client"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre del cliente" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_person"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Persona de Contacto</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre del contacto" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel>Referencia</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Información de referencia del proyecto..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="soldgrup_contact"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel>Contacto Soldgrup</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Información de contacto de Soldgrup..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Observaciones adicionales..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="offer_details"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel>Detalles de la Oferta</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Términos, condiciones, tiempos de entrega, etc..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>

            {/* Proposal Items Table */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Items de la Propuesta</h3>
              <ProposalItemsTable items={proposalItems} onChange={setProposalItems} />
            </Card>

            {/* Technical Specifications */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Especificaciones Técnicas</h3>
              <TechnicalSpecsTable data={technicalSpecs} onChange={setTechnicalSpecs} />
            </Card>

            {/* Images */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Imágenes</h3>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="mb-4"
              />
              {imagePreview.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {imagePreview.map((preview, index) => (
                    <div key={index} className="relative">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 3D Model */}
            {/* 3D Model */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Modelo 3D</h3>
              <Model3DUploader 
                onFileSelect={handle3DModelSelect}
                preview={model3DPreview || undefined}
                onRemove={handleRemove3DModel}
              />
            </Card>

            {/* Equipment Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Equipos</h3>
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
                    Agregar
                  </Button>
                </div>
              </div>

              {selectedEquipment.map((equipment, index) => (
                <Card key={index} className="p-6 relative mb-4">
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
            </Card>

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
