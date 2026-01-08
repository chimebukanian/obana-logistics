const db = require('../models/db.js')
const utils = require('../../utils.js')
const { default: axios } = require('axios')
const dbConfig = require('../config/dbConfig.js');

const Cart = db.carts


/**
 * Method to complete cart creation request
 * @param payload
 *   Required 
 *     productId: string
 *     qty: number
 * @param res 
 * @returns {*} Cart Products
 **/
const addProduct = async (req, res) => {
    const user = req.user
    if (!user) {
        return res.status(401).send(
            utils.responseError('You are not authorized to access this resource!!')
        )
    }

    const product = req?.body

    if (!product?.productId) {
        return res.status(400).send(
            utils.responseError('Product can not be empty!')
        )
    }

    let cart = await Cart.findOne({ where: { user_id: user.id } })

    if (!cart) {
        cart = await Cart.create({ user_id: user.id })
    }

    let cartProducts = cart?.products ? JSON.parse(cart.products) : []

    let productExist = cartProducts?.filter(cartProd => { return cartProd?.productId == product.productId })
    if (productExist.length > 0) {
        cartProducts = cartProducts?.filter(cartProd => { return cartProd?.productId !== product.productId })
        for (let existingProduct of productExist) {
            existingProduct.qty += product.qty
            cartProducts.push(existingProduct)
        }
    } else {
        cartProducts.push(product)
    }

    cart.products = JSON.stringify(cartProducts)
    await cart.save()

    let carts = await Cart.findOne({ where: { user_id: user.id } })
    const cartItems = await getCartDetails(carts)
    if (!cartItems) {
        return res.status(403).send(
            utils.responseError('Unable to get cart.')
        )
    } else
        return res.status(201).send(
            utils.responseSuccess(cartItems)
        )
}

/**
 * Method to remove products from cart 
 * @param {*} user_id 
 * @param {*} productId 

 */
const removeProduct = async (req, res) => {
    const user = req.user
    if (!user) {
        return res.status(401).send(
            utils.responseError('You are not authorized to access this resource!!')
        )
    }

    const product = req.body
    if (!product) {
        return res.status(400).send(
            utils.responseError('Product can not be empty!')
        )
    }

    const cart = await Cart.findOne({ where: { user_id: user.id } })
    if (!cart) {
        return res.status(400).send(
            utils.responseSuccess('Agent do not have any products in the cart at the moment!')
        )
    }
    let cartProducts = JSON.parse(cart?.products)

    let productExist = cartProducts?.filter(cartProd => { return cartProd?.productId == product.productId })
    if (cartProducts && productExist.length > 0) {
        let newCart = cartProducts?.filter(cartProd => { return cartProd?.productId !== product.productId })
        cart.products = JSON.stringify(newCart)
        await cart.save()
    }
    if (JSON.parse(cart.products).length < 1) return res.status(200).send(utils.responseSuccess([]))
    let carts = await Cart.findOne({ where: { user_id: user.id } })
    const cartItems = await getCartDetails(carts)
    return res.status(201).send(
        utils.responseSuccess(cartItems)
    )
}

/**
 * Method to get Cart
 * @param req
 * @param res 
 * @returns {Wish} Store
 **/
const getCart = async (req, res) => {
    const user = req.user
    if (!user) {
        return res.status(401).send(
            utils.responseError('You are not authorized to access this resource!!')
        )
    }
    try {
        const cart = await Cart.findOne({ where: { user_id: user.id } })
        if (!cart || !cart?.products || JSON.parse(cart.products).length < 1) {
            return res.status(200).send(
                utils.responseSuccess([])
            )
        }
        const cartDetails = await getCartDetails(cart)
        return res.status(200).send(
            utils.responseSuccess(cartDetails)
        )
    } catch (error) {
        res.status(500).send(error)
    }

}

/**
 * Method to update cart qty 
 * @param {*} user_id 
 * @param {*} productId 
 * @param {*} qty 

 */
