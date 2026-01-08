module.exports = (sequelize, DataTypes) => {
    const Vendor = sequelize.define("vendor", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        vendor_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        business_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        tax_id: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'suspended'),
            defaultValue: 'active'
        },
        rating: {
            type: DataTypes.DECIMAL(3, 2),
            defaultValue: 0.00
        },
        metadata: {
            type: DataTypes.JSONB,
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

    return Vendor;
};