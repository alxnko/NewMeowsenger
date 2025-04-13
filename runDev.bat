REM Script to run both frontend and backend

REM Run Django migrations and start the backend server in the same terminal
start cmd /k "cd backend && python manage.py makemigrations && python manage.py migrate && python manage.py runserver"

REM Add delay to ensure Django has time to initialize the database
echo Waiting for Django to initialize the database...
timeout /t 10 /nobreak

REM Start the messaging service after Django has initialized
start cmd /k "cd messaging/meowsenger && mvn spring-boot:run"

REM Start the frontend server
start cmd /k "cd frontend/meowsenger-frontend && npm run dev"