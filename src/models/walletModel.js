module.exports = (sequelize, DataTypes) => {

    const Wallet = sequelize.define("wallet", {
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
        actual_balance: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        ledger_balance: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        lifetime_sales_value: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        lifetime_sales_value_verified: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        lifetime_sales_count: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            default: 0
        },
        lifetime_sales_count_verified: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            default: 0
        },
        lifetime_commision: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        lifetime_commision_verified: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        payout_count: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            default: 0
        },
        payout_count_verified: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            default: 0
        },
        lifetime_payout: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        lifetime_payout_verified: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            default: 0.00
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            default: "enabled"
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    
    })

    return Wallet

}
