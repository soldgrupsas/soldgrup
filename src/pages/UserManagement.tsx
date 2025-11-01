import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Pencil, Wand2 } from "lucide-react";

type AppRole = "admin" | "user" | "mantenimiento";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: string;
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
  const { isAdmin, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [formData, setFormData] = useState<UserFormState>(DEFAULT_FORM);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(DEFAULT_FORM);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

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
          supabase.from("profiles").select("id, email, full_name").order("full_name"),
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

    try {
      const { error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "create_user",
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
        },
      });

      if (error) {
        throw new Error(error.message || "No se pudo crear el usuario");
      }

      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente.",
      });

      setFormData(DEFAULT_FORM);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error al crear usuario",
        description: error.message,
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
        description: "Los cambios fueron guardados correctamente.",
      });

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Cargando...</p>
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
          <h1 className="text-3xl font-bold mb-6">Administrar Usuarios</h1>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
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
                <Label htmlFor="role">Rol *</Label>
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
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Usuarios Registrados</h2>
              <p className="text-muted-foreground text-sm">
                Consulta y edita la información de todos los usuarios del sistema.
              </p>
            </div>
            <Button variant="ghost" onClick={() => void loadUsers()} disabled={isFetchingUsers}>
              <Loader2
                className={`mr-2 h-4 w-4 ${isFetchingUsers ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetchingUsers ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    No hay usuarios registrados.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
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
    </div>
  );
};

export default UserManagement;
