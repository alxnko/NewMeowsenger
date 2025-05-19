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
set SPRING_PROFILES_ACTIVE=prod
for /F "tokens=1* delims==" %%A in (.env.deploy) do (
    if "%%A"=="BACKEND_URL" set BACKEND_URL=%%B
    if "%%A"=="CLOUD_SQL_INSTANCE" set CLOUD_SQL_INSTANCE=%%B
    if "%%A"=="SPRING_DATASOURCE_URL" set SPRING_DATASOURCE_URL=%%B
    if "%%A"=="SPRING_DATASOURCE_USERNAME" set SPRING_DATASOURCE_USERNAME=%%B
    if "%%A"=="SPRING_DATASOURCE_PASSWORD" set SPRING_DATASOURCE_PASSWORD=%%B
)

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

REM Create application-prod.properties file with correct settings
echo # Production configuration for Cloud Run>meowsenger\src\main\resources\application-prod.properties
echo spring.application.name=meowsenger>>meowsenger\src\main\resources\application-prod.properties
echo server.port=${PORT:8080}>>meowsenger\src\main\resources\application-prod.properties
echo server.address=0.0.0.0>>meowsenger\src\main\resources\application-prod.properties
echo.>>meowsenger\src\main\resources\application-prod.properties
echo # Backend service connection will be updated on deployment>>meowsenger\src\main\resources\application-prod.properties
echo backend.url=${BACKEND_URL:http://localhost:8000}>>meowsenger\src\main\resources\application-prod.properties
echo.>>meowsenger\src\main\resources\application-prod.properties
echo # WebSocket Configuration>>meowsenger\src\main\resources\application-prod.properties
echo spring.websocket.path=/ws>>meowsenger\src\main\resources\application-prod.properties
echo spring.websocket.allowed-origins=*>>meowsenger\src\main\resources\application-prod.properties
echo.>>meowsenger\src\main\resources\application-prod.properties
echo # CORS Configuration>>meowsenger\src\main\resources\application-prod.properties
echo spring.mvc.cors.allowed-origins=*>>meowsenger\src\main\resources\application-prod.properties
echo spring.mvc.cors.allowed-methods=GET,POST,PUT,DELETE,OPTIONS>>meowsenger\src\main\resources\application-prod.properties
echo spring.mvc.cors.allowed-headers=*>>meowsenger\src\main\resources\application-prod.properties
echo spring.mvc.cors.allow-credentials=true>>meowsenger\src\main\resources\application-prod.properties
echo.>>meowsenger\src\main\resources\application-prod.properties
echo # Cloud SQL instance connection name>>meowsenger\src\main\resources\application-prod.properties
echo cloud.sql.instance=${CLOUD_SQL_INSTANCE:me0wsenger:us-central1:meowgress}>>meowsenger\src\main\resources\application-prod.properties
echo.>>meowsenger\src\main\resources\application-prod.properties
echo # PostgreSQL Database Configuration>>meowsenger\src\main\resources\application-prod.properties
echo spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/meowgress}>>meowsenger\src\main\resources\application-prod.properties
echo spring.datasource.username=${SPRING_DATASOURCE_USERNAME:postgres}>>meowsenger\src\main\resources\application-prod.properties
echo spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:meowgress}>>meowsenger\src\main\resources\application-prod.properties
echo spring.datasource.driver-class-name=org.postgresql.Driver>>meowsenger\src\main\resources\application-prod.properties
echo.>>meowsenger\src\main\resources\application-prod.properties
echo # Actuator Configuration>>meowsenger\src\main\resources\application-prod.properties
echo management.endpoints.web.exposure.include=health,info,metrics>>meowsenger\src\main\resources\application-prod.properties
echo management.endpoint.health.show-details=always>>meowsenger\src\main\resources\application-prod.properties
echo management.endpoint.health.probes.enabled=true>>meowsenger\src\main\resources\application-prod.properties
echo management.health.livenessState.enabled=true>>meowsenger\src\main\resources\application-prod.properties
echo management.health.readinessState.enabled=true>>meowsenger\src\main\resources\application-prod.properties
echo.>>meowsenger\src\main\resources\application-prod.properties

REM Setup service account for Cloud SQL access
echo Setting up Cloud SQL access permissions...
for /f %%i in ('gcloud run services describe %IMAGE_NAME% --region=%REGION% --format="value(spec.template.spec.serviceAccountName)" 2^>NUL') do set SERVICE_ACCOUNT=%%i
if "%SERVICE_ACCOUNT%"=="" (
    set SERVICE_ACCOUNT=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com
    echo Using default service account: %SERVICE_ACCOUNT%
) else (
    echo Using existing service account: %SERVICE_ACCOUNT%
)

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

echo Creating deployment...
gcloud run deploy %IMAGE_NAME% ^
    --port=8080 ^
    --image=%GCR_IMAGE_NAME% ^
    --platform=managed ^
    --region=us-central1 ^
    --add-cloudsql-instances=%PROJECT_ID%:%REGION%:%SQL_INSTANCE_NAME% ^
    --service-account=%SERVICE_ACCOUNT% ^
    --set-env-vars=SPRING_PROFILES_ACTIVE=prod ^
    --set-env-vars=BACKEND_URL=%BACKEND_URL% ^
    --set-env-vars=CLOUD_SQL_INSTANCE=%CLOUD_SQL_INSTANCE% ^
    --set-env-vars=SPRING_DATASOURCE_URL="%SPRING_DATASOURCE_URL%" ^
    --set-env-vars=SPRING_DATASOURCE_USERNAME=%SPRING_DATASOURCE_USERNAME% ^
    --set-env-vars=SPRING_DATASOURCE_PASSWORD=%SPRING_DATASOURCE_PASSWORD% ^
    --allow-unauthenticated ^
    --cpu=1 ^
    --memory=768Mi ^
    --min-instances=0 ^
    --max-instances=2 ^
    --timeout=300s ^
    --execution-environment=gen2
if %ERRORLEVEL% neq 0 (
    echo Deployment to Google Cloud Run failed. Exiting.
    exit /b 1
)

echo Deployment to Google Cloud Run successful!
goto :eof

:cancel
echo Build and push cancelled. 