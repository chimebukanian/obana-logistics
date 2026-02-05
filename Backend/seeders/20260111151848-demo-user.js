// seeders/0001-seed-users.js
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if users already exist before seeding
    const existingUsers = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as count FROM users WHERE id IN (12, 13, 14, 15)`
    );
    
    if (existingUsers[0][0].count === 0) {
      // First, seed the users
      await queryInterface.bulkInsert('users', [
        {
          id: 12,
          email: 'chimebukaanyanwu@gmail.com',
          phone: '2348069331070',
          password: '$2a$10$qXgkEtKntBF4yy/cCIV5zu/aaxtbtWKqYwJsVYR3qyKvJI12D0uAG',
          createdAt: '2025-09-23 13:19:24',
          updatedAt: '2025-09-23 13:19:24'
        },
        {
          id: 13,
          email: 'obana.africa@gmail.com',
          phone: '2348090335245',
          password: '$2a$10$m6PINlhvvRQ5sFDWxSHJmOTHDupSPm7Sb4e5CcREsN8iB4SwlkgTW',
          createdAt: '2025-11-11 16:15:51',
          updatedAt: '2025-11-11 16:15:51'
        },
        {
          id: 14,
          email: 'stanislasanyanwu@gmail.com',
          phone: '2348024168379',
          password: '$2a$10$1d9WWNjGIr/DhWu9Ty3/meqPeD/sKS5gnR5uYWLw69nvMytEPKd1C',
          createdAt: '2025-11-13 15:06:36',
          updatedAt: '2025-11-13 15:06:36'
        },
        {
          id: 15,
          email: 'chimebukanyanwu@gmail.com',
          phone: '2348069331033',
          password: '$2a$10$u15RoGkc8LQpoMD4tqlwX.y.3X.deycejdQt4xwbFxuqB7zulbBb.',
          createdAt: '2025-11-16 13:23:14',
          updatedAt: '2025-11-16 13:23:14'
        }
      ], {});
    }

    // You can also add default attributes if needed
    const existingAttrs = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as count FROM attributes WHERE slug IN ('role', 'first_name', 'last_name')`
    );
    
    if (existingAttrs[0][0].count === 0) {
      await queryInterface.bulkInsert('attributes', [
        {
          name: 'Role',
          slug: 'role',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'First Name',
          slug: 'first_name',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Last Name',
          slug: 'last_name',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ], {});
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove seeded data
    await queryInterface.bulkDelete('user_attributes', null, {});
    await queryInterface.bulkDelete('attributes', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};