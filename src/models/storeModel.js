module.exports = (sequelize, DataTypes) => {

    const Store = sequelize.define("store", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        link: {
            type: DataTypes.STRING,
            allowNull: false
        },
        social_handles: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        settlement_account: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        logo_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        user_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        }
    })

    return Store

}
