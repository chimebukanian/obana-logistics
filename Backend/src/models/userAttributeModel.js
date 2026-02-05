module.exports = (sequelize, DataTypes) => {

    const UserAttribute = sequelize.define("user_attribute", {
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
        attribute_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        value: {
            type: DataTypes.STRING,
            allowNull: true
        },
        parent_id: {
            type: DataTypes.INTEGER(11),
            allowNull: true
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    
    })

    return UserAttribute

}