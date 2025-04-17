@echo off
echo Setting up network for cross-device development...

REM Get the local IP address - improved to get the actual network adapter IP
SET LOCAL_IP=127.0.0.1
echo Detecting network IP address...

REM Use a more reliable way to get the IP address
FOR /F "tokens=4 delims= " %%i IN ('route print ^| find "0.0.0.0" ^| find "0.0.0.0" ^| find /v "127.0.0.1"') DO (
    SET LOCAL_IP=%%i
    goto :IP_FOUND
)

:IP_FOUND
echo Your local network IP is: %LOCAL_IP%
echo.

REM Create .env.local file for frontend with proper URLs
echo Creating frontend environment configuration...
(
echo # Dynamic environment configuration for development
echo NEXT_PUBLIC_API_URL=http://%LOCAL_IP%:8000
echo NEXT_PUBLIC_WS_URL=http://%LOCAL_IP%:8081/ws
) > frontend\meowsenger-frontend\.env.local

echo Frontend configuration updated successfully.
echo.

REM Update Django settings to include all needed hosts
echo Updating Django settings...
(
echo # Add the following to your settings.py file
echo # This is appended by the network setup script
echo.
echo ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '%LOCAL_IP%', '*']
) > backend\meowsenger_backend\local_hosts.py

echo Django settings updated successfully.
echo.

REM Update Spring Boot application properties
echo Updating messaging service configuration...
(
echo # Local development configuration
echo spring.application.name=meowsenger
echo server.port=8081
echo server.address=0.0.0.0
echo.
echo # Backend service connection (local)
echo backend.url=http://%LOCAL_IP%:8000
echo.
echo # WebSocket Configuration
echo spring.websocket.path=/ws
echo spring.websocket.allowed-origins=*
echo.
echo # PostgreSQL Database Configuration
echo spring.datasource.url=jdbc:postgresql://localhost:5432/meowsenger
echo spring.datasource.username=postgres
echo spring.datasource.password=admin
echo spring.datasource.driver-class-name=org.postgresql.Driver
echo.
echo # JPA / Hibernate - Changed to validate to work with Django's schema
echo spring.jpa.hibernate.ddl-auto=validate
echo spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
echo spring.jpa.show-sql=true
echo.
echo # Table naming strategy - Match Django's naming conventions
echo spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
echo spring.jpa.properties.hibernate.globally_quoted_identifiers=true
echo.
echo # Disable foreign key checks during initialization
echo spring.jpa.properties.hibernate.hbm2ddl.schema_ignore_references=true
echo # Defer datasource initialization 
echo spring.jpa.defer-datasource-initialization=false
echo spring.sql.init.mode=never
echo.
echo # Logging
echo logging.level.root=INFO
echo logging.level.meow.alxnko.meowsenger=DEBUG
echo logging.level.org.hibernate.SQL=DEBUG
echo logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE
) > messaging\meowsenger\src\main\resources\application.properties

echo Messaging service configuration updated successfully.
echo.

echo Creating a network-ready development launcher...
(
echo @echo off
echo REM Script to run both frontend and backend with network configuration
echo.
echo REM Display network information
echo echo =======================================
echo echo Your services will run on IP: %LOCAL_IP%
echo echo =======================================
echo echo.
echo.
echo REM Run Django migrations and start the backend server in the same terminal
echo start cmd /k "cd backend && python manage.py makemigrations && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"
echo.
echo REM Add delay to ensure Django has time to initialize the database
echo echo Waiting for Django to initialize the database...
echo timeout /t 10 /nobreak
echo.
echo REM Start the messaging service after Django has initialized
echo start cmd /k "cd messaging/meowsenger && mvn spring-boot:run"
echo.
echo REM Start the frontend server - without host parameter which doesn't work with turbopack
echo start cmd /k "cd frontend/meowsenger-frontend && npm run dev"
echo.
echo echo.
echo echo =======================================
echo echo Access your application from other devices using:
echo echo    Frontend: http://%LOCAL_IP%:3000
echo echo    Backend API: http://%LOCAL_IP%:8000
echo echo    WebSocket: ws://%LOCAL_IP%:8081/ws
echo echo =======================================
) > runDevNetwork.bat

echo Network-ready development launcher created successfully.
echo.
echo =====================================================
echo Setup complete! To run your application with network support:
echo    1. Run the command: runDevNetwork.bat
echo    2. Access from other devices using http://%LOCAL_IP%:3000
echo =====================================================