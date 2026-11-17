@echo off
title AKNU Hostel - Backend API (Port 5000)
color 0B
echo ========================================================
echo       AKNU HOSTELS - BACKEND API SERVER (PORT 5000)
echo ========================================================
echo.
echo Local API Endpoint: http://192.168.1.101:5000/api/v1
echo.
echo Starting Backend in Development mode...
echo Keep this window OPEN while using the web portal or mobile app.
echo ========================================================
echo.
cd /d "%~dp0backend"
call npm run dev
pause
