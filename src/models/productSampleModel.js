const { INTEGER } = require("sequelize")

module.exports = (sequelize, DataTypes) => {

    const Sample = sequelize.define("product_samples", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
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
        qty: {
            type: INTEGER(4),
            defaultValue: 1
        },
        vendor_name: DataTypes.STRING(),
        vendor_email: DataTypes.STRING(),
        product_image: DataTypes.TEXT,
        status: { type: DataTypes.ENUM(['request', 'supplied', 'cancel']), defaultValue: 'request' },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return Sample
}