const { validator } = require("express-validator")
const { Op } = require("sequelize")
const db = require("../models/db.js")
const utils = require("../../utils.js")
const requestController = require("../controllers/requestController")
const userController = require("../controllers/userController")

const Store = db.stores;
const Order = db.orders;
const StoreProduct = db.store_products

/**
 * Method to create agent store
 * @param req
 *   Required
 *     store_name: string
 * @param res
 * @returns {Store} Store
 **/
const createStore = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).send(utils.responseError('You are not authorized to access this resource!!'))
  }

  const { name, logo_url, link, social_handles, settlement_account } = { ...req.body };
  if (!name)
    return res.status(400).send(utils.responseError("Store name can not be empty!"))
  if (!link)
    return res.status(400).send(utils.responseError("Store link can not be empty!"))

  let store = await Store.findOne({ where: { user_id: user.id } })

  if (!store)
    store = await Store.create({ name, link, user_id: user.id })

  store.logo_url = logo_url
  store.social_handles = JSON.stringify(social_handles)
  store.settlement_account = JSON.stringify(settlement_account)
  store.save()

  return res.status(201).send(utils.responseSuccess(store))
};

/**
 * Method to retrive available products to add to store
 * @param res
 * @returns {*} Products
 **/
const getOrderedProducts = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).send(
      utils.responseError('You are not authorized to access this resource!!')
    )
  }

  const orders = await Order.findAll({ where: { user_id: user.id } })

  if (!orders) {
    return res.status(400).send(
      utils.responseError(
        "Agent do not have available products to add to store! Kindly purchase products and try again!!"
      )
    );
  }
  const products = {}

  for (let order of orders) {
    const order_detail = JSON.parse(order.order_details)
    for (let item of order_detail.items) {
      if (!products[item.sku])
        products[item.sku] = { name: item.name, price: item.price }

      products[item.sku].quantity = products[item.sku].quantity ? products[item.sku].quantity + item.qty_ordered : item.qty_ordered
    }
  }

  return res.status(201).send(utils.responseSuccess(products))
};


/**
 * Method to create store product
 * @param payload
 *   Required
 *     sku: string
 * @param res
 * @returns {*} Store
 **/
const addProduct = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).send(utils.responseError('You are not authorized to access this resource!!'))
  }

  const { sku, image, general, inventry, pricing, variant } = { ...req.body }
  if (!sku) {
    return res.status(400).send(utils.responseError("Sku can not be empty!"))
  }

  let store = await Store.findOne({ where: { user_id: user.id } })

  if (!store) {
    return res.status(400).send(
      utils.responseError("Agent do not have a store at the moment! Please create a store and try again!!")
    )
  }

  let storeProduct = await StoreProduct.findOne({ where: { store_id: store.id, sku } })

  if (!storeProduct) {
    storeProduct = await StoreProduct.create({ store_id: store.id, sku, status: "disabled" })
  }
  if (image) storeProduct.image = image
  const objectKeys = { general, inventry, pricing, variant }
  for (let objectKey in objectKeys) {
    if (objectKeys[objectKey]) storeProduct[objectKey] = JSON.stringify(objectKeys[objectKey])
  }
  storeProduct.save()

  store = await getStore(req, res, false)

  return res.status(201).send(utils.responseSuccess(store))
};


/**
 * Method to update store products status
 * @param payload
 *   Required
 *     sku: string
 * @param res
 * @returns {*} Store
 **/
const updateProductsStatus = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).send(utils.responseError('You are not authorized to access this resource!!'))
  }

  const { products } = { ...req.body }
  if (!sku) {
    return res.status(400).send(utils.responseError("Sku can not be empty!"))
  }

  let store = await Store.findOne({ where: { user_id: user.id } })

  if (!store) {
    return res.status(400).send(
      utils.responseError("Agent do not have a store at the moment! Please create a store and try again!!")
    )
  }

  for (let product of products) {
    const storeProduct = await StoreProduct.findOne({ where: { store_id: store.id, sku: product.sku } })
    storeProduct.status = product.status
    storeProduct.save()
  }

  store = await getStore(req, res, false)

  return res.status(201).send(utils.responseSuccess(store))
};


/**
 * Method to create all the users attributes supplied
 * @param {*} user_id
 * @param {*} attributes
 * @param {*} parent_id -
 */
const removeProduct = async (req, res) => {
  const user = req.user
  if (!user) {
    return res.status(401).send(
      utils.responseError('You are not authorized to access this resource!!')
    )
  }

  const sku = req.body.sku
  if (!sku) {
    return res.status(400).send(utils.responseError("Sku can not be empty!"))
  }

  const store = await Store.findOne({ where: { user_id: user.id } })

  if (!store) {
    return res.status(404).send(
      utils.responseError("Agent do not have a store at the moment! Please create a store and try again!!")
    );
  }


  const storeProduct = await StoreProduct.findOne({ where: { store_id: store.id, sku } })
  if (!storeProduct) {
    return res.status(400).send(
      utils.responseError("You do not have this product in your store!!")
    );
  }
  storeProduct.status = "deleted"
  storeProduct.save()

  return res.status(201).send(utils.responseSuccess(storeProduct))
};

/**
 * Method to store and it's products
 * @param req
 * @param res
 * @returns {Store} Store
 **/
const getStore = async (req, res, sendResponse = true) => {
  const user = req.user

  const store = await Store.findOne({ where: { user_id: user.id } })

  if (!store) {
    return res.status(404).send(
      utils.responseError("Agent do not have a store at the moment! Please create a store and try again!!")
    )
  }

  let storeProductsCriteria = { store_id: store.id, status: { [Op.ne]: 'deleted' } }
  if (req.query.store_name) storeProductsCriteria.status = 'enabled'
  const storeProducts = await StoreProduct.findAll({ where: storeProductsCriteria })

  // store.products = await requestController.constructAndMakeRequest(
  //   {req, res, tenant:'fazsion', endpoint:'get-products', value: store.products, attribute: 'sku', condition: 'in'}
  // )

  const response = { ...store.dataValues, storeProducts }
  if (!sendResponse) return response

  return res.status(201).send(utils.responseSuccess(response))
};



/**
 * Method to authenticate a call using store name
 * @param storeName
 * @returns {Store} Store
 **/
const authStore = async (storeName) => {

  const store = await Store.findOne({ where: { name: storeName } })

  if (!store) {
    return false
  }

  store.user = await userController.getUserById(store.user_id)

  return store
};


module.exports = {
  createStore,
  getOrderedProducts,
  updateProductsStatus,
  addProduct,
  removeProduct,
  getStore,
  authStore
};