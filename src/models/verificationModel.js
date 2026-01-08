module.exports = (sequelize, DataTypes) => {

    const Verification = sequelize.define("verification", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        request_id: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        otp: {
            type: DataTypes.INTEGER(6),
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(50)
        },
        phone: {
            type: DataTypes.STRING(20)
        },
        call_back: {
            type: DataTypes.TEXT
        },
        used: {
            type: DataTypes.INTEGER(1),
            allowNull: false,
            default: 0
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return Verification

}
