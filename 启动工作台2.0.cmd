@echo off
chcp 65001 >nul
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" start-workbench-v2.cjs --open
pause
