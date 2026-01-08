/**
 * Create rate agent-commission rate if not exists
 * TODO - Move this to seeder / migration
 */
const db = require('../models/db.js')
const createDefaultAgentCommisionRate = async () => {
    const rate = db.rate
    const agentCommision = await rate.findOne({ where: { slug: "agent-commission" } })
    if (!agentCommision) {
        rate.create(
            {
                name: 'Agent Commission',
                slug: 'agent-commission',
                type: 'percent',
                value: 3,
                start_date: new Date(),
                end_date: null,
                status: 'enabled',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        )
    }
}

module.exports = {
    createDefaultAgentCommisionRate,
}