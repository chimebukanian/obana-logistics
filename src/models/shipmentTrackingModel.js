module.exports = (sequelize, DataTypes) => {
    const ShipmentTracking = sequelize.define("shipment_tracking", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        shipment_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        vendor_group_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'For multi-vendor tracking per leg'
        },
        status: {
            type: DataTypes.ENUM(
                'pickup_scheduled',
                'driver_assigned',
                'en_route_pickup',
                'arrived_pickup',
                'package_collected',
                'in_transit',
                'arrived_hub',
                'departed_hub',
                'out_for_delivery',
                'delivery_attempted',
                'delivered',
                'failed',
                'exception',
                'returned'
            ),
            allowNull: false
        },
        location: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        performed_by: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'Driver ID, system, or admin'
        },
        metadata: {
            type: DataTypes.JSONB,
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

    return ShipmentTracking;
};