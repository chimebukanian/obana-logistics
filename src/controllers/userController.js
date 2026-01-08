const { Op } = require('sequelize')
const bcrypt = require('bcryptjs')
const uuid = require('uuid')
const jwt = require('jsonwebtoken')
const db = require('../models/db.js')
const utils = require('../../utils.js')
const nodemailer = require('../mailer/nodemailer')
const requestController = require('./requestController.js')


const User = db.users
const Verifications = db.verifications
const Tokens = db.tokens
const Attribute = db.attributes
const UserAttribute = db.user_attributes
const Cart = db.carts
const Roles = db.roles
const Scopes = db.scopes
const RoleScopes = db.role_scopes

/**
 * Method to request user creation
 * @param req
 *   Required 
 *     email: string
 *     phone: string
 *     password: string
 *   Optional
 *     attributes: object
 * @param res 
 **/
const createUserRequest = async (req, res) => {
    req.body.email = req.body.email.toLowerCase()

    const user = await getUser(req.body.email, req.body.phone)

    if (user) {
        return res.status(401).send(
            utils.responseError('Email or Phone number already registered')
        )
    }

    createVerificationRequest(req.body, res, 'createUserAfterOtpVerification')

}

/**
 * Method to complete user creation request
 * @param payload
 *   Required 
 *     email: string
 *     phone: string
 *     password: string
 *   Optional
 *     attributes: object
 * @returns {User} User
 **/
const createUserAfterOtpVerification = async (payload, req, res) => {
    let user = await getUser(payload.email, payload.phone)

    if (user) {
        throw new Error('Email or Phone number already registered')
    }

    const attributes = payload.attributes
    delete payload.attributes
    user = await User.create(payload)
    payload = utils.flattenObj(Object.assign(payload, attributes))
    
    const name = payload?.first_name ?? null
    const last_name = payload?.last_name ?? null

    

    if (!attributes?.account_types) attributes.account_types = 'agent'

    if (attributes?.account_types && attributes?.account_types == 'agent') {

        req.body = {
            data: [{
                "Name": name, "Last_Name": last_name, "category_of_interest": payload.category_of_interest, "brand_of_interest": payload.brand_of_interest, "dob": payload.dob, "Email": payload.email, "company_name": payload.company_name, "Phone_Number": payload.phone,
                "Country": payload.country,
                "State1": payload.state, "City": payload?.city
            }], "return": 1
        }
        req.params = { tenant: 'crm', endpoint: 'sales-person' }
        attributes.agent_id = generateAgentId(user.id)
        if (name && last_name) {
            const salesPersonData = name ? (await requestController.makeRequest(req, res)).data : null
            
            if (salesPersonData) attributes.sales_person_id = formatSalesPersonResponse(salesPersonData)
        }
    }

       req.body = {
            
                "first_name": name, "last_name": last_name, "contact_name": name, "Category of Interest": payload.category_of_interest, "Brand of Interest":payload.brand_of_interest, "D_O_B": payload.dob,  "Email": payload.email, "company_name":payload.company_name, "Phone_Number": payload.phone,
                "country": payload.country,
                "state": payload.state, "city": payload?.city,
             "return": 1
        }
        req.params = { tenant: 'zoho', endpoint: 'customer' }
        
            const contactData = name ? await requestController.makeRequest(req, res) : null
            console.log("contactDataaa", contactData)

    if (attributes?.account_types.split(',').some(item => ['agent', 'individual'].includes(item))) {
        req.body = payload?.account_types == 'agent' ? {
            "contact_type": "customer", "customer_sub_type": "individual",
            "first_name": payload.first_name, "last_name": last_name,
            "email": payload.email, "phone": payload.phone,
            "address": payload?.city, "country": payload.country,
            "city": payload?.city, "state": payload.state
        } : payload
        req.query.sales_person_id = payload?.lead
        req.body.return = 1
        req.params = { tenant: 'zoho', endpoint: 'customer' }

        if (payload.first_name) {
            const zohoAccountData = await requestController.makeRequest(req, res)
            if (zohoAccountData.hasOwnProperty('data') && zohoAccountData.data.hasOwnProperty('zoho_id')) {
                attributes.zoho_id = zohoAccountData.data.zoho_id
            } else {
                attributes.zoho_id = zohoAccountData.contact?.contact_id
            }
        }
    }
    await createUserAttributes(user.id, attributes)
    user = JSON.parse(JSON.stringify(user))
    attributes ? user.attributes = attributes : ""
    delete user.password
    return createAuthDetail(user)
}

