module.exports = (sequelize, DataTypes) => {

    const Coupon = sequelize.define("coupon", {
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
        code: {
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            type: DataTypes.DOUBLE,
            defaultValue: 0.00
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'unuse'
        },
        expires: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return Coupon

}
