module.exports = (sequelize, DataTypes) => {
    const ShipmentItem = sequelize.define("shipment_item", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
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
        price: {
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
        weight_unit: {
            type: DataTypes.STRING(10),
            defaultValue: 'kg'
        },
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'NGN'
        },
        dimensions: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: '{length, width, height} in cm'
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

    return ShipmentItem;
};