/**
 * Method to create all the users attributes supplied
 * @param {*} user_id 
 * @param {*} attributes 
 * @param {*} parent_id - 
 */
const createUserAttributes = async (user_id, attributes, parent_id = null) => {
    for (let slug in attributes) {
        let theAttribute = await Attribute.findOne({ where: { slug } });
        if (!theAttribute) {
            const name = slug.replaceAll("_", " ");
            theAttribute = await Attribute.create({ name, slug });
        }

        let userAttribute = await UserAttribute.findOne({
            where: {
                user_id,
                attribute_id: theAttribute.id,
            },
        });
        if (!userAttribute) {
            userAttribute = await UserAttribute.create({
                user_id,
                attribute_id: theAttribute.id,
            });
        }

        const value = attributes[slug];
        if (typeof value === "object" && value !== null) {
            if (Array.isArray(value)) {
                userAttribute.value = JSON.stringify(value);
                if (parent_id) userAttribute.parent_id = parent_id;
                await userAttribute.save();
            } else {
                await createUserAttributes(user_id, value, theAttribute.id);
            }
        } else {
            userAttribute.value = value;
            if (parent_id) userAttribute.parent_id = parent_id;
            await userAttribute.save();
        }
    }
}

/**
 * Method to request user password reset
 * @param req
 *   Required 
 *     user_identification: string (email or phone number of the user)
 * @param res 
 **/
const resetPasswordRequest = async (req, res) => {
    req.body.user_identification = req.body?.user_identification.toLowerCase()
    const user = await getUser(req.body.user_identification, req.body.user_identification, true)

    if (!user) {
        return res.status(401).send(
            utils.responseError('User not found. Check your user_identification and try again')
        )
    }

    if (req.body.platform && !utils.flattenObj(user)?.account_types.split(',').includes(req.body.platform))
        return res.status(401).send(utils.responseError('User not found. Check your user_identification and try again'))

    req.body.email = user.email
    req.body.phone = user.phone

    createVerificationRequest(req.body, res, 'resetPasswordAfterOtpVerification')

}

/**
 * Method to complete reset password request
 * @param payload
 *   Required 
 *     email: string
 *     phone: string
 *     password: string
 **/
const resetPasswordAfterOtpVerification = async (payload, req, res) => {
    let user = await getUser(payload.email, payload.phone)
    if (!user)
        return res.status(401).send(utils.responseError('User Not Found'))

    user.password = await hashPassword(payload.password)
    user.save()

    user = await getUser(payload.email, payload.phone, true)
    user = JSON.parse(JSON.stringify(user))
    delete user.password

    return createAuthDetail(user)
}

const resetPassword = async (req, res) => {
    let user = req.user
    try {
        const response = await resetPasswordAfterOtpVerification(Object.assign({ email: user.email, phone: user.phone }, req.body), req, res)
        return res.status(200).send(utils.responseSuccess(response))
    } catch (error) {
        res.status().send(utils.responseError(error.message))
    }
}

