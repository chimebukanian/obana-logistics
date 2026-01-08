module.exports = (sequelize, DataTypes) => {
    const Shipment = sequelize.define("shipment", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        order_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            references: {
                model: 'orders',
                key: 'id'
            }
        },
        shipment_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'pending'
        },
        carrier_reference: {
            type: DataTypes.STRING,
            allowNull: true
        },
        rate_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        tracking_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        tracking_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        vendor_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cash_collected: {
            type: DataTypes.DOUBLE,
            defaultValue: 0.00
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    Shipment.associate = models => {
        Shipment.belongsTo(models.order, { foreignKey: 'order_id' });
    };

    return Shipment;
}
