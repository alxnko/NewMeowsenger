# Meowsenger Deployment Script for Google Cloud Run

Write-Host "=================================================" -ForegroundColor Green
Write-Host "Meowsenger Deployment to Google Cloud Run" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""

# Set project ID
$MeowsengerProjectId = "me0wsenger"

# Ask to confirm project ID
Write-Host "Current GCP project is set to: $MeowsengerProjectId"
$ConfirmProject = Read-Host "Is this correct? (Y/N)"
if ($ConfirmProject -ne "Y") {
    $MeowsengerProjectId = Read-Host "Enter your GCP project ID"
}

# Switch to the correct project
Write-Host "Switching to project: $MeowsengerProjectId"
$projectSetResult = gcloud config set project $MeowsengerProjectId
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set GCP project." -ForegroundColor Red
    exit 1
}

# Check if the user is logged in
Write-Host "Checking gcloud authentication..."
$authCheck = gcloud auth print-identity-token 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "You need to authenticate with Google Cloud first." -ForegroundColor Yellow
    Write-Host "Running 'gcloud auth login'..." -ForegroundColor Yellow
    gcloud auth login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Authentication failed." -ForegroundColor Red
        exit 1
    }
}

# Enable required APIs if not already enabled
Write-Host "Enabling required Cloud Run APIs..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to enable required APIs." -ForegroundColor Red
    exit 1
}

# Set default region if not already set
$Region = Read-Host "Enter GCP region for deployment (e.g., us-central1)"
gcloud config set run/region $Region

# Set database configuration for user's existing instance
$DbExists = $true
$DbIp = "34.122.240.72"
$DbUsername = "postgres"
$DbPassword = "meowgress"
$DbName = "meowsenger"
$DbInstanceName = "meowgress"
$DbConnectionName = "me0wsenger:us-central1:meowgress"

Write-Host ""
Write-Host "Using existing PostgreSQL instance:" -ForegroundColor Cyan
Write-Host "- Host: $DbIp" -ForegroundColor Cyan
Write-Host "- Connection name: $DbConnectionName" -ForegroundColor Cyan
Write-Host "- Database: $DbName" -ForegroundColor Cyan
Write-Host "- Username: $DbUsername" -ForegroundColor Cyan
Write-Host ""

# Define available services
$Services = @("frontend", "backend", "websocket")

Write-Host ""
Write-Host "Available services:" -ForegroundColor Cyan
Write-Host "1. frontend - Next.js web application"
Write-Host "2. backend - Django backend API"
Write-Host "3. websocket - Spring Boot messaging service"
Write-Host "4. all - Deploy all services"
Write-Host ""

# Ask which services to deploy
$DeployChoice = Read-Host "Which services do you want to deploy? (Enter numbers separated by spaces, or '4' for all)"

$SelectedServices = @()
if ($DeployChoice -eq "4") {
    # If all services are selected, ensure backend is first in the deployment order
    $SelectedServices = @("backend", "frontend", "websocket")
} else {
    $choices = $DeployChoice -split " "
    foreach ($choice in $choices) {
        if ($choice -eq "1") { $SelectedServices += "frontend" }
        if ($choice -eq "2") { $SelectedServices += "backend" }
        if ($choice -eq "3") { $SelectedServices += "websocket" }
    }
}

Write-Host ""
Write-Host "You've selected to deploy: $($SelectedServices -join ', ')" -ForegroundColor Cyan
Write-Host ""
$Confirm = Read-Host "Do you want to continue? (Y/N)"
if ($Confirm -ne "Y") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# Configure Docker to use gcloud as credential helper
Write-Host "Configuring Docker to use gcloud credentials..." -ForegroundColor Cyan
gcloud auth configure-docker gcr.io
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to configure Docker." -ForegroundColor Red
    exit 1
}

$Timestamp = Get-Date -Format "yyyyMMddHHmm"

# Build all Docker images first
Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "Building Docker images for all selected services..." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

$currentLocation = Get-Location

