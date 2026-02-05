module.exports = (sequelize, DataTypes) => {

    const Token = sequelize.define("token", {
        refresh_token: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    })

    return Token

}
