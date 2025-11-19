import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ModuleKey } from "@/lib/permissions";

// Cache configuration
const PERMISSIONS_CACHE_KEY = 'user_permissions_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

interface CachedPermissions {
  permissions: ModuleKey[];
  role: string;
  isAdmin: boolean;
  timestamp: number;
}

interface UserRoleInfo {
  role: string | null;
  isAdmin: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Set<ModuleKey>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Cache utilities
  const getCachedPermissions = useCallback((userId: string): CachedPermissions | null => {
    try {
      const cached = localStorage.getItem(`${PERMISSIONS_CACHE_KEY}_${userId}`);
      if (!cached) return null;

      const data: CachedPermissions = JSON.parse(cached);
      if (Date.now() - data.timestamp > CACHE_TTL) {
        localStorage.removeItem(`${PERMISSIONS_CACHE_KEY}_${userId}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error reading cache:", error);
      return null;
    }
  }, []);

  const setCachedPermissions = useCallback((userId: string, permissions: Set<ModuleKey>, role: string | null, isAdmin: boolean) => {
    try {
      localStorage.setItem(`${PERMISSIONS_CACHE_KEY}_${userId}`, JSON.stringify({
        permissions: Array.from(permissions),
        role: role,
        isAdmin: isAdmin,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error("Error writing cache:", error);
    }
  }, []);

  const clearCachedPermissions = useCallback((userId?: string) => {
    try {
      if (userId) {
        localStorage.removeItem(`${PERMISSIONS_CACHE_KEY}_${userId}`);
      } else {
        // Clear all caches
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(PERMISSIONS_CACHE_KEY)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }, []);

  // Fase 1: Consolidar consultas de roles - Una sola consulta para obtener rol y admin status
  const loadUserRoleAndAdmin = useCallback(async (userId: string): Promise<UserRoleInfo> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error || !data || data.length === 0) {
        return { role: null, isAdmin: false };
      }

      const roles = data.map(r => r.role);
      const isAdmin = roles.includes('admin');
      const role = roles[0] || null;

      return { role, isAdmin };
    } catch (error) {
      console.error("Error loading user role and admin status:", error);
      return { role: null, isAdmin: false };
    }
  }, []);

  // Fase 4: Función optimizada para cargar permisos (usando función SQL si está disponible, sino consulta directa)
  const loadUserPermissionsOptimized = useCallback(async (userId: string, role: string | null, isAdmin: boolean): Promise<Set<ModuleKey>> => {
    // Admin siempre tiene acceso a todos los módulos
    if (isAdmin) {
      return new Set(['admin', 'dashboard', 'equipment', 'maintenance-reports'] as ModuleKey[]);
    }

    if (!role) {
      return new Set();
    }

    try {
      // Intentar usar función SQL optimizada primero
      const { data: functionData, error: functionError } = await supabase
        .rpc('get_user_module_permissions', { _user_id: userId });

      if (!functionError && functionData && Array.isArray(functionData)) {
        return new Set(functionData.map((m: { module_key: string }) => m.module_key));
      }

      // Fallback a consulta directa optimizada
      const { data: permissionsData, error: permissionsError } = await supabase
        .from("role_module_permissions")
        .select(`
          modules(module_key)
        `)
        .eq("role", role)
        .eq("has_access", true);

      if (permissionsError) {
        console.error("Error loading permissions:", permissionsError);
        return new Set();
      }

      const permissions = new Set<ModuleKey>(
        (permissionsData || [])
          .map((p: any) => p.modules?.module_key)
          .filter(Boolean)
      );

      return permissions;
    } catch (error) {
      console.error("Error loading user permissions:", error);
      return new Set();
    }
  }, []);

  // Cargar datos del usuario (rol, admin, permisos)
  const loadUserData = useCallback(async (userId: string) => {
    setIsAdminLoading(true);
    setPermissionsLoading(true);

    try {
      // Verificar caché primero
      const cached = getCachedPermissions(userId);
      if (cached) {
        setIsAdmin(cached.isAdmin);
        setIsAdminLoading(false);
        setUserRole(cached.role);
        setUserPermissions(new Set(cached.permissions));
        setPermissionsLoading(false);
        return;
      }

      // Fase 1: Cargar rol y admin status en una sola consulta
      const roleInfo = await loadUserRoleAndAdmin(userId);
      setIsAdmin(roleInfo.isAdmin);
      setIsAdminLoading(false);
      setUserRole(roleInfo.role);

      // Fase 5: Cargar permisos en paralelo después de obtener el rol
      // (aunque ya tenemos el rol, lo hacemos así para mantener la lógica)
      const permissions = await loadUserPermissionsOptimized(userId, roleInfo.role, roleInfo.isAdmin);
      setUserPermissions(permissions);
      setPermissionsLoading(false);

      // Guardar en caché
      setCachedPermissions(userId, permissions, roleInfo.role, roleInfo.isAdmin);
    } catch (error) {
      console.error("Error loading user data:", error);
      setIsAdmin(false);
      setIsAdminLoading(false);
      setUserRole(null);
      setUserPermissions(new Set());
      setPermissionsLoading(false);
    }
  }, [getCachedPermissions, loadUserRoleAndAdmin, loadUserPermissionsOptimized, setCachedPermissions]);

  const hasModuleAccess = useCallback(
    (moduleKey: ModuleKey): boolean => {
      // Admin siempre tiene acceso
      if (isAdmin) return true;
      return userPermissions.has(moduleKey);
    },
    [isAdmin, userPermissions]
  );

  const refreshPermissions = useCallback(async () => {
    if (user?.id) {
      clearCachedPermissions(user.id);
      await loadUserData(user.id);
    }
  }, [user?.id, loadUserData, clearCachedPermissions]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          setIsAdmin(false);
          setIsAdminLoading(false);
          setUserRole(null);
          setUserPermissions(new Set());
          setPermissionsLoading(false);
          clearCachedPermissions();
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadUserData(session.user.id);
      } else {
        setIsAdmin(false);
        setIsAdminLoading(false);
        setUserRole(null);
        setUserPermissions(new Set());
        setPermissionsLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData, clearCachedPermissions]);

  const signOut = async () => {
    try {
      if (user?.id) {
        clearCachedPermissions(user.id);
      }
      
      // Clear all caches
      clearCachedPermissions();
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error signing out:", error);
        throw error;
      }
      
      // Clear state
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setIsAdminLoading(false);
      setUserRole(null);
      setUserPermissions(new Set());
      setPermissionsLoading(false);
    } catch (error) {
      console.error("Error in signOut:", error);
      // Even if there's an error, clear local state
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setIsAdminLoading(false);
      setUserRole(null);
      setUserPermissions(new Set());
      setPermissionsLoading(false);
      throw error;
    }
  };

  return {
    user,
    session,
    loading,
    isAdmin,
    isAdminLoading,
    userRole,
    userPermissions,
    permissionsLoading,
    hasModuleAccess,
    refreshPermissions,
    clearCachedPermissions,
    signOut,
  };
};
