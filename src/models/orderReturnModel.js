const { INTEGER } = require("sequelize")

module.exports = (sequelize, DataTypes) => {

    const OrderReturns = sequelize.define("order_returns", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        salesreturn_id: DataTypes.STRING(),
        receive_id: DataTypes.STRING(),
        refunded_amount: DataTypes.DOUBLE,
        user_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        name: DataTypes.STRING(),
        email: DataTypes.STRING(),

        phone: DataTypes.STRING(),
        product_name: DataTypes.TEXT,
        sku: DataTypes.STRING(),
        order_ref: DataTypes.STRING(),
        order_id: DataTypes.STRING(),
        product_id: DataTypes.STRING(),
        qty: DataTypes.INTEGER(4),
        vendor_name: DataTypes.STRING(),
        vendor_email: DataTypes.STRING(),
        image: DataTypes.TEXT,
        reason: DataTypes.TEXT,
        status: { type: DataTypes.ENUM(['pending', 'approved', 'rejected', 'received', 'refunded']), defaultValue: 'pending' },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return OrderReturns

}