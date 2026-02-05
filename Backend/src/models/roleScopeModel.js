module.exports = (sequelize, DataTypes) => {

    const RoleScopes = sequelize.define("role_scopes", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        selfGranted: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE

    })

    return RoleScopes

}