"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Alter the country column to increase length from 2 to 100
    await queryInterface.changeColumn('addresses', 'country', {
      type: Sequelize.STRING(100),
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to STRING(2) if migration is rolled back
    await queryInterface.changeColumn('addresses', 'country', {
      type: Sequelize.STRING(2),
      allowNull: false
    });
  }
};
