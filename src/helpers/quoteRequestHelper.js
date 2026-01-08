const nodemailer = require('../mailer/nodemailer')
const utils = require('../../utils')
const { getCartDetails } = require('../controllers/cartController')
const VendorOrderHelper = require('./vendorOrderHelper')
const dbConfig = require('../config/dbConfig.js');
const axios = require("axios")

class QuoteRequest {
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

    async getquote() {
        let token = await this.getToken()
        try {
            const quotes = await axios.get(this.getUrl('estimates'), { headers: utils.zohoHerders(token) })
            return this.res.status(200).send(quotes.data)
        } catch (e) {
            return this.res.status(e.code ?? 500).send(e.message)
        }
    }

    async submit() {
        // const quote = await this.db.quote.findOne({ where: { user_id: this.user.id } })
        // const cartItems = await getCartDetails(quote)
        // const orderDetails = cartItems.items.map(item => {
        //     item.imageurl = '', item.description = item.name
        //     return item
        // })
        // const owner = `${this.req.body?.delivery_address?.first_name ?? this.user.first_name} ${this.req.body?.delivery_address?.last_name ?? this.user.last_name}`
        // const shipment = {
        //     delivery_address: this.req.body.delivery_address,
        //     carrier_id: this.req.body.carrier_id,
        //     "parcel": {
        //         "description": `Package delivery for ${owner}`,
        //         "weight_unit": "kg",
        //         "items": utils.formartShipment(structuredClone(cartItems.items))
        //     }
        // }

        // const savedOrder = await this.db.orders.create({ user_id: this.user.id, order_details: JSON.stringify(orderDetails), shipment_details: JSON.stringify(shipment), amount: this.req.body?.amount, types: 'quote' })
        // if (!savedOrder)
        //     return this.res.status(e.code ?? 500).send(savedOrder)


        // const payload = {
        //     "customer_id": this.req.body?.customer_id,
        //     'line_items': orderDetails,
        //     //"expiry_date": this.req.body.expiry_date,
        //     "discount": 0
        // }
        const token = await this.getToken()
        const quotes = await axios.post(this.getUrl('estimates'), this.req.body, { headers: utils.zohoHerders(token) })
        return this.res.status(200).send(quotes)

    }

    async addquote() {
        const product = this.req?.body
        const quote = await this.db.quote.findOne({ where: { user_id: this.user.id } })

        if (!quote)
            quote = await this.db.quote.create({ user_id: this.user.id })
        let quoteProducts = quote?.products ? JSON.parse(quote.products) : []

        const productExist = quoteProducts?.filter(quotetProd => { return quotetProd?.productId == product.productId })
        if (productExist.length > 0) {
            quoteProducts = quoteProducts?.filter(quotetProd => { return quotetProd?.productId !== product.productId })
            for (let existingProduct of productExist) {
                existingProduct.qty += product.qty
                quoteProducts.push(existingProduct)
            }
        } else {
            quoteProducts.push(product)
        }
        quote.products = JSON.stringify(quoteProducts)
        await quote.save()
        const quotes = await this.db.quote.findOne({ where: { user_id: this.user.id } })
        const quoteItems = await getCartDetails(quotes)
        if (!quoteItems) {
            return this.res.status(403).send(
                utils.responseError('Unable to get quote.')
            )
        } else
            return this.res.status(201).send(
                utils.responseSuccess(quoteItems)
            )
    }

    async remove() {

        const product = req.body
        if (!product) {
            return res.status(400).send(
                utils.responseError('Product can not be empty!')
            )
        }

        const quote = await this.db.quote.findOne({ where: { user_id: this.user.id } })
        if (!quote) {
            return res.status(400).send(
                utils.responseSuccess('Agent do not have any products in the quote at the moment!')
            )
        }
        let quoteProducts = JSON.parse(quote?.products)
        let productExist = quoteProducts?.filter(quoteProd => { return quoteProd?.productId == product.productId })
        if (quoteProducts && productExist.length > 0) {
            let newQuote = quoteProducts?.filter(quoteProd => { return quoteProd?.productId !== product.productId })
            quote.products = JSON.stringify(newQuote)
            await quote.save()
        }
        if (JSON.parse(quote.products).length < 1) return this.res.status(200).send(utils.responseSuccess([]))
        let quotes = await quote.findOne({ where: { user_id: this.user.id } })
        const cartItems = await getCartDetails(quotes)
        return this.res.status(201).send(
            utils.responseSuccess(cartItems)
        )
    }

    async update() {
        const product = this.req.body
        const quots = await this.db.quote.findOne({ where: { user_id: this.user.id } })
        if (!quots)
            return this.res.status(400).send(
                utils.responseSuccess([])
            )

        let quotProducts = JSON.parse(quots?.products)
        let productExist = quotProducts?.filter(cartProd => { return cartProd?.productId == product.productId })

        if (quotProducts && productExist.length > 0) {
            let index = quotProducts.findIndex(x => x.productId == product.productId);
            quotProducts[index] = product
            quots.products = JSON.stringify(quotProducts)
            await quots.save()
        }
        let quot = await this.db.quote.findOne({ where: { user_id: this.user.id } })
        const quotItems = await getCartDetails(quot)
        return this.res.status(201).send(
            utils.responseSuccess(quotItems)
        )
    }

    async get() {
        try {
            const quote = await this.db.quote.findOne({ where: { user_id: this.user.id } })
            if (!quote || !quote?.products || JSON.parse(quote.products).length < 1) {
                return this.res.status(200).send(
                    utils.responseSuccess([])
                )
            }
            const quoteDetails = await getCartDetails(quote)
            return this.res.status(200).send(
                utils.responseSuccess(quoteDetails)
            )
        } catch (error) {
            this.res.status(500).send(error)
        }

    }

    async getToken() {
        return await this.db.cache.zohoBookToken()
    }
    getUrl(endpoint) {
        return 'https://www.zohoapis.com/books/v3/estimates?organization_id=890177831'
        return `https://${dbConfig.zohoBookBaseUrl}${endpoint}?organization_id=${dbConfig.orgId}`
    }
}

module.exports.QuoteRequest = QuoteRequest