@echo off
title CleanSched - Servidor de Desarrollo
color 0A

echo.
echo  ========================================
echo   CleanSched ^& Facturacion DIAN
echo   Servidor de Desarrollo
echo  ========================================
echo.

cd /d "%~dp0"

:: Verificar que node_modules existe
if not exist "node_modules" (
    echo  [!] Instalando dependencias...
    npm install
    echo.
)

echo  [*] Iniciando servidor en http://localhost:3000
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo  ----------------------------------------
echo.

:: Abrir el navegador despues de 4 segundos
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

npm run dev
