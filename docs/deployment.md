# Meowsenger Deployment Guide

This document outlines how to deploy the Meowsenger application to Google Cloud Run. The application consists of three main services:

1. **Frontend** - Next.js web application
2. **Backend** - Django REST API
3. **Messaging** - Spring Boot WebSocket service

## Prerequisites

Before deploying, ensure you have:

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and configured
2. Access to the `me0wsenger` Google Cloud project
3. Docker installed on your machine
4. Each service has an `.env.deploy` file with appropriate environment variables

## Deployment Scripts

We provide several batch scripts to simplify the deployment process:

- `deploy.bat` - Main deployment script that allows deploying all services or individual services
- `frontend/deploy.bat` - Script to deploy only the frontend service
- `backend/deploy.bat` - Script to deploy only the backend service
- `messaging/deploy.bat` - Script to deploy only the messaging service

## Using the Main Deployment Script

The main deployment script provides a menu-driven interface:

1. Open a command prompt in the project root directory
2. Run `deploy.bat`
3. Choose an option from the menu:
   - Option 1: Deploy Frontend service
   - Option 2: Deploy Backend service
   - Option 3: Deploy Messaging service
   - Option 4: Deploy All services
   - Option 5: Exit

## Deploying Individual Services

You can also deploy each service individually:

1. Navigate to the service directory (`frontend`, `backend`, or `messaging`)
2. Run `deploy.bat` from that directory

Each deployment script will:

1. Copy `.env.deploy` to `.env` for the build process
2. Build a Docker image optimized for Google Cloud Run
3. Push the image to Google Container Registry
4. Deploy the service to Google Cloud Run

## Environment Variables

Each service should have an `.env.deploy` file with the necessary configuration for deployment. Make sure to update these files with appropriate values before deploying.

## Deployment URLs

After deployment, your services will be available at:

- Frontend: https://meowsenger-frontend-[random]-uc.a.run.app
- Backend: https://meowsenger-backend-[random]-uc.a.run.app
- Messaging: https://meowsenger-messaging-[random]-uc.a.run.app

You can find the exact URLs in the Google Cloud Console or in the output of the deployment scripts.

## Troubleshooting

If you encounter issues during deployment:

1. Check the logs in the Google Cloud Console
2. Ensure all required environment variables are set correctly
3. Verify that Docker is running properly
4. Make sure you have the necessary permissions in the `me0wsenger` Google Cloud project
