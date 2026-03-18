@echo off
echo.
echo  LIVING STORY — starting local services
echo  =======================================
echo.

:: ── Check Docker is running ───────────────────────────────────────────────
docker info >nul 2>&1
if errorlevel 1 (
    echo  [WARNING] Docker does not appear to be running.
    echo            Start Docker Desktop if you need the local database.
    echo.
)

:: ── Check Ollama is installed ─────────────────────────────────────────────
where ollama >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] ollama not found in PATH. Please install Ollama first.
    pause
    exit /b 1
)

:: ── Set OLLAMA_HOST so ngrok can reach it ────────────────────────────────
set OLLAMA_HOST=0.0.0.0

:: ── Start Ollama in its own window ───────────────────────────────────────
echo  [1/3] Starting Ollama...
start "Ollama" cmd /k "set OLLAMA_HOST=0.0.0.0 && ollama serve"
timeout /t 3 /nobreak >nul

:: ── Start sidecar in its own window ──────────────────────────────────────
echo  [2/3] Starting sidecar...
start "Sidecar" cmd /k "cd /d %~dp0sidecar && python app.py"
timeout /t 3 /nobreak >nul

:: ── Start ngrok in its own window ────────────────────────────────────────
echo  [3/3] Starting ngrok tunnels...
start "ngrok" cmd /k "ngrok start --all --config %~dp0ngrok.yml"
timeout /t 3 /nobreak >nul

echo.
echo  All services started in separate windows.
echo.
echo  Ollama:  http://localhost:11434
echo  Sidecar: http://localhost:5001/health
echo  ngrok:   http://localhost:4040
echo.
echo  Press any key to close this window.
echo  (Closing this window will NOT stop the services)
echo.
pause >nul