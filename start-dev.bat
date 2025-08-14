@echo off
echo Starting NPS Dashboard Development Environment...
echo.
echo Starting Server on port 5000...
start /b "NPS Server" cmd /c "cd packages/server && npm run dev"

echo Waiting for server to start...
timeout /t 3 /nobreak > nul

echo Starting Client on port 5173...
start /b "NPS Client" cmd /c "cd packages/client && npm run dev"

echo.
echo ✅ Both services are starting!
echo ✅ Server: http://localhost:5000
echo ✅ Client: http://localhost:5173
echo.
echo Press any key to stop all services...
pause > nul

echo Stopping services...
taskkill /f /im node.exe > nul 2>&1
echo Done!