/*
 Method for withdraw
  * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const withdrawRequest = async (req, res) => {
    createVerificationRequest(req.body, res, 'withdrawAfterOtpVerification')

}

/**
 * Method to request user login
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const loginRequest = async (req, res) => {
    req.body.user_identification = req.body.user_identification.toLowerCase()
    const user = await getUser(req.body.user_identification, req.body.user_identification)

    if (!user) {
        return res.status(401).send(
            utils.responseError('User not found. Check your user_identification and try again')
        )
    }

    const attribute = await getUserAttributes(user.id)
    const attributes = utils.flattenObj(attribute)
    let check = attributes.hasOwnProperty('account_types') ?
        attributes.account_types.split(',').includes(req.body.platform) : null
    if (!check && req.body?.platform)
        return res.status(401).send(
            utils.responseError('You do not have access to this platform')
        )

    bcrypt.compare(req.body.password, user.password, (error, isMatch) => {
        if (isMatch) {
            delete req.body.password
            createVerificationRequest(req.body, res, 'loginAfterOtpVerification')
        } else {
            return res.status(401).send(
                utils.responseError('Wrong password. Check your password and try again')
            )
        }
    })
}

/**
 * Method to login user after OTP validation
 * @param {*} payload 
 * @returns 
 */
const loginAfterOtpVerification = async (payload, req, res) => {
    const user = await getUser(payload.user_identification, payload.user_identification, true, req, res)
    const rememberMe = payload.hasOwnProperty('remember_me') ? payload.remember_me : false
    return createAuthDetail(user, rememberMe)
}

/**
 * Method to refresh users access token
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const token = async (req, res) => {
    const refresh_token = req.body.refresh_token
    if (!refresh_token) {
        return res.status(401).send(
            utils.responseError('Aunthentication failed')
        )
    }
    const found = await Tokens.findOne({ where: { refresh_token } })
    if (!found) {
        return res.status(403).send(
            utils.responseError('Access Denied')
        )
    }
    jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET, async (error, user) => {
        if (error) {
            return res.status(403).send(
                utils.responseError('Access Denied')
            )
        }
        user = await getUser(user.email, user.phone, true, req, res)
        access_token = generateToken(user)
        res.status(201).send(
            utils.responseSuccess({ access_token })
        )
    })
}

/**
 * Method to update users profile
 * @param {*} req 
 * @param {*} res 
 */
const updateProfile = async (req, res) => {
    const attributes = req.body
    let user = req.user
    await createUserAttributes(user.id, attributes)

    user = await getUser(user.email, user.phone, true, req, res)
    const payload = utils.flattenObj(user)

    req.body = payload
    req.body.return = 1
    req.params = { tenant: 'zoho', endpoint: 'update-customer' }
    req.query.contact_id = user.attributes.zoho_id
    if (
        req.body.category_of_interest &&
        Array.isArray(req.body.category_of_interest)
    ) {
        req.body.category_of_interest = req.body.category_of_interest
            .map((item) => item.value)
            .join(",");
    }
    if (
        req.body.brand_of_interest &&
        Array.isArray(req.body.brand_of_interest)
    ) {
        req.body.brand_of_interest = req.body.brand_of_interest
            .map((item) => item.value)
            .join(",");
    }

    if (user.attributes.zoho_id)
        await requestController.makeRequest(req, res)

    if (payload?.account_types && ['agent'].includes(payload?.account_types)) {
        await updaeteSalesPerson(payload, req, res)

        if (payload?.bank_name && payload?.account_name)
            await updateSalesPersonPerymentInfo(payload, req, res)
    }
    let userAuth = await createAuthDetail(user, true)
    return res.status(203).send(
        utils.responseSuccess(userAuth)
    )
}

/**
 * Method to logout user
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const logout = async (req, res) => {
    const refresh_token = req.body.refresh_token
    if (!refresh_token) {
        return res.status(403).send(
            utils.responseError('Refresh Token is not present')
        )
    }
    const found = await Tokens.findOne({ where: { refresh_token } })
    if (!found) {
        return res.status(403).send(
            utils.responseError('Access Denied')
        )
    }
    Tokens.destroy({ where: { refresh_token } })
    return res.status(204).send(
        utils.responseSuccess('You have been logged out successfully')
    )
}

/**
 * Method to get specific user by email or phone number
 * @param email -Optional
 * @param phone -Optional
 * @returns {User} User
 **/
