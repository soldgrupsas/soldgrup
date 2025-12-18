# Instrucciones para desplegar la corrección del error de PDF

## Problema resuelto
Se ha corregido el error "WinAnsi cannot encode √ (0x2713)" normalizando todos los caracteres Unicode antes de dibujarlos en el PDF.

## Pasos para desplegar

1. **Autenticarse con Supabase** (si no lo has hecho):
   ```bash
   npx supabase login
   ```

2. **Desplegar la función corregida**:
   ```bash
   npx supabase functions deploy generate-proposal-pdf
   ```

   O si necesitas desplegar todas las funciones que usan PDF:
   ```bash
   npx supabase functions deploy generate-proposal-pdf
   npx supabase functions deploy generate-proposal-pdf-public
   ```

## Cambios realizados

- Se agregó la función `normalizeForWinAnsi()` que reemplaza caracteres Unicode problemáticos
- Todos los textos (datos de propuestas, descripciones, títulos, etc.) ahora se normalizan antes de dibujarse
- El símbolo "√" (checkmark U+2713) y otros caracteres especiales se convierten a equivalentes ASCII seguros

## Verificación

Después de desplegar, intenta descargar un PDF de propuesta. El error ya no debería aparecer.




