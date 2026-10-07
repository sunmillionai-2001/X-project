@echo off
setlocal
set "studioNode=%ProgramFiles%\nodejs\node.exe"
if not exist "%studioNode%" set "studioNode=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%studioNode%" "%~dp0start-workbench-v2.cjs" --open
if errorlevel 1 (
  pause
  exit /b 1
)
