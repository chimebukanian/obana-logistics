module.exports = (sequelize, DataTypes) => {
    const Address = sequelize.define("address", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        address_type: {
            type: DataTypes.ENUM('pickup', 'delivery'),
            allowNull: false
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        contact_email: {
            type: DataTypes.STRING(100),
            allowNull: true
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
            type: DataTypes.STRING(100),
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
        instructions: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSON,  // Changed from JSONB
            allowNull: true
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