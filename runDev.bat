REM Script to run both frontend and backend

REM Run Django migrations and start the backend server in the same terminal
start cmd /k "cd backend && python manage.py makemigrations && python manage.py migrate && python manage.py runserver"

REM Start the frontend server
start cmd /k "cd frontend/meowsenger-frontend && npm run dev"