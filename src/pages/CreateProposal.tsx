import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, X, CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProposalItemsTable, ProposalItem } from "@/components/ProposalItemsTable";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";
import Model3DUploader from "@/components/Model3DUploader";
import { TechnicalSpecsTable, SpecTableData } from "@/components/TechnicalSpecsTable";

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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selected3DModel, setSelected3DModel] = useState<File | null>(null);
  const [model3DPreview, setModel3DPreview] = useState<string | null>(null);
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([
    {
      item_number: 1,
      description: "",
      quantity: 0,
      unit_price: 0,
      total_price: 0,
    },
  ]);
  const [technicalSpecs, setTechnicalSpecs] = useState<SpecTableData>([
    ["", ""],
    ["", ""],
  ]);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedImages([...selectedImages, ...files]);

    // Create previews
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  const handleRemoveImage = (index: number) => {
    // Revoke the object URL to free memory
    URL.revokeObjectURL(imagePreviews[index]);
    
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handle3DModelSelect = (file: File) => {
    setSelected3DModel(file);
    setModel3DPreview(URL.createObjectURL(file));
  };

  const handleRemove3DModel = () => {
    if (model3DPreview) {
      URL.revokeObjectURL(model3DPreview);
    }
    setSelected3DModel(null);
    setModel3DPreview(null);
  };

  const [formData, setFormData] = useState({
    offer_id: "",
    presentation_date: new Date(),
    client: "",
    contact_person: "",
    reference: "",
    soldgrup_contact: "",
    observations: "",
    offer_details: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const proposalData = {
        offer_id: formData.offer_id,
        presentation_date: format(formData.presentation_date, "yyyy-MM-dd"),
        client: formData.client,
        contact_person: formData.contact_person,
        reference: formData.reference,
        soldgrup_contact: formData.soldgrup_contact,
        observations: formData.observations,
        client_name: formData.client || "",
        project_name: formData.reference || "",
        technical_specs_table: technicalSpecs,
        offer_details: formData.offer_details,
      };

      const { data, error } = await supabase
        .from("proposals")
        .insert([proposalData])
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

      // Save proposal items
      if (proposalItems.length > 0) {
        const itemsToInsert = proposalItems.map((item) => ({
          proposal_id: data.id,
          item_number: item.item_number,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          unit: "unidad",
        }));

        const { error: itemsError } = await supabase
          .from("proposal_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Upload images to Storage and save references
      if (selectedImages.length > 0) {
        const imageRecords = [];

        for (let i = 0; i < selectedImages.length; i++) {
          const file = selectedImages[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${data.id}/${Date.now()}-${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('proposal-images')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('proposal-images')
            .getPublicUrl(fileName);

          imageRecords.push({
            proposal_id: data.id,
            image_url: publicUrl,
            image_order: i + 1,
          });
        }

        if (imageRecords.length > 0) {
          const { error: imagesError } = await supabase
            .from("proposal_images")
            .insert(imageRecords);

          if (imagesError) throw imagesError;
        }
      }

      // Upload 3D model to Storage and save reference
      if (selected3DModel) {
        const fileExt = selected3DModel.name.split('.').pop();
        const fileName = `${data.id}/${Date.now()}-model.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('3d-models')
          .upload(fileName, selected3DModel);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('3d-models')
            .getPublicUrl(fileName);

          await supabase
            .from('proposals')
            .update({ model_3d_url: publicUrl })
            .eq('id', data.id);
        } else {
          console.error('Error uploading 3D model:', uploadError);
        }
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
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleRichTextChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
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
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="offer_id">ID de la oferta</Label>
                <Input
                  id="offer_id"
                  name="offer_id"
                  value={formData.offer_id}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Fecha de presentación</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.presentation_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.presentation_date ? (
                        format(formData.presentation_date, "PPP", { locale: es })
                      ) : (
                        <span>Seleccione una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.presentation_date}
                      onSelect={(date) =>
                        setFormData({ ...formData, presentation_date: date || new Date() })
                      }
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Cliente</Label>
                <Input
                  id="client"
                  name="client"
                  value={formData.client}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Persona de Contacto</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Referencia</Label>
                <RichTextEditor
                  value={formData.reference}
                  onChange={(value) => handleRichTextChange("reference", value)}
                  placeholder="Ingrese la referencia de la propuesta..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="soldgrup_contact">Persona de Contacto en Soldgrup</Label>
                <RichTextEditor
                  value={formData.soldgrup_contact}
                  onChange={(value) => handleRichTextChange("soldgrup_contact", value)}
                  placeholder="Ingrese nombre, cargo, email, celular..."
                />
                <p className="text-sm text-muted-foreground">
                  Ingrese aquí nombre, cargo, email, celular de la persona que presenta la propuesta comercial.
                </p>
              </div>
            </div>

            <ProposalItemsTable
              items={proposalItems}
              onChange={setProposalItems}
            />

            <div className="space-y-2">
              <Label htmlFor="observations">Observaciones</Label>
              <RichTextEditor
                value={formData.observations}
                onChange={(value) => handleRichTextChange("observations", value)}
                placeholder="Ingrese las observaciones de la propuesta..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="images">Imágenes</Label>
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="cursor-pointer"
              />
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Visualizador Proyecto 3D</Label>
              <Model3DUploader
                onFileSelect={handle3DModelSelect}
                preview={model3DPreview || undefined}
                onRemove={handleRemove3DModel}
              />
              <p className="text-sm text-muted-foreground">
                Formatos soportados: GLB, GLTF. Tamaño máximo: 50MB
              </p>
            </div>

            <TechnicalSpecsTable
              data={technicalSpecs}
              onChange={setTechnicalSpecs}
            />

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

            <div className="space-y-2">
              <Label htmlFor="offer_details">Detalles de la oferta</Label>
              <RichTextEditor
                value={formData.offer_details}
                onChange={(value) => handleRichTextChange("offer_details", value)}
                placeholder="Incluya aquí los detalles de la oferta..."
              />
              <p className="text-sm text-muted-foreground">
                Incluya aquí: Forma de Pago, Tiempos de entrega, Validez de la oferta, Garantía y cualquier comentario adicional relevante.
              </p>
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
