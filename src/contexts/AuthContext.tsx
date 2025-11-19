import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ModuleKey } from "@/lib/permissions";

const PERMISSIONS_CACHE_KEY = "user_permissions_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const MIN_REFRESH_DELAY = 60 * 1000; // 1 minuto

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

interface LoadOptions {
  silent?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isAdminLoading: boolean;
  userRole: string | null;
  userPermissions: Set<ModuleKey>;
  permissionsLoading: boolean;
  hasModuleAccess: (moduleKey: ModuleKey) => boolean;
  refreshPermissions: () => Promise<void>;
  clearCachedPermissions: (userId?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const calculateRefreshDelay = (session: Session | null) => {
  if (!session?.expires_at) {
    return null;
  }

  const expiresIn = session.expires_at * 1000 - Date.now();
  if (expiresIn <= 0) {
    return MIN_REFRESH_DELAY;
  }

  // Refresh at 80% of the expiry time or at least MIN_REFRESH_DELAY
  const suggestedDelay = Math.max(expiresIn * 0.8, MIN_REFRESH_DELAY);
  return suggestedDelay;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Set<ModuleKey>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const refreshTimeoutRef = useRef<number>();
  const isInitialLoadRef = useRef(true);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = undefined;
    }
  }, []);

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

  const setCachedPermissions = useCallback(
    (userId: string, permissions: Set<ModuleKey>, role: string | null, isAdminFlag: boolean) => {
      try {
        localStorage.setItem(
          `${PERMISSIONS_CACHE_KEY}_${userId}`,
          JSON.stringify({
            permissions: Array.from(permissions),
            role,
            isAdmin: isAdminFlag,
            timestamp: Date.now(),
          })
        );
      } catch (error) {
        console.error("Error writing cache:", error);
      }
    },
    []
  );

  const clearCachedPermissions = useCallback((userId?: string) => {
    try {
      if (userId) {
        localStorage.removeItem(`${PERMISSIONS_CACHE_KEY}_${userId}`);
      } else {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(PERMISSIONS_CACHE_KEY)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }, []);

  const loadUserRoleAndAdmin = useCallback(async (userId: string): Promise<UserRoleInfo> => {
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);

      if (error || !data || data.length === 0) {
        return { role: null, isAdmin: false };
      }

      const roles = data.map((r) => r.role);
      const isAdminRole = roles.includes("admin");
      const role = roles[0] || null;

      return { role, isAdmin: isAdminRole };
    } catch (error) {
      console.error("Error loading user role and admin status:", error);
      return { role: null, isAdmin: false };
    }
  }, []);

  const loadUserPermissionsOptimized = useCallback(
    async (userId: string, role: string | null, isAdminRole: boolean): Promise<Set<ModuleKey>> => {
      if (isAdminRole) {
        return new Set(["admin", "dashboard", "equipment", "maintenance-reports"] as ModuleKey[]);
      }

      if (!role) {
        return new Set();
      }

      try {
        const { data: functionData, error: functionError } = await supabase.rpc(
          "get_user_module_permissions",
          { _user_id: userId }
        );

        if (!functionError && functionData && Array.isArray(functionData)) {
          return new Set(functionData.map((m: { module_key: string }) => m.module_key));
        }

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
          (permissionsData || []).map((p: any) => p.modules?.module_key).filter(Boolean)
        );

        return permissions;
      } catch (error) {
        console.error("Error loading user permissions:", error);
        return new Set();
      }
    },
    []
  );

  const loadUserData = useCallback(
    async (userId: string, options?: LoadOptions) => {
      const silent = options?.silent ?? false;

      if (!silent) {
        setIsAdminLoading(true);
        setPermissionsLoading(true);
      }

      try {
        const cached = getCachedPermissions(userId);
        if (cached) {
          setIsAdmin(cached.isAdmin);
          setUserRole(cached.role);
          setUserPermissions(new Set(cached.permissions));
          if (!silent) {
            setIsAdminLoading(false);
            setPermissionsLoading(false);
          }
          return;
        }

        const roleInfo = await loadUserRoleAndAdmin(userId);
        setIsAdmin(roleInfo.isAdmin);
        setUserRole(roleInfo.role);

        const permissions = await loadUserPermissionsOptimized(userId, roleInfo.role, roleInfo.isAdmin);
        setUserPermissions(permissions);

        setCachedPermissions(userId, permissions, roleInfo.role, roleInfo.isAdmin);
      } catch (error) {
        console.error("Error loading user data:", error);
        setIsAdmin(false);
        setUserRole(null);
        setUserPermissions(new Set());
      } finally {
        if (!silent) {
          setIsAdminLoading(false);
          setPermissionsLoading(false);
        }
      }
    },
    [
      getCachedPermissions,
      loadUserRoleAndAdmin,
      loadUserPermissionsOptimized,
      setCachedPermissions,
    ]
  );

  const scheduleRefresh = useCallback(
    (activeSession: Session | null) => {
      clearRefreshTimer();
      const delay = calculateRefreshDelay(activeSession);
      if (!delay) return;

      refreshTimeoutRef.current = window.setTimeout(async () => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error("Error refreshing session:", error);
            if (error.message?.toLowerCase().includes("refresh token")) {
              await supabase.auth.signOut();
            }
            return;
          }

          if (data.session) {
            setSession(data.session);
            setUser(data.session.user ?? null);
            if (data.session.user) {
              await loadUserData(data.session.user.id, { silent: true });
            }
            scheduleRefresh(data.session);
          }
        } catch (err) {
          console.error("Unexpected error refreshing session:", err);
        }
      }, delay);
    },
    [clearRefreshTimer, loadUserData]
  );

  const hasModuleAccess = useCallback(
    (moduleKey: ModuleKey): boolean => {
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
    let isMounted = true;

    const handleSessionChange = async (newSession: Session | null, options?: LoadOptions) => {
      const silent = options?.silent ?? !isInitialLoadRef.current;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await loadUserData(newSession.user.id, { silent });
        scheduleRefresh(newSession);
      } else {
        setIsAdmin(false);
        setUserRole(null);
        setUserPermissions(new Set());
        setIsAdminLoading(false);
        setPermissionsLoading(false);
        clearCachedPermissions();
        scheduleRefresh(null);
      }

      if (isMounted) {
        setLoading(false);
      }
      isInitialLoadRef.current = false;
    };

    const initializeSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        await handleSessionChange(data.session);
      } catch (error) {
        console.error("Error initializing session:", error);
        setLoading(false);
      }
    };

    initializeSession();

    const handleWindowFocus = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.error("Error refreshing session on focus:", error);
          if (error.message?.toLowerCase().includes("refresh token")) {
            await supabase.auth.signOut();
            await handleSessionChange(null, { silent: true });
            return;
          }
        }

        if (data?.session) {
          await handleSessionChange(data.session, { silent: true });
          return;
        }
      } catch (error) {
        console.error("Error refreshing session on focus:", error);
      }

      try {
        const { data } = await supabase.auth.getSession();
        await handleSessionChange(data.session, { silent: true });
      } catch (error) {
        console.error("Error getting session on focus:", error);
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await handleWindowFocus();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      await handleSessionChange(currentSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearRefreshTimer();
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearCachedPermissions, clearRefreshTimer, loadUserData, scheduleRefresh]);

  const signOut = useCallback(async () => {
    if (user?.id) {
      clearCachedPermissions(user.id);
    }
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setIsAdminLoading(false);
      setUserRole(null);
      setUserPermissions(new Set());
      setPermissionsLoading(false);
      clearRefreshTimer();
    }
  }, [clearCachedPermissions, clearRefreshTimer, user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
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
    }),
    [
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
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};


