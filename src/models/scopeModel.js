module.exports = (sequelize, DataTypes) => {

    const Scopes = sequelize.define("scopes", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        scopes: {
            type: DataTypes.STRING,
            allowNull: false
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE

    })

    return Scopes

}