const getUser = async (email = null, phone = null, withAttr = false, req = null, res = null, user_id = null) => {
    const criteria = [];
    if (email)
        criteria.push({ email: email })
    if (phone)
        criteria.push({ phone: phone })
    if (user_id)
        criteria.push({ id: user_id })
    if (criteria.length === 0)
        return false
    let user = await User.findOne({ where: { [Op.or]: criteria } })
    if (!user) return null
    if (withAttr) {
        user = JSON.parse(JSON.stringify(user))
        delete user.password
        user.attributes = await getUserAttributes(user.id)
        const attributes = utils.flattenObj(user.attributes)
        if (!attributes.hasOwnProperty('account_types')) {
            user.attributes.account_types = 'agent'
            await createUserAttributes(user.id, { account_types: user.attributes.account_types })
        }
        if (attributes.account_types.split(',').includes('agent')) {
            if (!attributes.hasOwnProperty('agent_id')) {
                user.attributes.agent_id = generateAgentId(user.id)
                await createUserAttributes(user.id, { agent_id: user.attributes.agent_id })
            }
            if (!attributes?.sales_person_id && req) {
                let sales_person_id = await createZohoSalesPerson(user, req, res)

                if (sales_person_id) user.attributes.sales_person_id = sales_person_id
                if (sales_person_id) await createUserAttributes(user.id, { sales_person_id: sales_person_id })
            }
        }
        if (attributes.account_types.split(',').some(item => ['individual', 'agent'].includes(item)) && !attributes?.zoho_id) {
            let zoho_id = attributes?.first_name && attributes?.last_name ? await createIndividualOnZoho(user, req, res) : null
            if (zoho_id) user.attributes.zoho_id = zoho_id
            if (zoho_id) await createUserAttributes(user.id, { zoho_id: zoho_id })
        }
        if (user.attributes.hasOwnProperty('role_id')) {
            const scopeDetails = await getRolesAndScopes(user.attributes.role_id)
            const formatedScope = scopeDetails.map(items => {
                let role = items.role
                let scope = items.scope.map(item => item.name)
                return { role, scope: scope }
            })
            user.permission = formatedScope[0]
        }
    }
    return user
}

const createZohoSalesPerson = async (user, req, res) => {
    let name = user.attributes?.first_name ?? user.attributes?.user_information?.first_name
    let city = user.attributes?.city ?? user.attributes?.partner_information?.lga
    req.body = {
        data: [{
            "Name": name,
            "Last_Name": user.attributes?.last_name ?? user.attributes?.user_information?.last_name,
            "Email": user.email, "Phone_number": user.phone, "City": city,
            "Country": user.attributes?.country ?? user.attributes?.partner_information?.country,
            "State1": user.attributes?.state ?? user.attributes.partner_information?.state
        }], "return": 1
    }
    req.params = { tenant: 'crm', endpoint: 'sales-person' }

    const salesPersonData = name ? (await requestController.makeRequest(req, res))?.data : null
    const sales_person_id = salesPersonData ? formatSalesPersonResponse(salesPersonData) : null
    if (sales_person_id) {
        await createUserAttributes(user.id, { sales_person_id: sales_person_id })
    }
    return sales_person_id
}

