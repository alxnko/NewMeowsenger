@echo off
setlocal enabledelayedexpansion

echo =================================================
echo Meowsenger Deployment to Google Cloud Run
echo =================================================
echo.

REM Set project ID
set MEOWSENGER_PROJECT_ID=me0wsenger

REM Ask to confirm project ID
echo Current GCP project is set to: %MEOWSENGER_PROJECT_ID%
set /p CONFIRM_PROJECT=Is this correct? (Y/N): 
if /i "%CONFIRM_PROJECT%" neq "Y" (
    set /p MEOWSENGER_PROJECT_ID=Enter your GCP project ID: 
)

REM Switch to the correct project
echo Switching to project: %MEOWSENGER_PROJECT_ID%
call gcloud config set project %MEOWSENGER_PROJECT_ID%
if %ERRORLEVEL% neq 0 (
    echo Failed to set GCP project.
    exit /b 1
)

REM Check if the user is logged in
echo Checking gcloud authentication...
call gcloud auth print-identity-token >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo You need to authenticate with Google Cloud first.
    echo Running 'gcloud auth login'...
    call gcloud auth login
    if %ERRORLEVEL% neq 0 (
        echo Authentication failed.
        exit /b 1
    )
)

REM Enable required APIs if not already enabled
echo Enabling required Cloud Run APIs...
call gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com
if %ERRORLEVEL% neq 0 (
    echo Failed to enable required APIs.
    exit /b 1
)

REM Set default region to us-central1
echo Setting deployment region to us-central1...
set REGION=us-central1
call gcloud config set run/region %REGION%

REM Set database configuration for user's existing instance
set DB_EXISTS=true
set DB_IP=34.122.240.72
set DB_USERNAME=postgres
set DB_PASSWORD=meowgress
set DB_NAME=meowsenger
set DB_INSTANCE_NAME=meowgress
set DB_CONNECTION_NAME=me0wsenger:us-central1:meowgress

echo.
echo Using existing PostgreSQL instance:
echo - Host: %DB_IP%
echo - Connection name: %DB_CONNECTION_NAME%
echo - Database: %DB_NAME%
echo - Username: %DB_USERNAME%
echo.

REM Define available services
set SERVICES=frontend backend websocket

echo.
echo Available services:
echo 1. frontend - Next.js web application
echo 2. backend - Django backend API
echo 3. websocket - Spring Boot messaging service
echo 4. all - Deploy all services
echo.

REM Ask which services to deploy
set /p DEPLOY_CHOICE=Which services do you want to deploy? (Enter numbers separated by spaces, or '4' for all): 

set SELECTED_SERVICES=
if "%DEPLOY_CHOICE%"=="4" (
    REM If all services are selected, ensure backend is first in the deployment order
    set SELECTED_SERVICES=backend frontend websocket
) else (
    for %%a in (%DEPLOY_CHOICE%) do (
        if "%%a"=="1" set SELECTED_SERVICES=!SELECTED_SERVICES! frontend
        if "%%a"=="2" set SELECTED_SERVICES=!SELECTED_SERVICES! backend
        if "%%a"=="3" set SELECTED_SERVICES=!SELECTED_SERVICES! websocket
    )
)

echo.
echo You've selected to deploy: %SELECTED_SERVICES%
echo.
set /p CONFIRM=Do you want to continue? (Y/N): 
if /i "%CONFIRM%" neq "Y" (
    echo Deployment cancelled.
    exit /b 0
)

REM Configure Docker to use gcloud as credential helper
echo Configuring Docker to use gcloud credentials...
call gcloud auth configure-docker gcr.io
if %ERRORLEVEL% neq 0 (
    echo Failed to configure Docker.
    exit /b 1
)

REM Use a simple numeric timestamp that's safe for Docker tags
set TIMESTAMP=%RANDOM%%RANDOM%

REM Build all Docker images first
echo.
echo =================================================
echo Building Docker images for all selected services...
echo =================================================

