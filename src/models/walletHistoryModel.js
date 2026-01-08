module.exports = (sequelize, DataTypes) => {

    const WalletHistory = sequelize.define("wallet_history", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        wallet_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        user_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        order_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        order_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        transaction_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        merchant_ref: {
            type: DataTypes.STRING,
            allowNull: true
        },
        opening_balance: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        amount: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        closing_balance: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            default: "commission"
        },
        customer_info: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            default: "pending"
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE

    })

    return WalletHistory

}