const createIndividualOnZoho = async (user, req, res) => {
    const attributes = utils.flattenObj(user)
    const addressFields = [
        attributes.address || '',
        attributes.city || '',
        attributes.state || '',
        attributes.country || ''
    ].filter(field => field).join(', ');
    if (!req) return null
    req.body = {
        "salutation": attributes.salutation ?? "", "first_name": attributes?.first_name,
        "last_name": attributes?.last_name, "email": attributes?.email, "phone": attributes?.phone ?? "",
        'billing_address': attributes?.billing_address ?? "", "billing_city": attributes?.billing_city ?? "",
        "billing_country": attributes?.billing_country ?? "", "billing_state": attributes?.billing_state ?? "",
        "address": attributes?.address ?? "", "country": attributes?.country ?? "",
        "city": attributes?.city ?? "", "state": attributes?.state ?? "", "custom_field_hash.cf_product_category": attributes?.category_of_interest ?? "",
        "custom_field_hash.cf_brand_of_interest": attributes?.brand_of_interest ?? "", "custom_field_hash.cf_contact_person": addressFields,
        return: 1
    }
    if (Array.isArray(attributes?.category_of_interest)) {
        req.body["custom_field_hash.cf_product_category"] =
            attributes.category_of_interest
                .map((item) => item.value ?? item)
                .join(",");
    }
    if (Array.isArray(attributes?.brand_of_interest)) {
        req.body["custom_field_hash.cf_brand_of_interest"] =
            attributes.brand_of_interest
                .map((item) => item.value ?? item)
                .join(",");
    }

    req.params = { tenant: 'zoho', endpoint: 'customer' }
    try {
        let contactData = await requestController.makeRequest(req, res)
        const zohoContactId = contactData.hasOwnProperty('data') ? contactData.data.zoho_id : contactData.contact?.contact_id
        if (zohoContactId) {
            await createUserAttributes(user.id, { zoho_id: zohoContactId })
        }
        return zohoContactId ?? null
    } catch (error) {
        return error
    }
}




/**
 * Method to get specific user by id
 * @param id 
 * @returns {User} User
 **/
const getUserById = async (id) => {
    let user = await User.findOne({ where: { id } })

    if (user) {
        user = JSON.parse(JSON.stringify(user))
        delete user.password
        user.attributes = await getUserAttributes(user.id)
    }

    return user
}

/**
 * Method to get user's attribute
 * @param {*} id 
 * @returns 
 */
const getUserAttributes = async (id) => {
    const visited = {}
    const result = {}
    const attributes = await UserAttribute.findAll({ where: { user_id: id } })
    for (let attribute of attributes) {
        const theAttribute = await Attribute.findOne({ where: { id: attribute.attribute_id } })
        if (!theAttribute) continue

        let val = attribute.value;
        if (
            val &&
            typeof val === "string" &&
            (val.startsWith("[") || val.startsWith("{"))
        ) {
            try {
                val = JSON.parse(val);
            } catch (e) {
                // Fallback to original if not valid JSON
            }
        }
        if (attribute.parent_id) {
            let parentKey = null;
            if (attribute.parent_id in visited) {
                parentKey = visited[attribute.parent_id]
            } else {
                const parentAttribute = await Attribute.findOne({ where: { id: attribute.parent_id } })
                parentKey = parentAttribute.slug
                visited[attribute.parent_id] = parentKey;
            }
            if (!(result.hasOwnProperty(parentKey) && result[parentKey])) result[parentKey] = {}
            result[parentKey][theAttribute.slug] = attribute.value
        } else {
            if (!result.hasOwnProperty(theAttribute.slug))
                result[theAttribute.slug] = attribute.value
        }
    }
    return result
}

/**
 * Method to create verification request and send details to user
 * @param body
 *   Required 
 *     email: string
 *     phone: string
 * @param res - Optional; used in sending back response to user when available
 * TODO 
 *  Implement notification service
 *  Send OTP to email and/or phone
 *  Remove OTP from response
 * @returns {*} otp
*/
const createVerificationRequest = async (body, res = null, callback = null) => {
    const data = await prepareVerificationData(body, callback)
    try {
        const verification = await Verifications.create(data)
        nodemailer.sendMail({ email: data.email, content: { otp: 'OTP: ' + data.otp, user: data.email }, subject: 'One Time Password', template: 'otp' })
        if (res) {
            return res.status(200).send(
                utils.responseSuccess({ request_id: verification.request_id })
            )
        }
        return verification.otp
    } catch (error) {
        return res.status(422).send(utils.responseError(error.message))
    }
}

