module.exports = (sequelize, DataTypes) => {

    const Role = sequelize.define("role", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        role: {
            type: DataTypes.STRING(50)
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return Role

}
