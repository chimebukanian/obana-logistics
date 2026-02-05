// shipmentTrackingModel.js
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
        status: {
            type: DataTypes.ENUM(
                'created',              // Shipment created
                'in_transit',           // Package in transit
                'delivered',            // Successfully delivered
                'failed',               // Delivery failed
                'cancelled',            // Shipment cancelled
                'returned'              // Returned to vendor
            ),
            allowNull: false
        },
        location: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Human-readable status description'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Internal notes'
        },
        // Who triggered this status (system, driver, admin, carrier API)
        source: {
            type: DataTypes.ENUM('system', 'driver', 'admin', 'carrier_api', 'customer'),
            defaultValue: 'system'
        },
        performed_by: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'Driver ID, admin username, etc.'
        },
        metadata: {
            type: DataTypes.JSON,
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
    }, {
        tableName: 'shipment_trackings'
    });

    return ShipmentTracking;
};