const updateCart = async (req, res) => {
    const user = req.user
    if (!user) {
        return res.status(401).send(
            utils.responseError('You are not authorized to access this resource!!')
        )
    }

    const product = req.body
    if (!product) {
        return res.status(400).send(
            utils.responseError('Product can not be empty!')
        )
    }

    const cart = await Cart.findOne({ where: { user_id: user.id } })
    if (!cart)
        return res.status(400).send(
            utils.responseSuccess([])
        )

    let cartProducts = JSON.parse(cart?.products)
    let productExist = cartProducts?.filter(cartProd => { return cartProd?.productId == product.productId })

    if (cartProducts && productExist.length > 0) {
        let index = cartProducts.findIndex(x => x.productId == product.productId);
        cartProducts[index] = product
        cart.products = JSON.stringify(cartProducts)
        await cart.save()
    }
    let carts = await Cart.findOne({ where: { user_id: user.id } })
    const cartItems = await getCartDetails(carts)
    return res.status(201).send(
        utils.responseSuccess(cartItems)
    )
}


const getCartDetails = async (cart) => {
    let carObject = JSON.parse(cart.products)
    let productIds = carObject.map(carts => carts.productId)
    let formatedResponse = []
    let zohoproducts = await getZohoMultipleProducts(productIds)

    if (!zohoproducts?.items) {
        return zohoproducts
    }

    let cart_total_price = 0
    let cart_total_qty = 0

    for (let product of zohoproducts.items) {
        let responsePayload = {}
        let qty = getCartQty(carObject, product.item_id)

        responsePayload.name = product.name
        responsePayload.rate = product.rate
        responsePayload.quantity = qty
        responsePayload.item_id = product.item_id
        responsePayload.total_price = product.rate * qty
        responsePayload.imageurl = getCustomFieldValue(product, 'cf_singleimage')
        responsePayload.weight = product.package_details?.weight
        responsePayload.in_stock = product.actual_available_stock > 0 ? "Available" : "Out of Stock"
        responsePayload.cf_stock_available_box = getCfStockAvailableBox(product.custom_fields)
        responsePayload.vendor = product?.vendor_name
        responsePayload.vendor_email = getCustomFieldValue(product, 'cf_vendor_email')
        responsePayload.vendor_address = getCustomFieldValue(product, 'cf_vendor_address')
        responsePayload.phone = getCustomFieldValue(product, 'cf_vendor_phone_no')
        responsePayload.line_address = getCustomFieldValue(product, 'cf_line_address') //line address 
        responsePayload.sku = product.sku ?? null


        cart_total_qty += qty
        cart_total_price += product.rate * qty

        formatedResponse.push(responsePayload)
    }

    return { items: formatedResponse, cart_total_qty, cart_total_price }
}

const getCfStockAvailableBox = (custom_fields) => {
    let field = custom_fields.filter(item => item.api_name == 'cf_stock_available_box')
    return field.length > 0 ? field[0].value : null
}


const getCartQty = (cartProducts, productId) => {
    let c = cartProducts.filter(c => { return c.productId == productId })
    return c[0]?.qty
}

const getZohoMultipleProducts = async (productIds) => {
    let token = await db.cache.getZohoInvetoryToken()
    let headers = utils.zohoHerders(token)
    let itemIds = productIds.toString()
    let url = `${dbConfig.zohoBaseUrl}itemdetails?item_ids=${itemIds}&organization_id=${dbConfig.orgId}`
    try {
        let zohoProducts = await axios.get(url, { headers: headers })
        return zohoProducts.data
    } catch (error) {

        return { statusCode: error?.response?.status, "data": error?.response?.data }
    }
}

const getCustomFieldValue = (producs, apiName) => {
    let value = null
    producs?.custom_fields.filter(obj => {
        if (obj.api_name === apiName)
            value = obj.value
    })
    return value
}

module.exports = {
    addProduct,
    removeProduct,
    getCart,
    updateCart,
    getZohoMultipleProducts,
    getCustomFieldValue,
    getCartDetails
}
