@echo off
title AKNU Hostels - Launch All Servers
color 0E
echo ========================================================
echo       AKNU HOSTELS - LAUNCHING DEVELOPMENT SERVERS
echo ========================================================
echo.
echo Launching Backend API (Port 5000)...
start "AKNU Backend API Server" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Launching Mobile App Expo Bundler (Port 8081)...
start "AKNU Mobile Expo Server" cmd /k "cd /d "%~dp0mobile" && npx expo start -c"

echo Launching Web Portal Frontend (Port 5173)...
start "AKNU Web Portal Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo All servers have been launched in separate CMD windows!
echo.
echo 1. Keep the open CMD windows running.
echo 2. Make sure your phone is connected to the SAME Wi-Fi network.
echo 3. In Expo Go on your phone, tap "Scan QR code" and scan
echo    the QR code shown in the "AKNU Mobile Expo Server" window!
echo ========================================================
echo.
pause
