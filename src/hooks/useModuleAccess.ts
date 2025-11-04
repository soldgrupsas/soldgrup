import { useAuth } from "./useAuth";
import { ModuleKey } from "@/lib/permissions";

/**
 * Hook to check if the current user has access to a specific module
 */
export const useModuleAccess = (moduleKey: ModuleKey): boolean => {
  const { hasModuleAccess } = useAuth();
  return hasModuleAccess(moduleKey);
};