REM Build frontend image if selected
echo "Selected services: %SELECTED_SERVICES%"
echo "%SELECTED_SERVICES%" | findstr /i /c:"frontend" >nul
if not errorlevel 1 (
    echo Building frontend Docker image...
    cd frontend\meowsenger-frontend
    call docker build -t gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-frontend:%TIMESTAMP% .
    cd ..\..
)

REM Build backend image if selected
echo "%SELECTED_SERVICES%" | findstr /i /c:"backend" >nul
if not errorlevel 1 (
    echo Building backend Docker image...
    
    REM Create a temporary directory for customizing Django settings
    mkdir backend\\temp 2>nul
    
    REM Create a custom CORS settings file
    echo import os > backend\\temp\\cors_settings.py
    echo. >> backend\\temp\\cors_settings.py
    echo # CORS configuration >> backend\\temp\\cors_settings.py
    echo CORS_ALLOW_ALL_ORIGINS = True >> backend\\temp\\cors_settings.py
    echo. >> backend\\temp\\cors_settings.py
    echo # This will be populated at runtime from environment variable >> backend\\temp\\cors_settings.py
    echo CORS_ALLOWED_ORIGINS_STR = os.getenv('CORS_ALLOWED_ORIGINS', '') >> backend\\temp\\cors_settings.py
    echo CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS_STR.split(',') if CORS_ALLOWED_ORIGINS_STR else [] >> backend\\temp\\cors_settings.py
    echo. >> backend\\temp\\cors_settings.py
    echo CORS_ALLOW_CREDENTIALS = True >> backend\\temp\\cors_settings.py
    echo. >> backend\\temp\\cors_settings.py
    echo # For handling credentials with specific origins >> backend\\temp\\cors_settings.py
    echo if not CORS_ALLOW_ALL_ORIGINS and CORS_ALLOWED_ORIGINS: >> backend\\temp\\cors_settings.py
    echo     CORS_ORIGIN_WHITELIST = CORS_ALLOWED_ORIGINS >> backend\\temp\\cors_settings.py
    echo. >> backend\\temp\\cors_settings.py
    echo # Add for backward compatibility >> backend\\temp\\cors_settings.py
    echo CORS_ORIGIN_ALLOW_ALL = CORS_ALLOW_ALL_ORIGINS >> backend\\temp\\cors_settings.py
    echo. >> backend\\temp\\cors_settings.py
    echo # Set trusted origins for CSRF >> backend\\temp\\cors_settings.py
    echo CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS >> backend\\temp\\cors_settings.py
    
    REM Copy custom settings to the Django project
    copy backend\\temp\\cors_settings.py backend\\meowsenger_backend\\cors_settings.py /Y
    
    REM Build the Docker image
    cd backend
    call docker build -t gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-backend:%TIMESTAMP% .
    cd ..
    
    REM Clean up temporary files
    rmdir /S /Q backend\\temp
)

