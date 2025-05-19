@echo off
setlocal enabledelayedexpansion

echo === Meowsenger Deployment Script ===

REM Ensure we're using the me0wsenger GCP project
echo Switching to me0wsenger project...
call gcloud config set project me0wsenger
if %ERRORLEVEL% neq 0 (
    echo Failed to switch to me0wsenger project.
    pause
    exit /b 1
)

:menu
echo.
echo 1. Deploy Frontend service
echo 2. Deploy Backend service
echo 3. Deploy Messaging service
echo 4. Deploy All services
echo 5. Exit
echo.
set /p CHOICE=Enter your choice (1-5): 

if "%CHOICE%"=="1" goto frontend
if "%CHOICE%"=="2" goto backend
if "%CHOICE%"=="3" goto messaging
if "%CHOICE%"=="4" goto all
if "%CHOICE%"=="5" goto end

echo Invalid choice. Please try again.
goto menu

:frontend
echo.
echo === Deploying Frontend Service ===
cd frontend/meowsenger-frontend
call deploy.bat
cd ..
goto menu

:backend
echo.
echo === Deploying Backend Service ===
cd backend
call deploy.bat
cd ..
goto menu

:messaging
echo.
echo === Deploying Messaging Service ===
cd messaging
call deploy.bat
cd ..
goto menu

:all
echo.
echo === Deploying All Services ===
echo.
echo Deploying Frontend...
cd frontend
call deploy.bat
cd ..

echo.
echo Deploying Backend...
cd backend
call deploy.bat
cd ..

echo.
echo Deploying Messaging...
cd messaging
call deploy.bat
cd ..

echo.
echo All services have been deployed!
goto menu

:end
echo Exiting deployment script.
endlocal
pause 