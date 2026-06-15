@echo off
title CineStream Local Tester
color 0B
cls
echo ===================================================
echo               CINESTREAM LOCAL TESTER              
echo ===================================================
echo.
echo This script will build and run CineStream locally.
echo.
echo [1] Build and Run Production Server (Recommended)
echo [2] Run Development Server (Fast reload)
echo [3] Exit
echo.
set /p opt="Select an option (1-3): "

if "%opt%"=="1" goto prod
if "%opt%"=="2" goto dev
if "%opt%"=="3" goto end
echo Invalid option, exiting.
goto end

:prod
echo.
echo [1/2] Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERROR: Build failed. Please check the logs above.
    pause
    exit /b %errorlevel%
)
echo.
echo [2/2] Starting local production server...
echo Server will be available at http://localhost:3000
echo Press Ctrl+C to stop the server.
echo.
call npm run start
goto end

:dev
echo.
echo Starting local development server...
echo Server will be available at http://localhost:3000 (or http://localhost:3001)
echo Press Ctrl+C to stop the server.
echo.
call npm run dev
goto end

:end
pause
