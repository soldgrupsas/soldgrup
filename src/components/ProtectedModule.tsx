import { ReactNode } from "react";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { ModuleKey } from "@/lib/permissions";

interface ProtectedModuleProps {
  moduleKey: ModuleKey;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component to conditionally render content based on module access
 */
export const ProtectedModule = ({
  moduleKey,
  children,
  fallback = null,
}: ProtectedModuleProps) => {
  const hasAccess = useModuleAccess(moduleKey);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

