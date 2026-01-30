"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const templatesRaw = [
      {
        origin_city: 'Ikeja',
        destination_city: 'Ibadan',
        transport_mode: 'road',
        service_level: 'Standard',
        weight_brackets: [
          { min: 0, max: 1, price: 800, eta: '1-2 days' },
          { min: 1.01, max: 5, price: 1200, eta: '1-2 days' },
          { min: 5.01, max: 20, price: 2500, eta: '2-3 days' }
        ],
        metadata: { provider: 'obana' }
      },
      {
        origin_city: 'Lagos',
        destination_city: 'Abuja',
        transport_mode: 'air',
        service_level: 'Express',
        weight_brackets: [
          { min: 0, max: 1, price: 2500, eta: 'Same day' },
          { min: 1.01, max: 5, price: 4000, eta: '1 day' }
        ],
        metadata: { provider: 'obana' }
      },
      {
        origin_city: 'Lagos',
        destination_city: 'London',
        transport_mode: 'air',
        service_level: 'International Express',
        weight_brackets: [
          { min: 0, max: 1, price: 20000, eta: '2-3 days' },
          { min: 1.01, max: 5, price: 50000, eta: '3-5 days' }
        ],
        metadata: { provider: 'intl-courier', notes: 'International sample' }
      }
    ];

    const templates = templatesRaw.map(t => ({
      origin_city: t.origin_city,
      destination_city: t.destination_city,
      transport_mode: t.transport_mode,
      service_level: t.service_level,
      weight_brackets: JSON.stringify(t.weight_brackets),
      metadata: JSON.stringify(t.metadata),
      created_at: new Date(),
      updated_at: new Date()
    }));

    await queryInterface.bulkInsert('route_templates', templates, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('route_templates', null, {});
  }
};
