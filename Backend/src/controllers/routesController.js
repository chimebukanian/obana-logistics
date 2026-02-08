const db = require('../models/db')
const utils = require('../../utils')

const RouteTemplates = db.route_templates

const listTemplates = async (req, res) => {
    const templates = await RouteTemplates.findAll({ order: [['id','ASC']] })
    return res.status(200).send(utils.responseSuccess(templates))
}

const getTemplate = async (req, res) => {
    const id = req.params.id
    const template = await RouteTemplates.findByPk(id)
    if (!template) return res.status(404).send(utils.responseError('Not found'))
    return res.status(200).send(utils.responseSuccess(template))
}

const createTemplate = async (req, res) => {
    const body = req.body
    try {
        const t = await RouteTemplates.create(body)
        return res.status(201).send(utils.responseSuccess(t))
    } catch (err) {
        return res.status(422).send(utils.responseError(err.message))
    }
}

const updateTemplate = async (req, res) => {
    const id = req.params.id
    const body = req.body
    const t = await RouteTemplates.findByPk(id)
    if (!t) return res.status(404).send(utils.responseError('Not found'))
    await t.update(body)
    return res.status(200).send(utils.responseSuccess(t))
}

const deleteTemplate = async (req, res) => {
    const id = req.params.id
    const t = await RouteTemplates.findByPk(id)
    if (!t) return res.status(404).send(utils.responseError('Not found'))
    await t.destroy()
    return res.status(204).send()
}

const matchTemplate = async (req, res) => {
    const { origin_city, destination_city, transport_mode, service_level, weight } = req.body
    if (!origin_city || !destination_city || !transport_mode || !service_level || typeof weight === 'undefined')
        return res.status(400).send(utils.responseError('Missing required parameters'))

    // const templates = await RouteTemplates.findAll({
    //     where: {
    //         origin_city: origin_city,
    //         destination_city: destination_city,
    //         transport_mode: transport_mode,
    //         service_level: service_level
    //     }
    // })
    // rather, the above should normalizze both the db values and the req body values to same letter casing first so comparison can work , implement the fix below:
    const templates = await RouteTemplates.findAll()
    const filteredTemplates = templates.filter(t => 
        t.origin_city.toLowerCase() === origin_city.toLowerCase() &&
        t.destination_city.toLowerCase() === destination_city.toLowerCase() &&
        t.transport_mode.toLowerCase() === transport_mode.toLowerCase() &&
        t.service_level.toLowerCase() === service_level.toLowerCase()
    )
    


    for (const t of filteredTemplates) {
        const brackets = t.weight_brackets || []
        for (const b of brackets) {
            const min = Number(b.min || 0)
            const max = Number(b.max || Number.POSITIVE_INFINITY)
            if (weight >= min && weight <= max) {
                return res.status(200).send(utils.responseSuccess({ template: t, match: b }))
            }
        }
    }

    return res.status(404).send(utils.responseError('No routes available for this shipment'))
}

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    matchTemplate
}
