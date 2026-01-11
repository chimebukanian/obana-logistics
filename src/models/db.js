const dbConfig = require('../config/dbConfig.js');
const { createClient } = require('redis')
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
    dbConfig.DB,
    dbConfig.USER,
    dbConfig.PASSWORD,
    {
        host: dbConfig.HOST,
        dialect: dbConfig.dialect,
        operatorsAliases: 0,
        port: dbConfig.PORT,
        logging: false,
        pool: {
            max: dbConfig.pool.max,
            min: dbConfig.pool.min,
            acquire: dbConfig.pool.acquire,
            idle: dbConfig.pool.idle

        }
    }
)
const redis = createClient(dbConfig.REDIS_CONN);
redis.on('error', err => console.log('Redis Client Error', err));
redis.connect();
redis.select(dbConfig.REDIS_DB)


const Cache = require('./cache.js');
const { port } = require('../config/MigrationConfig.js');


sequelize.authenticate()
    .then(() => {
        console.log('connected..')
    })
    .catch(err => {
        console.log('Error' + err)
    })

const db = {}

db.Sequelize = Sequelize
db.sequelize = sequelize

// db.products = require('./productModel.js')(sequelize, DataTypes)
// db.categories = require('./categoryModel.js')(sequelize, DataTypes)
db.users = require('./userModel.js')(sequelize, DataTypes)
// db.verifications = require('./verificationModel.js')(sequelize, DataTypes)
// db.tokens = require('./tokenModel.js')(sequelize, DataTypes)
db.attributes = require('./attributeModel.js')(sequelize, DataTypes)
// db.tenants = require('./tenantModel.js')(sequelize, DataTypes)
// db.endpoints = require('./endpointModel.js')(sequelize, DataTypes)
// db.requests = require('./requestModel.js')(sequelize, DataTypes)
db.user_attributes = require('./userAttributeModel.js')(sequelize, DataTypes)
// db.stores = require('./storeModel.js')(sequelize, DataTypes)
// db.wish_list = require('./wishModel.js')(sequelize, DataTypes)
// db.carts = require('./cartModel.js')(sequelize, DataTypes)
// db.order_details = require('./orderDetailsModel.js')(sequelize, DataTypes)
// db.orders = require('./orderModel.js')(sequelize, DataTypes)
// db.wallets = require('./walletModel.js')(sequelize, DataTypes)
// db.wallet_history = require('./walletHistoryModel.js')(sequelize, DataTypes)
// db.rate = require('./rateModel.js')(sequelize, DataTypes)
// db.store_products = require('./storeProductModel.js')(sequelize, DataTypes)
// db.brand = require('./brandModel.js')(sequelize, DataTypes)
// db.roles = require('./roleModel.js')(sequelize, DataTypes)
// db.scopes = require('./scopeModel.js')(sequelize, DataTypes)
// db.role_scopes = require('./roleScopeModel.js')(sequelize, DataTypes)
// db.product_samples = require('./productSampleModel.js')(sequelize, DataTypes)
// db.quote = require('./quoteModel.js')(sequelize, DataTypes)
// db.orderReturns = require('./orderReturnModel.js')(sequelize, DataTypes)
// db.shipment = require('./shipmentModel.js')(sequelize, DataTypes)
// db.shipment_history = require('./shipmentHistoryModel.js')(sequelize, DataTypes)
// db.webhook_logs = require('./webhookLogsModel.js')(sequelize, DataTypes)
db.cache = new Cache(redis)
db.drivers = require('./driversModel.js')(sequelize, DataTypes)
db.addresses = require('./addressModel.js')(sequelize, DataTypes)
db.shipment_item = require('./shipmentItemsModel.js')(sequelize, DataTypes)
db.shipment_tracking = require('./shipmentTrackingModel.js')(sequelize, DataTypes)
// db.driver_assignment = require('./driverAssignmentModel.js')(sequelize, DataTypes)
db.shipment_items = require('./shipmentItemsModel.js')(sequelize, DataTypes)
db.shippings = require('./shipmentsModel.js')(sequelize, DataTypes)

