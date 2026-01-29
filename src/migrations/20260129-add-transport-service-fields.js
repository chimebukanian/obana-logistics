'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add transport_mode ENUM type
      await queryInterface.sequelize.query(
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_shippings_transport_mode') THEN
            CREATE TYPE public.enum_shippings_transport_mode AS ENUM('road', 'air', 'sea');
          END IF;
        END $$;`,
        { transaction }
      );

      // Add service_level ENUM type
      await queryInterface.sequelize.query(
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_shippings_service_level') THEN
            CREATE TYPE public.enum_shippings_service_level AS ENUM('Express', 'Standard', 'Economy');
          END IF;
        END $$;`,
        { transaction }
      );

      // Add columns to shippings table
      await queryInterface.addColumn(
        'shippings',
        'transport_mode',
        {
          type: Sequelize.ENUM('road', 'air', 'sea'),
          defaultValue: 'road',
          allowNull: false,
          comment: 'Transportation method for the shipment'
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'shippings',
        'service_level',
        {
          type: Sequelize.ENUM('Express', 'Standard', 'Economy'),
          defaultValue: 'Standard',
          allowNull: false,
          comment: 'Service level/speed tier'
        },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove columns
      await queryInterface.removeColumn('shippings', 'transport_mode', { transaction });
      await queryInterface.removeColumn('shippings', 'service_level', { transaction });

      // Drop ENUM types
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS public.enum_shippings_transport_mode CASCADE;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS public.enum_shippings_service_level CASCADE;`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
