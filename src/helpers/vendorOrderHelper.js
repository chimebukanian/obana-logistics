const db = require('../models/db.js')

class VendorOrderHelper {
    constructor() {
        this.helper = false
    }

    createVendorOrderDetail = async (id) => {
        this.helper = true
        let orders = await db.orders.findAll({ where: { v_t_order: 0, id: id }, limit: 10 })
        if (!orders) return
        let vendorOrder = this.extractOrderDetails(orders)
        let orderTableId = [...(new Set(vendorOrder.map(order => order.order_table_id)))]
        const fields = ['name', 'rate', 'quantity', 'item_id', 'total_price', 'imageurl', 'weight', 'vendor', 'order_table_id']
        try {
            if (orderTableId.length > 0) {
                await db.order_details.bulkCreate(vendorOrder, { fields })
                await db.sequelize.query(`UPDATE orders SET v_t_order = ${1} WHERE id IN (${orderTableId})`)
            }
        } catch (error) {
            console.log(error)
        }
        this.helper = false
    }

    extractOrderDetails = (orders) => {
        let vendorOrder = []
        for (let order of orders) {
            let order_detail = JSON.parse(order?.order_details)
            if (order_detail?.hasOwnProperty('line_items')) {
                vendorOrder.push(... this.formatLineItem(order_detail.line_items, order.id))
            } else {
                if (Array.isArray(order_detail)) {

                    vendorOrder.push(... this.formatLineItem(order_detail, order.id))
                }
            }
        }
        return vendorOrder
    }

    formatLineItem = (items, id) => {
        let lineOrder = []
        for (let item of items) {
            item.order_table_id = id
            item.total_price = item?.total_price ?? (item.rate * item.quantity)
            item.vendor = item?.vendor ?? ""
            item.imageurl = item?.imageurl ?? ""
            item.weight = typeof item?.weight === "string" ? 0 : item?.weight ?? 0
            delete items.in_stock
            lineOrder.push(item)
        }
        return lineOrder
    }

}


module.exports = VendorOrderHelper
