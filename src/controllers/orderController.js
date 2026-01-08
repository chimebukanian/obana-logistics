const { Op } = require('sequelize')
const db = require("../models/db.js")
const utils = require("../../utils.js");
const Order = db.orders;




/**
 * Method to get all customer oders
 * @param req
 * @param res
 * @returns {orders} Store
 **/
const getCustomerOrders = async (req, res) => {
  const user = req.user
  const offset = req.query?.offset ?? 0
  const limit = req.query?.limit ?? 50
  delete req.query.offset
  delete req.query.limit
  const orders = await Order.findAndCountAll({
    where: { [Op.or]: [{ user_id: user.id }, { agent_id: user.id }, { customer_id: user.id }], ...req.query },
    limit: parseInt(limit), offset: parseInt(offset),
    order: [['id', 'DESC']]
  })

  if (!orders) {
    return res
      .status(400)
      .send(
        utils.responseError(
          "Agent do not have any order at the moment!!"
        )
      )
  }
  return res.status(201).send(utils.responseSuccess(orders))
};

/**
 * Method to get all customer oders
 * @param req
 * @param res
 * @returns {orders} Store
 **/
const getAdminOrders = async (req, res) => {
  const offset = req.query?.offset ?? 0
  const limit = req.query?.limit ?? 50
  delete req.query.offset
  delete req.query.limit
  const orders = await Order.findAndCountAll({
    where: req.query?.query,
    limit: parseInt(limit), offset: parseInt(offset),
    order: [['id', 'DESC']]
  })
  if (!orders) {
    return res
      .status(400)
      .send(
        utils.responseError(
          []
        )
      )
  }
  return res.status(201).send(utils.responseSuccess(orders))
};

const updateOrder = async (req, res) => {

  const { orderId, status } = { ...req.body }
  const order = await Order.findOne({ where: { order_id: orderId } })

  if (!order) {
    return res
      .status(400)
      .send(
        utils.responseError(
          "No order found for orderId " + orderId
        )
      )
  }

  order.status = status
  order.save()

  return res.status(200).send(utils.responseSuccess(order))

}


module.exports = {
  getCustomerOrders,
  updateOrder,
  getAdminOrders
};
