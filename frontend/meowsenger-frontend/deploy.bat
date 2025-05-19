@echo off

REM Copy deploy environment variables to .env
copy .env.deploy .env

REM Set image name and Google Container Registry (GCR) image name
set IMAGE_NAME=meowsenger-frontend
set GCR_IMAGE_NAME=gcr.io/me0wsenger/%IMAGE_NAME%

REM Ask for confirmation
set /p CONFIRM=Do you really want to build and push the Docker image to Google Cloud Run container? (y/n): 
if /i "%CONFIRM%" neq "y" goto :cancel

echo Switching to me0wsenger project...
call gcloud config set project me0wsenger
if %ERRORLEVEL% neq 0 (
    echo Failed to switch to me0wsenger project.
    pause
    exit /b 1
)

echo Building the Docker image with deployment environment variables...
docker buildx build --platform linux/amd64 -t %GCR_IMAGE_NAME% --load .
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
    --port 3000 ^
    --image %GCR_IMAGE_NAME% ^
    --platform managed ^
    --region us-central1 ^
    --allow-unauthenticated
if %ERRORLEVEL% neq 0 (
    echo Deployment to Google Cloud Run failed. Exiting.
    exit /b 1
)

echo Deployment to Google Cloud Run successful!
goto :eof

:cancel
echo Build and push cancelled. 