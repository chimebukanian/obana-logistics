const nodemailer = require('../mailer/nodemailer.js')
const utils = require('../../utils.js')


/**
 * Method to request user creation
 * @param req
 *   Required 
 *     email: string
 *     contents: string
 *     subject: string
 *     template: string
 * @param res 
 **/
const sendMail = async (req, res) => {
    try {
        const { contents, email, subject, template } = req.body
        await nodemailer.sendMail({ email, contents, subject, template })
        return res.status(200).send(utils.responseSuccess('Mail sent.'))
    } catch (e) {
        return res.status(400).send(utils.responseError(e.message))
    }
}

module.exports = {
    sendMail
}