/**
 * Method to prepare verification data
 * @param body: object
 *    Requird:
 *      email: string
 *      phone: string
 * @param callback - The method to be called after verification is done (Optional)
 **/
const prepareVerificationData = async (body, callback = null) => {

    if (body.hasOwnProperty('password'))
        body.password = await hashPassword(body.password)

    if (body.hasOwnProperty('user_identification')) {
        const user = await getUser(body.user_identification, body.user_identification)
        body.email = user.email
        body.phone = user.phone
    }

    return {
        request_id: uuid.v4(),
        otp: generateOTP(),
        email: body.email,
        phone: body.phone,
        used: 0,
        call_back: JSON.stringify({
            method: callback,
            payload: {
                ...body
            }
        })
    }
}

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10)
}


/**
 * Method to generate OTP
 * @param length -Optional
 * @return OTP
 **/
const generateOTP = (length = 4) => {
    var digits = '0123456789'
    let OTP = ''
    for (let i = 0; i < length; i++) {
        OTP += digits[Math.floor(Math.random() * 10)]
    }
    return OTP
}

/**
 * Method to generate JWT
 * @param {*} user 
 */
const generateToken = (user, refresh = false, expiresIn = false) => {
    const secret = refresh ? process.env.REFRESH_TOKEN_SECRET
        : process.env.ACCESS_TOKEN_SECRET
    expiresIn = expiresIn ? expiresIn : process.env.ACCESS_TOKEN_SECRET_EXPIRES_IN
    return jwt.sign(
        user,
        secret,
        { expiresIn: expiresIn }
    )
}

const generateAgentId = (id) => {
    let prefix = ''
    const length = 11 - id.toString().length
    for (let i = 0; i < length; i++) {
        prefix += '0'
    }
    return 'OB-' + prefix + id
}

/**
 * Method to create authentication details for a given user
 * @param {*} user 
 * @returns 
 */
const createAuthDetail = async (user, rememberMe = false) => {
    const access_token = generateToken(user)
    const expiresIn = rememberMe ? process.env.REFRESH_TOKEN_SECRET_REMEMBER_ME
        : process.env.REFRESH_TOKEN_SECRET_EXPIRES_IN
    const refresh_token = generateToken(user, true, expiresIn)
    Tokens.create({ refresh_token })
    const active_quote = await Cart.findOne({ where: { user_id: user.id } })
    const active_quote_id = active_quote ? active_quote.qoute_id : null;
    return { user, active_quote_id, access_token, refresh_token }
}

const createRole = async (req, res) => {
    let role = await Roles.findAll({ where: req.body })
    if (role.length > 0)
        return res.status(401).send(
            utils.responseError('Role already available')
        )
    role = await Roles.create(req.body)
    return res.status(201).send(
        utils.responseSuccess(role))
}

const asignRole = async (req, res) => {
    if (!req.body?.user_id || !req.body?.role_id) return res.status(401).send(
        utils.responseError('Provide user_id and role_id')
    )
    const user = await User.findOne({ where: { id: req.body?.user_id } })
    if (!user)
        return res.status(501).send(utils.responseError('Invalid user_id'))
    const attribute = await getUserAttributes(user.id)
    if (attribute.role_id == req.body.role_id)
        return res.status(501).send(
            utils.responseError(`User is already has same role`))
    const role = await db.roles.findOne({ where: { id: req.body?.role_id } })
    if (!role)
        return res.status(401).send(
            utils.responseError('Invalid role_id'))
    const createdAtt = await createUserAttributes(user.id, { role_id: req.body?.role_id, role: role.role })
    return res.status(201).send(utils.responseSuccess(createdAtt))
}

const unasignRole = async (req, res) => {
    if (!Array.isArray(req.body?.userIds)) return res.status(201).send(utils.responseError("Provide array of userIds {userIds:[ user_id]}"))
    for (let user of req?.body?.userIds) {
        await deleteUserAtribute("role_id", user)
    }
    return res.status(201).send(
        utils.responseSuccess())
}


