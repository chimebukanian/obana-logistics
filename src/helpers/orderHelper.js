const util = require('../../utils')
const dbConfig = require('../config/dbConfig');
const axios = require('axios');
const querystring = require('node:querystring');
const { rate } = require('../models/db.js');
const rateController = require('../controllers/rateController');
const walletController = require('../controllers/walletController');



class OrderHelper {
    dialet = process.env.DB_DIALECT
    constructor(db, endpoint, req, res) {
        this.db = db
        this.endpoint = endpoint
        this.req = req
        this.res = res
        this.user = this.req?.user ? util.flattenObj(this.req?.user ?? {}) : null
    }

    async callMethods() {
        let method = this.endpoint + '()'
        try {
            return await eval('this.' + method)
        } catch (error) {
            return this.res.status(400).send(error.message)
        }
    }
    async receive() {
        try {
            const salesReturn = await this.getSalesReturnDatalZoho(this.req.query.salesreturn_id)
            if (!salesReturn) return
            const payloadLineItems = []
            for (let item of salesReturn.salesreturn.line_items) {
                payloadLineItems.push(
                    {
                        "line_item_id": item.line_item_id,
                        "quantity": item.quantity
                    }
                )
            }
            const payload = { "line_items": payloadLineItems, "notes": this.req.body.note }
            const receivedReturn = await this.receiveSalesReturn(payload)
            await this.updateOrderDetailsOnReturn(salesReturn, 'received')
            const creditnote = await this.creditnote('return')
            return this.res.status(200).send(creditnote)
        } catch (error) {
            console.log(error)
            return error
        }
    };
    async creditnote(result = null) {
        const salesReturn = await this.getSalesReturnDatalZoho(this.req.query.salesreturn_id)
        if (!salesReturn)
            throw this.res.status(400).send("Sales return not found")
        try {


            const payloadLineItems = []
            const invoiceData = await this.searchInvoicess(salesReturn.salesreturn.salesorder_number)

            const invoices = invoiceData.hasOwnProperty('invoices') ? invoiceData.invoices : null
            if (!invoices || invoices.length < 1) return this.res.status(400).send("Invoice not found")
            const invoiceId = invoices[0].invoice_id
            const invoice = await this.getInvoiceById(invoiceId)

            if (!invoice) return this.res.status(400).send("Invoice not found")
            const invoiceById = invoice.hasOwnProperty('invoice') ? invoice.invoice : null
            if (!invoiceById) return this.res.status(400).send("Invoice not found")

            for (let item of salesReturn.salesreturn.line_items) {
                payloadLineItems.push(
                    {
                        "item_id": item.item_id,
                        "salesreturn_item_id": item.line_item_id,
                        "name": item.name,
                        "description": item.description,
                        "rate": item.rate,
                        "unit": item.unit ?? "",
                        "quantity": item.quantity, "is_returned_to_stock": true,
                        "invoice_item_id": await this.getInvoiceLineItemValue(invoiceById.line_items, item.item_id, 'line_item_id'),
                        "account_id": await this.getInvoiceLineItemValue(invoiceById.line_items, item.item_id, 'account_id'),
                        "account_name": await this.getInvoiceLineItemValue(invoiceById.line_items, item.item_id, 'account_name'),
                        "invoice_id": invoiceById.invoice_id,
                        "is_item_shipped": true,
                        "is_returned_to_stock": true,
                    }
                )
            }
            const payload = { "customer_id": salesReturn.salesreturn.customer_id, "line_items": payloadLineItems, "notes": this.req.body.note }
            const creditNote = await this.createCreditNote(payload, this.req.query.salesreturn_id)
            // if (result && result === 'return')
            return creditNote
        } catch (error) {
            return error
        }
        // return this.res.status(200).send(creditNote)
    }

