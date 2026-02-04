"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create addresses table
    await queryInterface.createTable("addresses", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      address_type: {
        type: Sequelize.ENUM('pickup', 'delivery'),
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      contact_email: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      line1: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      line2: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      zip_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      is_residential: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      instructions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,  // Changed from JSONB to JSON for MySQL
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Create drivers table
    await queryInterface.createTable("drivers", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      driver_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      vehicle_type: {
        type: Sequelize.ENUM('bike', 'car', 'van', 'truck'),
        defaultValue: 'bike'
      },
      vehicle_registration: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'on_leave', 'suspended'),
        defaultValue: 'active'
      },
      total_deliveries: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      successful_deliveries: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      metadata: {
        type: Sequelize.JSON,  // Changed from JSONB to JSON
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Create shippings table
    await queryInterface.createTable("shippings", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      shipment_reference: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      order_reference: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      user_id: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      vendor_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      carrier_type: {
        type: Sequelize.ENUM('internal', 'external'),
        allowNull: false,
        defaultValue: 'internal'
      },
      carrier_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      carrier_slug: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      external_carrier_reference: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      external_rate_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      delivery_address_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'addresses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      pickup_address_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'addresses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      product_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      shipping_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'NGN'
      },
      total_weight: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      total_items: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'in_transit',
          'delivered',
          'failed',
          'cancelled',
          'returned'
        ),
        defaultValue: 'pending'
      },
      actual_delivery_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_insured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      insurance_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      driver_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'drivers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      metadata: {
        type: Sequelize.JSON,  // Changed from JSONB to JSON
        allowNull: true,
        comment: 'Original payload, carrier response, etc.'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Create shipment_items table
    await queryInterface.createTable("shipment_items", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      shipment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'shippings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      item_id: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      unit_price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      total_price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      weight: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Weight in kg'
      },
      dimensions: {
        type: Sequelize.JSON,  // Changed from JSONB to JSON
        allowNull: true,
        comment: '{length, width, height} in cm'
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'NGN'
      },
      metadata: {
        type: Sequelize.JSON,  // Changed from JSONB to JSON
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Create shipment_tracking table
    await queryInterface.createTable("shipment_tracking", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      shipment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'shippings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM(
          'created',
          'in_transit',
          'delivered',
          'failed',
          'cancelled',
          'returned'
        ),
        allowNull: false
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      source: {
        type: Sequelize.ENUM('system', 'driver', 'admin', 'carrier_api', 'customer'),
        defaultValue: 'system'
      },
      performed_by: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,  // Changed from JSONB to JSON
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('addresses', ['address_type', 'country', 'city']);
    await queryInterface.addIndex('addresses', ['phone']);
    
    await queryInterface.addIndex('drivers', ['driver_code']);
    await queryInterface.addIndex('drivers', ['status']);
    await queryInterface.addIndex('drivers', ['user_id']);
    
    await queryInterface.addIndex('shippings', ['shipment_reference']);
    await queryInterface.addIndex('shippings', ['order_reference']);
    await queryInterface.addIndex('shippings', ['user_id']);
    await queryInterface.addIndex('shippings', ['carrier_type', 'status']);
    await queryInterface.addIndex('shippings', ['delivery_address_id']);
    await queryInterface.addIndex('shippings', ['pickup_address_id']);
    await queryInterface.addIndex('shippings', ['driver_id']);
    await queryInterface.addIndex('shippings', ['createdAt']);
    await queryInterface.addIndex('shippings', ['status', 'carrier_type']);
    
    await queryInterface.addIndex('shipment_items', ['shipment_id']);
    await queryInterface.addIndex('shipment_items', ['item_id']);
    
    await queryInterface.addIndex('shipment_tracking', ['shipment_id', 'createdAt']);
    await queryInterface.addIndex('shipment_tracking', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('shipment_tracking');
    await queryInterface.dropTable('shipment_items');
    await queryInterface.dropTable('shippings');
    await queryInterface.dropTable('drivers');
    await queryInterface.dropTable('addresses');
  }
};