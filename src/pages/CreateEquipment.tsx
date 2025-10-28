import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CustomTable {
  id: string;
  title: string;
  data: string[][];
}

const CreateEquipment = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<
    Array<{ url: string; order: number }>
  >([]);
  const [tables, setTables] = useState<CustomTable[]>([]);

  const isEditMode = !!id;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (isEditMode && user) {
      fetchEquipment();
    }
  }, [isEditMode, user, id]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const { data: equipmentData, error: equipmentError } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", id)
        .single();

      if (equipmentError) throw equipmentError;

      setName(equipmentData.name);
      setDescription(equipmentData.description || "");

      const { data: imagesData } = await supabase
        .from("equipment_images")
        .select("*")
        .eq("equipment_id", id)
        .order("image_order");

      if (imagesData) {
        setExistingImages(
          imagesData.map((img) => ({ url: img.image_url, order: img.image_order }))
        );
      }

      const { data: tablesData } = await supabase
        .from("equipment_tables")
        .select("*")
        .eq("equipment_id", id)
        .order("table_order");

      if (tablesData) {
        setTables(
          tablesData.map((t) => ({
            id: t.id,
            title: t.title,
            data: t.table_data as string[][],
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching equipment:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el equipo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages([...images, ...Array.from(e.target.files)]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const addTable = () => {
    setTables([
      ...tables,
      {
        id: crypto.randomUUID(),
        title: "",
        data: [
          ["", ""],
          ["", ""],
        ],
      },
    ]);
  };

  const removeTable = (tableId: string) => {
    setTables(tables.filter((t) => t.id !== tableId));
  };

  const updateTableTitle = (tableId: string, title: string) => {
    setTables(
      tables.map((t) => (t.id === tableId ? { ...t, title } : t))
    );
  };

  const updateTableCell = (
    tableId: string,
    rowIndex: number,
    colIndex: number,
    value: string
  ) => {
    setTables(
      tables.map((t) => {
        if (t.id === tableId) {
          const newData = [...t.data];
          newData[rowIndex][colIndex] = value;
          return { ...t, data: newData };
        }
        return t;
      })
    );
  };

  const addRow = (tableId: string) => {
    setTables(
      tables.map((t) => {
        if (t.id === tableId) {
          const numCols = t.data[0]?.length || 2;
          return { ...t, data: [...t.data, Array(numCols).fill("")] };
        }
        return t;
      })
    );
  };

  const removeRow = (tableId: string, rowIndex: number) => {
    setTables(
      tables.map((t) => {
        if (t.id === tableId && t.data.length > 1) {
          return { ...t, data: t.data.filter((_, i) => i !== rowIndex) };
        }
        return t;
      })
    );
  };

  const addColumn = (tableId: string) => {
    setTables(
      tables.map((t) => {
        if (t.id === tableId) {
          return { ...t, data: t.data.map((row) => [...row, ""]) };
        }
        return t;
      })
    );
  };

  const removeColumn = (tableId: string, colIndex: number) => {
    setTables(
      tables.map((t) => {
        if (t.id === tableId && t.data[0].length > 1) {
          return {
            ...t,
            data: t.data.map((row) => row.filter((_, i) => i !== colIndex)),
          };
        }
        return t;
      })
    );
  };

  const uploadImages = async (equipmentId: string) => {
    const uploadPromises = images.map(async (image, index) => {
      const fileExt = image.name.split(".").pop();
      const fileName = `${equipmentId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("proposal-images")
        .upload(fileName, image);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("proposal-images").getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("equipment_images")
        .insert({
          equipment_id: equipmentId,
          image_url: publicUrl,
          image_order: existingImages.length + index,
        });

      if (dbError) throw dbError;
    });

    await Promise.all(uploadPromises);
  };

  const saveTables = async (equipmentId: string) => {
    if (isEditMode) {
      await supabase
        .from("equipment_tables")
        .delete()
        .eq("equipment_id", equipmentId);
    }

    const tablePromises = tables.map((table, index) => {
      return supabase.from("equipment_tables").insert({
        equipment_id: equipmentId,
        title: table.title,
        table_data: table.data,
        table_order: index,
      });
    });

    await Promise.all(tablePromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del equipo es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let equipmentId = id;

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from("equipment")
          .update({
            name,
            description,
          })
          .eq("id", id);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("equipment")
          .insert({
            name,
            description,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        equipmentId = data.id;
      }

      if (images.length > 0) {
        await uploadImages(equipmentId!);
      }

      await saveTables(equipmentId!);

      toast({
        title: "Éxito",
        description: isEditMode
          ? "Equipo actualizado correctamente"
          : "Equipo creado correctamente",
      });

      navigate("/equipment");
    } catch (error) {
      console.error("Error saving equipment:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el equipo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (isEditMode && loading)) {
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate("/equipment")}
            variant="outline"
            size="icon"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {isEditMode ? "Editar Equipo" : "Crear Nuevo Equipo"}
            </h1>
            <p className="text-muted-foreground">
              Completa los datos del equipo
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Información General</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del Equipo *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Compresor Industrial XYZ-100"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción detallada del equipo..."
                  rows={4}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Imágenes</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="images" className="cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                    <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click para seleccionar imágenes
                    </p>
                  </div>
                </Label>
                <Input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {existingImages.length > 0 && (
                <div>
                  <Label>Imágenes existentes</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    {existingImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.url}
                          alt={`Existente ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeExistingImage(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {images.length > 0 && (
                <div>
                  <Label>Nuevas imágenes ({images.length})</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    {images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-center mt-1 truncate">
                          {image.name}
                        </p>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Tablas Personalizadas</h2>
              <Button type="button" onClick={addTable} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Agregar Tabla
              </Button>
            </div>

            {tables.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay tablas agregadas. Las tablas son opcionales.
              </p>
            ) : (
              <div className="space-y-6">
                {tables.map((table, tableIndex) => (
                  <Card key={table.id} className="p-4 bg-muted/50">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 mr-4">
                        <Label>Título de la Tabla</Label>
                        <Input
                          value={table.title}
                          onChange={(e) =>
                            updateTableTitle(table.id, e.target.value)
                          }
                          placeholder="Ej: Especificaciones Técnicas"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeTable(table.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <tbody>
                          {table.data.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, colIndex) => (
                                <td key={colIndex} className="p-1">
                                  <Input
                                    value={cell}
                                    onChange={(e) =>
                                      updateTableCell(
                                        table.id,
                                        rowIndex,
                                        colIndex,
                                        e.target.value
                                      )
                                    }
                                    placeholder={`Celda ${rowIndex + 1}-${
                                      colIndex + 1
                                    }`}
                                  />
                                </td>
                              ))}
                              <td className="p-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeRow(table.id, rowIndex)}
                                  disabled={table.data.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addRow(table.id)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Fila
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addColumn(table.id)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Columna
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          removeColumn(table.id, table.data[0].length - 1)
                        }
                        disabled={table.data[0].length <= 1}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar Última Columna
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/equipment")}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Guardando..."
                : isEditMode
                ? "Actualizar Equipo"
                : "Guardar Equipo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEquipment;