    async initiate() {
        const request = this.req.body
        const zohoOrder = await this.getSaleOrderFromZoho(request.order_id)
        if (zohoOrder?.salesorder?.line_items.length < 1) return this.res.status(400).send(util.responseError('Not found', 400))
        const check = this.orderCreatedWithinReturnDays(zohoOrder?.salesorder.date)
        // if (!check) return this.res.status(400).send(util.responseError('Order return days has passed. You can only return within 5 days', 400))
        const returnLineItems = []
        for (let product of request.products) {
            const lineItem = zohoOrder?.salesorder.line_items.filter(item => item.item_id == product.item_id)
            if (lineItem < 1) continue
            returnLineItems.push({
                "item_id": lineItem[0].item_id,
                "salesorder_item_id": lineItem[0].line_item_id,
                quantity: product.quantity
            })
        }
        if (returnLineItems.length < 1) return this.res.status(400).send(util.responseError('Not found', 400))
        const createdReturns = await this.createSalesReturn({ line_items: returnLineItems, reason: request.reason }, request.order_id)
        await this.updateOrderDetailsOnReturn(createdReturns, 'initiated')
        return this.res.status(200).send(util.responseSuccess(createdReturns))
    }
    updateStatus = async () => {
        try {
            const { salesreturn_id, status } = this.req.body
            const statuses = ['approved', 'declined', 'received']
            if (!statuses.includes(status)) return this.res.status(400).send(util.responseError('Invalid status', 400))
            const updatedReturn = await this.updateSalesReturnStatus(salesreturn_id, status)
            return this.res.status(200).send(util.responseSuccess(updatedReturn))
        } catch (e) {
            console.log(e)
            return this.res.status(400).send(util.responseError('Invalid request', 400))
        }
    }

    async refund() {
        const request = this.req.body
        const returns = await this.db.orderReturns.findOne({ where: { id: request.id, status: 'received' } })
        if (returns.length < 1) return this.res.status(400).send(util.responseSuccess([]))
        try {
            returns.status = 'refunded'
        } catch (error) {
            return this.res.status(400).send(util.responseError(error.message, 400))
        }
        return this.res.status(200).send(util.responseSuccess(returns))
    }

    createCreditNote = async (payload, salesreturnId) => {
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const url = `${dbConfig.zohoBaseUrl}creditnotes?organization_id=${dbConfig.orgId}&salesreturn_id=${salesreturnId}`
        try {
            return (await axios.post(url, payload, { headers: headers })).data
        } catch (e) {
            console.log(e)
            throw this.res.status(400).send(e.response.data)
        }

    }

    createSalesReturn = async (payload, orderId) => {
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const url = `${dbConfig.zohoBaseUrl}salesreturns?organization_id=${dbConfig.orgId}&salesorder_id=${orderId}`
        try {
            return (await axios.post(url, payload, { headers: headers })).data
        } catch (error) {
            throw this.res.status(400).send(error.response.data)
        }
    }

    receiveSalesReturn = async (payload) => {
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const url = `${dbConfig.zohoBaseUrl}salesreturnreceives?salesreturn_id=${this.req.query.salesreturn_id}&organization_id=${dbConfig.orgId}`
        try {
            return (await axios.post(url, payload, { headers: headers })).data
        } catch (e) {
            throw this.res.status(400).send(e.response.data)
        }

    }

    updateSalesReturnStatus = async (salesreturnId, status) => {
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        let url = `${dbConfig.zohoBaseUrl}salesreturns/${salesreturnId}/status/${status}?organization_id=${dbConfig.orgId}`
        let payload = { organization_id: dbConfig.orgId }
        return (await axios.post(url, payload, { headers: headers })).data
    }

    getSaleOrderFromZoho = async (orderId) => {
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const url = `${dbConfig.zohoBaseUrl}salesorders/${orderId}?organization_id=${dbConfig.orgId}`
        try {
            return (await axios.get(url, { headers: headers })).data
        } catch (error) {
            console.log(error)
            throw this.res.status(400).send(util.responseError(error.response.data, 400))
        }
    }

    getSalesReturnFromZoho = async () => {
        const queries = querystring.stringify(this.req.query)
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const query = queries ? `?${queries}&organization_id=${dbConfig.orgId}` : `?organization_id=${dbConfig.orgId}`
        const url = `${dbConfig.zohoBaseUrl}salesreturns${query}`
        try {
            return (await axios.get(url, { headers: headers })).data
        } catch (error) {
            console.log(error)
            throw this.res.status(400).send(util.responseError(error.response.data, 400))
        }
    }


