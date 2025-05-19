@echo off

REM Set project ID and service account variables
set PROJECT_ID=me0wsenger
set PROJECT_NUMBER=307953174855
set SERVICE_ACCOUNT=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com

REM Get the current user's email
for /f "tokens=*" %%i in ('gcloud auth list --filter=status:ACTIVE --format="value(account)"') do set USER_EMAIL=%%i

if "%USER_EMAIL%"=="" (
    echo Error: No active gcloud account found. Please run 'gcloud auth login' first.
    exit /b 1
)

echo You are currently authenticated as: %USER_EMAIL%
echo This script will grant necessary permissions for deploying the WebSocket service.
echo The following actions will be performed:

echo 1. Grant Cloud Run Admin role to your account
echo 2. Grant Service Account User role to your account for the Compute Engine service account
echo 3. Grant Cloud SQL Client role to the service account

set /p CONFIRM=Do you want to proceed? (y/n): 
if /i "%CONFIRM%" neq "y" goto :cancel

echo.
echo Granting Cloud Run Admin role...
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member=user:%USER_EMAIL% --role=roles/run.admin
if %ERRORLEVEL% neq 0 (
    echo Failed to grant Cloud Run Admin role.
    exit /b 1
)

echo.
echo Granting Service Account User role...
call gcloud iam service-accounts add-iam-policy-binding %SERVICE_ACCOUNT% --member=user:%USER_EMAIL% --role=roles/iam.serviceAccountUser
if %ERRORLEVEL% neq 0 (
    echo Failed to grant Service Account User role.
    exit /b 1
)

echo.
echo Granting Cloud SQL Client role to service account...
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member=serviceAccount:%SERVICE_ACCOUNT% --role=roles/cloudsql.client
if %ERRORLEVEL% neq 0 (
    echo Failed to grant Cloud SQL Client role.
    exit /b 1
)

echo.
echo ========================================================================
echo Permissions granted successfully!
echo ------------------------------------------------------------------------
echo You now have the necessary permissions to deploy the WebSocket service.
echo Please run 'deploy.bat' again to deploy the service.
echo ========================================================================
goto :eof

:cancel
echo Operation cancelled. 