# Build each selected service's Docker image
foreach ($service in $SelectedServices) {
    Write-Host "Building Docker image for $service..." -ForegroundColor Cyan
    
    if ($service -eq "frontend") {
        Set-Location -Path "./frontend"
        docker build -t "gcr.io/$MeowsengerProjectId/meowsenger-$service`:$Timestamp" .
    }
    
    if ($service -eq "backend") {
        Set-Location -Path "./backend"
        docker build -t "gcr.io/$MeowsengerProjectId/meowsenger-$service`:$Timestamp" .
    }
    
    if ($service -eq "websocket") {
        # Create a temporary directory for the websocket build
        New-Item -ItemType Directory -Path "messaging\temp" -Force | Out-Null
        
        # Create a custom application.properties with proper URLs
        $appPropsContent = @"
# Production configuration for Cloud Run
spring.application.name=meowsenger
server.port=8080
server.address=0.0.0.0

# Backend service connection will be updated on deployment
backend.url=\${BACKEND_API_URL:http://localhost:8000}

# WebSocket Configuration
spring.websocket.path=/ws
spring.websocket.allowed-origins=*

# PostgreSQL Database Configuration
spring.datasource.url=jdbc:postgresql://$DbIp:5432/$DbName
spring.datasource.username=$DbUsername
spring.datasource.password=$DbPassword
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA / Hibernate
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.show-sql=false

# Table naming strategy - Match Django's naming conventions
spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
spring.jpa.properties.hibernate.globally_quoted_identifiers=true

# Logging
logging.level.root=INFO
logging.level.meow.alxnko.meowsenger=INFO
"@
        
        # Write the content to the properties file
        $appPropsContent | Set-Content -Path "messaging\temp\application-prod.properties" -Encoding UTF8
        
        # Copy the custom properties file into the messaging resources directory
        Copy-Item -Path "messaging\temp\application-prod.properties" -Destination "messaging\meowsenger\src\main\resources\" -Force
        
        # Build the Docker image
        Set-Location -Path "./messaging"
        docker build -t "gcr.io/$MeowsengerProjectId/meowsenger-$service`:$Timestamp" .
        
        # Clean up temporary files
        Remove-Item -Path "..\messaging\temp" -Recurse -Force
    }
    
    Set-Location -Path $currentLocation
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to build Docker image for $service." -ForegroundColor Red
        Write-Host "Continuing with other services..." -ForegroundColor Yellow
        continue
    }
}

# Push all Docker images to GCR
Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "Pushing Docker images to Google Container Registry..." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Push each selected service's Docker image
foreach ($service in $SelectedServices) {
    Write-Host "Pushing Docker image for $service..." -ForegroundColor Cyan
    docker push "gcr.io/$MeowsengerProjectId/meowsenger-$service`:$Timestamp"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to push Docker image for $service." -ForegroundColor Red
        Write-Host "Continuing with other services..." -ForegroundColor Yellow
    }
}

# Initialize variables for service URLs
$BackendUrl = ""
$WebsocketUrl = ""

# Deploy services in the proper order (backend first)
# The SelectedServices array already has the proper order

