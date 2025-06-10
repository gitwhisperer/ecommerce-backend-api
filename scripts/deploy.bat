@echo off
REM E-commerce API Deployment Script for Windows
REM This script helps deploy the API to various environments

setlocal enabledelayedexpansion

if "%1"=="" (
    echo [ERROR] Please specify environment: development, staging, or production
    exit /b 1
)

set ENVIRONMENT=%1

echo [INFO] Starting deployment for %ENVIRONMENT% environment...

REM Create logs directory
if not exist "logs" mkdir logs

REM Install dependencies
echo [INFO] Installing dependencies...
call npm ci

if !errorlevel! neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)

REM Run tests
echo [INFO] Running tests...
call npm run test:ci

if !errorlevel! neq 0 (
    echo [ERROR] Tests failed! Deployment aborted.
    exit /b 1
)

REM Generate documentation
echo [INFO] Generating documentation...
call npm run docs

REM Environment-specific configurations
if "%ENVIRONMENT%"=="development" (
    echo [INFO] Setting up development environment...
    copy .env.example .env
    echo [WARNING] Please update .env file with your development configuration
) else if "%ENVIRONMENT%"=="staging" (
    echo [INFO] Setting up staging environment...
    echo [WARNING] Ensure staging environment variables are set
) else if "%ENVIRONMENT%"=="production" (
    echo [INFO] Setting up production environment...
    echo [WARNING] Ensure production environment variables are set
    echo [WARNING] Make sure to use production MongoDB and Redis instances
) else (
    echo [ERROR] Invalid environment: %ENVIRONMENT%
    exit /b 1
)

REM Build Docker images if requested
if "%2"=="--docker" (
    echo [INFO] Building Docker images...
    docker-compose build
    
    if !errorlevel! equ 0 (
        echo [INFO] Docker images built successfully
    ) else (
        echo [ERROR] Docker build failed
        exit /b 1
    )
)

echo [INFO] Deployment completed successfully!
echo [INFO] Environment: %ENVIRONMENT%
echo [INFO] Documentation available at: docs/api-docs.html

if "%ENVIRONMENT%"=="development" (
    echo [INFO] To start the development server:
    echo [INFO] npm run dev
    echo.
    echo [INFO] API will be available at: http://localhost:5000
    echo [INFO] Health check: http://localhost:5000/api/health
    echo [INFO] API info: http://localhost:5000/api/info
)

pause