const createScope = async (req, res) => {
    try {
        let scope = await Scopes.findAll({ where: req.body })
        if (scope.length > 0)
            return res.status(401).send(
                utils.responseError('Scope already available')
            )
        scope = await Scopes.create(req.body)
        const role = await Roles.findOne({ where: { role: "super admin" } })
        const createdScope = await scope.addRoles(role, { through: { selfGranted: false } })
        return res.status(201).send(
            utils.responseSuccess(createdScope))
    } catch (error) {
        return res.status(501).send(
            utils.responseError(error))
    }
}

const asignScope = async (req, res) => {
    const { scope_ids, role_id } = req.body
    try {
        for (let scope_id of scope_ids) {
            let check = RoleScopes.findOne({ where: { scope_id, role_id } })
            if (!check)
                await RoleScopes.create({ selfGranted: 0, scope_id, role_id })
        }
        const role = await getRolesAndScopes(role_id)
        return res.status(201).send(
            utils.responseSuccess(role))
    } catch (error) {
        return res.status(501).send(
            utils.responseError(error.name))
    }
}

const unasignScopes = async (req, res) => {
    const { scope_ids, role_id } = req.body
    for (let scope_id of scope_ids) {
        await RoleScopes.destroy({ where: { scope_id, role_id } })
    }
    return res.status(201).send(
        utils.responseSuccess())
}

const asignAccountType = async (req, res) => {
    if (!req.body?.user_id || !req.body?.account_types) return res.status(401).send(
        utils.responseError('Provide user_id and account_types')
    )
    const user = await User.findOne({ where: req.body?.user_id })
    if (!user)
        return res.status(501).send(
            utils.responseError('Invalid user_id'))
    let attribute = await getUserAttributes(user.id)
    let accountTypes = attribute.account_types ? attribute.account_types.split(',') : req.body.account_types.split(',')
    if (accountTypes.includes(req.body.account_types))
        return res.status(501).send(utils.responseError(`User is already ${req.body.account_types}`))

    const attributeCreated = await createUserAttributes(user.id, { account_types: (accountTypes.concat([req.body.account_types])).toString() })
    return res.status(201).send(
        utils.responseSuccess(attributeCreated))
}


const getRoles = async (req, res) => {
    try {
        const role_id = req?.query?.role_id
        const items = await getRolesAndScopes(role_id)
        return res.status(201).send(
            utils.responseSuccess(items))
    } catch (error) {
        return res.status(501).send(
            utils.responseError(error))
    }
}
const getScope = async (req, res) => {
    try {
        const scopes = await Scopes.findAll()
        const forScope = scopes.map(scope => {
            return { id: scope.id, scope: scope.scopes }
        })
        return res.status(201).send(
            utils.responseSuccess(forScope))
    } catch (error) {
        return res.status(501).send(
            utils.responseError(error))
    }
}

const getUsersList = async (req, res) => {
    const createat = process.env.DB_DIALECT == 'mysql' ? 'u.createdAt' : 'u."createdAt"'
    const updateat = process.env.DB_DIALECT == 'mysql' ? 'u.updatedAt' : 'u."updatedAt"'
    const sql = `SELECT u.id, u.email, u.phone, ${createat}, ${updateat}, a.slug, a.name, ua.value  FROM users u
                JOIN user_attributes ua ON  u.id = ua.user_id JOIN attributes a ON  ua.attribute_id = a.id`
    const qurRe = (await db.sequelize.query(sql))[0]
    let newArr = {}
    for (let data of qurRe) {
        let itExist = newArr[data?.email]
        if (itExist) {
            newArr[data.email] = Object.assign(newArr[data.email], { [data.slug]: data.value })
        } else {
            let tempValue = Object.assign(data, { [data.slug]: data.value })
            delete tempValue.slug
            delete tempValue.value
            newArr[data.email] = tempValue
        }
    }
    res.status(201).send(Object.values(newArr))
}

