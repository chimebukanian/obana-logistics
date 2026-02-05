module.exports = (sequelize, DataTypes) => {
    const RouteTemplate = sequelize.define('route_templates', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        origin_city: { type: DataTypes.STRING, allowNull: false },
        destination_city: { type: DataTypes.STRING, allowNull: false },
        transport_mode: { type: DataTypes.STRING, allowNull: false },
        service_level: { type: DataTypes.STRING, allowNull: false },
        weight_brackets: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'route_templates'
    })

    return RouteTemplate
}
