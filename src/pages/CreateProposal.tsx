import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { generateUniqueProposalSlug } from "@/lib/slug";
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
  const params = useParams<{ id?: string }>();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  
  // Autosave states
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const initialLoadRef = useRef(true);
  const isCreatingInitialRef = useRef(false);
  const justLoadedRef = useRef(false);
  const lastSaveCompletedRef = useRef<Date | null>(null);
  const [availableEquipment, setAvailableEquipment] = useState<EquipmentWithDetails[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails[]>([]);
  const [equipmentToAdd, setEquipmentToAdd] = useState<string>("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
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

  // Session expiration handler
  const handleSessionExpired = useCallback(() => {
    toast({
      title: "Sesión expirada",
      description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
      variant: "destructive",
    });
    navigate("/auth");
  }, [toast, navigate]);

  // Error handler
  const isAuthError = (error: any): boolean => {
    if (!error) return false;
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';
    return (
      errorMessage.includes('refresh token') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('jwt') ||
      errorCode === 'invalid_refresh_token' ||
      errorCode === '401' ||
      error?.status === 401
    );
  };

  const handleSupabaseError = useCallback((error: any, fallbackMessage: string) => {
    console.error(fallbackMessage, error);
    if (isAuthError(error)) {
      handleSessionExpired();
      return;
    }
    toast({
      title: "Error",
      description: fallbackMessage,
      variant: "destructive",
    });
  }, [handleSessionExpired, toast]);

  // Create initial proposal
  const createInitialProposal = async () => {
    // Prevenir múltiples creaciones
    if (isCreatingInitialRef.current || proposalId) {
      return proposalId;
    }
    
    isCreatingInitialRef.current = true;
    
    try {
      if (!user?.id) {
        isCreatingInitialRef.current = false;
        return null;
      }

      const { data: slugData, error: slugError } = await supabase.rpc("generate_proposal_slug");
      if (slugError) {
        isCreatingInitialRef.current = false;
        throw slugError;
      }

      const proposalData = {
        offer_id: "",
        presentation_date: format(new Date(), "yyyy-MM-dd"),
        client: "",
        contact_person: "",
        reference: "",
        soldgrup_contact: "",
        observations: "",
        technical_specs_table: [["", ""], ["", ""]],
        offer_details: "",
        public_url_slug: slugData,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from("proposals")
        .insert([proposalData])
        .select()
        .single();

      if (error) throw error;

      setProposalId(data.id);
      setLastSavedAt(new Date());
      
      toast({
        title: "Propuesta iniciada",
        description: "Autoguardado activado - Tus cambios se guardarán automáticamente",
      });

      isCreatingInitialRef.current = false;
      return data.id;
    } catch (error: any) {
      isCreatingInitialRef.current = false;
      handleSupabaseError(error, "Error al crear la propuesta inicial");
      return null;
    }
  };

  // Load existing proposal
  const loadExistingProposal = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        // Restore form data
        setFormData({
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
          setTechnicalSpecs(data.technical_specs_table as SpecTableData);
        }

        // Load 3D model URL
        if (data.model_3d_url) {
          setModel3DPreview(data.model_3d_url);
        }

        // Load existing images
        const { data: images, error: imagesError } = await supabase
          .from("proposal_images")
          .select("*")
          .eq("proposal_id", id)
          .order("image_order");

        if (imagesError) throw imagesError;
        if (images) {
          const urls = images.map((img: any) => img.image_url);
          setExistingImageUrls(urls);
          setImagePreviews(urls);
        }

        // Load existing equipment
        // Now we load equipment dynamically from the equipment table using equipment_id
        const { data: existingEquipment, error: eqError } = await supabase
          .from("equipment_details")
          .select("*")
          .eq("proposal_id", id);

        if (eqError) throw eqError;

        if (existingEquipment && existingEquipment.length > 0) {
          console.log("Equipment found in proposal:", existingEquipment.length, existingEquipment);
          
          // RECOVERY: First, try to recover lost equipment from equipment_specs
          const equipmentToRecover = existingEquipment.filter(
            (eq: any) => !eq.equipment_id && eq.equipment_specs?.id
          );
          
          if (equipmentToRecover.length > 0) {
            console.log(`Recuperando ${equipmentToRecover.length} equipos desde equipment_specs...`);
            try {
              // Try to restore equipment_id from equipment_specs
              await Promise.all(
                equipmentToRecover.map(async (eq: any) => {
                  const equipmentId = eq.equipment_specs?.id;
                  if (equipmentId) {
                    // Verify equipment still exists
                    const { data: equipmentExists } = await supabase
                      .from("equipment")
                      .select("id")
                      .eq("id", equipmentId)
                      .single();
                    
                    if (equipmentExists) {
                      // Restore equipment_id
                      await supabase
                        .from("equipment_details")
                        .update({ equipment_id: equipmentId })
                        .eq("id", eq.id);
                    }
                  }
                })
              );
            } catch (recoveryError) {
              console.warn("Error during equipment recovery:", recoveryError);
            }
          }

          // Load equipment data - try both equipment_id and equipment_specs.id
          const equipmentIds: string[] = [];
          existingEquipment.forEach((eq: any) => {
            if (eq.equipment_id) {
              equipmentIds.push(eq.equipment_id);
            } else if (eq.equipment_specs?.id) {
              equipmentIds.push(eq.equipment_specs.id);
            }
          });
          
          console.log("Equipment IDs to load:", equipmentIds);

          if (equipmentIds.length > 0) {
            try {
              // Fetch current equipment data from equipment table
              const { data: equipmentData, error: equipmentDataError } = await supabase
                .from("equipment")
                .select("id, name, description")
                .in("id", equipmentIds);

              if (equipmentDataError) {
                console.warn("Error loading equipment dynamically, using fallback:", equipmentDataError);
                // Fallback to equipment_specs if dynamic load fails
                throw equipmentDataError;
              }

              // Check if any equipment was deleted (exists in equipment_details but not in equipment table)
              const foundEquipmentIds = new Set((equipmentData || []).map(eq => eq.id));
              const missingEquipmentIds = equipmentIds.filter(id => !foundEquipmentIds.has(id));
              
              if (missingEquipmentIds.length > 0) {
                console.warn("Some equipment was deleted but still referenced in proposal:", missingEquipmentIds);
                // Remove references to deleted equipment silently
                try {
                  const { error: deleteError } = await supabase
                    .from("equipment_details")
                    .delete()
                    .eq("proposal_id", id)
                    .in("equipment_id", missingEquipmentIds);
                  
                  if (deleteError) {
                    console.warn("Error removing deleted equipment references:", deleteError);
                    // Continue anyway, we'll just skip loading those equipment
                  }
                } catch (deleteErr) {
                  console.warn("Error removing deleted equipment references:", deleteErr);
                  // Continue anyway
                }
              }

              // Fetch all images and tables in batch queries (more efficient than per-equipment)
              const equipmentIdsArray = (equipmentData || []).map(eq => eq.id);
              
              const [allImagesResult, allTablesResult] = await Promise.all([
                equipmentIdsArray.length > 0
                  ? supabase
                      .from("equipment_images")
                      .select("equipment_id, image_url, image_order")
                      .in("equipment_id", equipmentIdsArray)
                      .order("equipment_id, image_order")
                  : Promise.resolve({ data: [], error: null }),
                equipmentIdsArray.length > 0
                  ? supabase
                      .from("equipment_tables")
                      .select("equipment_id, title, table_data, table_order")
                      .in("equipment_id", equipmentIdsArray)
                      .order("equipment_id, table_order")
                  : Promise.resolve({ data: [], error: null }),
              ]);

              // Group images and tables by equipment_id
              const imagesByEquipment = new Map<string, any[]>();
              const tablesByEquipment = new Map<string, any[]>();

              (allImagesResult.data || []).forEach((img: any) => {
                if (!imagesByEquipment.has(img.equipment_id)) {
                  imagesByEquipment.set(img.equipment_id, []);
                }
                imagesByEquipment.get(img.equipment_id)!.push({
                  image_url: img.image_url,
                  image_order: img.image_order,
                });
              });

              (allTablesResult.data || []).forEach((table: any) => {
                if (!tablesByEquipment.has(table.equipment_id)) {
                  tablesByEquipment.set(table.equipment_id, []);
                }
                tablesByEquipment.get(table.equipment_id)!.push({
                  title: table.title,
                  table_data: table.table_data,
                  table_order: table.table_order,
                });
              });

              // Map equipment data with grouped images and tables
              const loadedEquipment = (equipmentData || []).map((eq) => ({
                id: eq.id,
                name: eq.name,
                description: eq.description || "",
                images: imagesByEquipment.get(eq.id) || [],
                tables: tablesByEquipment.get(eq.id) || [],
              }));

              setSelectedEquipment(loadedEquipment);

              // IMPORTANTE: Actualizar equipment_name en equipment_details si ha cambiado
              // Esto asegura que siempre esté sincronizado con la tabla equipment
              try {
                await Promise.all(
                  (equipmentData || []).map(async (eq) => {
                    const existingDetail = existingEquipment.find((ed: any) => ed.equipment_id === eq.id);
                    if (existingDetail && existingDetail.equipment_name !== eq.name) {
                      // El nombre ha cambiado, actualizar
                      await supabase
                        .from("equipment_details")
                        .update({ 
                          equipment_name: eq.name,
                          equipment_specs: null // Limpiar equipment_specs para usar datos frescos
                        })
                        .eq("id", existingDetail.id);
                    }
                  })
                );
              } catch (updateError) {
                console.warn("Error actualizando equipment_name en propuestas:", updateError);
                // No lanzar error, es una actualización secundaria
              }

              // Migrate old data: Update equipment_details to use equipment_id if not already set
              const needsMigration = existingEquipment.some((eq: any) => !eq.equipment_id && eq.equipment_specs?.id);
              if (needsMigration) {
                try {
                  await Promise.all(
                    existingEquipment
                      .filter((eq: any) => !eq.equipment_id && eq.equipment_specs?.id)
                      .map((eq: any) =>
                        supabase
                          .from("equipment_details")
                          .update({ equipment_id: eq.equipment_specs.id })
                          .eq("id", eq.id)
                      )
                  );
                  console.log("Migrated equipment_details to use equipment_id");
                } catch (migrationError) {
                  console.warn("Error migrating equipment_details:", migrationError);
                  // Don't throw, migration is not critical
                }
              }
            } catch (dynamicLoadError) {
              console.warn("Failed to load equipment dynamically, using fallback from equipment_specs:", dynamicLoadError);
              // Fallback: Load from equipment_specs for backward compatibility with old data
              const loadedEquipment = existingEquipment
                .filter((eq: any) => eq.equipment_specs?.id)
                .map((eq: any) => ({
                  id: eq.equipment_specs.id,
                  name: eq.equipment_name || eq.equipment_specs.name || "Equipo sin nombre",
                  description: eq.equipment_specs.description || "",
                  images: eq.equipment_specs.images || [],
                  tables: eq.equipment_specs.tables || [],
                }));
              
              console.log("Loaded equipment from fallback:", loadedEquipment.length);
              if (loadedEquipment.length > 0) {
                setSelectedEquipment(loadedEquipment);
                // Try to restore equipment_id for future loads
                try {
                  await Promise.all(
                    existingEquipment
                      .filter((eq: any) => eq.equipment_specs?.id && !eq.equipment_id)
                      .map(async (eq: any) => {
                        const equipmentId = eq.equipment_specs.id;
                        const { data: equipmentExists } = await supabase
                          .from("equipment")
                          .select("id")
                          .eq("id", equipmentId)
                          .single();
                        
                        if (equipmentExists) {
                          await supabase
                            .from("equipment_details")
                            .update({ equipment_id: equipmentId })
                            .eq("id", eq.id);
                        }
                      })
                  );
                } catch (recoveryError) {
                  console.warn("Error recovering equipment_id:", recoveryError);
                }
              }
            }
          } else {
            // No equipment_ids found, try loading from equipment_specs
            console.log("No equipment_ids found, trying to load from equipment_specs");
            const loadedEquipment = existingEquipment
              .filter((eq: any) => eq.equipment_specs?.id)
              .map((eq: any) => ({
                id: eq.equipment_specs.id,
                name: eq.equipment_name || eq.equipment_specs.name || "Equipo sin nombre",
                description: eq.equipment_specs.description || "",
                images: eq.equipment_specs.images || [],
                tables: eq.equipment_specs.tables || [],
              }));
            
            console.log("Loaded equipment from equipment_specs:", loadedEquipment.length);
            if (loadedEquipment.length > 0) {
              setSelectedEquipment(loadedEquipment);
              // Try to restore equipment_id for future loads
              try {
                await Promise.all(
                  existingEquipment
                    .filter((eq: any) => eq.equipment_specs?.id && !eq.equipment_id)
                    .map(async (eq: any) => {
                      const equipmentId = eq.equipment_specs.id;
                      const { data: equipmentExists } = await supabase
                        .from("equipment")
                        .select("id")
                        .eq("id", equipmentId)
                        .single();
                      
                      if (equipmentExists) {
                        await supabase
                          .from("equipment_details")
                          .update({ equipment_id: equipmentId })
                          .eq("id", eq.id);
                      }
                    })
                );
              } catch (recoveryError) {
                console.warn("Error recovering equipment_id:", recoveryError);
              }
            }
          }
        } else {
          console.log("No equipment found in proposal");
        }

        // Load proposal items
        const { data: items, error: itemsError } = await supabase
          .from("proposal_items")
          .select("*")
          .eq("proposal_id", id)
          .order("item_number");

        if (itemsError) throw itemsError;
        if (items && items.length > 0) {
          setProposalItems(items.map((item: any) => ({
            item_number: item.item_number,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          })));
        }

        setProposalId(id);
        setLastSavedAt(new Date(data.updated_at || data.created_at));
        
        // Mark that we just loaded to prevent immediate autosave
        justLoadedRef.current = true;
        setTimeout(() => {
          justLoadedRef.current = false;
        }, 2000); // Wait 2 seconds before allowing autosave after load
      }
    } catch (error: any) {
      console.error("Error loading proposal:", error);
      const errorMessage = error?.message || "Error desconocido";
      
      // Provide more specific error messages
      if (errorMessage.includes("equipment") || errorMessage.includes("equipo")) {
        handleSupabaseError(
          error,
          "Error al cargar los equipos. La propuesta se cargó pero algunos equipos pueden no mostrarse correctamente."
        );
        // Don't navigate away, let user see what loaded
      } else {
        handleSupabaseError(error, "Error al cargar la propuesta");
        navigate("/dashboard");
      }
    }
  };

  // Persist proposal (autosave)
  const persistProposal = async () => {
    if (!proposalId || isSaving) return;

    setIsSaving(true);
    setPendingAutoSave(false);

    try {
      // Update main proposal data
      const { error: updateError } = await supabase
        .from("proposals")
        .update({
          offer_id: formData.offer_id,
          presentation_date: format(formData.presentation_date, "yyyy-MM-dd"),
          client: formData.client,
          contact_person: formData.contact_person,
          reference: formData.reference,
          soldgrup_contact: formData.soldgrup_contact,
          observations: formData.observations,
          technical_specs_table: technicalSpecs,
          offer_details: formData.offer_details,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      if (updateError) throw updateError;

      // Sync proposal items (delete and insert)
      await supabase.from("proposal_items").delete().eq("proposal_id", proposalId);
      
      const itemsToInsert = proposalItems
        .filter(item => item.description)
        .map((item) => ({
          proposal_id: proposalId,
          item_number: item.item_number,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          unit: "unidad",
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("proposal_items")
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      // Sync equipment details (delete and insert) - Same simple approach as proposal_items
      // IMPORTANTE: Preparar datos ANTES de eliminar para evitar pérdida de datos si hay error
      const validEquipment = selectedEquipment.filter(eq => eq.id && eq.name);
      
      // Preparar datos para insertar ANTES de eliminar
      // Usar formato legacy (equipment_specs) que es compatible con la BD actual
      const equipmentDetails = validEquipment.map((eq) => ({
        proposal_id: proposalId,
        equipment_name: eq.name!,
        equipment_specs: {
          id: eq.id,
          description: eq.description || "",
          images: eq.images || [],
          tables: eq.tables || [],
        },
      }));

      console.log("Equipment sync - Valid:", validEquipment.length, "Total selected:", selectedEquipment.length);
      
      // Si hay equipos seleccionados pero ninguno es válido, limpiar estado sin tocar la BD
      if (selectedEquipment.length > 0 && validEquipment.length === 0) {
        console.warn("Selected equipment has invalid data, clearing selection:", selectedEquipment);
        setSelectedEquipment([]);
        // No eliminar de BD, dejar los equipos existentes
        // Continuar para que se ejecute el finally y se resetee el estado de guardado
        console.log("Propuesta guardada exitosamente (equipos inválidos fueron ignorados)");
      } else {
        // Solo sincronizar equipos si hay equipos válidos o si no hay equipos seleccionados
        // Eliminar todos los equipos existentes
        await supabase.from("equipment_details").delete().eq("proposal_id", proposalId);

        // Insertar solo si hay equipos válidos
        if (equipmentDetails.length > 0) {
          console.log("Inserting equipment:", equipmentDetails.length, "items");
          const { error: equipmentError } = await supabase
            .from("equipment_details")
            .insert(equipmentDetails);
          
          if (equipmentError) {
            console.error("Error inserting equipment:", equipmentError);
            console.error("Equipment details attempted:", JSON.stringify(equipmentDetails, null, 2));
            console.error("Selected equipment state:", selectedEquipment);
            throw new Error(`Error al guardar equipos: ${equipmentError.message}`);
          } else {
            console.log("Equipment saved successfully:", equipmentDetails.length, "items");
          }
        }
        console.log("Propuesta guardada exitosamente, incluyendo equipos");
      }

      // Actualizar lastSavedAt cuando el guardado se completa exitosamente
      const savedTime = new Date();
      setLastSavedAt(savedTime);
      lastSaveCompletedRef.current = savedTime;
    } catch (error: any) {
      console.error("Error saving proposal:", error);
      const errorMessage = error?.message || "Error desconocido";
      
      // Verificar si el error es realmente crítico o solo un warning
      const isNonCriticalError = 
        errorMessage.includes("No se pudieron eliminar") ||
        errorMessage.includes("Algunos equipos no se pudieron") ||
        errorMessage.includes("continuando con guardado parcial");
      
      if (isNonCriticalError) {
        // Error no crítico, solo registrar y continuar
        console.warn("Error no crítico durante guardado:", errorMessage);
        setLastSavedAt(new Date());
      } else {
        // Error crítico, mostrar al usuario
        if (errorMessage.includes("equipment") || errorMessage.includes("equipo")) {
          handleSupabaseError(error, "Error al guardar los equipos. Por favor, intenta nuevamente.");
          // Recargar propuesta para restaurar el estado de los equipos
          if (proposalId) {
            console.log("Reloading proposal to restore equipment state...");
            try {
              await loadExistingProposal(proposalId);
            } catch (reloadError) {
              console.error("Error reloading proposal:", reloadError);
            }
          }
        } else if (errorMessage.includes("item")) {
          handleSupabaseError(error, "Error al guardar los items. Los cambios en otros campos se guardaron correctamente.");
        } else {
          handleSupabaseError(error, "Error al guardar los cambios. Por favor, intenta nuevamente.");
        }
      }
    } finally {
      // CRITICAL: Always reset saving state, even if there was an error
      // Usar setTimeout para asegurar que lastSavedAt se actualice antes de resetear los estados
      // Esto garantiza que la UI muestre "Guardado" correctamente
      setTimeout(() => {
        setIsSaving(false);
        setPendingAutoSave(false);
      }, 0);
    }
  };

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

  // Initialize proposal (create or load)
  useEffect(() => {
    const initializeProposal = async () => {
      // Prevenir múltiples ejecuciones
      if (!user || initialLoadRef.current === false || proposalId || isCreatingInitialRef.current) return;
      
      if (params.id) {
        // Edit mode: Load existing proposal
        await loadExistingProposal(params.id);
      } else {
        // Create mode: Create new proposal
        await createInitialProposal();
      }
      
      initialLoadRef.current = false;
    };

    void initializeProposal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id]);

  // Autosave with debounce (2000ms for better performance)
  useEffect(() => {
    if (initialLoadRef.current || !proposalId || justLoadedRef.current) {
      console.log("Autosave skipped:", { 
        initialLoad: initialLoadRef.current, 
        proposalId, 
        justLoaded: justLoadedRef.current 
      });
      return;
    }
    
    // Skip if already saving
    if (isSaving) {
      console.log("Autosave skipped: already saving");
      return;
    }
    
    // Skip if a save just completed (within last 100ms) to avoid immediate re-trigger
    if (lastSaveCompletedRef.current) {
      const timeSinceLastSave = Date.now() - lastSaveCompletedRef.current.getTime();
      if (timeSinceLastSave < 100) {
        console.log("Autosave skipped: save just completed", timeSinceLastSave, "ms ago");
        return;
      }
    }
    
    // Validate that selectedEquipment has valid data before scheduling save
    const validEquipmentCount = selectedEquipment.filter(eq => eq.id && eq.name).length;
    if (selectedEquipment.length > 0 && validEquipmentCount === 0) {
      console.warn("Autosave skipped: selectedEquipment has invalid data", selectedEquipment);
      // Limpiar estado pendiente si había uno
      setPendingAutoSave(false);
      return;
    }
    
    console.log("Autosave triggered, scheduling save in 2 seconds...", {
      equipmentCount: selectedEquipment.length,
      validEquipmentCount,
      proposalId,
      equipmentIds: selectedEquipment.map(eq => eq.id).filter(Boolean)
    });
    setPendingAutoSave(true);

    const handler = setTimeout(() => {
      console.log("Autosave timer fired, executing persistProposal...");
      void persistProposal();
    }, 2000); // Increased from 800ms to 2000ms to reduce frequent saves

    return () => {
      console.log("Autosave cleanup: clearing timer");
      clearTimeout(handler);
      // Limpiar pendingAutoSave solo si se cancela el timer (nuevo cambio antes de que se ejecute)
      // Si persistProposal se ejecuta, él mismo limpiará el estado en el finally
    };
  }, [formData, proposalItems, technicalSpecs, selectedEquipment, proposalId, isSaving]);

  // Upload images immediately
  useEffect(() => {
    const uploadImages = async () => {
      if (initialLoadRef.current || !proposalId || selectedImages.length === 0) return;

      try {
        // Delete existing images if replacing
        await supabase.from("proposal_images").delete().eq("proposal_id", proposalId);
        
        // Delete old image files from storage if replacing
        if (existingImageUrls.length > 0) {
          for (const url of existingImageUrls) {
            const path = url.split('/proposal-images/')[1];
            if (path) {
              await supabase.storage.from('proposal-images').remove([path]);
            }
          }
        }

        // Upload new images
        const imageRecords = [];
        for (let i = 0; i < selectedImages.length; i++) {
          const file = selectedImages[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${proposalId}/${Date.now()}-${i}.${fileExt}`;

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
            proposal_id: proposalId,
            image_url: publicUrl,
            image_order: i + 1,
          });
        }

        if (imageRecords.length > 0) {
          const { error: imagesError } = await supabase
            .from("proposal_images")
            .insert(imageRecords);

          if (imagesError) throw imagesError;
          
          // Update existing image URLs
          setExistingImageUrls(imageRecords.map(img => img.image_url));
        }
      } catch (error: any) {
        handleSupabaseError(error, "Error al subir las imágenes");
      }
    };

    void uploadImages();
  }, [selectedImages, proposalId]);

  // Upload 3D model immediately
  useEffect(() => {
    const upload3DModel = async () => {
      if (initialLoadRef.current || !proposalId || !selected3DModel) return;

      toast({
        title: "Comprimiendo modelo 3D...",
        description: "Optimizando el archivo para carga rápida. Esto puede tardar 10-30 segundos.",
      });

      try {
        // Convert file to ArrayBuffer
        const arrayBuffer = await selected3DModel.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64 for transmission
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);

        // Call Edge Function to compress and upload
        const { data: compressData, error: compressError } = await supabase.functions.invoke(
          'compress-3d-model',
          {
            body: {
              proposalId: proposalId,
              fileName: selected3DModel.name,
              fileData: base64Data,
            },
          }
        );

        if (compressError) {
          console.error('Error compressing 3D model:', compressError);
          toast({
            title: "Error en compresión",
            description: "No se pudo comprimir el modelo. Subiendo archivo original...",
            variant: "destructive",
          });
          
          // Fallback: Upload without compression
          const fileExt = selected3DModel.name.split('.').pop();
          const fileName = `${proposalId}/${Date.now()}-model.${fileExt}`;
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
              .eq('id', proposalId);

            setModel3DPreview(publicUrl);
          }
        } else {
          // Success: Use compressed URL
          await supabase
            .from('proposals')
            .update({ model_3d_url: compressData.url })
            .eq('id', proposalId);

          setModel3DPreview(compressData.url);

          toast({
            title: "✅ Modelo comprimido exitosamente",
            description: `Tamaño reducido de ${compressData.originalSizeMB.toFixed(2)}MB a ${compressData.compressedSizeMB.toFixed(2)}MB (${compressData.compressionRatio}% de reducción)`,
          });
        }
      } catch (error: any) {
        handleSupabaseError(error, "No se pudo procesar el modelo 3D");
      }
    };

    void upload3DModel();
  }, [selected3DModel, proposalId]);

  const fetchAvailableEquipment = async () => {
    try {
      // Load only basic equipment data initially for faster loading
      const { data: equipment, error: equipmentError } = await supabase
        .from("equipment")
        .select("id, name, description")
        .order("name");

      if (equipmentError) throw equipmentError;

      // Return basic data only - images and tables will be loaded when equipment is selected
      const equipmentWithBasicData = (equipment || []).map((eq) => ({
        id: eq.id,
        name: eq.name,
        description: eq.description || "",
        images: [], // Will be loaded on demand
        tables: [], // Will be loaded on demand
      }));

      setAvailableEquipment(equipmentWithBasicData);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el listado de equipos",
        variant: "destructive",
      });
    }
  };

  // Load full equipment details (images and tables) when equipment is added
  const loadEquipmentDetails = async (equipmentId: string): Promise<EquipmentWithDetails | null> => {
    try {
      const { data: equipment, error: equipmentError } = await supabase
        .from("equipment")
        .select("id, name, description")
        .eq("id", equipmentId)
        .single();

      if (equipmentError || !equipment) return null;

      const [imagesResult, tablesResult] = await Promise.all([
        supabase
          .from("equipment_images")
          .select("image_url, image_order")
          .eq("equipment_id", equipmentId)
          .order("image_order"),
        supabase
          .from("equipment_tables")
          .select("title, table_data, table_order")
          .eq("equipment_id", equipmentId)
          .order("table_order"),
      ]);

      return {
        id: equipment.id,
        name: equipment.name,
        description: equipment.description || "",
        images: imagesResult.data || [],
        tables: tablesResult.data || [],
      };
    } catch (error) {
      console.error("Error loading equipment details:", error);
      return null;
    }
  };

  const handleAddEquipment = async () => {
    if (!equipmentToAdd) return;
    
    // Check if equipment is already selected
    if (selectedEquipment.some(eq => eq.id === equipmentToAdd)) {
      toast({
        title: "Equipo ya agregado",
        description: "Este equipo ya está en la lista",
        variant: "default",
      });
      setEquipmentToAdd("");
      return;
    }

    // Find basic equipment data
    const basicEquipment = availableEquipment.find((eq) => eq.id === equipmentToAdd);
    if (!basicEquipment || !basicEquipment.id || !basicEquipment.name) {
      toast({
        title: "Error",
        description: "Equipo no encontrado o datos inválidos",
        variant: "destructive",
      });
      return;
    }

    // Save equipment ID before clearing equipmentToAdd
    const equipmentIdToLoad = equipmentToAdd;
    
    // Add equipment with basic data first (for immediate UI feedback)
    // Ensure id and name are always present
    const equipmentWithBasicData: EquipmentWithDetails = {
      id: basicEquipment.id!,
      name: basicEquipment.name!,
      description: basicEquipment.description || "",
      images: [],
      tables: [],
    };
    
    setSelectedEquipment([...selectedEquipment, equipmentWithBasicData]);
    setEquipmentToAdd("");

    // Load full details in background using the saved ID
    // Only update if fullDetails has valid id and name
    const fullDetails = await loadEquipmentDetails(equipmentIdToLoad);
    if (fullDetails && fullDetails.id && fullDetails.name) {
      // Update equipment with full details
      setSelectedEquipment(prev => 
        prev.map(eq => eq.id === equipmentIdToLoad ? fullDetails : eq)
      );
      console.log("Equipment details loaded successfully for:", equipmentIdToLoad);
    } else {
      // If loading fails, keep the basic data - it's already valid
      console.warn("Failed to load full equipment details, keeping basic data for:", equipmentIdToLoad);
    }
  };

  const handleRemoveEquipment = (index: number) => {
    const removedEquipment = selectedEquipment[index];
    console.log("Removing equipment:", removedEquipment?.name, "at index:", index);
    const newEquipment = selectedEquipment.filter((_, i) => i !== index);
    setSelectedEquipment(newEquipment);
    console.log("Equipment removed. New count:", newEquipment.length);
    // El autoguardado se ejecutará automáticamente por el useEffect
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

  const handleSaveAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiples envíos
    if (isSubmittingRef.current) {
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // Ensure final save is complete before navigating
      if (proposalId && !isSaving) {
        await persistProposal();
      }

      toast({
        title: "Propuesta guardada",
        description: params.id ? "Los cambios han sido guardados exitosamente" : "La propuesta ha sido creada exitosamente",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al guardar la propuesta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">
              {params.id ? "Editar Propuesta Comercial" : "Nueva Propuesta Comercial"}
            </h1>
            {proposalId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isSaving ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span>Guardando...</span>
                  </>
                ) : pendingAutoSave ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <span>Cambios pendientes</span>
                  </>
                ) : lastSavedAt ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Guardado {lastSavedAt.toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : null}
              </div>
            )}
          </div>

          <form onSubmit={handleSaveAndClose} className="space-y-6">
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar y Cerrar"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreateProposal;
