"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('route_templates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      origin_city: {
        type: Sequelize.STRING,
        allowNull: false
      },
      destination_city: {
        type: Sequelize.STRING,
        allowNull: false
      },
      transport_mode: {
        type: Sequelize.STRING,
        allowNull: false
      },
      service_level: {
        type: Sequelize.STRING,
        allowNull: false
      },
      weight_brackets: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('route_templates');
  }
};
