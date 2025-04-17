REM Script to run both frontend and backend with network configuration

REM Run Django migrations and start the backend server in the same terminal
start cmd /k "cd backend && python manage.py makemigrations && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"

REM Add delay to ensure Django has time to initialize the database
echo Waiting for Django to initialize the database...
timeout /t 10 /nobreak

REM Start the messaging service after Django has initialized
start cmd /k "cd messaging/meowsenger && mvn spring-boot:run"

REM Start the frontend server with host parameter to bind to all interfaces
start cmd /k "cd frontend/meowsenger-frontend && npm run dev -- --host 0.0.0.0"

echo.
echo =======================================
echo Your services are running on IP: 26.84.60.85
echo =======================================
echo.
echo Access your application from other devices using:
echo    Frontend: http://26.84.60.85:3000
echo    Backend API: http://26.84.60.85:8000
echo    WebSocket: ws://26.84.60.85:8081/ws
