# Script para desplegar la función generate-maintenance-report-pdf
# Ejecuta este script desde PowerShell en la carpeta del proyecto

Write-Host "🚀 Desplegando función generate-maintenance-report-pdf..." -ForegroundColor Cyan

# Verificar si está autenticado
Write-Host "📋 Verificando autenticación..." -ForegroundColor Yellow
$authCheck = npx supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No estás autenticado. Ejecuta primero: npx supabase login" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para autenticarte:" -ForegroundColor Yellow
    Write-Host "1. Ejecuta: npx supabase login" -ForegroundColor White
    Write-Host "2. Se abrirá tu navegador para autenticarte" -ForegroundColor White
    Write-Host "3. Luego ejecuta este script nuevamente" -ForegroundColor White
    exit 1
}

Write-Host "✅ Autenticación verificada" -ForegroundColor Green
Write-Host ""

# Desplegar la función
Write-Host "📦 Desplegando función..." -ForegroundColor Yellow
npx supabase functions deploy generate-maintenance-report-pdf

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ ¡Deploy completado exitosamente!" -ForegroundColor Green
    Write-Host "Ahora puedes probar generando un PDF de informe de mantenimiento" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Error durante el deploy. Revisa los mensajes arriba." -ForegroundColor Red
}












