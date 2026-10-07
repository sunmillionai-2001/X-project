@echo off
chcp 65001 >nul
cd /d "%~dp0"
node stop-x-radar.cjs
if errorlevel 1 pause
