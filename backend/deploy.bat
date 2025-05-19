@echo off

REM Navigate to the correct directory
cd %~dp0

REM Copy deploy environment variables to .env
copy .env.deploy .env

REM Read environment variables from .env.deploy
set DB_ENGINE=
set DB_NAME=
set DB_USER=
set DB_PASSWORD=
set DB_HOST=
set DB_PORT=
set CLOUD_SQL_INSTANCE=
for /F "tokens=1* delims==" %%A in (.env.deploy) do (
    if "%%A"=="DB_ENGINE" set DB_ENGINE=%%B
    if "%%A"=="DB_NAME" set DB_NAME=%%B
    if "%%A"=="DB_USER" set DB_USER=%%B
    if "%%A"=="DB_PASSWORD" set DB_PASSWORD=%%B
    if "%%A"=="DB_HOST" set DB_HOST=%%B
    if "%%A"=="DB_PORT" set DB_PORT=%%B
    if "%%A"=="CLOUD_SQL_INSTANCE" set CLOUD_SQL_INSTANCE=%%B
)

REM If CLOUD_SQL_INSTANCE is not defined, set a default value
if "%CLOUD_SQL_INSTANCE%"=="" set CLOUD_SQL_INSTANCE=me0wsenger:us-central1:meowgress

REM Set image name and Google Container Registry (GCR) image name
set IMAGE_NAME=meowsenger-backend
set GCR_IMAGE_NAME=gcr.io/me0wsenger/%IMAGE_NAME%

REM Check if Dockerfile exists
if not exist Dockerfile (
    echo Error: Dockerfile not found in the current directory.
    echo Current directory: %CD%
    dir /b
    exit /b 1
)

REM Ask for confirmation
set /p CONFIRM=Do you really want to build and push the Docker image to Google Cloud Run container? (y/n): 
if /i "%CONFIRM%" neq "y" goto :cancel

echo Switching to me0wsenger project...
call gcloud config set project me0wsenger

echo Building the Docker image with deployment environment variables...
docker buildx build --platform linux/amd64 -t %GCR_IMAGE_NAME% --load -f Dockerfile .
if %ERRORLEVEL% neq 0 (
    echo Docker build failed. Exiting.
    exit /b 1
)

echo Docker image built successfully.

echo Pushing the Docker image to %GCR_IMAGE_NAME%...
docker push %GCR_IMAGE_NAME%
if %ERRORLEVEL% neq 0 (
    echo Docker push failed. Exiting.
    exit /b 1
)

echo Deploying %IMAGE_NAME% to Google Cloud Run managed platform...
gcloud run deploy %IMAGE_NAME% ^
    --port=8000 ^
    --image=%GCR_IMAGE_NAME% ^
    --platform=managed ^
    --region=us-central1 ^
    --add-cloudsql-instances=%CLOUD_SQL_INSTANCE% ^
    --set-env-vars=DB_ENGINE=%DB_ENGINE%,DB_NAME=%DB_NAME%,DB_USER=%DB_USER%,DB_PASSWORD=%DB_PASSWORD%,DB_HOST=/cloudsql/%CLOUD_SQL_INSTANCE%,DB_PORT=%DB_PORT%,INSTANCE_CONNECTION_NAME=%CLOUD_SQL_INSTANCE% ^
    --allow-unauthenticated
if %ERRORLEVEL% neq 0 (
    echo Deployment to Google Cloud Run failed. Exiting.
    exit /b 1
)

echo Deployment to Google Cloud Run successful!
goto :eof

:cancel
echo Build and push cancelled. 