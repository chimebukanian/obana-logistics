module.exports = {

    HOST: process.env.DB_HOST,
    USER: process.env.DB_USER,
    PASSWORD: process.env.DB_PASSWORD,
    DB: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT,
    PORT: process.env.DB_PORT ?? 5433,

    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 1000
    },

    REDIS_CONN: {
        url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
    },
    REDIS_DB: process.env.REDIS_DB,

    authUrl: process.env.ZOHO_AUTH_URL,
    zohoBaseUrl: process.env.ZOHO_BASE_URL,
    zohoBookBaseUrl: process.env.ZOHO_BOOK_BASE_URL,

    orgId: process.env.ZOHO_ORG_ID,
    inventoryRefreshTokenCredentials: tokenCredentials(process.env.INVENTORY_REFRESH_TOKEN),
    salesOrderRefreshTokenCre: tokenCredentials(process.env.SALES_ORDER_REFRESH_TOKEN),
    crmRefreshToken: tokenCredentials(process.env.CRM_REFRESH_TOKEN),
    zohoBookRefreshToken: tokenCredentials(process.env.ZOHO_BOOK_REFRESH_TOKEN),

}

function tokenCredentials(reToken) {
    return {
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: reToken
    }
}