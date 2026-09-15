@echo off
setlocal enabledelayedexpansion

:: Always run from the repository root
cd /d "%~dp0"

echo ======================================================================
echo                     Starting PRAVAH Environment
echo ======================================================================
echo.

:: 1. Detect Python executable
set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
if not exist "!PYTHON_EXE!" (
    where python >nul 2>nul
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        echo [ERROR] Python not found in .venv or system PATH!
        echo Please ensure Python is installed and your virtual environment is set up.
        pause
        exit /b 1
    )
)

:: 2. Detect pnpm package manager
where pnpm >nul 2>nul
if !errorlevel! equ 0 (
    set "PNPM_CMD=pnpm"
) else (
    set "PNPM_CMD=corepack pnpm"
)

:: 3. Start Backend (FastAPI on port 8000)
echo [*] Starting Backend (FastAPI on http://localhost:8000)...
start "PRAVAH - Backend (:8000)" cmd /k "cd /d "%~dp0" && "!PYTHON_EXE!" -m uvicorn app.main:app --app-dir backend --reload --port 8000"

:: 4. Start Frontend (Vite on port 4173)
echo [*] Starting Frontend (Vite on http://localhost:4173)...
start "PRAVAH - Frontend (:4173)" cmd /k "cd /d "%~dp0" && set PORT=4173&& set BASE_PATH=/&& set VITE_API_BASE_URL=http://localhost:8000&& !PNPM_CMD! --dir frontend dev"

echo.
echo ======================================================================
echo  PRAVAH services are launching in separate windows:
echo    - Backend API:  http://localhost:8000
echo    - Health Check: http://localhost:8000/health
echo    - API Docs:     http://localhost:8000/docs
echo    - Frontend UI:  http://localhost:4173/
echo ======================================================================
echo.
echo Close the respective windows or press Ctrl+C inside them to stop.
echo.

:: 5. Open the frontend in the default browser after a brief delay
if /i not "%~1"=="--no-browser" if /i not "%~1"=="/nobrowser" (
    echo Opening http://localhost:4173 in your default browser...
    timeout /t 3 /nobreak >nul 2>&1
    start "" "http://localhost:4173"
)
