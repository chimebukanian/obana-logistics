'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if roles table exists and has data
    try {
      const roles = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM roles WHERE role IN ('admin', 'driver', 'customer')`
      );
      
      if (roles[0][0].count === 0) {
        // Insert default roles
        await queryInterface.bulkInsert('roles', [
          {
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            role: 'driver',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            role: 'customer',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ], {});
      }
    } catch (error) {
      console.log('Roles table may not exist yet, skipping role seeding');
    }

    // Check if attributes exist
    try {
      const attrs = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM attributes WHERE slug IN ('role_id', 'driver_id')`
      );
      
      if (attrs[0][0].count === 0) {
        // Insert default attributes
        await queryInterface.bulkInsert('attributes', [
          {
            name: 'Role ID',
            slug: 'role_id',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: 'Driver ID',
            slug: 'driver_id',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ], {});
      }
    } catch (error) {
      console.log('Attributes table may not exist yet, skipping attribute seeding');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove seeded data
    try {
      await queryInterface.bulkDelete('attributes', { slug: ['role_id', 'driver_id'] });
      await queryInterface.bulkDelete('roles', { role: ['admin', 'driver', 'customer'] });
    } catch (error) {
      console.log('Error rolling back roles/attributes');
    }
  }
};
