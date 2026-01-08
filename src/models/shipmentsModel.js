module.exports = (sequelize, DataTypes) => {
    const Shipment = sequelize.define("shipment", {
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
            comment: 'Internal tracking number'
        },
        order_reference: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'Platform order ID'
        },
        customer_id: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        delivery_type: {
            type: DataTypes.ENUM('single', 'aggregated', 'per-vendor'),
            allowNull: false
        },
        is_multi_vendor: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        dispatch_type: {
            type: DataTypes.ENUM('delivery', 'pickup'),
            defaultValue: 'delivery'
        },
        pickup_method: {
            type: DataTypes.ENUM('delivery', 'pickup-station'),
            defaultValue: 'delivery'
        },
        total_amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        shipping_fee: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'NGN'
        },
        total_weight: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        total_items: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM(
                'pending',
                'pickup_scheduled',
                'in_transit',
                'out_for_delivery',
                'delivered',
                'failed',
                'cancelled',
                'returned'
            ),
            defaultValue: 'pending'
        },
        pickup_scheduled_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        actual_pickup_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        estimated_delivery_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        actual_delivery_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        is_insured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        insurance_amount: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0.00
        },
        carrier_type: {
            type: DataTypes.ENUM('internal', 'external'),
            defaultValue: 'internal'
        },
        external_carrier_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        external_carrier_reference: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        external_rate_id: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Original payload and additional data'
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