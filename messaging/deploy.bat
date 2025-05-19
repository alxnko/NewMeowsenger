@echo off

REM Navigate to the correct directory
cd %~dp0

REM Copy deploy environment variables to .env
copy .env.deploy .env

REM Read environment variables from .env.deploy
set BACKEND_URL=
set CLOUD_SQL_INSTANCE=
set SPRING_DATASOURCE_URL=
set SPRING_DATASOURCE_USERNAME=
set SPRING_DATASOURCE_PASSWORD=
set SPRING_PROFILES_ACTIVE=
for /F "tokens=1* delims==" %%A in (.env.deploy) do (
    if "%%A"=="BACKEND_URL" set BACKEND_URL=%%B
    if "%%A"=="CLOUD_SQL_INSTANCE" set CLOUD_SQL_INSTANCE=%%B
    if "%%A"=="SPRING_DATASOURCE_URL" set SPRING_DATASOURCE_URL=%%B
    if "%%A"=="SPRING_DATASOURCE_USERNAME" set SPRING_DATASOURCE_USERNAME=%%B
    if "%%A"=="SPRING_DATASOURCE_PASSWORD" set SPRING_DATASOURCE_PASSWORD=%%B
    if "%%A"=="SPRING_PROFILES_ACTIVE" set SPRING_PROFILES_ACTIVE=%%B
)

REM Always ensure prod profile is set
if "%SPRING_PROFILES_ACTIVE%"=="" set SPRING_PROFILES_ACTIVE=prod

REM If CLOUD_SQL_INSTANCE is not defined, set a default value
if "%CLOUD_SQL_INSTANCE%"=="" set CLOUD_SQL_INSTANCE=me0wsenger:us-central1:meowgress

REM Set image name and Google Container Registry (GCR) image name
set IMAGE_NAME=meowsenger-websocket
set GCR_IMAGE_NAME=gcr.io/me0wsenger/%IMAGE_NAME%
set PROJECT_ID=me0wsenger
set PROJECT_NUMBER=307953174855
set REGION=us-central1

REM Extract just the instance name from the connection string (after the last colon)
for /f "tokens=3 delims=:" %%a in ("%CLOUD_SQL_INSTANCE%") do set SQL_INSTANCE_NAME=%%a
if "%SQL_INSTANCE_NAME%"=="" set SQL_INSTANCE_NAME=%CLOUD_SQL_INSTANCE%

echo Checking Cloud SQL instance %SQL_INSTANCE_NAME%...
call gcloud sql instances describe %SQL_INSTANCE_NAME% --project=%PROJECT_ID% >NUL 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Cloud SQL instance %SQL_INSTANCE_NAME% not found!
    echo Listing available instances:
    call gcloud sql instances list --project=%PROJECT_ID%
    goto :cancel
)

REM Use the default Compute Engine service account
echo Setting up service account for deployment...
set SERVICE_ACCOUNT=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com
echo Using the default Compute Engine service account: %SERVICE_ACCOUNT%

REM Grant permissions to the service account
echo Adding Cloud SQL Client role to service account %SERVICE_ACCOUNT%...
call gcloud projects add-iam-policy-binding %PROJECT_ID% ^
    --member=serviceAccount:%SERVICE_ACCOUNT% ^
    --role=roles/cloudsql.client

REM Ask for confirmation
set /p CONFIRM=Do you really want to build and push the Docker image to Google Cloud Run container? (y/n): 
if /i "%CONFIRM%" neq "y" goto :cancel

echo Switching to me0wsenger project...
call gcloud config set project me0wsenger

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

echo Creating properly escaped environment variables...
REM Create properly escaped environment variables string
set ENV_VARS=SPRING_PROFILES_ACTIVE=prod,BACKEND_URL=%BACKEND_URL%,CLOUD_SQL_INSTANCE=%CLOUD_SQL_INSTANCE%,SPRING_DATASOURCE_URL="%SPRING_DATASOURCE_URL%",SPRING_DATASOURCE_USERNAME=%SPRING_DATASOURCE_USERNAME%,SPRING_DATASOURCE_PASSWORD=%SPRING_DATASOURCE_PASSWORD%


echo Attempting to deploy with the default service account...
gcloud run deploy %IMAGE_NAME% ^
    --port=8080 ^
    --image=%GCR_IMAGE_NAME% ^
    --platform=managed ^
    --region=us-central1 ^
    --add-cloudsql-instances=%PROJECT_ID%:%REGION%:%SQL_INSTANCE_NAME% ^
    --service-account=%SERVICE_ACCOUNT% ^
    --set-env-vars=%ENV_VARS% ^
    --allow-unauthenticated ^
    --cpu=1 ^
    --memory=768Mi ^
    --min-instances=1 ^
    --max-instances=3 ^
    --timeout=3600s ^
    --session-affinity ^
    --concurrency=80 ^
    --execution-environment=gen2 ^
    --cpu-throttling=false ^
    --ingress=all ^
    --no-traffic-migration

if %ERRORLEVEL% neq 0 (
    echo.
    echo Deployment failed. Please ensure you have the following permissions:
    echo 1. roles/run.admin on the project
    echo 2. roles/iam.serviceAccountUser on the service account %SERVICE_ACCOUNT%
    echo.
    echo To fix this issue, run these commands in the Google Cloud Console:
    echo.
    echo gcloud projects add-iam-policy-binding %PROJECT_ID% --member=user:[YOUR-EMAIL] --role=roles/run.admin
    echo gcloud iam service-accounts add-iam-policy-binding %SERVICE_ACCOUNT% --member=user:[YOUR-EMAIL] --role=roles/iam.serviceAccountUser
    echo.
    exit /b 1
)

echo Enabling all WebSocket related features...
gcloud run services update %IMAGE_NAME% ^
    --region=us-central1 ^
    --ingress=all ^
    --session-affinity ^
    --use-http2 ^
    --no-cpu-throttling

echo Deployment to Google Cloud Run successful!

echo ========================================================================
echo WebSocket Service Configuration Complete
echo ------------------------------------------------------------------------
echo Your WebSocket service is now configured properly for Cloud Run.
echo Important configuration applied:
echo - Session affinity for consistent connections
echo - HTTP/2 enabled for better WebSocket support
echo - Increased timeout to 3600s (1 hour) for long-lived connections
echo - Disabled CPU throttling for better WebSocket performance
echo - Ingress set to "all" to allow direct connections
echo - Min instance set to 1 to prevent cold starts
echo ========================================================================
goto :eof

:cancel
echo Build and push cancelled. 