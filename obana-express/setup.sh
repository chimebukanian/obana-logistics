#!/bin/bash
# 🚀 Obana Frontend - Quick Start Script

echo "🎉 Welcome to Obana Frontend Setup!"
echo "=================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node --version) found"
echo ""

# Navigate to frontend
cd "$(dirname "$0")"
echo "📁 Working directory: $(pwd)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo ""

# Create .env.local if not exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local..."
    cat > .env.local << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3006
EOF
    echo "✅ .env.local created"
    echo "⚠️  Make sure backend is running on port 3006"
else
    echo "✅ .env.local already exists"
fi
echo ""

# Summary
echo "🎯 Setup Complete!"
echo "=================================="
echo ""
echo "📚 Documentation:"
echo "   • QUICK_REFERENCE.md - Quick lookup"
echo "   • IMPLEMENTATION_GUIDE.md - Full guide"
echo "   • TESTING_GUIDE.md - Testing procedures"
echo "   • COMPLETE_SUMMARY.md - What's built"
echo ""
echo "🚀 To start development server:"
echo "   npm run dev"
echo ""
echo "📱 Open in browser:"
echo "   http://localhost:3000"
echo ""
echo "✅ Backend should be running on:"
echo "   http://localhost:3006"
echo ""
echo "🧪 Test with:"
echo "   Email: customer@obana.com"
echo "   Password: customer123"
echo ""
echo "=================================="
echo "Happy coding! 💻"
