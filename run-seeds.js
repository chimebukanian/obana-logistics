#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('🌱 Running database migrations and seeds...\n');
  
  // Run migrations
  console.log('📦 Running migrations...');
  execSync('npx sequelize-cli db:migrate', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ Migrations completed!\n');
  
  // Run seeds
  console.log('🌾 Running seeders...');
  execSync('npx sequelize-cli db:seed:all', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ Seeding completed!\n');
  console.log('🎉 Database setup complete!');
  
} catch (error) {
  console.error('❌ Error during migrations/seeding:', error.message);
  process.exit(1);
}
