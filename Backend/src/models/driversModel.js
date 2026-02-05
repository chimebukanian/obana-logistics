module.exports = (sequelize, DataTypes) => {
    const Driver = sequelize.define("driver", {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        driver_code: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            comment: 'OBANA-DRV-001'
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Link to user account if driver has login'
        },

        vehicle_type: {
            type: DataTypes.ENUM('bike', 'car', 'van', 'truck'),
            defaultValue: 'bike'
        },
        vehicle_registration: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'on_leave', 'suspended'),
            defaultValue: 'active'
        },
        // zone: {
        //     type: DataTypes.STRING(100),
        //     allowNull: true,
        //     comment: 'Assigned delivery zone'
        // },
        // rating: {
        //     type: DataTypes.DECIMAL(3, 2),
        //     defaultValue: 0.00
        // },
        total_deliveries: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        successful_deliveries: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        metadata: {
            type: DataTypes.JSON,
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

    return Driver;
};