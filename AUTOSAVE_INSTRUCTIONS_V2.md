# 📋 DOCUMENTACIÓN TÉCNICA: AUTOGUARDADO EN PROPUESTAS COMERCIALES

## RESUMEN EJECUTIVO

Esta funcionalidad implementa autoguardado automático en la creación y edición de propuestas comerciales, eliminando la pérdida de datos por cierres accidentales del navegador o cambios de pestaña.

---

## 1. ARQUITECTURA DE BASE DE DATOS

### Migraciones SQL Aplicadas

**Archivo 1:** `supabase/migrations/20251105105504_add_user_id_to_proposals.sql`
- ✅ Campo `user_id` en tabla `proposals`
- ✅ Índice `idx_proposals_user_id` para optimizar consultas
- ✅ Políticas RLS iniciales

**Archivo 2:** `supabase/migrations/20251105110000_fix_proposals_rls_policies.sql`
- ✅ Políticas RLS para usuarios (solo sus propuestas)
- ✅ Políticas RLS para admins (todas las propuestas)
- ✅ Acceso público por `public_url_slug`

**⚠️ IMPORTANTE:** Las migraciones ya están aplicadas en la base de datos.

---

## 2. COMPONENTE PRINCIPAL: CreateProposal.tsx

### Estados de Autoguardado

```typescript
const [proposalId, setProposalId] = useState<string | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
const [pendingAutoSave, setPendingAutoSave] = useState(false);
const initialLoadRef = useRef(true);
```

### Funciones Clave

#### 1. `createInitialProposal()`
- Crea la propuesta inmediatamente al cargar el componente
- Genera slug público automáticamente (`generate_proposal_slug` RPC)
- Asocia la propuesta al `user.id` del usuario autenticado
- Muestra notificación: "Propuesta iniciada - Autoguardado activado"
- Retorna el `proposalId` creado

#### 2. `loadExistingProposal(id)`
- Carga una propuesta existente para edición
- Restaura todos los campos del formulario
- Carga `proposal_items` y `equipment_details` relacionados
- Configura el estado de autoguardado (`proposalId`, `lastSavedAt`)

#### 3. `persistProposal()`
- Guarda automáticamente los cambios
- Actualiza la tabla `proposals` principal
- Sincroniza `proposal_items` (delete + insert)
- Sincroniza `equipment_details` (delete + insert)
- Actualiza `lastSavedAt` con el timestamp del servidor

### useEffects Implementados

#### 1. Inicialización (al montar componente)
```typescript
useEffect(() => {
  if (!user || initialLoadRef.current === false) return;
  
  if (params.id) {
    // Editar: Cargar propuesta existente
    await loadExistingProposal(params.id);
  } else {
    // Crear: Nueva propuesta
    await createInitialProposal();
  }
  
  initialLoadRef.current = false;
}, [user, params.id, ...]);
```

#### 2. Autoguardado con Debounce (800ms)
```typescript
useEffect(() => {
  if (initialLoadRef.current || !proposalId) return;
  setPendingAutoSave(true);

  const handler = setTimeout(() => {
    void persistProposal();
  }, 800);

  return () => clearTimeout(handler);
}, [formData, proposalItems, technicalSpecs, selectedEquipment, proposalId]);
```

#### 3. Subida Inmediata de Imágenes
```typescript
useEffect(() => {
  if (initialLoadRef.current || !proposalId || selectedImages.length === 0) return;
  
  const uploadImages = async () => {
    // 1. Eliminar imágenes anteriores
    // 2. Subir nuevas a bucket 'proposal-images'
    // 3. Insertar registros en 'proposal_images'
  };
  
  void uploadImages();
}, [selectedImages, proposalId]);
```

#### 4. Subida Inmediata de Modelos 3D
```typescript
useEffect(() => {
  if (initialLoadRef.current || !proposalId || !selected3DModel) return;
  
  const upload3DModel = async () => {
    // 1. Convertir a base64
    // 2. Llamar Edge Function 'compress-3d-model'
    // 3. Actualizar 'proposals.model_3d_url'
    // 4. Notificación de compresión exitosa
  };
  
  void upload3DModel();
}, [selected3DModel, proposalId]);
```

---

## 3. ROUTING

### App.tsx
```typescript
<Route path="/create" element={<ProtectedRoute><CreateProposal /></ProtectedRoute>} />
<Route path="/edit/:id" element={<ProtectedRoute><CreateProposal /></ProtectedRoute>} />
```

