@echo off
echo Building frontend with Docker to test our fixes...
cd frontend/meowsenger-frontend
docker build -t meowsenger-frontend-test --build-arg NPM_CONFIG_LEGACY_PEER_DEPS=true .
echo If the build completed successfully, the frontend should be ready.
pause 