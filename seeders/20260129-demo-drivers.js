'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if drivers already exist
    const existingDrivers = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as count FROM drivers WHERE driver_code IN ('OBANA-DRV-001', 'OBANA-DRV-002')`
    );
    
    if (existingDrivers[0][0].count === 0) {
      return queryInterface.bulkInsert('drivers', [
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
            rating: 4.8
          }),
          createdAt: new Date(),
          updatedAt: new Date()
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
            rating: 4.9
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    }
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('drivers', {
      driver_code: {
        [Sequelize.Op.in]: ['OBANA-DRV-001', 'OBANA-DRV-002']
      }
    });
  }
};