**✅ Ventaja:** Mismo componente para crear y editar, sin duplicación de código.

---

## 4. FLUJO DE USUARIO

### Nueva Propuesta (`/create`)

1. Usuario accede a `/create`
2. Sistema crea inmediatamente un registro en DB:
   - Slug público generado
   - `user_id` del usuario autenticado
   - Campos vacíos o valores por defecto
3. Notificación: "Propuesta iniciada - Autoguardado activado"
4. Usuario completa el formulario
5. **Autoguardado cada 800ms tras cualquier cambio**
6. Imágenes y modelos 3D se suben **inmediatamente** al seleccionar
7. Usuario hace clic en "Guardar y Cerrar" → Navega a `/dashboard`

### Editar Propuesta Existente (`/edit/:id`)

1. Usuario accede a `/edit/:id`
2. Sistema carga la propuesta existente
3. Autoguardado se activa automáticamente
4. Comportamiento idéntico al de crear

---

## 5. INDICADORES VISUALES (UI)

### Estado de Guardado en Tiempo Real

En la esquina superior derecha del formulario:

- 🟡 **"Guardando..."** - Guardado en progreso (`isSaving=true`)
- 🟠 **"Cambios pendientes"** - Esperando debounce (`pendingAutoSave=true`)
- 🟢 **"Guardado HH:MM"** - Guardado exitoso con timestamp

### Código del Indicador
```typescript
{lastSavedAt && (
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
    ) : (
      <>
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span>Guardado {lastSavedAt.toLocaleTimeString("es-ES", {...})}</span>
      </>
    )}
  </div>
)}
```

---

## 6. POLÍTICAS DE SEGURIDAD (RLS)

### Usuarios Normales
- ✅ **Crear:** Solo propuestas con su propio `user_id`
- ✅ **Ver:** Solo sus propias propuestas + propuestas públicas (con slug)
- ✅ **Actualizar:** Solo sus propias propuestas
- ✅ **Eliminar:** Solo sus propias propuestas

### Administradores
- ✅ **Crear:** Cualquier propuesta
- ✅ **Ver:** Todas las propuestas
- ✅ **Actualizar:** Todas las propuestas
- ✅ **Eliminar:** Todas las propuestas

### Público (Anónimo)
- ✅ **Ver:** Solo propuestas con `public_url_slug` no nulo

---

## 7. ARCHIVOS INVOLUCRADOS

### Frontend
- `src/pages/CreateProposal.tsx` - Componente principal con toda la lógica
- `src/App.tsx` - Routing `/create` y `/edit/:id`

### Backend (Migraciones SQL)
- `supabase/migrations/20251105105504_add_user_id_to_proposals.sql`
- `supabase/migrations/20251105110000_fix_proposals_rls_policies.sql`

### Edge Functions (ya existentes, sin cambios)
- `supabase/functions/compress-3d-model/` - Compresión de modelos 3D

---

## 8. VENTAJAS DE LA IMPLEMENTACIÓN

1. ✅ **Persistencia Completa** - Todo en base de datos, no en localStorage
2. ✅ **Multi-dispositivo** - Continuar editando desde cualquier dispositivo
3. ✅ **Sin Límites de Tamaño** - No hay restricciones de localStorage
4. ✅ **Manejo Automático de Archivos** - Imágenes y modelos 3D
5. ✅ **Experiencia de Usuario** - Indicador visual claro del estado
6. ✅ **Recuperación ante Fallos** - Refresh del navegador no pierde datos
7. ✅ **Simplicidad** - URL pública generada desde el inicio

---

## 9. COMPATIBILIDAD CON FUNCIONALIDADES EXISTENTES

### ✅ Generación de PDF
- Sin impacto negativo
- `generate-proposal-pdf` funciona igual
- Los borradores también pueden generar PDF

### ✅ URLs Públicas
- Se generan inmediatamente al crear
- Los borradores tienen URL pero no se comparten hasta completar

### ✅ Dashboard
- Muestra todas las propuestas del usuario (o todas si es admin)
- Propuestas legacy sin `user_id` son visibles para admins
- Funciones de PDF, copiar URL y eliminar funcionan sin cambios

---

## 10. CÓMO VOLVER A SOLICITAR ESTA FUNCIONALIDAD

