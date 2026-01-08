module.exports = (sequelize, DataTypes) => {
    const Address = sequelize.define("address", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        address_type: {
            type: DataTypes.ENUM('pickup', 'delivery', 'vendor', 'warehouse'),
            allowNull: false
        },
        first_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        last_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        line1: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        line2: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        state: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        country: {
            type: DataTypes.STRING(2),
            allowNull: false
        },
        zip_code: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        is_residential: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updatedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    return Address;
};