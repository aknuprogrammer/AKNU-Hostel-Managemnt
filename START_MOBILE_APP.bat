@echo off
title AKNU Mobile App - Expo Server
color 0A
echo ========================================================
echo       AKNU HOSTELS - MOBILE EXPO DEVELOPMENT SERVER
echo ========================================================
echo.
echo Current Computer IP: 192.168.1.101
echo.
echo IMPORTANT REQUIREMENTS FOR YOUR PHONE:
echo 1. Connect your phone to the SAME Wi-Fi network as this PC.
echo 2. Do NOT use Mobile Data (4G/5G) on your phone.
echo 3. Keep this window OPEN while testing the mobile app.
echo.
echo Starting Expo Metro Bundler (clearing cache)...
echo ========================================================
echo.
cd /d "%~dp0mobile"
call npx expo start -c
pause
