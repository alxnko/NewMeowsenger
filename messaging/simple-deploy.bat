@echo off

cd %~dp0

REM Set image name and Google Container Registry (GCR) image name
set IMAGE_NAME=meowsenger-websocket
set GCR_IMAGE_NAME=gcr.io/me0wsenger/%IMAGE_NAME%
set PROJECT_ID=me0wsenger
set REGION=us-central1

REM Basic environment variables
set CLOUD_SQL_INSTANCE=me0wsenger:us-central1:meowgress
set BACKEND_URL=https://meowsenger-backend-307953174855.us-central1.run.app
set JDBC_URL=jdbc:postgresql:///meowgress?socketFactory=com.google.cloud.sql.postgres.SocketFactory^&cloudSqlInstance=me0wsenger:us-central1:meowgress

REM Ask for confirmation
set /p CONFIRM=Do you want to deploy the websocket service? (y/n): 
if /i "%CONFIRM%" neq "y" goto :cancel

echo Cleaning Docker system...
docker system prune -f

echo Building Docker image...
docker buildx build --platform linux/amd64 -t %GCR_IMAGE_NAME% --no-cache .

echo Pushing the Docker image...
docker push %GCR_IMAGE_NAME%

echo Creating deployment with minimal configuration...
gcloud run deploy %IMAGE_NAME% ^
  --project %PROJECT_ID% ^
  --image %GCR_IMAGE_NAME% ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --max-instances=2 ^
  --min-instances=0 ^
  --timeout=300s ^
  --execution-environment=gen2 ^
  --port=8080 ^
  --set-env-vars="SPRING_PROFILES_ACTIVE=prod,LOG_LEVEL=DEBUG,SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING=true" ^
  --set-env-vars="BACKEND_URL=%BACKEND_URL%" ^
  --set-env-vars="CLOUD_SQL_INSTANCE=%CLOUD_SQL_INSTANCE%" ^
  --set-env-vars="SPRING_DATASOURCE_URL=%JDBC_URL%" ^
  --set-env-vars="SPRING_DATASOURCE_USERNAME=postgres" ^
  --set-env-vars="SPRING_DATASOURCE_PASSWORD=meowgress" ^
  --add-cloudsql-instances=%PROJECT_ID%:%REGION%:meowgress

goto :end

:cancel
echo Deployment cancelled.

:end 