module.exports = (sequelize, DataTypes) => {
  const ShipmentHistory = sequelize.define("shipment_history", {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    shipment_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      references: {
        model: 'shipments',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    source: {
      type: DataTypes.STRING,
      defaultValue: 'system'
    },
    updated_by: {
      type: DataTypes.STRING,
      defaultValue: 'system'
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  });

  ShipmentHistory.associate = models => {
    ShipmentHistory.belongsTo(models.shipment, { foreignKey: 'shipment_id' });
  };

  return ShipmentHistory;
};