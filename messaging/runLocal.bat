@echo off
echo Starting Meowsenger locally...

REM Set the active profile to local
set SPRING_PROFILES_ACTIVE=local

REM Run the application
cd meowsenger
mvn spring-boot:run

echo Application stopped. 