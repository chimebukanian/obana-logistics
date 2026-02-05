module.exports = (sequelize, DataTypes) => {
    const WebhookLog = sequelize.define('webhook_logs', {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        event_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        shipment_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        order_id: {
            type: DataTypes.INTEGER(11),
            allowNull: true
        },
        payload: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        processed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        error_message: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return WebhookLog
}