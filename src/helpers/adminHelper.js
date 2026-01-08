const utils = require('../../utils')
class AdminHelper {
    dialet = process.env.DB_DIALECT
    constructor(db, endpoint, req, res) {
        this.db = db
        this.endpoint = endpoint
        this.req = req
        this.res = res
        this.user = utils.flattenObj(this.req?.user ?? {})
    }
    async callMethods() {
        let method = this.endpoint + '()'
        try {
            return await eval('this.' + method)
        } catch (error) {
            return this.res.status(400).send(error.message)
        }
    }
    dashboard = async () => {
        let dialet = process.env.DB_DIALECT
        const analysis = {
            ...await this.getOrderAnalysis(), ...await this.getTotalOrder(),
            'MONTHLY_ORDERS': await this.formathMonthly(),
            'PAID_ORDERS_CURRENT_WEEK': await this.getFulfilledOrdersCountCurrent(dialet),
            'PAID_ORDERS_PREVIOUS_WEEK': await this.getFulfilledOrdersCountPreviouse(dialet),
            'USERS': await this.getTotalCustomers(),
            'USERS_ACTIVITIES': await this.getActiveUsers(),
            // 'INACTIVE_USERS': await this.getInActiveUsers(),      
            'TOP_SALE_PRODUCTS': await this.getTopSoldProduct(),


        }
        this.res.status(200).send(analysis)
    }

    getAnalysis = async () => {
        let dialet = process.env.DB_DIALECT
        const orderAnalysis = await this.getOrderAnalysis()
        const totalOrder = await this.getTotalOrder()
        const totalCustomers = await this.getTotalCustomers()
        const topSoldProduct = await this.getTopSoldProduct()
        const completedOrderPreviousWeek = await this.getFulfilledOrdersCountPreviouse(dialet)
        const completedOrderCurrentWeek = await this.getFulfilledOrdersCountCurrent(dialet)
        const orderAnalysisByMonths = await this.getMonthlyOrderCounts(dialet)
        return { orderAnalysis, totalOrder, totalCustomers, topSoldProduct, completedOrderCurrentWeek, completedOrderPreviousWeek, orderAnalysisByMonths }
    }

    async getMonthlyOrderCounts() {
        return (
            await this.db.sequelize.query(`SELECT month, sum(net) AS net_order, sum(gross) AS gross_order FROM
                (SELECT TO_CHAR("createdAt", 'MONTH') AS month,
                CASE WHEN payments = 'paid' THEN 1 ELSE 0 END AS net,
                CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END AS gross
                FROM orders WHERE EXTRACT(YEAR from "createdAt") =  EXTRACT(YEAR from CURRENT_DATE)
                ) a GROUP BY month`)
        )[0] ?? [];
    }


    async getFulfilledOrdersCountCurrent(dialet) {
        switch (dialet) {
            case 'postgres':
                return (await this.db.sequelize.query(`SELECT count(order_id) AS count FROM orders WHERE payments ='paid' AND
                    EXTRACT(WEEK from "createdAt") = EXTRACT(WEEK from CURRENT_DATE)`))[0][0].count ?? 0
            case 'mysql':
                return (await this.db.sequelize.query(`SELECT WEEK(CURRENT_DATE )AS CURRENT_WEEK, count(order_id) AS count FROM orders 
                  WHERE  WEEK(createdAt) =  WEEK(CURRENT_DATE )`))[0][0].count ?? 0
        }
    }

