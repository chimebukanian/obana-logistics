module.exports = (sequelize, DataTypes) => {
    const ShipmentVendorGroup = sequelize.define("shipment_vendor_group", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        vendor_id: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        shipment_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        vendor_shipment_reference: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Separate tracking for vendor leg if needed'
        },
        status: {
            type: DataTypes.ENUM(
                'pending',
                'pickup_scheduled',
                'collected',
                'in_transit_to_hub',
                'at_hub',
                'in_transit_to_customer',
                'delivered',
                'failed'
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
        received_at_hub_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        shipping_fee: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        weight: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        item_count: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        carrier_type: {
            type: DataTypes.ENUM('internal', 'external'),
            defaultValue: 'internal'
        },
        external_carrier_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        external_rate_id: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
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

    return ShipmentVendorGroup;
};