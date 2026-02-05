module.exports = (sequelize, DataTypes) => {
    const ShipmentItem = sequelize.define("shipment_item", {
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
        item_id: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        unit_price: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        total_price: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        weight: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Weight in kg'
        },
    dimensions: {
            type: DataTypes.JSON,  
            allowNull: true,
            comment: '{length, width, height} in cm'
        },
        metadata: {
            type: DataTypes.JSON,  
            allowNull: true
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'NGN'
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

    return ShipmentItem;
};