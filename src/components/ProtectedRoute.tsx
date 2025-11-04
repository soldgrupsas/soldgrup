import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getModuleFromPath } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Component to protect routes based on module permissions
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAdminLoading, permissionsLoading, hasModuleAccess, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Wait for auth and permissions to load
    if (loading || isAdminLoading || permissionsLoading) return;

    // Redirect to auth if not logged in
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if this route requires module access
    const moduleKey = getModuleFromPath(location.pathname);
    
    if (moduleKey) {
      // Admin always has access, so skip check
      if (!isAdmin && !hasModuleAccess(moduleKey)) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permiso para acceder a esta sección",
          variant: "destructive",
        });
        navigate("/home");
      }
    }
  }, [
    user,
    loading,
    isAdminLoading,
    permissionsLoading,
    location.pathname,
    hasModuleAccess,
    isAdmin,
    navigate,
    toast,
  ]);

  // Show loading while checking permissions
  if (loading || isAdminLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  return <>{children}</>;
};

