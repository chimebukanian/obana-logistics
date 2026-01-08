module.exports = (sequelize, DataTypes) => {

    const Order = sequelize.define("order", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        tenant_id: {
            type: DataTypes.INTEGER(11),
            allowNull: true
        },
        user_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        agent_id: {
            type: DataTypes.INTEGER(11),
            allowNull: true
        },
        customer_id: {
            type: DataTypes.INTEGER(11),
            allowNull: true
        },
        order_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        amount: {
            type: DataTypes.DOUBLE,
            default: 0.00
        },

        order_details: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        shipment_details: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        shipment_id: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // to create shipment or not
        pickupmethod: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        commission: {
            type: DataTypes.DOUBLE,
            // allowNull: true,
            defaultValue: 0.00
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'pending'
        },
        shipment_status: {
            type: DataTypes.STRING,
            defaultValue: 'pending'
        },
        tracking_history: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        shipping_fee: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            defaultValue: 0.00
        },
        types: {
            type: DataTypes.ENUM(['order', 'qoute', 'sample']),
        },
        v_t_order: {
            type: DataTypes.INTEGER(11),
            defaultValue: 0
        },
        payments: {
            type: DataTypes.STRING,
            defaultValue: 'pending'
        },
        processor: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        order_ref: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        currency: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    },
        {
            indexes: [
                {
                    unique: true,
                    fields: ['order_id'],
                },
            ]
        }
    )

    return Order

}