foreach ($service in $SelectedServices) {
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host "Deploying $service service..." -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Green
    
    # Set environment variables based on service
    $EnvVars = ""
    
    if ($service -eq "backend") {
        # Set backend environment variables with database connection
        $SecretKey = "meowsenger-prod-key-" + (Get-Random) + (Get-Random)
        $EnvVars = "--set-env-vars=DB_HOST=$DbIp,DB_NAME=$DbName,DB_USER=$DbUsername,DB_PASSWORD=$DbPassword,DEBUG=False,SECRET_KEY=$SecretKey,DATABASE_URL=postgres://$DbUsername`:$DbPassword@$DbIp`:5432/$DbName"
        
        $deployCmd = "gcloud run deploy meowsenger-$service --image gcr.io/$MeowsengerProjectId/meowsenger-$service`:$Timestamp --platform managed --allow-unauthenticated $EnvVars"
        Invoke-Expression $deployCmd
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to deploy backend service." -ForegroundColor Red
            Write-Host "WARNING: Continuing with other services, but they may not function correctly." -ForegroundColor Yellow
        } else {
            Write-Host "Backend deployment completed successfully!" -ForegroundColor Green
            
            # Get the backend URL for other services to use
            $BackendUrl = gcloud run services describe meowsenger-backend --format="value(status.url)" 2>$null
            Write-Host "Backend URL: $BackendUrl" -ForegroundColor Cyan
        }
    }
    elseif ($service -eq "websocket") {
        # Set websocket environment variables with database connection
        $EnvVars = "--set-env-vars=SPRING_PROFILES_ACTIVE=prod,SERVER_PORT=8080,SPRING_DATASOURCE_URL=jdbc:postgresql://$DbIp`:5432/$DbName,SPRING_DATASOURCE_USERNAME=$DbUsername,SPRING_DATASOURCE_PASSWORD=$DbPassword"
        
        if ([string]::IsNullOrEmpty($BackendUrl)) {
            $BackendUrl = "https://meowsenger-backend-$MeowsengerProjectId.run.app"
            Write-Host "Backend URL not found, using default: $BackendUrl" -ForegroundColor Yellow
        }
        
        # Add backend URL to websocket service - this sets the environment variable that will be used in Spring's application properties
        $EnvVars = "$EnvVars,BACKEND_API_URL=$BackendUrl"
        
        $deployCmd = "gcloud run deploy meowsenger-$service --image gcr.io/$MeowsengerProjectId/meowsenger-$service`:$Timestamp --platform managed --allow-unauthenticated $EnvVars"
        Invoke-Expression $deployCmd
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to deploy websocket service." -ForegroundColor Red
            Write-Host "Continuing with frontend deployment..." -ForegroundColor Yellow
        } else {
            Write-Host "Websocket deployment completed successfully!" -ForegroundColor Green
            
            # Get the websocket URL for the frontend to use
            $WebsocketUrl = gcloud run services describe meowsenger-websocket --format="value(status.url)" 2>$null
            Write-Host "Websocket URL: $WebsocketUrl" -ForegroundColor Cyan
        }
    }
    elseif ($service -eq "frontend") {
        # Set frontend environment variables
        if ([string]::IsNullOrEmpty($BackendUrl)) {
            $BackendUrl = "https://meowsenger-backend-$MeowsengerProjectId.run.app"
            Write-Host "Backend URL not found, using default: $BackendUrl" -ForegroundColor Yellow
        }
        
        if ([string]::IsNullOrEmpty($WebsocketUrl)) {
            $WebsocketUrl = "https://meowsenger-websocket-$MeowsengerProjectId.run.app"
            Write-Host "Websocket URL not found, using default: $WebsocketUrl" -ForegroundColor Yellow
        }
        
        $EnvVars = "--set-env-vars=NEXT_PUBLIC_API_URL=$BackendUrl,NEXT_PUBLIC_WS_URL=$WebsocketUrl/ws"
        
        $deployCmd = "gcloud run deploy meowsenger-$service --image gcr.io/$MeowsengerProjectId/meowsenger-$service`:$Timestamp --platform managed --allow-unauthenticated $EnvVars"
        Invoke-Expression $deployCmd
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to deploy frontend service." -ForegroundColor Red
        } else {
            Write-Host "Frontend deployment completed successfully!" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "Deployment process completed!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Fetch service URLs
Write-Host "Service URLs:" -ForegroundColor Cyan

foreach ($service in $SelectedServices) {
    Write-Host "$service`: " -ForegroundColor Cyan
    gcloud run services describe "meowsenger-$service" --format="value(status.url)"
}

Write-Host ""
Write-Host "Database connection details:" -ForegroundColor Cyan
Write-Host "- Host: $DbIp" -ForegroundColor Cyan
Write-Host "- Database: $DbName" -ForegroundColor Cyan
Write-Host "- User: $DbUsername" -ForegroundColor Cyan
Write-Host "- Connection name: $DbConnectionName" -ForegroundColor Cyan 