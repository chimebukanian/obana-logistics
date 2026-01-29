module.exports = (sequelize, DataTypes) => {
    const Shipment = sequelize.define("shippings", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        
        shipment_reference: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            comment: 'OBANA-20250108-ABC123 or EXT-20250108-XYZ789'
        },
        
        order_reference: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'Platform order ID that groups multiple vendor shipments'
        },
        
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        
        
        vendor_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        
        carrier_type: {
            type: DataTypes.ENUM('internal', 'external'),
            allowNull: false,
            defaultValue: 'internal'
        },
        // If external carrier
        carrier_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'Obana Logistics, FedEx, DHL, UPS, etc.'
        },
        carrier_slug: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'obana, fedex, dhl, ups'
        },
        
        transport_mode: {
            type: DataTypes.ENUM('road', 'air', 'sea'),
            defaultValue: 'road',
            allowNull: false,
            comment: 'Transportation method for the shipment'
        },
        
        service_level: {
            type: DataTypes.ENUM('Express', 'Standard', 'Economy'),
            defaultValue: 'Standard',
            allowNull: false,
            comment: 'Service level/speed tier'
        },
        
        external_carrier_reference: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'CA-71017347351 (from Terminal Africa)'
        },
        
        external_rate_id: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        
        delivery_address_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        
        pickup_address_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        // Financial details for THIS shipment
        product_value: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        shipping_fee: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'NGN'
        },
        
        total_weight: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        total_items: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        
        status: {
            type: DataTypes.ENUM(
                'pending',           // Created but not processed
                'in_transit',        // On the way to hub/customer
                'delivered',         // Successfully delivered
                'failed',            // Delivery failed
                'cancelled',         // Shipment cancelled
                'returned'           // Returned to vendor
            ),
            defaultValue: 'pending'
        },
        // // Timestamps for tracking
        // pickup_scheduled_at: {
        //     type: DataTypes.DATE,
        //     allowNull: true
        // },
        // actual_pickup_at: {
        //     type: DataTypes.DATE,
        //     allowNull: true
        // },
        // estimated_delivery_at: {
        //     type: DataTypes.DATE,
        //     allowNull: true
        // },
        actual_delivery_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Insurance
        is_insured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        insurance_amount: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0.00
        },
        // Driver assignment (for internal logistics)
        driver_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Original payload, carrier response, etc.'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updatedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    return Shipment;
};