    orderCreatedWithinReturnDays = (dateCreated = null) => {
        if (!dateCreated) return false
        const futureDate = new Date(dateCreated);
        const now = new Date();
        const diffTime = now.getTime() - futureDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays < 6
    }

    updateOrderDetailsOnReturn = async (orderReturn, status) => {
        const salesorder_id = Object.hasOwn(orderReturn?.salesreturn, 'salesorder_id') ? orderReturn.salesreturn.salesorder_id : null
        if (!salesorder_id) return
        const order = await this.db.orders.findOne({ where: { order_id: salesorder_id } })
        if (!order) return
        const totalOrderValue = util.getOrderDetailTotalAmount(order)
        const storeORderCurrency = order.currency ? JSON.parse(order.currency).rate : 1
        const storeORder = order.order_details ? JSON.parse(order.order_details) : []
        const isReceived = status == 'received'
        for (let item of orderReturn.salesreturn.line_items) {
            let found = storeORder?.filter(product => { return product?.item_id == item.item_id })
            let idx = storeORder.findIndex((stord) => { return stord.item_id == item.item_id })
            if (found.length > 0) {
                let { quantity } = item
                let foundObj = found[0]
                let initialReturn = foundObj?.return_quantity ?? 0
                let oldQuantity = foundObj.quantity
                foundObj.return_status = status
                foundObj.return_quantity = initialReturn + quantity
                foundObj.quantity = isReceived ? oldQuantity - quantity : oldQuantity
                foundObj.total_price = isReceived ? foundObj.rate * (oldQuantity - quantity) : foundObj.rate
                storeORder[idx] = foundObj
            }
        }
        order.order_details = JSON.stringify(storeORder)
        if (!isReceived) return
        const newtotalOrderValue = util.getOrderDetailTotalAmount(order)
        const wallet = await walletController.reverseCommision(salesorder_id, totalOrderValue)
        if (newtotalOrderValue < 1) {
            order.commission = 0
            order.save()
            return
        }
        const orderPayload = this.constructOrderBody(salesorder_id, order.order_ref, newtotalOrderValue)
        if (wallet) {
            const user = await this.db.users.findOne({ where: { id: wallet.user_id } })
            order.commission = await walletController.createCommision(orderPayload, user, storeORderCurrency)
        }
        await order.save()
    }

    getSalesReturnDatalZoho = async (salesReturnId) => {
        if (!salesReturnId) return null
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const url = `${dbConfig.zohoBaseUrl}salesreturns/${salesReturnId}?organization_id=${dbConfig.orgId}`
        try {
            return (await axios.get(url, { headers: headers })).data
        } catch (error) {
            console.log(error)
            throw this.res.status(400).send(util.responseError(error.response.data, 400))
        }
    }
    searchInvoicess = async (salesOrderNumber) => {
        if (!salesOrderNumber) return { "invoices": [] }
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const url = `${dbConfig.zohoBaseUrl}invoices?search_text=${salesOrderNumber}&organization_id=${dbConfig.orgId}`
        try {
            return (await axios.get(url, { headers: headers })).data
        } catch (error) {
            console.log(error)
            throw this.res.status(400).send(util.responseError(error.response.data, 400))
        }
    }

    getInvoiceById = async (invoiceId) => {
        if (!invoiceId) return null
        const token = await this.db.cache.getZohoInvetoryToken()
        const headers = util.zohoHerders(token)
        const url = `${dbConfig.zohoBaseUrl}invoices/${invoiceId}?organization_id=${dbConfig.orgId}`
        try {
            return (await axios.get(url, { headers: headers })).data
        } catch (error) {
            console.log(error)
            throw this.res.status(400).send(util.responseError(error.response.data, 400))
        }
    }
    getInvoiceLineItemValue = async (lineItems, id, key) => {
        let value = null
        lineItems.filter(obj => {
            if (obj.item_id === id)
                value = obj[key]
        })
        return value
    }

    constructOrderBody = (salesorder_id, salesorder_number, total) => {
        return { salesorder_id, salesorder_number, total }
    }

}

module.exports.OrderHelper = OrderHelper;