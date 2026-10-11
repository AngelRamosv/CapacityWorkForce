@echo off
title WORKFORCE SYSTEM - AUTORUN
echo Iniciando Servidor Central (Backend)...
start cmd /k "cd /d "%~dp0server" && npm run dev"
timeout /t 5
echo Iniciando Interfaz de Usuario (Frontend)...
start cmd /k "cd /d "%~dp0client" && npm run dev -- --host"
echo.
echo [SISTEMA ACTIVO] El Director ya puede entrar al Live Dashboard.

