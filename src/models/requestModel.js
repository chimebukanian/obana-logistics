module.exports = (sequelize, DataTypes) => {

    const Request = sequelize.define("request", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        originating_route: {
            type: DataTypes.STRING,
            allowNull: false
        },
        destination_route: {
            type: DataTypes.STRING
        },
        payload: {
            type: DataTypes.TEXT
        },
        response: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.STRING
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    
    })

    return Request

}