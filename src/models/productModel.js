module.exports = (sequelize, DataTypes) => {

    const Product = sequelize.define("product", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        image: {
            type: DataTypes.STRING
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false
        },
        price: {
            type: DataTypes.INTEGER
        },
        description: {
            type: DataTypes.TEXT
        },
        category_id: {
            type: DataTypes.INTEGER(11)
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    
    })

    return Product

}