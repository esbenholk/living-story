@echo off
echo.
echo  Living Story — startup check
echo  ==============================
echo.

:: Check Postgres (Docker container)
echo [1/2] Checking PostgreSQL (Docker)...
docker inspect living-story-db --format="{{.State.Status}}" 2>nul | findstr "running" >nul
if %errorlevel% neq 0 (
    echo       Not running — starting container...
    docker start living-story-db
    timeout /t 3 /nobreak >nul
    echo       PostgreSQL started.
) else (
    echo       PostgreSQL already running.
)

:: Check Ollama
echo [2/2] Checking Ollama...
curl -s http://localhost:11434 | findstr "running" >nul
if %errorlevel% neq 0 (
    echo       Not running — starting Ollama in background...
    start /B ollama serve
    timeout /t 3 /nobreak >nul
    echo       Ollama started.
) else (
    echo       Ollama already running.
)

echo.
echo  All services ready. Starting app...
echo.

:: Start backend, frontend, sidecar together
yarn start