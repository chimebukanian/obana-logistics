#!/usr/bin/env node

/**
 * Production-safe Database Seeding Script
 * Safely seeds drivers and other core data without duplicates
 * 
 * Usage:
 *  npm run seed          - Seeds only new data
 *  node scripts/seed-database.js
 */

require('dotenv').config();
const Sequelize = require('sequelize');

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    // Create database connection
    const sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT,
        logging: false // Set to true for debug logs
      }
    );

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Seed drivers
    await seedDrivers(sequelize);

    // Seed other data if needed
    await seedAdditionalData(sequelize);

    console.log('\n✅ Database seeding completed successfully!\n');
    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function seedDrivers(sequelize) {
  console.log('📦 Seeding drivers...');

  try {
    // Check if drivers already exist
    const [result] = await sequelize.query(
      `SELECT COUNT(*) as count FROM drivers WHERE driver_code IN ('OBANA-DRV-001', 'OBANA-DRV-002')`
    );

    const existingCount = result[0]?.count || 0;

    if (existingCount >= 2) {
      console.log(`   ℹ️  ${existingCount} drivers already exist, skipping driver seeding`);
      return;
    }

    // Delete existing drivers if any to avoid conflicts
    await sequelize.query(
      `DELETE FROM drivers WHERE driver_code IN ('OBANA-DRV-001', 'OBANA-DRV-002')`
    );

    // Check if users exist, create them if they don't
    const [userCheck] = await sequelize.query(
      `SELECT id FROM users WHERE id IN (12, 13) LIMIT 2`
    );

    const existingUserIds = userCheck.map(u => u.id);

    // Seed missing users if needed
    if (!existingUserIds.includes(12)) {
      console.log('   ℹ️  User 12 not found, creating...');
      await sequelize.query(
        `INSERT INTO users (id, email, phone, password, "createdAt", "updatedAt")
         VALUES (12, 'driver1@obana.africa', '+2348069331070', 
                 '$2a$10$qXgkEtKntBF4yy/cCIV5zu/aaxtbtWKqYwJsVYR3qyKvJI12D0uAG', 
                 NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`
      );
      console.log('   ✅ Created user 12');
    }

    if (!existingUserIds.includes(13)) {
      console.log('   ℹ️  User 13 not found, creating...');
      await sequelize.query(
        `INSERT INTO users (id, email, phone, password, "createdAt", "updatedAt")
         VALUES (13, 'driver2@obana.africa', '+2348163957185', 
                 '$2a$10$m6PINlhvvRQ5sFDWxSHJmOTHDupSPm7Sb4e5CcREsN8iB4SwlkgTW', 
                 NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`
      );
      console.log('   ✅ Created user 13');
    }

    // Insert drivers
    const driversData = [
      {
        driver_code: 'OBANA-DRV-001',
        user_id: 12,
        vehicle_type: 'car',
        vehicle_registration: 'ABC-123-XYZ',
        status: 'active',
        total_deliveries: 45,
        successful_deliveries: 43,
        metadata: JSON.stringify({
          phone: '+2348069331070',
          email: 'driver1@obana.africa',
          rating: 4.8,
          availability: 'available',
          region: 'Lagos'
        })
      },
      {
        driver_code: 'OBANA-DRV-002',
        user_id: 13,
        vehicle_type: 'bike',
        vehicle_registration: 'XYZ-789-ABC',
        status: 'active',
        total_deliveries: 128,
        successful_deliveries: 125,
        metadata: JSON.stringify({
          phone: '+2348163957185',
          email: 'driver2@obana.africa',
          rating: 4.9,
          availability: 'available',
          region: 'Lagos'
        })
      }
    ];

    for (const driver of driversData) {
      await sequelize.query(
        `INSERT INTO drivers (driver_code, user_id, vehicle_type, vehicle_registration, status, total_deliveries, successful_deliveries, metadata, "createdAt", "updatedAt")
         VALUES (:driver_code, :user_id, :vehicle_type, :vehicle_registration, :status, :total_deliveries, :successful_deliveries, :metadata, NOW(), NOW())`,
        {
          replacements: driver,
          type: Sequelize.QueryTypes.INSERT
        }
      );
      console.log(`   ✅ Seeded driver: ${driver.driver_code}`);
    }

    console.log(`\n   Summary: 2 drivers seeded successfully`);

  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`   ℹ️  Drivers already seeded, skipping`);
      return;
    }
    throw error;
  }
}

async function seedAdditionalData(sequelize) {
  console.log('\n📦 Checking additional seed data...');
  
  try {
    // Check if core attributes exist
    const [attrResult] = await sequelize.query(
      `SELECT COUNT(*) as count FROM attributes WHERE slug IN ('role', 'first_name', 'last_name')`
    );

    const attrCount = attrResult[0]?.count || 0;

    if (attrCount >= 3) {
      console.log(`   ℹ️  ${attrCount} attributes already exist, skipping`);
      return;
    }

    // Only insert missing attributes
    const existingAttrs = await sequelize.query(
      `SELECT slug FROM attributes WHERE slug IN ('role', 'first_name', 'last_name')`
    );

    const existingSlugs = existingAttrs[0].map(a => a.slug);

    const attributesData = [
      { name: 'Role', slug: 'role' },
      { name: 'First Name', slug: 'first_name' },
      { name: 'Last Name', slug: 'last_name' }
    ].filter(attr => !existingSlugs.includes(attr.slug));

    if (attributesData.length > 0) {
      for (const attr of attributesData) {
        await sequelize.query(
          `INSERT INTO attributes (name, slug, "createdAt", "updatedAt") 
           VALUES (:name, :slug, NOW(), NOW())`,
          {
            replacements: attr,
            type: Sequelize.QueryTypes.INSERT
          }
        );
        console.log(`   ✅ Seeded attribute: ${attr.slug}`);
      }
    }

  } catch (error) {
    console.warn(`   ⚠️  Could not seed additional attributes (this is optional):`, error.message);
  }
}

// Run the seeding
seedDatabase();
