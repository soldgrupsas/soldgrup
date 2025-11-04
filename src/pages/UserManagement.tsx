import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Pencil, Wand2, Trash2, Search, X, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type AppRole = "admin" | "user" | "mantenimiento";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface UserFormState {
  email: string;
  full_name: string;
  role: AppRole;
  password: string;
}

const DEFAULT_FORM: UserFormState = {
  email: "",
  full_name: "",
  role: "user",
  password: "",
};

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  user: "Usuario General",
  mantenimiento: "Mantenimiento",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  user: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  mantenimiento: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "sin rol": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const generateSecurePassword = () => {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789@$!%*?&";
  const length = 12;
  let result = "";
  const cryptoObj =
    typeof window !== "undefined" && (window.crypto || (window as any).msCrypto);

  if (cryptoObj) {
    const randomValues = new Uint32Array(length);
    cryptoObj.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)];
    }
  }

  return result;
};

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading, user: currentUser, clearCachedPermissions } = useAuth();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [formData, setFormData] = useState<UserFormState>(DEFAULT_FORM);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(DEFAULT_FORM);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden acceder a esta página",
        variant: "destructive",
      });
      navigate("/home");
    }
  }, [isAdmin, authLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      void loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const [{ data: profiles, error: profilesError }, { data: rolesData, error: rolesError }] =
        await Promise.all([
          supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
        ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const roleMap = new Map<string, string>();
      rolesData?.forEach((entry) => roleMap.set(entry.user_id, entry.role));

      const formattedUsers =
        profiles?.map((profile) => ({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name ?? "",
          role: roleMap.get(profile.id) ?? "sin rol",
          created_at: profile.created_at,
        })) ?? [];

      setUsers(formattedUsers);
    } catch (error: any) {
      toast({
        title: "Error al cargar usuarios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const handleGeneratePassword = (setter: (value: string) => void) => {
    const newPassword = generateSecurePassword();
    setter(newPassword);
    toast({
      title: "Contraseña generada",
      description: "Copia la nueva contraseña y compártela con el usuario.",
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);

    const roleToAssign = formData.role;
    const emailToCreate = formData.email;

    // Logging para depuración
    console.log("Creando usuario con datos:", {
      email: emailToCreate,
      full_name: formData.full_name,
      role: roleToAssign,
      hasPassword: !!formData.password,
    });

    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "create_user",
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
        },
      });

      // Logging de respuesta
      console.log("Respuesta de Edge Function:", { data, error });

      // Verificar error de Supabase
      if (error) {
        console.error("Error de Supabase al invocar función:", error);
        console.error("Detalles del error:", {
          message: error.message,
          context: error.context,
          status: error.context?.status,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        
        // Intentar obtener más detalles del error
        let errorMessage = error.message || "No se pudo crear el usuario";
        
        // Si es un error 422, puede ser un problema de validación
        if (error.context?.status === 422) {
          errorMessage = "Error de validación: " + (error.message || "Los datos enviados no son válidos");
        }
        
        // Si menciona función no encontrada o no disponible
        if (error.message?.includes('función') || error.message?.includes('function') || 
            error.message?.includes('no está disponible')) {
          errorMessage = "Error crítico del sistema: " + error.message + ". Por favor, contacta al administrador técnico.";
        }
        
        throw new Error(errorMessage);
      }

      // Verificar que la respuesta contiene los datos esperados
      // La Edge Function retorna directamente el objeto con id, email, full_name, role
      if (!data || (!data.id && typeof data !== 'object')) {
        console.error("La respuesta no contiene los datos esperados:", data);
        console.error("Tipo de data:", typeof data);
        console.error("data completo:", JSON.stringify(data, null, 2));
        
        // Si la función fue exitosa pero no tenemos datos, intentar verificar de todas formas
        // puede ser que el usuario se haya creado pero la respuesta no se parseó correctamente
        console.log("Intentando verificar usuario creado de todas formas...");
      } else {
        // Log debug info si está disponible
        if (data._debug) {
          console.log("=== DEBUG INFO FROM EDGE FUNCTION ===");
          console.log("Assign Role Result:", data._debug.assignRoleResult);
          console.log("Assign Role Success:", data._debug.assignRoleSuccess);
          console.log("Assigned Role:", data._debug.assignedRole);
          console.log("Message:", data._debug.message);
          console.log("===================================");
        }
        
        // Verificar que el rol en la respuesta coincide con el enviado
        if (data.role && data.role !== roleToAssign) {
          console.warn(`Rol en respuesta no coincide. Enviado: ${roleToAssign}, Recibido: ${data.role}`);
        }
        
        // Si el debug info indica que no se asignó correctamente
        if (data._debug && !data._debug.assignRoleSuccess) {
          console.error("⚠️ El debug info indica que el rol NO se asignó correctamente");
          console.error("Detalles:", data._debug);
        }
      }

      // Invalidar caché antes de verificar
      clearCachedPermissions();

      // Esperar un momento para que la base de datos se actualice
      await new Promise(resolve => setTimeout(resolve, 500));

      // Cargar usuarios para verificar que se creó correctamente
      await loadUsers();

      // Verificar que el usuario se creó con el rol correcto
      const { data: allUsers, error: usersError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("email", emailToCreate)
        .maybeSingle();

      if (usersError) {
        console.error("Error al verificar usuario creado:", usersError);
        throw new Error("No se pudo verificar que el usuario se creó correctamente");
      }

      if (!allUsers) {
        // Si no encontramos el usuario, puede ser que aún no se haya propagado
        // Esperar un poco más y reintentar
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: retryUsers, error: retryError } = await supabase
          .from("profiles")
          .select("id, email, full_name, created_at")
          .eq("email", emailToCreate)
          .maybeSingle();

        if (retryError || !retryUsers) {
          throw new Error("El usuario no se encontró después de la creación. Por favor, verifica manualmente.");
        }

        // Usar los datos del reintento
        const retryRoleData = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", retryUsers.id)
          .maybeSingle();

        if (retryRoleData.error) {
          throw new Error("No se pudo verificar el rol asignado al usuario");
        }

        const assignedRole = retryRoleData.data?.role || "sin rol";

        if (assignedRole !== roleToAssign) {
          const errorMsg = `El usuario se creó pero el rol no coincide. Esperado: ${ROLE_LABELS[roleToAssign]}, Obtenido: ${assignedRole === "sin rol" ? "Sin rol" : ROLE_LABELS[assignedRole as AppRole] || assignedRole}`;
          console.error(errorMsg);
          toast({
            title: "Advertencia: Rol no asignado correctamente",
            description: errorMsg + ". Por favor, edita el usuario para asignarle el rol correcto.",
            variant: "destructive",
          });
          setIsCreatingUser(false);
          return;
        }

        // Todo está correcto
        toast({
          title: "Usuario creado",
          description: `El usuario ${formData.full_name} ha sido creado exitosamente con rol ${ROLE_LABELS[roleToAssign]}.`,
        });

        setFormData(DEFAULT_FORM);
        setIsCreateDialogOpen(false);
        return;
      }

      // Obtener el rol del usuario recién creado
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", allUsers.id)
        .maybeSingle();

      if (roleError) {
        console.error("Error al verificar rol del usuario:", roleError);
        throw new Error("No se pudo verificar el rol asignado al usuario");
      }

      const assignedRole = roleData?.role || "sin rol";

      if (assignedRole !== roleToAssign) {
        const errorMsg = `El usuario se creó pero el rol no coincide. Esperado: ${ROLE_LABELS[roleToAssign]}, Obtenido: ${assignedRole === "sin rol" ? "Sin rol" : ROLE_LABELS[assignedRole as AppRole] || assignedRole}`;
        console.error(errorMsg);
        toast({
          title: "Advertencia: Rol no asignado correctamente",
          description: errorMsg + ". Por favor, edita el usuario para asignarle el rol correcto.",
          variant: "destructive",
        });
        setIsCreatingUser(false);
        return;
      }

      // Todo está correcto, mostrar éxito y cerrar dialog
      toast({
        title: "Usuario creado",
        description: `El usuario ${formData.full_name} ha sido creado exitosamente con rol ${ROLE_LABELS[roleToAssign]}.`,
      });

      setFormData(DEFAULT_FORM);
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      console.error("Error completo al crear usuario:", error);
      console.error("Error context:", error?.context);

      let errorMessage = error.message || "No se pudo crear el usuario";

      // Intentar obtener más detalles del error si está disponible
      if (error?.context?.response) {
        try {
          const errorBody = await error.context.response.clone().json();
          errorMessage = errorBody?.error || errorMessage;
          console.error("Error del servidor:", errorBody);
        } catch (parseError) {
          // Si no se puede parsear como JSON, intentar como texto
          try {
            const errorText = await error.context.response.clone().text();
            if (errorText) {
              errorMessage = errorText;
              console.error("Error del servidor (texto):", errorText);
            }
          } catch (textError) {
            console.warn("No se pudo leer el cuerpo del error:", textError);
          }
        }
      }

      // Si es un error 422, proporcionar mensaje más específico
      if (error?.context?.status === 422) {
        errorMessage = errorMessage || "Error de validación: Los datos enviados no son válidos. Verifica que todos los campos estén completos.";
      }

      toast({
        title: "Error al crear usuario",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    const allowedRoles: AppRole[] = ["admin", "user", "mantenimiento"];
    const normalizedRole = allowedRoles.includes(user.role as AppRole)
      ? (user.role as AppRole)
      : "user";

    setEditingUser(user);
    setEditForm({
      email: user.email,
      full_name: user.full_name,
      role: normalizedRole,
      password: "",
    });
    setIsEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsUpdatingUser(true);
    try {
      const payload: Record<string, unknown> = {
        action: "update_user",
        userId: editingUser.id,
        email: editForm.email,
        full_name: editForm.full_name,
        role: editForm.role,
      };

      if (editForm.password) {
        payload.password = editForm.password;
      }

      const { error } = await supabase.functions.invoke("admin-manage-users", {
        body: payload,
      });

      if (error) {
        throw new Error(error.message || "No se pudo actualizar el usuario");
      }

      toast({
        title: "Usuario actualizado",
        description: `Los cambios de ${editForm.full_name} fueron guardados correctamente.`,
      });

      // Invalidar caché del usuario actualizado para que recargue permisos
      if (editingUser.id) {
        clearCachedPermissions(editingUser.id);
      }

      setIsEditOpen(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error al actualizar usuario",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const openDeleteDialog = (user: UserWithRole) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      const { error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "delete_user",
          userId: userToDelete.id,
        },
      });

      if (error) {
        throw new Error(error.message || "No se pudo eliminar el usuario");
      }

      toast({
        title: "Usuario eliminado",
        description: `El usuario ${userToDelete.full_name} ha sido eliminado exitosamente.`,
      });

      // Limpiar caché del usuario eliminado
      if (userToDelete.id) {
        clearCachedPermissions(userToDelete.id);
      }

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error al eliminar usuario",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const usersWithoutRole = users.filter((u) => u.role === "sin rol").length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al panel de administración
        </Button>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Administrar Usuarios</h1>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Usuario
            </Button>
          </div>

          {usersWithoutRole > 0 && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Advertencia:</strong> Hay {usersWithoutRole} usuario(s) sin rol asignado. 
                Asigna un rol para que puedan acceder al sistema.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold">Usuarios Registrados</h2>
              <p className="text-muted-foreground text-sm">
                {filteredUsers.length} de {users.length} usuario(s)
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuarios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-6 w-6 p-0"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuario General</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="sin rol">Sin rol</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={() => void loadUsers()} disabled={isFetchingUsers}>
                <Loader2
                  className={`h-4 w-4 ${isFetchingUsers ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha de creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetchingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Cargando usuarios...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      {searchQuery || roleFilter !== "all"
                        ? "No se encontraron usuarios con los filtros aplicados."
                        : "No hay usuarios registrados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name || "Sin nombre"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          className={ROLE_COLORS[user.role] || ROLE_COLORS["sin rol"]}
                        >
                          {ROLE_LABELS[user.role as AppRole] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), "PP", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(user)}
                            title="Editar usuario"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(user)}
                              title="Eliminar usuario"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog 
        open={isCreateDialogOpen} 
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setFormData(DEFAULT_FORM);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
            <DialogDescription>
              Completa el formulario para crear un nuevo usuario en el sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid md:grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_full_name">Nombre Completo *</Label>
                <Input
                  id="create_full_name"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_email">Email *</Label>
                <Input
                  id="create_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_password">Contraseña *</Label>
                <div className="flex gap-2">
                  <Input
                    id="create_password"
                    type="text"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, password: e.target.value }))
                    }
                    required
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      handleGeneratePassword((generated) =>
                        setFormData((prev) => ({ ...prev, password: generated })),
                      )
                    }
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_role">Rol *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, role: value as AppRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario General</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Usuario"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Modifica la información del usuario. Los cambios se guardarán inmediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Nombre completo</Label>
              <Input
                id="edit_full_name"
                value={editForm.full_name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_role">Rol</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, role: value as AppRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario General</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_password">Nueva contraseña (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  id="edit_password"
                  type="text"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Deja en blanco para mantener la actual"
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    handleGeneratePassword((generated) =>
                      setEditForm((prev) => ({ ...prev, password: generated })),
                    )
                  }
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser} disabled={isUpdatingUser}>
              {isUpdatingUser ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el usuario{" "}
              <strong>{userToDelete?.full_name}</strong> ({userToDelete?.email}) y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingUser ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
