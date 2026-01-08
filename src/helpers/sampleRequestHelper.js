const nodemailer = require('../mailer/nodemailer')
const utils = require('../../utils')
const { getZohoMultipleProducts, getCustomFieldValue } = require('../controllers/cartController')
const VendorOrderHelper = require('./vendorOrderHelper')
const dbConfig = require('../config/dbConfig.js');
const axios = require("axios")
const { Op } = require('sequelize')

class SampleRequest {
    constructor(db, endpoint, req, res) {
        this.db = db
        this.mail = nodemailer
        this.endpoint = endpoint
        this.req = req
        this.res = res
        this.user = utils.flattenObj(this.req.user ?? {})
    }
    async callMethods() {
        let method = this.endpoint + '()'
        try {
            return await eval('this.' + method)
        } catch (error) {
            console.log(error.message)
            return this.res.status(400).send(error.message)
        }
    }

    testNotif = async () => {
        let res = await this.sendSampleRequestNotification([21, 20])
        return this.res.status(400).send(res)
    }

    sendSampleRequestNotification = async (producIds) => {
        const products = await this.db.product_samples.findAll({ where: { id: { [Op.in]: producIds } } })
        const name = this.user.first_name + " " + this.user.last_name
        const email = this.user.email
        const phone = this.user.phone
        let d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }))
        const date = d.toDateString() + " " + d.toLocaleTimeString()
        const adminMail = process.env.ADMIN_MAIL

        const formatedProduct = this.formatProductForEmail(products)
        for (let product of formatedProduct) {
            let vendorMail = Object.keys(product)[0]
            let productDetails = Object.values(product)[0]
            if (adminMail)
                this.mail.sendMail({
                    email: adminMail, content: { name: name, email: email, phone: phone, product: productDetails, date },
                    subject: 'Product Sample Request', template: 'adminSampleRequest'
                })
            if (vendorMail) {
                try {
                    this.mail.sendMail({
                        email: vendorMail, content:
                            { product: productDetails, vendorName: productDetails[0].vendorName, date: date },
                        subject: 'Product Sample Request', template: 'vendorSampleRequest'
                    })
                } catch (error) {
                    console.log(error.message)
                }
            }
        }
    }

    formatProductForEmail(data) {
        const grouped = data.reduce((acc, item) => {
            const email = item.vendor_email;
            if (!acc[email]) {
                acc[email] = [];
            }
            acc[email].push(item.dataValues);
            return acc;
        }, {});
        return Object.entries(grouped).map(([email, items]) => ({
            [email]: items
        }));

    }



    get = async () => {
        const user = this.user
        let limit = this.req.query.limit ?? 20
        let offset = this.req.query.offset ?? 0
        const samples = await this.db.product_samples.findAndCountAll({
            where: { user_id: user.id },
            lmit: parseInt(limit), offset: parseInt(offset),
            order: [['id', 'DESC']]

        })
        return this.res.status(200).send(utils.responseSuccess(samples))
    }

    checkout = async () => {
        const orderPayload = await this.orderDetails()

        let token = await this.db.cache.getZohoSalesOrderToken()
        let headers = utils.zohoHerders(token)
        const savedOrder = await this.db.orders.findOne({ where: { id: orderPayload.savedOrderId } })
        if (!savedOrder) return this.res.status(400).send(utils.responseSuccess('Badrequest', 400))
        let url = `${dbConfig.zohoBaseUrl}salesorders?organization_id=${dbConfig.orgId}`
        try {
            let zohoOrder = await axios.post(url, orderPayload.payload, { headers: headers })
            const orderId = zohoOrder?.data?.salesorder?.salesorder_id
            savedOrder.order_id = orderId
            savedOrder.status = zohoOrder?.data?.salesorder?.status
            savedOrder.order_ref = zohoOrder?.data?.salesorder?.salesorder_number
            savedOrder.save()
            await this.db.sequelize.query(`UPDATE product_samples SET status = 'supplied', 
                order_ref= '${zohoOrder?.data?.salesorder?.salesorder_number}', order_id= '${orderId}' 
                WHERE id IN( ${orderPayload.sampleCreatedId})`)

            await this.sendSampleRequestNotification(orderPayload.sampleCreatedId)
            return this.res.status(200).send(utils.responseSuccess(zohoOrder?.data))
        } catch (error) {
            console.log(error)
            return this.res.status(400).send(utils.responseError(error.message))
        }
    }

    orderDetails = async () => {
        const payload = this.req.body

        if (!payload?.products || payload?.products.length < 1)
            throw this.res.status(404).send({ "measage": "Missing products", code: 404 })

        const productIds = payload.products.map(carts => carts.item_id)
        const products = await getZohoMultipleProducts(productIds)

        if (products?.data?.code == 2006)
            throw utils.responseError(products, products?.data?.code)

        let productSample = []
        let orderDetailSample = []

        let cartDetails = []
        let orderAmount = 0
        for (let product of products.items) {
            const sampleId = getCustomFieldValue(product, 'cf_sample_id')
            if (!sampleId) throw utils.responseError(`Sample product not found for this product ${product.name}`)
            const sampleProducts = await getZohoMultipleProducts([sampleId])
            if (!sampleProducts.hasOwnProperty('items') || sampleProducts.items.length < 1)
                throw utils.responseError(`Sample product not found for this product ${product.name}`)
            product = sampleProducts.items[0]
            const vendor_name = getCustomFieldValue(product, 'cf_vendor_name')
            const vendor_email = getCustomFieldValue(product, 'cf_vendor_email')
            const product_image = getCustomFieldValue(product, 'cf_singleimage')
            productSample.push({
                vendor_name, vendor_email, product_image, product_id: product.item_id, sku: product.sku, product_name: product.name,
                qty: this.getSampleRequestQty(payload.products, product.item_id),
                user_id: this.user.id, name: this.user.first_name + " " + this.user.last_name, email: this.user.email, phone: this.user.phone
            })
            let qty = this.getSampleRequestQty(payload.products, product.item_id)
            orderDetailSample.push({
                vendor_name, vendor_email, product_image, item_id: product.item_id, sku: product.sku, name: product.name,
                rate: product.rate, quantity: this.getSampleRequestQty(payload.products, product.item_id),
                total_price: product.rate * qty, weight: product.package_details?.weight,
                metadata: this.getSampleMetadata(payload.products, product.item_id), description: product.name,
                currency: JSON.stringify(payload?.currency ?? {}),
                user_id: this.user.id, name: this.user.first_name + " " + this.user.last_name, email: this.user.email, phone: this.user.phone

            })

            let responsePayload = {}
            responsePayload.name = product.name
            responsePayload.rate = product.rate
            responsePayload.quantity = this.getSampleRequestQty(payload.products, product.item_id)
            responsePayload.item_id = product.item_id
            responsePayload.total_price = product.rate
            orderAmount += product.rate
            responsePayload.weight = product.package_details?.weight
            responsePayload.description = product.name
            cartDetails.push(responsePayload)

        }
        const sampleRequest = await this.db.product_samples.bulkCreate(productSample)
        const sampleCreatedId = sampleRequest.map(item => item.id)

        const temp = structuredClone(cartDetails)
        const orderDetails = cartDetails
        const customer_id = payload?.customer_id

        delete payload?.customer_id
        delete payload?.products
        delete payload?.amount
        const shipment = this.getshipment(temp, payload)

        let salesperson = `${this.user?.first_name} ${this.user?.last_name ?? ""}`
        let placingOrderUser = this.user.sales_person_id ?? this.user.zoho_id
        if (!placingOrderUser) {
            throw this.requestDetails.res.status(400).send({ measage: "Update your profile then re-login.", code: 400 })
        }
        const savedOrder = await this.db.orders.create({
            user_id: this.user.id, order_details: JSON.stringify(orderDetailSample), shipment_details: JSON.stringify(shipment),
            amount: orderAmount, types: 'sample', currency: JSON.stringify(payload?.currency ?? {})
        })
        await (new VendorOrderHelper()).createVendorOrderDetail(savedOrder.id)
        return {
            payload: {
                "customer_id": customer_id, 'custom_fields': [{ "label": "Sales Person Name", "value": salesperson },
                { "label": "Agent Email", "value": this.user.email }, { "label": "Payment Type", "value": 'Prepaid' },
                { "label": "Order Type", "value": 'sample' }, { "label": "Currency code", "value": this.payload?.currency?.symbol },
                { "label": "Exchange Rate", "value": this.payload?.currency?.rate }, { "label": "SAMPLE_DETAILS", "value": payload?.sample_details }
                ], 'line_items': orderDetails
            },
            savedOrderId: savedOrder.id, sampleCreatedId
        }
    }

    getshipment = (cartDetailsItmes, payload) => {
        return {
            ...payload,
            "parcel": {
                "description": `Package delivery for ${payload?.delivery_address?.last_name ?? 'Obana'} ${payload?.delivery_address?.first_name ?? 'Africa'}.`,
                "weight_unit": "kg",
                "items": utils.formartShipment(cartDetailsItmes)
            }
        }
    }
    getSampleRequestQty = (paylodProducts, productId) => {
        let c = paylodProducts.filter(c => { return c.item_id == productId })
        return c[0]?.qty
    }
    getSampleMetadata = (paylodProducts, productId) => {
        let c = paylodProducts.filter(c => { return c.item_id == productId })
        if (c.length < 1) return null
        return c[0]?.metadata
    }
}

module.exports.SampleRequest = SampleRequest