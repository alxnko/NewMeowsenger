# Deploying Meowsenger to Google Cloud Run

This document describes how to deploy Meowsenger services to Google Cloud Run using the provided deployment scripts.

## Prerequisites

Before deployment, make sure you have:

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
2. [Docker](https://www.docker.com/get-started/) installed and running
3. Created a Google Cloud project (in this case, `me0wsenger`)
4. Authenticated with Google Cloud CLI: `gcloud auth login`
5. Enabled billing for your project

## Database Setup

The application requires a PostgreSQL database. We've provided a script to create the cheapest possible PostgreSQL instance in Google Cloud SQL:

### Creating the Database

1. Run the `setup-database.bat` script: `.\setup-database.bat`
2. Confirm or update the GCP project ID
3. Enter the GCP region for the database (e.g., `us-central1`)
4. Review the database configuration and confirm
5. Wait for the database to be created (usually takes 5-10 minutes)

The script creates:

- A `db-f1-micro` instance (smallest available)
- 10GB of HDD storage (cheapest option)
- A single zone deployment (no high availability)
- No automated backups
- Estimated cost: ~$7-10/month

### Database Configuration

The setup script will:

1. Save all connection details to `database-config.txt`
2. Display connection information on completion
3. Configure the deployment scripts to use this database

**Note**: Keep the `database-config.txt` file secure as it contains database credentials!

## Environment Variables

The deployment scripts will automatically configure environment variables for each service using the database connection information:

### Frontend Environment Variables

- `NEXT_PUBLIC_API_URL`: URL of your deployed backend service
- `NEXT_PUBLIC_WS_URL`: URL of your deployed websocket service

### Backend Environment Variables

- `DB_HOST`: Your database host IP
- `DB_NAME`: Your database name (meowsenger)
- `DB_USER`: Your database username (postgres)
- `DB_PASSWORD`: Your database password
- `DEBUG`: Set to `False` in production
- `SECRET_KEY`: Automatically generated secure key
- `DATABASE_URL`: Full PostgreSQL connection string

### Websocket Environment Variables

- `SPRING_PROFILES_ACTIVE`: Set to `prod` for production
- `SERVER_PORT`: Port the service will run on (8080 is Cloud Run default)
- `SPRING_DATASOURCE_URL`: JDBC connection string for PostgreSQL
- `SPRING_DATASOURCE_USERNAME`: Database username
- `SPRING_DATASOURCE_PASSWORD`: Database password
- `BACKEND_API_URL`: URL of the backend service

## Deployment Process

1. Run the `setup-database.bat` script first to create your database
2. Run the `deploy.bat` script: `.\deploy.bat` (or `deploy.ps1` if using PowerShell)
3. Confirm or update the GCP project ID
4. Enter the GCP region for deployment (e.g., `us-central1`)
5. Select which services to deploy:
   - `1` for frontend
   - `2` for backend
   - `3` for websocket
   - `4` for all services
6. The script will:
   - Build Docker images for each selected service
   - Push the images to Google Container Registry
   - Deploy the services to Cloud Run with database configuration
   - Output the URLs for accessing each service

## Service Dependencies

The deployment scripts will automatically handle service dependencies:

- Frontend will be configured with backend and websocket service URLs
- Backend will be configured with database connection details
- Websocket service will be configured with backend URL and database connection details

## Troubleshooting

If you encounter issues:

1. Check Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=meowsenger-SERVICE"`
2. Verify your environment variables are correctly set
3. Check that required APIs are enabled: `gcloud services list`
4. Ensure your Docker images built correctly: `docker images`
5. Test database connectivity: `gcloud sql connect meowsenger --user=postgres`

### Common Database Issues

- **Connection timeout**: Check that the Cloud SQL instance has authorized connections from Cloud Run
- **Authentication failure**: Verify the username and password in `database-config.txt`
- **Database not found**: Make sure the database `meowsenger` exists in your Cloud SQL instance

## Cost Management

To control costs:

- The database uses the smallest possible configuration (db-f1-micro, ~$7-10/month)
- Cloud Run charges based on actual usage (requests, CPU, memory)
- Set memory limits appropriately in the deployment
- Configure concurrency based on your expected load
- Set minimum instances to 0 when not in use
