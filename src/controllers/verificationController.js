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
        // Execute the callback safely — catch any errors coming from downstream
        let response
        try {
            response = await executeCallBack(JSON.parse(record.call_back), req, res, record)
        } catch (cbErr) {
            console.error('Callback execution error:', cbErr)
            // Mark record as used to avoid replay attacks even if callback failed
            try {
                record.used = 1
                await record.save()
            } catch (saveErr) {
                console.error('Failed to mark verification record as used:', saveErr)
            }
            return res.status(500).send(utils.responseError(cbErr.message || 'Callback execution failed'))
        }

        // mark verification as used and respond
        try {
            record.used = 1
            await record.save()
        } catch (saveErr) {
            console.error('Failed to mark verification record as used:', saveErr)
        }

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
    try {
        if (request_details.method == 'loginAfterOtpVerification') {
            delete payload.password
            response = await userController.loginAfterOtpVerification(payload, req, res)
        } else if (request_details.method == 'createUserAfterOtpVerification') {
            response = await userController.createUserAfterOtpVerification(payload, req, res)
        } else {
            response = await userController.resetPasswordAfterOtpVerification(payload, req, res)
        }
        return response
    } catch (err) {
        // Catch any downstream errors (e.g., nodemailer/network) and return structured error
        console.error('executeCallBack caught error:', err)
        throw err
    }
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