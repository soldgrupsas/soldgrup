// Constants for module keys
export const MODULES = {
  ADMIN: 'admin',
  DASHBOARD: 'dashboard',
  EQUIPMENT: 'equipment',
  MAINTENANCE_REPORTS: 'maintenance-reports',
} as const;

export type ModuleKey = typeof MODULES[keyof typeof MODULES];

// Module path mappings
export const MODULE_PATHS: Record<ModuleKey, string> = {
  [MODULES.ADMIN]: '/admin',
  [MODULES.DASHBOARD]: '/dashboard',
  [MODULES.EQUIPMENT]: '/equipment',
  [MODULES.MAINTENANCE_REPORTS]: '/maintenance-reports',
} as const;

// Module display names
export const MODULE_NAMES: Record<ModuleKey, string> = {
  [MODULES.ADMIN]: 'Panel de Administración',
  [MODULES.DASHBOARD]: 'Propuestas Comerciales',
  [MODULES.EQUIPMENT]: 'Equipos',
  [MODULES.MAINTENANCE_REPORTS]: 'Informes de Mantenimiento',
} as const;

/**
 * Get module key from pathname
 */
export const getModuleFromPath = (pathname: string): ModuleKey | null => {
  if (pathname.startsWith('/admin')) return MODULES.ADMIN;
  if (pathname.startsWith('/dashboard')) return MODULES.DASHBOARD;
  if (pathname.startsWith('/equipment')) return MODULES.EQUIPMENT;
  if (pathname.startsWith('/maintenance-reports')) return MODULES.MAINTENANCE_REPORTS;
  return null;
};

/**
 * Check if a path requires authentication
 */
export const requiresAuth = (pathname: string): boolean => {
  // Public routes that don't require auth
  const publicRoutes = ['/', '/auth', '/view'];
  return !publicRoutes.some(route => pathname.startsWith(route));
};

