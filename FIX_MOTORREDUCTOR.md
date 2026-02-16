# Fix para "Motorreductor" en PDF

## Problema
El código simplificado no encuentra "Motorreductor" porque:
1. Usa `toLowerCase()` en lugar de `normalizeName()` (que remueve acentos)
2. La clave del mapa puede no coincidir con la búsqueda

## Solución

Reemplaza esta sección en `supabase/functions/generate-maintenance-report-pdf/index.ts`:

### ANTES (código problemático):
```javascript
const checklistEntriesRaw = Array.isArray(reportData.checklist) ? reportData.checklist : Array.isArray(reportData?.data?.checklist) ? reportData.data.checklist : [];
const checklistMap = new Map();
(checklistEntriesRaw ?? []).forEach((entry, index)=>{
  const key = typeof entry?.name === 'string' ? entry.name.trim().toLowerCase() : checklistFallback[index]?.toLowerCase();
  if (!key) return;
  checklistMap.set(key, {
    index,
    name: typeof entry?.name === 'string' ? entry.name : checklistFallback[index] ?? `Ítem ${index + 1}`,
    status: entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : entry?.status === 'na' ? 'na' : null,
    observation: typeof entry?.observation === 'string' ? entry.observation : ''
  });
});
const checklist = checklistFallback.map((name, index)=>{
  const entry = checklistMap.get(name.toLowerCase());
  return {
    index,
    name,
    status: entry?.status ?? null,
    observation: entry?.observation ?? ''
  };
});
```

### DESPUÉS (código corregido):
```javascript
// Función para normalizar nombres (remover acentos y convertir a minúsculas)
const normalizeName = (str: string): string => {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

const checklistEntriesRaw = Array.isArray(reportData.checklist) 
  ? reportData.checklist 
  : Array.isArray(reportData?.data?.checklist) 
  ? reportData.data.checklist 
  : [];

// Log para verificar "Motorreductor"
console.log('[maintenance-pdf] Total items en checklistEntriesRaw:', checklistEntriesRaw.length);
const motorreductorInRaw = checklistEntriesRaw.find((entry: any) => 
  entry && typeof entry.name === 'string' && 
  normalizeName(entry.name) === normalizeName('Motorreductor')
);
if (motorreductorInRaw) {
  console.log('[maintenance-pdf] ✅ "Motorreductor" encontrado:', {
    name: motorreductorInRaw.name,
    status: motorreductorInRaw.status,
    observation: motorreductorInRaw.observation
  });
} else {
  console.log('[maintenance-pdf] ⚠️ "Motorreductor" NO encontrado en checklistEntriesRaw');
}

// Construir el mapa usando normalizeName para las claves
const checklistMap = new Map();
(checklistEntriesRaw ?? []).forEach((entry, index) => {
  const entryName = typeof entry?.name === 'string' ? entry.name : checklistFallback[index] ?? `Ítem ${index + 1}`;
  const key = normalizeName(entryName); // ✅ USAR normalizeName en lugar de toLowerCase()
  if (!key) return;
  
  // Log específico para "Motorreductor"
  if (key.includes('motorreductor')) {
    console.log('[maintenance-pdf] 🔍 Agregando "Motorreductor" al mapa:', {
      entryName,
      key,
      status: entry?.status || 'null',
      observation: entry?.observation ? 'yes' : 'no'
    });
  }
  
  // Si ya existe, actualizar con los datos más recientes
  if (checklistMap.has(key)) {
    const existing = checklistMap.get(key);
    const newStatus = entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : entry?.status === 'na' ? 'na' : null;
    const newObservation = typeof entry?.observation === 'string' ? entry.observation : '';
    
    // Priorizar datos nuevos sobre existentes
    checklistMap.set(key, {
      index,
      name: entryName,
      status: newStatus || existing?.status || null,
      observation: newObservation || existing?.observation || ''
    });
  } else {
    checklistMap.set(key, {
      index,
      name: entryName,
      status: entry?.status === 'good' ? 'good' : entry?.status === 'bad' ? 'bad' : entry?.status === 'na' ? 'na' : null,
      observation: typeof entry?.observation === 'string' ? entry.observation : ''
    });
  }
});

// Verificar si "Motorreductor" está en el mapa
const motorreductorKey = normalizeName('Motorreductor');
const motorreductorInMap = checklistMap.has(motorreductorKey);
console.log('[maintenance-pdf] "Motorreductor" en mapa:', motorreductorInMap);
if (motorreductorInMap) {
  const entry = checklistMap.get(motorreductorKey);
  console.log('[maintenance-pdf] Datos de "Motorreductor" en mapa:', {
    status: entry?.status || 'null',
    observation: entry?.observation || '(vacía)'
  });
}

// Construir el checklist usando normalizeName para buscar en el mapa
const checklist = checklistFallback.map((name, index) => {
  const key = normalizeName(name); // ✅ USAR normalizeName en lugar de toLowerCase()
  const entry = checklistMap.get(key);
  
  // Log específico para "Motorreductor"
  if (key.includes('motorreductor')) {
    console.log('[maintenance-pdf] 🔍 Procesando "Motorreductor" desde fallback:', {
      name,
      key,
      encontrado: !!entry,
      status: entry?.status || 'null',
      observation: entry?.observation || '(vacía)'
    });
    
    // Si no está en el mapa, buscar en checklistEntriesRaw directamente
    if (!entry) {
      const motorreductorInRaw = checklistEntriesRaw.find((rawEntry: any) => 
        rawEntry && typeof rawEntry.name === 'string' && 
        normalizeName(rawEntry.name) === normalizeName('Motorreductor')
      );
      if (motorreductorInRaw) {
        console.log('[maintenance-pdf] ✅ Encontrado "Motorreductor" en checklistEntriesRaw, usando esos datos');
        return {
          index,
          name: 'Motorreductor',
          status: motorreductorInRaw.status === 'good' ? 'good' : motorreductorInRaw.status === 'bad' ? 'bad' : motorreductorInRaw.status === 'na' ? 'na' : null,
          observation: typeof motorreductorInRaw.observation === 'string' ? motorreductorInRaw.observation : ''
        };
      }
    }
  }
  
  return {
    index,
    name,
    status: entry?.status ?? null,
    observation: entry?.observation ?? ''
  };
});

// Verificación final
const motorreductorInChecklist = checklist.find(item => normalizeName(item.name) === normalizeName('Motorreductor'));
console.log('[maintenance-pdf] ✅✅✅ "Motorreductor" en checklist final:', !!motorreductorInChecklist);
if (motorreductorInChecklist) {
  console.log('[maintenance-pdf] Datos finales de "Motorreductor":', {
    index: motorreductorInChecklist.index,
    status: motorreductorInChecklist.status || 'null',
    observation: motorreductorInChecklist.observation || '(vacía)'
  });
} else {
  console.log('[maintenance-pdf] ❌❌❌ PROBLEMA: "Motorreductor" NO está en el checklist final!');
}
```

## Cambios clave:
1. ✅ Agregar función `normalizeName()` que remueve acentos
2. ✅ Usar `normalizeName()` en lugar de `toLowerCase()` para construir y buscar en el mapa
3. ✅ Agregar logs para rastrear "Motorreductor" en cada paso
4. ✅ Si no se encuentra en el mapa, buscar directamente en `checklistEntriesRaw`
5. ✅ Verificación final para asegurar que "Motorreductor" esté en el checklist

## Después de aplicar el fix:
1. Despliega la función: `supabase functions deploy generate-maintenance-report-pdf`
2. Genera un nuevo PDF
3. Revisa los logs en Supabase Dashboard para ver los mensajes de "Motorreductor"
























