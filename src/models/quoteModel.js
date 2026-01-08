module.exports = (sequelize, DataTypes) => {

    const Quote = sequelize.define("quotes", {
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
        products: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    })

    return Quote

}
