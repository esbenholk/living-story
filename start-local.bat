@echo off
setlocal

echo.
echo  LIVING STORY - starting local services
echo  ======================================
echo.

:: start-local.bat
:: Starts ollama + sidecar + StreamDiffusion + ngrok.

:: -------------------------------------------------------------------------
:: CONFIG
:: -------------------------------------------------------------------------

set "STREAMDIFFUSION_DIR=C:\Users\esben\Downloads\StreamDiffusion"
set "STREAMDIFFUSION_HOST=127.0.0.1"
set "STREAMDIFFUSION_PORT=7860"
set "STREAMDIFFUSION_ACCELERATION=xformers"

:: --- Model / resolution -------------------------------------------------
:: ACTIVE: sd-turbo at 768. Same model you already run, just bigger. SD2.1-
:: based, so it tolerates 768 better than a 1.5 model. Tiny VAE is correct
:: for this model, so EXTRA is empty. Zero new-model risk — boots today.
set "STREAMDIFFUSION_MODEL=stabilityai/sd-turbo"
set "STREAMDIFFUSION_WIDTH=768"
set "STREAMDIFFUSION_HEIGHT=768"
set "STREAMDIFFUSION_CFG_TYPE=self"
set "STREAMDIFFUSION_GUIDANCE=1.2"
set "STREAMDIFFUSION_EXTRA="

:: --- UPGRADE (only if you want sharper output AND have 16GB+ VRAM) -------
:: SDXL-Turbo at 768. Requires an SDXL-capable StreamDiffusion build. If the
:: backend window throws a traceback (NaN / added_cond_kwargs / text_encoder_2)
:: your build doesn't support SDXL. To try it, comment out the six lines above
:: and uncomment these:
:: set "STREAMDIFFUSION_MODEL=stabilityai/sdxl-turbo"
:: set "STREAMDIFFUSION_WIDTH=768"
:: set "STREAMDIFFUSION_HEIGHT=768"
:: set "STREAMDIFFUSION_CFG_TYPE=none"
:: set "STREAMDIFFUSION_GUIDANCE=1.0"
:: set "STREAMDIFFUSION_EXTRA=--no-tiny-vae"

:: -------------------------------------------------------------------------
:: Check Docker
:: -------------------------------------------------------------------------

docker info >nul 2>&1
if errorlevel 1 (
echo  [WARNING] Docker does not appear to be running.
echo            Start Docker Desktop if you need the local database.
echo.
)

:: -------------------------------------------------------------------------
:: Check Ollama
:: -------------------------------------------------------------------------

where ollama >nul 2>&1
if errorlevel 1 (
echo  [ERROR] ollama not found in PATH. Please install Ollama first.
pause
exit /b 1
)

:: -------------------------------------------------------------------------
:: Check StreamDiffusion files
:: -------------------------------------------------------------------------

if not exist "%STREAMDIFFUSION_DIR%" (
echo  [ERROR] StreamDiffusion folder not found:
echo          "%STREAMDIFFUSION_DIR%"
echo.
pause
exit /b 1
)

if not exist "%STREAMDIFFUSION_DIR%\unity_backend\unity_stream_server.py" (
echo  [ERROR] StreamDiffusion Unity backend not found:
echo          "%STREAMDIFFUSION_DIR%\unity_backend\unity_stream_server.py"
echo.
pause
exit /b 1
)

if not exist "%STREAMDIFFUSION_DIR%\.venv\Scripts\activate.bat" (
echo  [ERROR] StreamDiffusion venv activation file not found:
echo          "%STREAMDIFFUSION_DIR%\.venv\Scripts\activate.bat"
echo.
echo          The venv does NOT need to already be running.
echo          But the .venv folder must exist at:
echo          "%STREAMDIFFUSION_DIR%\.venv"
echo.
pause
exit /b 1
)

:: -------------------------------------------------------------------------
:: Set OLLAMA_HOST so ngrok can reach it
:: -------------------------------------------------------------------------

set OLLAMA_HOST=0.0.0.0

:: -------------------------------------------------------------------------
:: Start Ollama
:: -------------------------------------------------------------------------

echo  [1/4] Starting Ollama...
start "Ollama" cmd /k "set OLLAMA_HOST=0.0.0.0 && ollama serve"
timeout /t 3 /nobreak >nul

:: -------------------------------------------------------------------------
:: Start sidecar
:: -------------------------------------------------------------------------

echo  [2/4] Starting sidecar...
start "Sidecar" cmd /k "cd /d "%~dp0sidecar" && python app.py"
timeout /t 3 /nobreak >nul

:: -------------------------------------------------------------------------
:: Start StreamDiffusion Unity backend
:: -------------------------------------------------------------------------

echo  [3/4] Starting StreamDiffusion Unity backend...
echo        model=%STREAMDIFFUSION_MODEL%  size=%STREAMDIFFUSION_WIDTH%x%STREAMDIFFUSION_HEIGHT%
start "StreamDiffusion Unity Backend" cmd /k "cd /d "%STREAMDIFFUSION_DIR%" && call .venv\Scripts\activate.bat && python unity_backend\unity_stream_server.py --host %STREAMDIFFUSION_HOST% --port %STREAMDIFFUSION_PORT% --acceleration %STREAMDIFFUSION_ACCELERATION% --model-id %STREAMDIFFUSION_MODEL% --width %STREAMDIFFUSION_WIDTH% --height %STREAMDIFFUSION_HEIGHT% --cfg-type %STREAMDIFFUSION_CFG_TYPE% --guidance-scale %STREAMDIFFUSION_GUIDANCE% %STREAMDIFFUSION_EXTRA% --engine-dir "%STREAMDIFFUSION_DIR%\engines""
timeout /t 5 /nobreak >nul

:: -------------------------------------------------------------------------
:: Start ngrok
:: -------------------------------------------------------------------------

echo  [4/4] Starting ngrok tunnels...
start "ngrok" cmd /k "ngrok start --all --config "%~dp0ngrok.yml""
timeout /t 3 /nobreak >nul

echo.
echo  All services started in separate windows.
echo.
echo  Ollama:          http://localhost:11434
echo  Sidecar:         http://localhost:5001/health
echo  StreamDiffusion: http://localhost:7860/health
echo  ngrok:           http://localhost:4040
echo.
echo  NOTE: set Stream Resolution = %STREAMDIFFUSION_WIDTH% on the Unity
echo        StreamDiffusionClient so Unity and the backend match.
echo.
echo  Press any key to close this window.
echo  Closing this window will NOT stop the services.
echo.

pause >nul