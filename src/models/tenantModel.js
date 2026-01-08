module.exports = (sequelize, DataTypes) => {

    const Tenant = sequelize.define("tenant", {
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
        slug: {
            type: DataTypes.STRING,
            allowNull: false
        },
        base_url: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT
        },
        registry: {
            type: DataTypes.TEXT
        },
        config: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.STRING
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    
    })

    return Tenant

    

}