db.sequelize.sync({ force: false })
    .then(() => {
        console.log('yes re-sync done!')
    })

    // Address associations
    db.addresses.hasMany(db.shippings, {
        foreignKey: 'delivery_address_id',
        as: 'deliveries'
    });
    
    db.addresses.hasMany(db.shippings, {
        foreignKey: 'pickup_address_id',
        as: 'pickups'
    });
    
    // Shipment associations
    db.shippings.belongsTo(db.addresses, {
        foreignKey: 'delivery_address_id',
        as: 'delivery_address'
    });
    
    db.shippings.belongsTo(db.addresses, {
        foreignKey: 'pickup_address_id',
        as: 'pickup_address'
    });
    
    db.shippings.hasMany(db.shipment_items, {
        foreignKey: 'shipment_id',
        as: 'items'
    });
    
    db.shippings.hasMany(db.shipment_tracking, {
        foreignKey: 'shipment_id',
        as: 'tracking_events'
    });
    
    db.shippings.belongsTo(db.drivers, {
        foreignKey: 'driver_id',
        as: 'driver',
        constraints: false // For internal shipments only
    });
    
    // Shipment Item associations
    db.shipment_items.belongsTo(db.shippings, {
        foreignKey: 'shipment_id',
        as: 'shipment'
    });
    
    // Shipment Tracking associations
    db.shipment_tracking.belongsTo(db.shippings, {
        foreignKey: 'shipment_id',
        as: 'shipment'
    });
    
    // Driver associations
    db.drivers.hasMany(db.shippings, {
        foreignKey: 'driver_id',
        as: 'assigned_shipments'
    });
    
    
        db.drivers.belongsTo(db.users, {
            foreignKey: 'user_id',
            as: 'user'
        });
        
        db.users.hasOne(db.drivers, {
            foreignKey: 'user_id',
            as: 'driver_profile'
        });

// // Order -> Shipment association
// db.orders.hasMany(db.shipment, {
//     foreignKey: 'order_id',
//     as: 'shipments'
// })

// db.shipment.belongsTo(db.orders, {
//     foreignKey: 'order_id',
//     as: 'order'
// })

// // Shipment -> Shipment History association
// db.shipment.hasMany(db.shipment_history, {
//     foreignKey: 'shipment_id',
//     as: 'history'
// })

// db.shipment_history.belongsTo(db.shipment, {
//     foreignKey: 'shipment_id',
//     as: 'shipment'
// })

// // Order -> Webhook Logs association
// db.orders.hasMany(db.webhook_logs, {
//     foreignKey: 'order_id',
//     as: 'webhook_logs'
// })

// db.webhook_logs.belongsTo(db.orders, {
//     foreignKey: 'order_id',
//     as: 'order'
// })

// // User -> Orders association (if not already exists)
// db.users.hasMany(db.orders, {
//     foreignKey: 'user_id',
//     as: 'orders'
// })

// db.orders.belongsTo(db.users, {
//     foreignKey: 'user_id',
//     as: 'user'
// })


db.sequelize.sync({ force: false })
    .then(() => {
        console.log('yes re-sync done!')
    })
db.user_attributes.belongsTo(db.users, {
    foreignKey: 'user_id',
    as: 'user'
})

// UserAttributes -> Attribute association 
db.attributes.hasMany(db.user_attributes, {
    foreignKey: 'attribute_id',
    as: 'user_attributes'
})

db.user_attributes.belongsTo(db.attributes, {
    foreignKey: 'attribute_id',
    as: 'attribute'
})

db.users.hasMany(db.user_attributes, {
    foreignKey: 'user_id',
    as: 'attributes'
})



// db.orders.hasMany(db.order_details, {
//     foreignKey: 'order_table_id',
//     as: 'v_order'
// })

// db.order_details.belongsTo(db.orders, {
//     foreignKey: 'order_table_id',
//     as: 'orders'
// })

// db.roles.belongsToMany(db.scopes, { through: 'role_scopes', foreignKey: 'role_id' });
// db.scopes.belongsToMany(db.roles, { through: 'role_scopes', foreignKey: 'scope_id' });

// db.users.hasOne(db.wallets, {
//     foreignKey: 'user_id',
//     as: 'wallet'
// })

// db.wallets.belongsTo(db.wallets, {
//     foreignKey: 'user_id',
//     as: 'user'
// })

// db.tenants.hasMany(db.endpoints, {
//     foreignKey: 'tenant_id',
//     as: 'endpoints'
// })

// db.endpoints.belongsTo(db.tenants, {
//     foreignKey: 'tenant_id',
//     as: 'tenant'
// })


// db.wallets.hasMany(db.wallet_history, {
//     foreignKey: 'wallet_id',
//     as: 'histories'
// })

// db.wallet_history.belongsTo(db.wallets, {
//     foreignKey: 'wallet_id',
//     as: 'wallet'
// })
module.exports = db