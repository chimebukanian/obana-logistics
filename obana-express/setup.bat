@echo off
REM 🚀 Obana Frontend - Quick Start Script (Windows)

cls
echo.
echo 🎉 Welcome to Obana Frontend Setup!
echo ===================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo ✅ Node.js %NODE_VER% found
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
if %errorlevel% equ 0 (
    echo ✅ Dependencies installed
) else (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo.

REM Create .env.local if not exists
if not exist ".env.local" (
    echo 📝 Creating .env.local...
    (
        echo # API Configuration
        echo NEXT_PUBLIC_API_URL=http://localhost:3006
    ) > .env.local
    echo ✅ .env.local created
    echo ⚠️  Make sure backend is running on port 3006
) else (
    echo ✅ .env.local already exists
)
echo.

REM Summary
echo 🎯 Setup Complete!
echo ===================================
echo.
echo 📚 Documentation:
echo    • QUICK_REFERENCE.md - Quick lookup
echo    • IMPLEMENTATION_GUIDE.md - Full guide
echo    • TESTING_GUIDE.md - Testing procedures
echo    • COMPLETE_SUMMARY.md - What's built
echo.
echo 🚀 To start development server:
echo    npm run dev
echo.
echo 📱 Open in browser:
echo    http://localhost:3000
echo.
echo ✅ Backend should be running on:
echo    http://localhost:3006
echo.
echo 🧪 Test with:
echo    Email: customer@obana.com
echo    Password: customer123
echo.
echo ===================================
echo Happy coding! 💻
echo.

pause
