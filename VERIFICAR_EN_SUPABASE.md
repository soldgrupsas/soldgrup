# Cómo verificar y corregir el error en Supabase

## Pasos para verificar en el Dashboard de Supabase:

### 1. Ir a Edge Functions
- Dashboard: https://supabase.com/dashboard
- Selecciona tu proyecto
- Menú lateral → **Edge Functions**

### 2. Abrir la función
- Haz clic en **generate-proposal-pdf**
- Busca el archivo: **_shared/pdf.ts** (o **supabase/functions/_shared/pdf.ts**)

### 3. Buscar la función de normalización
Presiona **Ctrl+F** (o Cmd+F) y busca:

```
normalizeForWinAnsi
```

O busca directamente:
```
.replace(/\u2713/g, 'v')
```

### 4. Qué deberías ver

**Si EXISTE la función**, deberías ver algo como esto (alrededor de la línea 197):

```typescript
const normalizeForWinAnsi = (text: string): string => {
  if (!text) return '';
  let normalized = text
    .replace(/\u2713/g, 'v')  // CHECK MARK (U+2713) -> v
    .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
    // ... más código
```

**Si NO existe**, el código desplegado está desactualizado y necesitas actualizarlo.

### 5. Si NO existe la función

Necesitas copiar el contenido del archivo `supabase/functions/_shared/pdf.ts` desde tu código local
y reemplazarlo completamente en Supabase.

### 6. Verificar que se está usando

Busca en el código si `normalizeForWinAnsi` se está usando antes de dibujar textos:

- Busca: `page.drawText(normalizeForWinAnsi(`
- Deberías verlo en múltiples lugares

Si no se está usando, el código necesita ser actualizado.







