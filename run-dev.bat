@echo off
setlocal enabledelayedexpansion

if not exist .env (
    echo [INFO] Creating .env file from .env.example...
    copy .env.example .env
    echo [WARNING] Please open the .env file in your editor and update the DATABASE_URL connection string!
    echo [WARNING] Once updated, run this script again.
    pause
    exit /b
)

:: Read .env file line by line and set variables safely (ignoring comments and stripping carriage returns)
for /f "usebackq delims=" %%x in (".env") do (
    set "line=%%x"
    set "first_char=!line:~0,1!"
    if not "!first_char!"=="#" (
        for /f "tokens=1* delims==" %%a in ("!line!") do (
            set "key=%%a"
            set "val=%%b"
            for /f "delims=" %%c in ("!val!") do set "val=%%c"
            set "!key!=!val!"
        )
    )
)

if "!DATABASE_URL!"=="" (
    echo [ERROR] DATABASE_URL is not set in the .env file!
    pause
    exit /b
)

echo ==========================================================
echo   Red Fox Hotel HRMS - Local Development Launcher
echo ==========================================================
echo.
echo Connecting to database: !DATABASE_URL!
echo.

:: Install dependencies first in case they are missing
echo [1/4] Checking and installing dependencies...
call pnpm.cmd install
call pnpm.cmd approve-builds --all

:: Push the database schema to the database (creating tables)
echo [2/4] Pushing database schema (creating tables)...
call pnpm.cmd --filter @workspace/db run push

:: Seed the database with default users
echo [3/4] Seeding database with default accounts...
call pnpm.cmd --filter @workspace/api-server run seed

:: Start the API Server, HRMS frontend, and Employee Portal (incorporating Attendance Kiosk)
echo [4/4] Launching backend and frontends...
start "Red Fox API Server" cmd /k "set PORT=8080 && pnpm.cmd --filter @workspace/api-server run dev"
start "Red Fox HRMS Frontend" cmd /k "set PORT=18896 && set BASE_PATH=/ && pnpm.cmd --filter @workspace/hotel-hrms run dev"
start "Red Fox Employee Portal" cmd /k "set PORT=25852 && set BASE_PATH=/ && pnpm.cmd --filter @workspace/employee-portal run dev"

echo.
echo ==========================================================
echo   Launch Complete!
echo.
echo   * HRMS Frontend:      http://localhost:18896/
echo   * Employee Portal:    http://localhost:25852/ (incorporates Attendance Kiosk)
echo   * API Server:         http://localhost:8080/api
echo ==========================================================
echo.
pause
