const { check, validationResult } = require('express-validator')
const db = require('../models/db.js')
const utils = require('../../utils.js')
const userController = require('./userController')
const requestController = require('./requestController')

const Verifications = db.verifications

/**
 * Method to verify OTP
 * @param req
 *   Required 
 *     request_id
 *     otp
 * @param res
 **/
const verifyOTP = async (req, res) => {
    const { otp, request_id } = req.body
    const record = !utils.isStaging() ?
        await Verifications.findOne({ where: { otp, request_id, used: 0 } }) :
        await Verifications.findOne({ where: { request_id, used: 0 } })

    if (!record)
        return res.status(401).send(utils.responseError('Invalide OTP'))
    try {
        const response = await executeCallBack(JSON.parse(record.call_back), req, res, record)
        record.used = 1
        record.save()
        return res.status(200).send(utils.responseSuccess(response))
    } catch (error) {
        return res.status(500).send(utils.responseError(error.message))
    }
}

/**
 * Method to execute verify OTP callback
 * @param request_details
 * TODO: Dynamically execute methods in call_back to allow scalability 
 **/
const executeCallBack = async (request_details, req, res, record) => {
    let response = ""
    delete req.body.request_id
    delete req.body.otp
    const payload = { ...request_details.payload, ...req.body }
    if (request_details.method == 'loginAfterOtpVerification') {
        delete payload.password
        response = await userController.loginAfterOtpVerification(payload, req, res)
    } else if (request_details.method == 'createUserAfterOtpVerification') {
        response = await userController.createUserAfterOtpVerification(payload, req, res)
    } else if (request_details.method === 'withdrawAfterOtpVerification') {
        req.params.tenant = 'embedlyPayout';
req.params.endpoint = 'embedly-bank-transfer';
        payload.return = 1
        req.body.return = 1
        response = await requestController.makeRequest(req, res)
          if (response.statusCode !== 200) {
            throw new Error(response?.data ?? "Somthing went wrong")
        }
    } else {
        response = await userController.resetPasswordAfterOtpVerification(payload, req, res)
    }
    return response
}

const getOtp = async (req, res) => {
    const email = req.query.email
    if (!utils.isStaging || !utils.isEmail(email))
        return res.status(400).send(utils.responseError("Invalid email or environment"))
    let maxId = await db.verifications.max('id', { where: { email: email, used: 0 } })
    otpData = await db.verifications.findOne({ where: { id: maxId, used: 0 } })
    if (otpData)
        return res.send({ 'otp': otpData?.otp })
    else
        return res.send({ 'otp': null })
}

module.exports = {
    verifyOTP,
    getOtp

}