const getRolesAndScopes = async (role_id) => {
    let condition = role_id ? { where: { id: role_id }, include: { model: Scopes } } : { include: { model: Scopes } }
    const roles = await Roles.findAll(condition)
    let items = []
    for (let role of roles) {
        const name = role.role
        const id = role.id
        const scope = role.scopes.map(scope => {
            return { id: scope.id, name: scope.scopes }
        })
        items.push({ role_id: id, role: name, scope })
    }
    return items
}

const addAdminUser = async (req, res) => {
    const tempPassword = utils.temPassword()
    req.body.password = await hashPassword(tempPassword)

    const payload = req.body
    if (!req.body.attributes && req.body.attributes.account_types !== "admin")
        return res.status(201).send(utils.responseError('Only admin account type is permited'))
    const subject = "Welcome to Obana! Your Salesforce Account i"
    const userCreated = await createUserAfterOtpVerification(payload, req, res)
    if (userCreated?.id) {
        await nodemailer.sendMail({
            email: payload.email, content:
                { user: payload.email, email: payload.email, password: tempPassword, url: payload.callback_url ?? "" },
            subject: subject, template: 'addAdmin'
        })
        if (res) res.status(201).send(utils.responseSuccess(userCreated.id))
    } else {
        // return res.status(422).send(utils.responseError())
    }
}

const formatSalesPersonResponse = (data) => {
    let salesPersonId = null
    if (!Array.isArray(data)) return null
    for (let rec of data) {
        if (rec.hasOwnProperty('code') && rec.code == "DUPLICATE_DATA")
            salesPersonId = rec?.details?.id
        else salesPersonId = rec.details.id
    }
    return salesPersonId
}
const deleteUserAtribute = async (slug, user_id) => {
    const roleAtribute = await Attribute.findOne({ where: { slug: slug } })
    await UserAttribute.destroy({ where: { user_id: user_id, attribute_id: roleAtribute.id } })
}

const updateSalesPersonPerymentInfo = async (payload, req, res) => {
    req.body = {
        "data": [
            {
                "Bank_Details": [{
                    "Bank_Name": payload?.bank_name ?? "", "Account_Name": payload?.account_name ?? "",
                    "Account_Numver": payload?.account_number ?? "", "BVN": payload?.bvn ?? ""
                }], "id": payload.sales_person_id
            }
        ], "return": 1
    }
    req.params = { 'tenant': 'crm', 'endpoint': 'update-salesperson' }
    req.query = { 'sales_person_id': payload.sales_person_id }
    if (payload.bank_name && payload.account_name) {
        const respomse = await requestController.makeRequest(req, res)
    }
}

const updaeteSalesPerson = async (payload, req, res) => {
    req.body = {
        "data": [{
            "Name": payload.first_name + " " + payload.last_name,
            "Last_Name": payload.last_name, "Email": payload.email, "Phone_number": payload.phone,
            "Country": payload?.country ?? "", "State1": payload?.state ?? "", "City": payload?.city ?? "",

        }], return: 1
    }
    req.params = { 'tenant': 'crm', 'endpoint': 'update-salesperson' }
    req.query = { 'sales_person_id': payload.sales_person_id }
    if (payload.first_name && payload.last_name) {
        const respomse = await requestController.makeRequest(req, res)

    }
}

module.exports = {
    createUserAfterOtpVerification,
    resetPasswordAfterOtpVerification,
    loginAfterOtpVerification,
    resetPasswordRequest,
    createUserRequest,
    loginRequest,
    getUser,
    token,
    updateProfile,
    getUserById,
    logout,
    createUserAttributes,
    getUserAttributes,
    createRole,
    createScope,
    asignScope,
    getRoles,
    getScope,
    asignRole,
    getUsersList,
    asignAccountType,
    addAdminUser,
    unasignScopes,
    unasignRole,
    resetPassword,
    createAuthDetail,
    withdrawRequest
}

