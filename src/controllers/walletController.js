const db = require('../models/db.js')
const utils = require("../../utils.js")
const rateController = require('./rateController');
const { rate } = require('../models/db.js');
const nodemailer = require('../mailer/nodemailer')
const validator = require('validator');

const Wallet = db.wallets;
const WalletHistory = db.wallet_history;


/**
 * Method to get wallet summary and history
 * @param req
 * @param res
 * @returns {Wallet} Wallet
 **/
const getWallet = async (req, res) => {
  const user = req.user

  const wallet = await Wallet.findOne({ where: { user_id: user.id } })

  if (!wallet) {
    return res
      .status(400)
      .send(
        utils.responseError(
          "Agent do not have a wallet at the moment! Please create a wallet and try again!!"
        )
      )
  }

  const result = JSON.parse(JSON.stringify(wallet))
  result.histories = await WalletHistory.findAll({ where: { wallet_id: wallet.id }, order: [['id', 'DESC']] })

  return res.status(201).send(utils.responseSuccess(result))
}

/**
 * Method to update wallet history and wallet record
 * - Can approve, decline, refund wallet history
 * @param {*} req 
 * @param {*} res 
 */
const updateWallet = async (req, res) => {

}

/**
 * Method to request payout from an agent
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const payout = async (req, res) => {
  const user = utils.flattenObj(req.user)
  const amount = -Math.abs(Number(req.body.amount))

  const wallet = await Wallet.findOne({ where: { user_id: user.id } })

  if (wallet.ledger_balance + amount < 0) {
    return res.status(400).send(
      utils.responseError("Insufficient balance!!")
    )
  }
  const actualBalance = wallet.actual_balance
  const openingBalance = actualBalance
  const closingBalance = actualBalance + amount

  await createHistory(user.id, wallet.id, amount, "payout", null, 'paid', null, openingBalance, closingBalance)

  wallet.actual_balance = closingBalance
  wallet.ledger_balance = wallet.ledger_balance + amount
  wallet.lifetime_payout += amount
  wallet.lifetime_payout_verified += amount
  wallet.payout_count++
  wallet.payout_count_verified++
  await wallet.save()

  // Send mail 
  const date = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })
  let usersName = user.first_name ? `${user.first_name} ${user.last_name}` : user.email
  const payouAmount = Math.abs(amount).toLocaleString('en-US')
  await nodemailer.sendMail({
    email: 'payout@obana.africa', content: { agent_id: user.agent_id, user: usersName, amount: payouAmount, date: date, acount: user?.account_number, bank: user?.bank_name, currency: user.currency ?? "" },
    subject: `New Payout Request from ${usersName}`, template: 'payOut'
  })

  return res.status(201).send(
    utils.responseSuccess(
      wallet
    )
  )

}

/**
 * Method to create commission after order
 * @param {*} order 
 * @param {*} user 
 */
const createCommision = async (order, user, rate = 1) => {

  if (order) {
    const amount = order.total * rate
    const commision = parseFloat(Number(await rateController.eval('agent-commission', amount)).toFixed(2))
    if (commision > 0) {
      let wallet = await Wallet.findOne({ where: { user_id: user.id } })

      if (!wallet) {
        wallet = await Wallet.create({
          user_id: user.id,
          actual_balance: 0.00,
          ledger_balance: 0.00,
          embedly_availableBalance: 0.00,
          embedly_ledgerBalance: 0.00,
          embedly_wallet_id: null,
          lifetime_sales_value: 0.00,
          lifetime_sales_value_verified: 0.00,
          lifetime_sales_count: 0,
          lifetime_sales_count_verified: 0,
          lifetime_commision: 0.00,
          lifetime_commision_verified: 0.00,
          payout_count: 0,
          payout_count_verified: 0,
          lifetime_payout: 0.00,
          lifetime_payout_verified: 0.00,
          status: "enabled"
        })
      }
      const actual_balance = !isNaN(wallet.actual_balance) ? wallet.actual_balance : 0.0
      const openingBalance = actual_balance
      const closingBalance = (actual_balance + commision)

      await
        createHistory(user_id = user.id, wallet.id, commision, "commission", order?.salesorder_id, 'pending', order?.salesorder_number, openingBalance, closingBalance)
      wallet.actual_balance = closingBalance
      wallet.lifetime_sales_value += amount
      wallet.lifetime_sales_count++
      !isNaN(wallet.lifetime_commision) ? wallet.lifetime_commision += commision : wallet.lifetime_commision = commision
      await wallet.save()
    }
    return commision
  }
}
/**
 * Method to create wallet history record
 * @param {*} user_id 
 * @param {*} wallet_id 
 * @param {*} amount 
 * @param {*} commision 
 * @param {*} order_id 
 * @param {*} status 
 * @param {*} order_number 
 */
const createHistory = async (user_id, wallet_id, amount = 0.00, type = "commision", order_id = null, status = "pending", order_number = null, opening_balance = 0.00, closing_balance = 0.00) => {
  const transaction_id = await generateReference(amount)
  await WalletHistory.create({
    user_id,
    wallet_id,
    amount,
    type,
    transaction_id,
    order_id,
    status,
    order_number,
    opening_balance,
    closing_balance
  })
}


const generateReference = async (amount) => {
  const prefix = amount > 0 ? "CR" : "DR"
  const reference = prefix + "_" + Date.now() + "_" + utils.generateRandomString(5)
  return reference
}
const reverseCommision = async (salesOrderId, initialOrderAmount) => {
  const walletHistory = await WalletHistory.findOne({ where: { order_id: salesOrderId, status: 'pending' } })
  if (!walletHistory || walletHistory.amount < 1) return

  const wallet = await Wallet.findOne({ where: { user_id: walletHistory.user_id } })
  if (!wallet) return
  const amount = -Math.abs(walletHistory.amount)
  const openingBalance = wallet.actual_balance
  const closingBalance = (wallet.actual_balance + amount)
  const reverseRef = 'REV-' + walletHistory.order_id
  createHistory(walletHistory.user_id, wallet.id, amount, "reversal", reverseRef,
    'reversed', walletHistory.order_number, openingBalance, closingBalance)
  walletHistory.status = 'reversed'
  walletHistory.order_id = reverseRef
  await walletHistory.save()

  wallet.actual_balance = closingBalance
  wallet.lifetime_sales_value -= Math.abs(parseFloat(initialOrderAmount))
  wallet.lifetime_sales_count -= 1
  wallet.lifetime_commision -= walletHistory.amount
  return await wallet.save()
}

module.exports = {
  getWallet,
  updateWallet,
  payout,
  createCommision,
  reverseCommision
}
