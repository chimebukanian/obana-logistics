module.exports = (sequelize, DataTypes) => {

    const Cart = sequelize.define("cart", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        products: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    })

    return Cart

}
