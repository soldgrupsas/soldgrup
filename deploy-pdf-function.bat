@echo off
REM Script para desplegar la función generate-maintenance-report-pdf
REM Ejecuta este script desde CMD en la carpeta del proyecto

echo 🚀 Desplegando función generate-maintenance-report-pdf...
echo.

echo 📋 Verificando autenticación...
call npx supabase projects list >nul 2>&1
if errorlevel 1 (
    echo ❌ No estás autenticado. Ejecuta primero: npx supabase login
    echo.
    echo Para autenticarte:
    echo 1. Ejecuta: npx supabase login
    echo 2. Se abrirá tu navegador para autenticarte
    echo 3. Luego ejecuta este script nuevamente
    pause
    exit /b 1
)

echo ✅ Autenticación verificada
echo.

echo 📦 Desplegando función...
call npx supabase functions deploy generate-maintenance-report-pdf

if errorlevel 1 (
    echo.
    echo ❌ Error durante el deploy. Revisa los mensajes arriba.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ ¡Deploy completado exitosamente!
    echo Ahora puedes probar generando un PDF de informe de mantenimiento
    pause
)





