### Opción 1: Solicitud Completa
```
Implementa el autoguardado en propuestas comerciales según la documentación 
en AUTOSAVE_INSTRUCTIONS_V2.md. Las migraciones de base de datos ya están 
aplicadas (user_id en proposals + RLS policies). Solo necesito los cambios 
en el frontend: CreateProposal.tsx con autoguardado cada 800ms, subida 
inmediata de archivos, indicadores visuales de estado, y routing a /edit/:id.
```

### Opción 2: Solicitud Corta
```
Reactiva el autoguardado de propuestas comerciales documentado en 
AUTOSAVE_INSTRUCTIONS_V2.md
```

### Opción 3: Referencia al Archivo Original
```
Implementa la funcionalidad descrita en AUTOSAVE_IMPLEMENTATION.md
```

---

## 11. PRUEBAS RECOMENDADAS

### Escenarios de Prueba

1. **Crear Nueva Propuesta**
   - Verificar creación inmediata al entrar a `/create`
   - Verificar autoguardado al completar campos
   - Verificar indicador visual de guardado

2. **Subir Archivos**
   - Subir imágenes y verificar subida inmediata
   - Subir modelo 3D y verificar compresión
   - Verificar notificaciones de progreso

3. **Editar Propuesta Existente**
   - Navegar a `/edit/:id` de una propuesta
   - Verificar carga de todos los datos
   - Hacer cambios y verificar autoguardado

4. **Refresh del Navegador**
   - Crear propuesta, completar campos
   - Refrescar navegador
   - Verificar que no se perdió nada
   - Dashboard debe mostrar la propuesta

5. **Generación de PDF**
   - Crear propuesta parcialmente completa
   - Guardar y cerrar
   - Descargar PDF desde dashboard
   - Verificar que funciona correctamente

6. **Permisos**
   - Como usuario: Solo ver tus propuestas
   - Como admin: Ver todas las propuestas
   - Verificar URLs públicas sin autenticación

---

## 12. DETALLES TÉCNICOS ADICIONALES

### Manejo de Errores de Sesión

El componente incluye verificación de errores de autenticación:

```typescript
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
```

### Sincronización de Items y Equipos

El método `persistProposal()` usa una estrategia "delete-and-insert":

1. **Proposal Items:**
   ```typescript
   // Eliminar todos los items existentes
   await supabase.from("proposal_items").delete().eq("proposal_id", proposalId);
   
   // Insertar solo items con descripción
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
     await supabase.from("proposal_items").insert(itemsToInsert);
   }
   ```

2. **Equipment Details:**
   ```typescript
   // Eliminar equipos existentes
   await supabase.from("equipment_details").delete().eq("proposal_id", proposalId);
   
   // Insertar equipos seleccionados
   if (selectedEquipment.length > 0) {
     const equipmentDetails = selectedEquipment.map((eq) => ({
       proposal_id: proposalId,
       equipment_name: eq.name,
       equipment_specs: {
         id: eq.id,
         description: eq.description,
         images: eq.images,
         tables: eq.tables,
       },
     }));
     await supabase.from("equipment_details").insert(equipmentDetails);
   }
   ```

### Prevención de Guardado Durante Carga Inicial

```typescript
const initialLoadRef = useRef(true);

// En el useEffect de autoguardado:
useEffect(() => {
  if (initialLoadRef.current || !proposalId) return; // <-- Previene guardado inicial
  setPendingAutoSave(true);
  
  const handler = setTimeout(() => {
    void persistProposal();
  }, 800);
  
  return () => clearTimeout(handler);
}, [formData, proposalItems, technicalSpecs, selectedEquipment, proposalId]);
```

---

## 13. NOTA FINAL

**⚠️ IMPORTANTE:** Las migraciones SQL ya están aplicadas en la base de datos. 
Al reimplementar solo necesitas:
1. Modificar `src/pages/CreateProposal.tsx`
2. Verificar routing en `src/App.tsx`

**No es necesario volver a ejecutar migraciones de base de datos.**

---

## 📚 REFERENCIA COMPLETA

Para documentación extendida con ejemplos de código completos, consultar:
- `AUTOSAVE_IMPLEMENTATION.md` (raíz del proyecto)

---

**Fecha de documentación:** Noviembre 2025  
**Estado:** ✅ Implementado y probado  
**Autor:** Sistema de IA - Documentación técnica