REM Build websocket image if selected
echo "%SELECTED_SERVICES%" | findstr /i /c:"websocket" >nul
if not errorlevel 1 (
    echo Building websocket Docker image...
    
    REM Create a temporary directory for the websocket build
    mkdir messaging\\temp 2>nul
    
    REM Create a custom application.properties with proper URLs and CORS settings
    echo # Production configuration for Cloud Run > messaging\\temp\\application-prod.properties
    echo spring.application.name=meowsenger >> messaging\\temp\\application-prod.properties
    echo server.port=${PORT} >> messaging\\temp\\application-prod.properties
    echo server.address=0.0.0.0 >> messaging\\temp\\application-prod.properties
    echo. >> messaging\\temp\\application-prod.properties
    echo # Backend service connection will be updated on deployment >> messaging\\temp\\application-prod.properties
    echo backend.url=${BACKEND_API_URL:http://localhost:8000} >> messaging\\temp\\application-prod.properties
    echo. >> messaging\\temp\\application-prod.properties
    echo # WebSocket Configuration >> messaging\\temp\\application-prod.properties
    echo spring.websocket.path=/ws >> messaging\\temp\\application-prod.properties
    echo spring.websocket.allowed-origins=* >> messaging\\temp\\application-prod.properties
    echo. >> messaging\\temp\\application-prod.properties
    echo # CORS Configuration >> messaging\\temp\\application-prod.properties
    echo # This is set to allow all origins by default >> messaging\\temp\\application-prod.properties
    echo # In production, will be restricted by environment variables >> messaging\\temp\\application-prod.properties
    echo spring.mvc.cors.allowed-origins=${CORS_ALLOWED_ORIGINS:*} >> messaging\\temp\\application-prod.properties
    echo spring.mvc.cors.allowed-methods=GET,POST,PUT,DELETE,OPTIONS >> messaging\\temp\\application-prod.properties
    echo spring.mvc.cors.allowed-headers=*  >> messaging\\temp\\application-prod.properties
    echo spring.mvc.cors.allow-credentials=true >> messaging\\temp\\application-prod.properties
    echo. >> messaging\\temp\\application-prod.properties
    echo # PostgreSQL Database Configuration >> messaging\\temp\\application-prod.properties
    echo spring.datasource.url=jdbc:postgresql://%DB_IP%:5432/%DB_NAME% >> messaging\\temp\\application-prod.properties
    echo spring.datasource.username=%DB_USERNAME% >> messaging\\temp\\application-prod.properties
    echo spring.datasource.password=%DB_PASSWORD% >> messaging\\temp\\application-prod.properties
    echo spring.datasource.driver-class-name=org.postgresql.Driver >> messaging\\temp\\application-prod.properties
    echo. >> messaging\\temp\\application-prod.properties
    echo # JPA / Hibernate >> messaging\\temp\\application-prod.properties
    echo spring.jpa.hibernate.ddl-auto=validate >> messaging\\temp\\application-prod.properties
    echo spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect >> messaging\\temp\\application-prod.properties
    echo spring.jpa.show-sql=false >> messaging\\temp\\application-prod.properties
    echo. >> messaging\\temp\\application-prod.properties
    echo # Table naming strategy - Match Django's naming conventions >> messaging\\temp\\application-prod.properties
    echo spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl >> messaging\\temp\\application-prod.properties
    echo spring.jpa.properties.hibernate.globally_quoted_identifiers=true >> messaging\\temp\\application-prod.properties
    echo. >> messaging\\temp\\application-prod.properties
    echo # Logging >> messaging\\temp\\application-prod.properties
    echo logging.level.root=INFO >> messaging\\temp\\application-prod.properties
    echo logging.level.meow.alxnko.meowsenger=INFO >> messaging\\temp\\application-prod.properties
    
    REM Copy the custom properties file into the messaging resources directory
    copy messaging\\temp\\application-prod.properties messaging\\meowsenger\\src\\main\\resources\\ /Y
    
    REM Build the Docker image
    cd messaging
    call docker build -t gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-websocket:%TIMESTAMP% .
    cd ..
    
    REM Clean up temporary files
    rmdir /S /Q messaging\\temp
)

REM Push all Docker images to GCR
echo.
echo =================================================
echo Pushing Docker images to Google Container Registry...
echo =================================================

REM Push frontend image if selected
echo "%SELECTED_SERVICES%" | findstr /i /c:"frontend" >nul
if not errorlevel 1 (
    echo Pushing frontend Docker image...
    call docker push gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-frontend:%TIMESTAMP%
)

REM Push backend image if selected
echo "%SELECTED_SERVICES%" | findstr /i /c:"backend" >nul
if not errorlevel 1 (
    echo Pushing backend Docker image...
    call docker push gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-backend:%TIMESTAMP%
)

REM Push websocket image if selected
echo "%SELECTED_SERVICES%" | findstr /i /c:"websocket" >nul
if not errorlevel 1 (
    echo Pushing websocket Docker image...
    call docker push gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-websocket:%TIMESTAMP%
)

REM Get deployed service URLs if they exist
set BACKEND_URL=
set WEBSOCKET_URL=
set FRONTEND_URL=

REM Deploy the services in the proper order
REM First, deploy the backend service if selected
echo "%SELECTED_SERVICES%" | findstr /i /c:"backend" >nul
if not errorlevel 1 (
    echo.
    echo =================================================
    echo Deploying backend service...
    echo =================================================
    
    set ENV_VARS=--set-env-vars=DB_HOST=%DB_IP%,DB_NAME=%DB_NAME%,DB_USER=%DB_USERNAME%,DB_PASSWORD=%DB_PASSWORD%,DEBUG=False,SECRET_KEY=meowsenger-prod-key-%RANDOM%%RANDOM%,DATABASE_URL=postgres://%DB_USERNAME%:%DB_PASSWORD%@%DB_IP%:5432/%DB_NAME%

    echo Deploying meowsenger-backend service...
    call gcloud run deploy meowsenger-backend ^
        --image gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-backend:%TIMESTAMP% ^
        --platform managed ^
        --region %REGION% ^
        --allow-unauthenticated ^
        --add-cloudsql-instances %DB_CONNECTION_NAME% ^
        --set-env-vars "DB_HOST=%DB_IP%" ^
        --set-env-vars "DB_NAME=%DB_NAME%" ^
        --set-env-vars "DB_USER=%DB_USERNAME%" ^
        --set-env-vars "DB_PASSWORD=%DB_PASSWORD%" ^
        --set-env-vars "DJANGO_SETTINGS_MODULE=meowsenger_backend.settings" ^
        --set-env-vars "PYTHONUNBUFFERED=1" ^
        --set-env-vars "CORS_ALLOWED_ORIGINS=*" ^
        --set-env-vars "CSRF_TRUSTED_ORIGINS=*" ^
        --quiet
    if %ERRORLEVEL% neq 0 (
        echo Failed to deploy meowsenger-backend.
        set BACKEND_DEPLOY_SUCCESS=false
    ) else (
        echo Successfully deployed meowsenger-backend.
        set BACKEND_DEPLOY_SUCCESS=true
        set BACKEND_URL=https://meowsenger-backend-%MEOWSENGER_PROJECT_ID_HASH%-uc.a.run.app
    )
)

REM Next, deploy the websocket service if selected
echo "%SELECTED_SERVICES%" | findstr /i /c:"websocket" >nul
if not errorlevel 1 (
    echo.
    echo =================================================
    echo Deploying websocket service...
    echo =================================================
    
    if "!BACKEND_URL!"=="" (
        set BACKEND_URL=https://meowsenger-backend-%MEOWSENGER_PROJECT_ID%.run.app
        echo Backend URL not found, using default: !BACKEND_URL!
    )
    
    REM Set websocket environment variables with database connection
    set ENV_VARS=--set-env-vars=SPRING_PROFILES_ACTIVE=prod,SERVER_PORT=8080,SPRING_DATASOURCE_URL=jdbc:postgresql://%DB_IP%:5432/%DB_NAME%,SPRING_DATASOURCE_USERNAME=%DB_USERNAME%,SPRING_DATASOURCE_PASSWORD=%DB_PASSWORD%
    
    REM Add backend URL to websocket service - this sets the environment variable that will be used in Spring's application properties
    set ENV_VARS=!ENV_VARS!,BACKEND_API_URL=!BACKEND_URL!
    
    REM Add CORS allowed origins (will include frontend and backend)
    set ENV_VARS=!ENV_VARS!,CORS_ALLOWED_ORIGINS=!BACKEND_URL!
    
    echo Deploying meowsenger-websocket service...
    call gcloud run deploy meowsenger-websocket ^
        --image gcr.io/%MEOWSENGER_PROJECT_ID%/meowsenger-websocket:%TIMESTAMP% ^
        --platform managed ^
        --region %REGION% ^
        --allow-unauthenticated ^
        --set-env-vars "BACKEND_API_URL=!BACKEND_URL!" ^
        --set-env-vars "CORS_ALLOWED_ORIGINS=*" ^
        --quiet
    if %ERRORLEVEL% neq 0 (
        echo Failed to deploy meowsenger-websocket.
        set WEBSOCKET_DEPLOY_SUCCESS=false
    ) else (
        echo Successfully deployed meowsenger-websocket.
        set WEBSOCKET_DEPLOY_SUCCESS=true
        set WEBSOCKET_URL=https://meowsenger-websocket-%MEOWSENGER_PROJECT_ID_HASH%-uc.a.run.app
    )
)

REM Update frontend environment variables if it was deployed and other services were deployed
echo "%SELECTED_SERVICES%" | findstr /i /c:"frontend" >nul
if not errorlevel 1 (
    if "!BACKEND_DEPLOY_SUCCESS!"=="true" or "!WEBSOCKET_DEPLOY_SUCCESS!"=="true" (
        echo Updating frontend service with new backend/websocket URLs...
        set FRONTEND_ENV_VARS=
        if "!BACKEND_DEPLOY_SUCCESS!"=="true" set FRONTEND_ENV_VARS=!FRONTEND_ENV_VARS!,"NEXT_PUBLIC_API_URL=!BACKEND_URL!"
        if "!WEBSOCKET_DEPLOY_SUCCESS!"=="true" set FRONTEND_ENV_VARS=!FRONTEND_ENV_VARS!,"NEXT_PUBLIC_WEBSOCKET_URL=!WEBSOCKET_URL!"
        
        REM Remove leading comma if present
        if "!FRONTEND_ENV_VARS:~0,1!"=="," set FRONTEND_ENV_VARS=!FRONTEND_ENV_VARS:~1!

        if defined FRONTEND_ENV_VARS (
            call gcloud run services update meowsenger-frontend ^
                --platform managed ^
                --region %REGION% ^
                --set-env-vars "!FRONTEND_ENV_VARS!" ^
                --quiet
            if %ERRORLEVEL% neq 0 (
                echo Failed to update frontend service environment variables.
            ) else (
                echo Successfully updated frontend service environment variables.
            )
        )
    )
)

REM Update backend CORS settings if backend was deployed
if "!BACKEND_DEPLOY_SUCCESS!"=="true" (
    echo Updating backend CORS settings to allow all origins...
    call gcloud run services update meowsenger-backend ^
        --platform managed ^
        --region %REGION% ^
        --set-env-vars "CORS_ALLOWED_ORIGINS=*" ^
        --set-env-vars "CSRF_TRUSTED_ORIGINS=*" ^
        --quiet
    if %ERRORLEVEL% neq 0 (
        echo Failed to update backend CORS settings.
    ) else (
        echo Successfully updated backend CORS settings to allow all.
    )
)

REM Update websocket CORS settings if websocket was deployed
if "!WEBSOCKET_DEPLOY_SUCCESS!"=="true" (
    echo Updating websocket CORS settings to allow all origins...
    call gcloud run services update meowsenger-websocket ^
        --platform managed ^
        --region %REGION% ^
        --set-env-vars "CORS_ALLOWED_ORIGINS=*" ^
        --quiet
    if %ERRORLEVEL% neq 0 (
        echo Failed to update websocket CORS settings.
    ) else (
        echo Successfully updated websocket CORS settings to allow all.
    )
)

echo.
echo =================================================
echo Deployment process completed!
echo =================================================

REM Fetch service URLs
echo Service URLs:
echo "%SELECTED_SERVICES%" | findstr /i /c:"backend" >nul
if not errorlevel 1 (
    echo backend: 
    call gcloud run services describe meowsenger-backend --format="value(status.url)"
)

echo "%SELECTED_SERVICES%" | findstr /i /c:"frontend" >nul
if not errorlevel 1 (
    echo frontend: 
    call gcloud run services describe meowsenger-frontend --format="value(status.url)"
)

echo "%SELECTED_SERVICES%" | findstr /i /c:"websocket" >nul
if not errorlevel 1 (
    echo websocket: 
    call gcloud run services describe meowsenger-websocket --format="value(status.url)"
)

echo.
echo Database connection details:
echo - Host: %DB_IP%
echo - Database: %DB_NAME%
echo - User: %DB_USERNAME%
echo - Connection name: %DB_CONNECTION_NAME%

echo.
echo CORS configuration:
if not "!BACKEND_URL!"=="" (
    echo Backend allows requests from: !CORS_ORIGINS!
)

if not "!WEBSOCKET_URL!"=="" (
    echo Websocket allows requests from: !CORS_ORIGINS!
)

endlocal