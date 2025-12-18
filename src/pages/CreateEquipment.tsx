import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
  Check,
  Loader2,
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
    Array<{ id: string; url: string; order: number }>
  >([]);
  const [originalImages, setOriginalImages] = useState<
    Array<{ id: string; url: string; order: number }>
  >([]);
  const [tables, setTables] = useState<CustomTable[]>([]);
  
  // Autosave states
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const initialLoadRef = useRef(true);
  const equipmentIdRef = useRef<string | null>(id || null);

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
        const imagesWithId = imagesData.map((img) => ({
          id: img.id,
          url: img.image_url,
          order: img.image_order,
        }));
        setExistingImages(imagesWithId);
        setOriginalImages(imagesWithId);
      }

      equipmentIdRef.current = equipmentData.id;
      setLastSavedAt(new Date(equipmentData.updated_at || equipmentData.created_at));
      initialLoadRef.current = false;

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

  const extractStoragePath = (publicUrl: string): string | null => {
    try {
      // Handle different Supabase URL formats:
      // 1. https://[project].supabase.co/storage/v1/object/public/proposal-images/[path]
      // 2. https://[project].supabase.co/storage/v1/object/public/proposal-images/[path]?t=timestamp
      // 3. CDN URLs or custom domains
      
      // Remove query parameters first
      const urlWithoutQuery = publicUrl.split('?')[0];
      
      // Try standard pattern
      let urlPattern = /\/storage\/v1\/object\/public\/proposal-images\/(.+)$/;
      let match = urlWithoutQuery.match(urlPattern);
      if (match) {
        return decodeURIComponent(match[1]);
      }
      
      // Try alternative pattern (in case of CDN or different URL structure)
      urlPattern = /proposal-images\/(.+)$/;
      match = urlWithoutQuery.match(urlPattern);
      if (match) {
        return decodeURIComponent(match[1]);
      }
      
      // Try extracting from full path
      const urlObj = new URL(urlWithoutQuery);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.findIndex(part => part === 'proposal-images');
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'));
      }
      
      return null;
    } catch (error) {
      console.warn("Error extracting storage path from URL:", publicUrl, error);
      return null;
    }
  };

  const findStoragePathByUrl = async (equipmentId: string, publicUrl: string): Promise<string | null> => {
    try {
      // Alternative approach: list files in the equipment folder and match by URL
      const searchInFolder = async (folderPath: string): Promise<string | null> => {
        const { data: files, error } = await supabase.storage
          .from("proposal-images")
          .list(folderPath, {
            limit: 100,
            offset: 0,
          });

        if (error || !files) return null;

        // Compare URLs (without query params) for comparison
        const originalUrlClean = publicUrl.split('?')[0].toLowerCase();

        // Check all items - files have id, folders might not
        for (const file of files) {
          // Files typically have an id and image extensions
          const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name);
          
          // Only check files (those with id or image extension)
          if (file.id !== null || hasImageExtension) {
            const path = folderPath ? `${folderPath}/${file.name}` : file.name;
            
            try {
              const { data: { publicUrl: fileUrl } } = supabase.storage
                .from("proposal-images")
                .getPublicUrl(path);
              
              const fileUrlClean = fileUrl.split('?')[0].toLowerCase();
              
              if (originalUrlClean === fileUrlClean) {
                return path;
              }
            } catch (e) {
              // Skip if we can't get URL (might be a folder)
              continue;
            }
          }
        }

        // Check subfolders recursively (items without id and without image extension)
        for (const file of files) {
          const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name);
          
          if (file.id === null && !hasImageExtension) {
            const subfolderPath = folderPath ? `${folderPath}/${file.name}` : file.name;
            const result = await searchInFolder(subfolderPath);
            if (result) return result;
          }
        }

        return null;
      };

      return await searchInFolder(equipmentId);
    } catch (error) {
      console.warn("Error finding storage path by URL:", error);
      return null;
    }
  };

  const deleteRemovedImages = async (equipmentId: string) => {
    // Find images that were removed (in originalImages but not in existingImages)
    const currentImageIds = new Set(existingImages.map((img) => img.id));
    const removedImages = originalImages.filter((img) => !currentImageIds.has(img.id));

    if (removedImages.length === 0) return;

    // Delete from database
    const removedIds = removedImages.map((img) => img.id);
    const { error: deleteError } = await supabase
      .from("equipment_images")
      .delete()
      .in("id", removedIds);

    if (deleteError) throw deleteError;

    // Delete from storage
    const pathsToDelete: string[] = [];
    for (const img of removedImages) {
      let storagePath = extractStoragePath(img.url);
      
      // If extraction failed, try alternative method
      if (!storagePath) {
        console.warn(`Could not extract path from URL: ${img.url}, trying alternative method...`);
        storagePath = await findStoragePathByUrl(equipmentId, img.url);
      }
      
      if (storagePath) {
        pathsToDelete.push(storagePath);
      } else {
        console.warn(`Could not determine storage path for image: ${img.url}`);
      }
    }

    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("proposal-images")
        .remove(pathsToDelete);

      if (storageError) {
        console.warn("Error deleting images from storage:", storageError);
        // Don't throw - database deletion already succeeded
      }
    } else {
      console.warn("No storage paths found to delete, but images were removed from database");
    }
  };

  const uploadImages = useCallback(async (equipmentId: string, imagesToUpload: File[] = images) => {
    const uploadPromises = imagesToUpload.map(async (image, index) => {
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
  }, [images, existingImages.length]);

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

  const isSavingRef = useRef(false);

  const persistEquipment = useCallback(async () => {
    const equipmentId = equipmentIdRef.current;
    
    // Guard clause checks
    if (!equipmentId) {
      console.warn("persistEquipment: No equipmentId, skipping autosave");
      return;
    }
    
    if (isSavingRef.current) {
      console.warn("persistEquipment: Already saving, skipping");
      return;
    }
    
    if (!name.trim()) {
      console.warn("persistEquipment: No name, skipping autosave");
      return;
    }

    console.log("persistEquipment: Starting autosave for equipment", equipmentId);
    isSavingRef.current = true;
    setIsSaving(true);
    setPendingAutoSave(false);

    try {
      // Update main equipment data
      const { error: updateError } = await supabase
        .from("equipment")
        .update({
          name,
          description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", equipmentId);

      if (updateError) {
        console.error("Error actualizando equipo:", updateError);
        throw updateError;
      }

      console.log("persistEquipment: Equipment data updated successfully");

      // IMPORTANTE: Actualizar equipment_name en todas las propuestas que usan este equipo
      // Esto asegura que las propuestas siempre muestren el nombre actualizado del equipo
      try {
        const { error: updateProposalsError } = await supabase
          .from("equipment_details")
          .update({ 
            equipment_name: name,
            equipment_specs: null // Limpiar equipment_specs para forzar uso de datos frescos
          })
          .eq("equipment_id", equipmentId);

        if (updateProposalsError) {
          console.warn("Error actualizando propuestas con el nuevo nombre del equipo:", updateProposalsError);
          // No lanzar error, es una actualización secundaria
        } else {
          console.log("Propuestas actualizadas con el nuevo nombre del equipo");
        }
      } catch (updateProposalsErr) {
        console.warn("Error al actualizar propuestas:", updateProposalsErr);
        // No lanzar error, es una actualización secundaria
      }

      // Delete removed images
      const currentImageIds = new Set(existingImages.map((img) => img.id));
      const removedImages = originalImages.filter((img) => !currentImageIds.has(img.id));

      if (removedImages.length > 0) {
        const removedIds = removedImages.map((img) => img.id);
        const { error: deleteError } = await supabase
          .from("equipment_images")
          .delete()
          .in("id", removedIds);

        if (deleteError) {
          console.error("Error eliminando imágenes:", deleteError);
          throw deleteError;
        }

        // Delete from storage
        const pathsToDelete: string[] = [];
        for (const img of removedImages) {
          let storagePath = extractStoragePath(img.url);
          
          if (!storagePath) {
            storagePath = await findStoragePathByUrl(equipmentId, img.url);
          }
          
          if (storagePath) {
            pathsToDelete.push(storagePath);
          }
        }

        if (pathsToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("proposal-images")
            .remove(pathsToDelete);

          if (storageError) {
            console.warn("Error eliminando archivos de storage:", storageError);
            // No lanzar error, la eliminación de la BD ya se completó
          }
        }

        // Update original images after deletion
        setOriginalImages(existingImages);
      }

      // Save tables
      if (isEditMode) {
        const { error: deleteTablesError } = await supabase
          .from("equipment_tables")
          .delete()
          .eq("equipment_id", equipmentId);

        if (deleteTablesError) {
          console.error("Error eliminando tablas:", deleteTablesError);
          throw deleteTablesError;
        }
      }

      if (tables.length > 0) {
        const tablePromises = tables.map((table, index) => {
          return supabase.from("equipment_tables").insert({
            equipment_id: equipmentId,
            title: table.title,
            table_data: table.data,
            table_order: index,
          });
        });

        const results = await Promise.all(tablePromises);
        const errors = results.filter((r) => r.error).map((r) => r.error);
        if (errors.length > 0) {
          console.error("Error insertando tablas:", errors);
          throw errors[0];
        }
      }

      setLastSavedAt(new Date());
      console.log("persistEquipment: Autosave completed successfully");
    } catch (error) {
      console.error("Error en autoguardado:", error);
      // Don't show toast on autosave errors to avoid annoying the user
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      console.log("persistEquipment: Cleanup complete, isSavingRef set to false");
    }
  }, [name, description, existingImages, originalImages, tables, isEditMode]);

  // Serialize tables and images for comparison
  const tablesSerialized = useMemo(() => JSON.stringify(tables), [tables]);
  const existingImagesIdsSerialized = useMemo(() => 
    JSON.stringify(existingImages.map(img => img.id).sort()), 
    [existingImages]
  );

  // Autosave with debounce
  useEffect(() => {
    if (initialLoadRef.current) {
      console.log("Autosave effect: Skipping, initial load");
      return;
    }
    
    if (!equipmentIdRef.current) {
      console.log("Autosave effect: Skipping, no equipmentId");
      return;
    }

    // Don't autosave if currently saving
    if (isSavingRef.current) {
      console.log("Autosave effect: Skipping, already saving");
      return;
    }

    console.log("Autosave effect: Scheduling autosave", { 
      imagesCount: images.length, 
      name, 
      tablesCount: tables.length 
    });
    setPendingAutoSave(true);

    const handler = setTimeout(async () => {
      console.log("Autosave effect: Timer fired, starting autosave process");
      
      const equipmentId = equipmentIdRef.current;
      if (!equipmentId) {
        console.warn("Autosave effect: No equipmentId, aborting");
        return;
      }

      // Capture current state to avoid stale closures
      const currentImages = [...images];
      const currentExistingImagesCount = existingImages.length;
      
      // If there are new images, upload them first
      if (currentImages.length > 0) {
        try {
          console.log("Autosave effect: Uploading new images first", currentImages.length);
          isSavingRef.current = true;
          setIsSaving(true);
          setPendingAutoSave(false);
          
          // Upload images manually here to avoid closure issues
          const uploadPromises = currentImages.map(async (image, index) => {
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
                image_order: currentExistingImagesCount + index,
              });

            if (dbError) throw dbError;
          });

          await Promise.all(uploadPromises);
          
          console.log("Autosave effect: Images uploaded successfully");
          
          // Clear uploaded images after successful upload
          setImages([]);
          
          // Refresh existing images after upload
          const { data: imagesData } = await supabase
            .from("equipment_images")
            .select("*")
            .eq("equipment_id", equipmentId)
            .order("image_order");

          if (imagesData) {
            const imagesWithId = imagesData.map((img) => ({
              id: img.id,
              url: img.image_url,
              order: img.image_order,
            }));
            setExistingImages(imagesWithId);
            setOriginalImages(imagesWithId);
            console.log("Autosave effect: Existing images refreshed", imagesWithId.length);
          }
          
          isSavingRef.current = false;
          setIsSaving(false);
          setLastSavedAt(new Date());
        } catch (error) {
          console.error("Error uploading images in autosave:", error);
          isSavingRef.current = false;
          setIsSaving(false);
          // Continue with other saves even if image upload fails
        }
      }
      
      // Then persist the rest (name, description, tables, deleted images)
      await persistEquipment();
    }, 1500); // Debounce time to 1.5 seconds

    return () => {
      console.log("Autosave effect: Cleaning up timer");
      clearTimeout(handler);
    };
  }, [name, description, tablesSerialized, existingImagesIdsSerialized, persistEquipment, images.length]);

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
      let equipmentId = equipmentIdRef.current || id;

      if (isEditMode) {
        if (!equipmentId) {
          throw new Error("ID de equipo no encontrado");
        }

        const { error: updateError } = await supabase
          .from("equipment")
          .update({
            name,
            description,
            updated_at: new Date().toISOString(),
          })
          .eq("id", equipmentId);

        if (updateError) throw updateError;

        // IMPORTANTE: Actualizar equipment_name en todas las propuestas que usan este equipo
        try {
          const { error: updateProposalsError } = await supabase
            .from("equipment_details")
            .update({ 
              equipment_name: name,
              equipment_specs: null // Limpiar equipment_specs para forzar uso de datos frescos
            })
            .eq("equipment_id", equipmentId);

          if (updateProposalsError) {
            console.warn("Error actualizando propuestas con el nuevo nombre del equipo:", updateProposalsError);
            // No lanzar error, es una actualización secundaria
          }
        } catch (updateProposalsErr) {
          console.warn("Error al actualizar propuestas:", updateProposalsErr);
          // No lanzar error, es una actualización secundaria
        }

        // Delete removed images in edit mode
        await deleteRemovedImages(equipmentId);
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
        equipmentIdRef.current = data.id;
      }

      // Upload new images
      if (images.length > 0) {
        await uploadImages(equipmentId!);
        setImages([]); // Clear uploaded images
      }

      // Save tables
      await saveTables(equipmentId!);

      // Update original images after uploads
      if (isEditMode && images.length === 0) {
        // Refresh existing images
        const { data: imagesData } = await supabase
          .from("equipment_images")
          .select("*")
          .eq("equipment_id", equipmentId)
          .order("image_order");

        if (imagesData) {
          const imagesWithId = imagesData.map((img) => ({
            id: img.id,
            url: img.image_url,
            order: img.image_order,
          }));
          setExistingImages(imagesWithId);
          setOriginalImages(imagesWithId);
        }
      }

      setLastSavedAt(new Date());

      toast({
        title: "Éxito",
        description: isEditMode
          ? "Equipo actualizado correctamente"
          : "Equipo creado correctamente",
      });

      // Only navigate away if creating new equipment
      if (!isEditMode) {
        navigate("/equipment");
      }
    } catch (error: any) {
      console.error("Error saving equipment:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el equipo",
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
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">
              {isEditMode ? "Editar Equipo" : "Crear Nuevo Equipo"}
            </h1>
            <p className="text-muted-foreground">
              Completa los datos del equipo
            </p>
          </div>
          {isEditMode && equipmentIdRef.current && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : pendingAutoSave ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Pendiente...</span>
                </>
              ) : lastSavedAt ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span>
                    Guardado {new Intl.DateTimeFormat("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format(lastSavedAt)}
                  </span>
                </>
              ) : null}
            </div>
          )}
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
                      <div key={img.id} className="relative group">
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
