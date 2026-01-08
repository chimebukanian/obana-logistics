module.exports = (sequelize, DataTypes) => {

    const Order = sequelize.define("order_details", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },

        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        quantity: {
            type: DataTypes.INTEGER(11),
            allowNull: true
        },

        rate: {
            type: DataTypes.DOUBLE,
            defaultValue: 0.00
        },
        total_price: {
            type: DataTypes.DOUBLE,
            defaultValue: 0.00
        },
        item_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        imageurl: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        weight: {
            type: DataTypes.DOUBLE,
            allowNull: true
        },
        vendor: {
            type: DataTypes.STRING,
            allowNull: true
        },
        order_table_id: {
            type: DataTypes.INTEGER(11),
            allowNull: true,
                references: {
                    model: 'orders',
                    key: 'id'
                }
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE

    })

    return Order

}
