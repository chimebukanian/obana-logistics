module.exports = (sequelize, DataTypes) => {

    const User = sequelize.define("user", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        email: {
            type: DataTypes.STRING(50)
        },
        phone: {
            type: DataTypes.STRING(20)
        },
        password: {
            type: DataTypes.TEXT
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return User

}