    async getFulfilledOrdersCountPreviouse(dialet) {
        switch (dialet) {
            case 'postgres':
                return (await this.db.sequelize.query(`SELECT count(order_id) AS count FROM orders WHERE payments ='paid' AND 
                    EXTRACT(WEEK from "createdAt") =  EXTRACT(WEEK from CURRENT_DATE - INTERVAL '1 week')`))[0][0].count ?? 0
            case 'mysql':
                return (await this.db.sequelize.query(`SELECT count(order_id) AS count FROM orders WHERE payments ='paid' 
                    AND WEEK(createdAt) =  WEEK(CURRENT_DATE - INTERVAL 1 WEEK )`))[0][0].count ?? 0
        }
    }
    async getOrderAnalysis() {
        const data = (await this.db.sequelize.query(`SELECT count(order_id) AS gross_order, sum(amount) as gmv FROM orders 
            WHERE status IS NOT NULL AND order_id IS NOT NULL`))[0][0]
        return { 'GROSS_ORDER': data.gross_order ?? 0, 'GMV': data.gmv ?? 0 }

    }
    async getTotalOrder() {
        const data = (await this.db.sequelize.query(`SELECT  count(order_id) AS net_order,  sum(amount) as net_gmv FROM orders  WHERE payments = 'paid' AND 
            order_id IS NOT NULL `))[0][0]
        return { 'NET_ORDER': data.net_order ?? 0, 'NET_GMV': data.net_gmv ?? 0 }

    }
    async getTotalCustomers() {
        return (await this.db.sequelize.query(`SELECT ua.value as type, count(u.id) AS count FROM users u LEFT JOIN user_attributes ua 
        ON u.id = ua.user_id WHERE attribute_id IN (SELECT id FROM attributes WHERE slug = 'account_types') GROUP BY ua.value`))[0] ?? []
    }
    async getTopSoldProduct() {
        return (await this.db.sequelize.query(`SELECT count(quantity) As count, name, rate FROM order_details od JOIN orders o ON 
            od.order_table_id = o.id  WHERE o.status IS NOT NULL  GROUP BY NAME, rate ORDER BY count(quantity) DESC LIMIT 20`))[0]
    }
    async getActiveUsers() {
        return (await this.db.sequelize.query(`
            SELECT types, cat, count(user_id) AS count FROM (
            SELECT ua.user_id, ua.value AS types,
            CASE WHEN DATE(o."createdAt") < CURRENT_DATE - INTERVAL '30 DAY' THEN 'inactive' ELSE 'active'  END AS cat
            FROM user_attributes ua
            JOIN orders o ON  (ua.user_id = o.user_id OR ua.user_id = agent_id) 
            JOIN attributes a ON ua.attribute_id = a.id
            WHERE o.id IN (
            SELECT max(o.id) FROM user_attributes ua
            JOIN orders o ON  (ua.user_id = o.user_id OR ua.user_id = agent_id) 
            GROUP BY ua.user_id)
            AND slug = 'account_types') dat GROUP BY types, cat`))[0]
    }
    // async getActiveUsers() {
    //     return (await this.db.sequelize.query(`SELECT COUNT(DISTINCT u.id) AS count FROM users u JOIN orders o ON 
    //         (u.id = o.user_id OR u.id = agent_id) WHERE DATE(u."createdAt") >= CURRENT_DATE - INTERVAL '30 DAY'`))[0][0].count
    // }
    // async getInActiveUsers() {
    //     return (await this.db.sequelize.query(`SELECT COUNT(DISTINCT u.id) AS count FROM users u JOIN orders o ON 
    //         (u.id = o.user_id OR u.id = agent_id) WHERE DATE(u."createdAt") <= CURRENT_DATE - INTERVAL '31 DAY'`))[0][0].count
    // }

    async formathMonthly() {
        const monthly = await this.getMonthlyOrderCounts(this.dialet)
        const monthlyData = {
            "Jan": { "net_order": "0", "gross_order": "0" }, "Feb": { "net_order": "0", "gross_order": "0" },
            "Mar": { "net_order": "0", "gross_order": "0" }, "Apr": { "net_order": "0", "gross_order": "0" },
            "May": { "net_order": "0", "gross_order": "0" }, "Jun": { "net_order": "0", "gross_order": "0" },
            "Jul": { "net_order": "0", "gross_order": "0" }, "Aug": { "net_order": "0", "gross_order": "0" },
            "Sep": { "net_order": "0", "gross_order": "0" }, "Oct": { "net_order": "0", "gross_order": "0" },
            "Nov": { "net_order": "0", "gross_order": "0" }, "Dec": { "net_order": "0", "gross_order": "0" }
        }
        for (let month of monthly) {
            monthlyData[this.capitalizeFirstLetter(month.month.trim().substring(0, 3))] = { net_order: month.net_order, gross_order: month.gross_order }
        }
        return monthlyData
    }
    capitalizeFirstLetter(str) {
        if (typeof str !== 'string' || str.length === 0) {
            return str;
        }
        str = str.toLowerCase()
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

module.exports.AdminHelper = AdminHelper
