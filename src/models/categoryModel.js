module.exports = (sequelize, DataTypes) => {

    const Category = sequelize.define("category", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        category_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: true
        },
        image: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.TEXT
        },
        parent_id: {
            type: DataTypes.STRING
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'active',
            allowNull: true
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE

    })

    return Category

}