import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { MODULES, MODULE_NAMES, ModuleKey } from "@/lib/permissions";

interface Module {
  id: string;
  module_key: string;
  module_name: string;
}

interface RolePermission {
  role: string;
  module_id: string;
  has_access: boolean;
}

const ROLES = [
  { key: "admin", label: "Administrador" },
  { key: "user", label: "Usuario General" },
  { key: "mantenimiento", label: "Mantenimiento" },
] as const;

const AdminRoles = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, isAdminLoading, clearCachedPermissions } = useAuth();
  const { toast } = useToast();

  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdminLoading && !isAdmin) {
      toast({
        title: "Acceso restringido",
        description: "Esta sección está restringida a administradores de la plataforma",
        variant: "destructive",
      });
      navigate("/home");
    }
  }, [isAdmin, loading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Load modules
      const { data: modulesData, error: modulesError } = await supabase
        .from("modules")
        .select("id, module_key, module_name")
        .order("module_key");

      if (modulesError) throw modulesError;

      setModules(modulesData || []);

      // Load permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from("role_module_permissions")
        .select("role, module_id, has_access");

      if (permissionsError) throw permissionsError;

      const permissionsMap = new Map<string, boolean>();
      (permissionsData || []).forEach((perm: RolePermission) => {
        const key = `${perm.role}_${perm.module_id}`;
        permissionsMap.set(key, perm.has_access);
      });

      setPermissions(permissionsMap);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handlePermissionChange = (role: string, moduleId: string, checked: boolean) => {
    // Admin always has access to all modules - prevent changes
    if (role === "admin") {
      return;
    }

    const key = `${role}_${moduleId}`;
    setPermissions((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, checked);
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get all current permissions to compare
      const { data: currentPermissions, error: fetchError } = await supabase
        .from("role_module_permissions")
        .select("id, role, module_id, has_access");

      if (fetchError) throw fetchError;

      const updates: Array<{ id: string; has_access: boolean }> = [];
      const inserts: Array<{ role: string; module_id: string; has_access: boolean }> = [];

      // Compare and prepare updates/inserts
      for (const role of ROLES) {
        for (const module of modules) {
          const key = `${role.key}_${module.id}`;
          const newAccess = permissions.get(key) ?? false;
          const currentPerm = currentPermissions?.find(
            (p: RolePermission) => p.role === role.key && p.module_id === module.id
          );

          if (currentPerm) {
            if (currentPerm.has_access !== newAccess) {
              updates.push({ id: currentPerm.id, has_access: newAccess });
            }
          } else {
            inserts.push({
              role: role.key,
              module_id: module.id,
              has_access: newAccess,
            });
          }
        }
      }

      // Execute updates
      for (const update of updates) {
        const { error } = await supabase
          .from("role_module_permissions")
          .update({ has_access: update.has_access, updated_at: new Date().toISOString() })
          .eq("id", update.id);

        if (error) throw error;
      }

      // Execute inserts
      if (inserts.length > 0) {
        const { error } = await supabase
          .from("role_module_permissions")
          .insert(inserts);

        if (error) throw error;
      }

      toast({
        title: "Permisos actualizados",
        description: "Los cambios se guardaron correctamente",
      });

      // Invalidar caché de todos los usuarios para que recarguen permisos
      clearCachedPermissions();

      // Reload data to reflect changes
      await loadData();
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || isAdminLoading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Button variant="outline" onClick={() => { window.location.href = "/admin"; }}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al panel de administración
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">Administrar Roles y Permisos</h1>
          <p className="text-muted-foreground">
            Configura los permisos de acceso a cada módulo para los diferentes roles del sistema.
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Marca las casillas para habilitar el acceso a un módulo para cada rol.
              </p>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Rol</TableHead>
                    {modules.map((module) => (
                      <TableHead key={module.id} className="text-center">
                        {MODULE_NAMES[module.module_key as ModuleKey] || module.module_name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ROLES.map((role) => (
                    <TableRow key={role.key}>
                      <TableCell className="font-medium">
                        {role.label}
                        {role.key === "admin" && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (siempre tiene acceso completo)
                          </span>
                        )}
                      </TableCell>
                      {modules.map((module) => {
                        const key = `${role.key}_${module.id}`;
                        const hasAccess = permissions.get(key) ?? false;
                        const isAdminRole = role.key === "admin";

                        return (
                          <TableCell key={module.id} className="text-center">
                            <Checkbox
                              checked={hasAccess || isAdminRole}
                              disabled={isAdminRole}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(role.key, module.id, checked as boolean)
                              }
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Los cambios en los permisos afectarán inmediatamente el acceso de los usuarios
                con esos roles. Asegúrate de guardar los cambios después de realizar modificaciones.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminRoles;
