module.exports = (sequelize, DataTypes) => {

    const Category = sequelize.define("endpoint", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        tenant_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false
        },
        before_execute: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        after_execute: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        route: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        verb: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        parameters: {
            type: DataTypes.TEXT
        },
        payload: {
            type: DataTypes.TEXT
        },
        headers: {
            type: DataTypes.TEXT
        },
        require_authentication: {
            type: DataTypes.STRING,
            default: 0
        },
        response: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.STRING
        },
        scope: {
            type: DataTypes.STRING
        },
        log: {
            type: DataTypes.BOOLEAN,
            default: false
        },

        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE

    })

    return Category

}