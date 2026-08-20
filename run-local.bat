@echo off
setlocal EnableDelayedExpansion
title CineStream Local Production Tester
color 0B
cls

:menu
cls
echo ===================================================
echo        CINESTREAM PRODUCTION & LOCAL TESTER         
echo ===================================================
echo.
echo [1] Production Build and Server (Matches Deployed Site 1:1)
echo [2] Development Server (Fast Hot-Reload)
echo [3] Exit
echo.
set /p opt="Select an option (1-3): "

if "%opt%"=="1" goto prod
if "%opt%"=="2" goto dev
if "%opt%"=="3" goto end
echo Invalid option, please choose 1, 2, or 3.
timeout /t 2 >nul
goto menu

:prod
cls
color 0E
echo ===================================================
echo [1/2] Building Next.js Production Bundle...
echo ===================================================
call npx.cmd next build
if errorlevel 1 goto build_err

cls
color 0A
echo ===================================================
echo [2/2] Starting Next.js Production Server...
echo ===================================================
echo Server is running at http://localhost:3000
echo (This is the exact production bundle as deployed)
echo.
echo Press Ctrl+C in this window to stop the server.
echo ===================================================
echo.
call npx.cmd next start -p 3000
goto end

:dev
cls
color 0B
echo ===================================================
echo Starting Local Development Server...
echo ===================================================
echo Server will be available at http://localhost:3000
echo Press Ctrl+C to stop the server.
echo.
call npx.cmd next dev -p 3000
goto end

:build_err
color 0C
echo.
echo ===================================================
echo ERROR: Production build failed!
echo Check the error messages above for details.
echo ===================================================
echo.
pause
goto menu

:end
echo.
echo Closing tester.
pause
