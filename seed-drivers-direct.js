const Sequelize = require('sequelize');
const path = require('path');

async function seedDrivers() {
  try {
    require('dotenv').config();
    
    // Create connection
    const sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT,
        logging: (msg) => console.log('📝', msg)
      }
    );
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully\n');
    
    // Insert drivers directly
    console.log('\n🌾 Seeding drivers...');
    
    await sequelize.query(`
      INSERT INTO drivers (driver_code, user_id, vehicle_type, vehicle_registration, status, total_deliveries, successful_deliveries, metadata, "createdAt", "updatedAt")
      VALUES 
        ('OBANA-DRV-001', 12, 'car', 'ABC-123-XYZ', 'active', 45, 43, '{"phone":"+2348069331070","email":"driver1@obana.africa","rating":4.8}', NOW(), NOW()),
        ('OBANA-DRV-002', 13, 'bike', 'XYZ-789-ABC', 'active', 128, 125, '{"phone":"+2348163957185","email":"driver2@obana.africa","rating":4.9}', NOW(), NOW())
      ON CONFLICT (driver_code) DO NOTHING;
    `);
    
    console.log('✅ Drivers seeded successfully!');
    
    // Verify
    const [drivers] = await sequelize.query('SELECT * FROM drivers');
    console.log('\n📋 Drivers in database:');
    console.table(drivers);
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedDrivers();
