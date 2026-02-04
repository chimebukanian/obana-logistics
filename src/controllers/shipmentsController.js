const { Op } = require('sequelize');
const crypto = require('crypto');
const db = require('../models/db');
const nodemailer = require('../mailer/nodemailer'); // hypothetical email module
// Helper functions (not using 'this')
const validateShipmentPayload = (payload) => {
    const errors = [];

    if (!payload.pickup_address) {
        errors.push('pickup_address is required');
    } else {
        const addr = payload.pickup_address;
        if (!addr.line1) errors.push('pickup_address.line1 is required');
        if (!addr.city) errors.push('pickup_address.city is required');
        if (!addr.state) errors.push('pickup_address.state is required');
        if (!addr.country) errors.push('pickup_address.country is required');
        if (!addr.phone) errors.push('pickup_address.phone is required');
    }

    if (!payload.delivery_address) {
        errors.push('delivery_address is required');
    } else {
        const addr = payload.delivery_address;
        if (!addr.line1) errors.push('delivery_address.line1 is required');
        if (!addr.city) errors.push('delivery_address.city is required');
        if (!addr.state) errors.push('delivery_address.state is required');
        if (!addr.country) errors.push('delivery_address.country is required');
        if (!addr.phone) errors.push('delivery_address.phone is required');
    }
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
        errors.push('items array is required with at least one item');
    }
    if (!payload.transport_mode) {
        errors.push('transport_mode is required (road, air, or sea)');
    } else if (!['road', 'air', 'sea'].includes(payload.transport_mode)) {
        errors.push('transport_mode must be one of: road, air, sea');
    }
    if (!payload.service_level) {
        errors.push('service_level is required (Express, Standard, or Economy)');
    } else if (!['Express', 'Standard', 'Economy'].includes(payload.service_level)) {
        errors.push('service_level must be one of: Express, Standard, Economy');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

const generateShipmentReference = (isInternal = true) => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    const prefix = isInternal ? 'OBANA' : 'EXT';
    return `${prefix}-${dateStr}-${random}`;
};

const calculateShipmentTotals = (items) => {
    let totalWeight = 0;
    let totalValue = 0;
    let itemCount = 0;

    if (items && Array.isArray(items)) {
        items.forEach(item => {
            const weight = parseFloat(item.weight) || 0;
            const value = parseFloat(item.total_price) || parseFloat(item.value) || parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 1;
            
            totalWeight += weight * quantity;
            totalValue += value;
            itemCount += quantity;
        });
    }

    return { totalWeight, totalValue, itemCount };
};

const getVehicleTypesForTransportMode = (transportMode) => {
    // Map transport modes to vehicle types
    const modeToVehicles = {
        'road': ['car', 'van', 'truck', 'bike'],
        'air': ['car', 'van'],  // Air requires vehicles to go to airport
        'sea': ['van', 'truck']  // Sea requires larger vehicles for port delivery
    };
    
    return modeToVehicles[transportMode] || ['car', 'bike', 'van', 'truck'];
};

const triggerPostCreationProcesses = async (shipmentId, isInternal) => {
    setImmediate(async () => {
        try {
            // 1. Send confirmation email/SMS
            await sendShipmentConfirmation(shipmentId);
            
            // 2. Notify drivers if internal shipment
            if (isInternal) {
                await notifyPickupTeam(shipmentId);
            }
            
            // 3. Update order status if linked
            await updateOrderStatus(shipmentId);
            
        } catch (error) {
            console.error('Error in post-creation processes:', error);
            // Log but don't fail the main request
        }
    });
};

const sendShipmentConfirmation = async (shipmentId) => {
    try {
        const shipment = await db.shippings.findByPk(shipmentId, {
            include: [
                { model: db.addresses, as: 'delivery_address' }
            ]
        });
        
        if (shipment && shipment.delivery_address?.contact_email) {
            console.log(`[NOTIFICATION] Sending confirmation email to ${shipment.delivery_address.contact_email} for shipment ${shipment.shipment_reference}`);
            // TODO: Implement email service
        }
    } catch (error) {
        console.error('Error sending confirmation:', error);
    }
};

const notifyPickupTeam = async (shipmentId) => {
    try {
        const shipment = await db.shippings.findByPk(shipmentId, {
            include: [
                { model: db.addresses, as: 'pickup_address' }
            ]
        });
        
        if (shipment && shipment.carrier_type === 'internal') {
            console.log(`[DRIVER NOTIFICATION] New internal shipment ${shipment.shipment_reference} needs pickup from ${shipment.pickup_address?.line1}`);
            // TODO: Notify drivers via push notification or SMS
        }
    } catch (error) {
        console.error('Error notifying pickup team:', error);
    }
};

const updateOrderStatus = async (shipmentId) => {
    try {
        // This would update your orders table if you have one
        // For now, just log
        console.log(`[ORDER SYNC] Would update order status for shipment ${shipmentId}`);
    } catch (error) {
        console.error('Error updating order status:', error);
    }
};
/**
 * Send email notification for new internal shipment
 */
const sendNewShipmentEmail = async (shipment, deliveryAddress, pickupAddress) => {
    try {
        
        const emailData = {
            shipment_reference: shipment.shipment_reference,
            order_reference: shipment.order_reference,
            customer_name: deliveryAddress.name || 'Customer',
            vendor_name: shipment.vendor_name,
            total_items: shipment.total_items,
            total_weight: shipment.total_weight,
            product_value: shipment.product_value,
            shipping_fee: shipment.shipping_fee,
            currency: shipment.currency,
            pickup_contact_name: pickupAddress.name || 'Vendor',
            pickup_address_line: `${pickupAddress.line1}${pickupAddress.line2 ? ', ' + pickupAddress.line2 : ''}`,
            pickup_city: pickupAddress.city,
            pickup_state: pickupAddress.state,
            pickup_country: pickupAddress.country,
            pickup_phone: pickupAddress.phone,
            pickup_instructions: pickupAddress.instructions || '',
            
            
            delivery_contact_name: deliveryAddress.name || 'Customer',
            delivery_address_line: `${deliveryAddress.line1}${deliveryAddress.line2 ? ', ' + deliveryAddress.line2 : ''}`,
            delivery_city: deliveryAddress.city,
            delivery_state: deliveryAddress.state,
            delivery_country: deliveryAddress.country,
            delivery_phone: deliveryAddress.phone,
            delivery_instructions: deliveryAddress.instructions || '',
            
            
            is_insured: shipment.is_insured,
            insurance_amount: shipment.insurance_amount,
            
            
            notes: shipment.notes || '',
            
            
            dashboard_url: process.env.DASHBOARD_URL || 'https://obana.africa'
        };

        
        await nodemailer.sendMail({
            email: 'obana.africa@gmail.com', 
            subject: `New Shipment: ${shipment.shipment_reference} - ${shipment.vendor_name}`,
            content: emailData,
            template: 'newShipment'
        });

        

        console.log(`Email sent for shipment ${shipment.shipment_reference}`);

    } catch (error) {
        console.error('Error sending shipment email:', error);
        // Don't throw error, just log it
    }
}

/**
 * Send status update email
 */
const sendStatusUpdateEmail = async (shipment, status, trackingEvent) => {
    try {
        const statusEmails = {
            'pickup_assigned': ['obana.africa@gmail.com', process.env.DRIVER_MANAGER_EMAIL],
            'picked_up': ['obana.africa@gmail.com'],
            'delivered': ['obana.africa@gmail.com', process.env.ACCOUNTS_EMAIL],
            'failed': ['obana.africa@gmail.com', process.env.SUPPORT_EMAIL]
        };

        const emails = statusEmails[status] || ['obana.africa@gmail.com'];
        
        const emailData = {
            shipment_reference: shipment.shipment_reference,
            order_reference: shipment.order_reference,
            vendor_name: shipment.vendor_name,
            status: status,
            status_description: trackingEvent.description || `Status changed to ${status}`,
            location: trackingEvent.location || 'Not specified',
            notes: trackingEvent.notes || '',
            updated_by: trackingEvent.performed_by || 'System',
            updated_at: new Date(trackingEvent.createdAt).toLocaleString(),
            dashboard_url: process.env.DASHBOARD_URL || 'https://obana.africa'
        };

        for (const email of emails) {
            await nodemailer.sendMail({
                email: email,
                subject: `🔄 Shipment Update: ${shipment.shipment_reference} - ${status.toUpperCase()}`,
                content: emailData,
                template: 'statusUpdate' // You'll need to create this template
            });
        }

    } catch (error) {
        console.error('Error sending status update email:', error);
    }
}
// Controller object
const shipmentController = {
    /**
     * Get admin dashboard statistics
     */
    getAdminStats: async (req, res) => {
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const [
                totalRoutes,
                activeDrivers,
                pendingShipments,
                revenueResult,
                recentActivity
            ] = await Promise.all([
                db.route_templates.count(),
                db.drivers.count({ where: { status: 'active' } }),
                db.shippings.count({ where: { status: 'pending' } }),
                db.shippings.sum('shipping_fee', {
                    where: {
                        createdAt: { [Op.gte]: startOfMonth },
                        status: { [Op.notIn]: ['cancelled', 'failed'] }
                    }
                }),
                db.shipment_tracking.findAll({
                    limit: 5,
                    order: [['createdAt', 'DESC']],
                    include: [{
                        model: db.shippings,
                        as: 'shipment',
                        attributes: ['shipment_reference', 'user_id']
                    }]
                })
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    totalRoutes,
                    activeDrivers,
                    pendingShipments,
                    revenue: revenueResult || 0,
                    recentActivity
                }
            });
        } catch (error) {
            console.error('Error fetching admin stats:', error);
            return res.status(500).json({ success: false, message: 'Error fetching stats' });
        }
    },

    /**
     * Main endpoint to create shipments
     * Handles both internal and external shipments
     */
    createShipment: async (req, res) => {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Authentication required - user not found in request'
                });
            }

            const payload = req.body;
        
            // Validate payload
            const validation = validateShipmentPayload(payload);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payload',
                    errors: validation.errors
                });
            }
            let user = req.user;
            console.log("user info from auth middleware:", user.id);
            const transaction = await db.sequelize.transaction();
            
            try {
                // 1. Create delivery address
                const deliveryAddress = await db.addresses.create({
                    address_type: 'delivery',
                    name: `${payload.delivery_address.first_name || ''} ${payload.delivery_address.last_name || ''}`.trim(),
                    phone: payload.delivery_address.phone,
                    contact_email: payload.delivery_address.email,
                    line1: payload.delivery_address.line1,
                    line2: payload.delivery_address.line2 || '',
                    city: payload.delivery_address.city,
                    state: payload.delivery_address.state,
                    country: payload.delivery_address.country,
                    zip_code: payload.delivery_address.zip || '',
                    is_residential: payload.delivery_address.is_residential || false,
                    instructions: payload.delivery_address.instructions || '',
                    metadata: payload.delivery_address.metadata || {}
                }, { transaction });

                // 2. Create pickup address - from user form
                const pickupAddressData = {
                    address_type: 'pickup',
                    name: payload.pickup_address.contact_name || 'Vendor',
                    phone: payload.pickup_address.phone,
                    contact_email: payload.pickup_address.email || '',
                    line1: payload.pickup_address.line1,
                    line2: payload.pickup_address.line2 || '',
                    city: payload.pickup_address.city,
                    state: payload.pickup_address.state,
                    country: payload.pickup_address.country,
                    zip_code: payload.pickup_address.zip_code || '',
                    is_residential: payload.pickup_address.is_residential || false,
                    instructions: payload.pickup_address.instructions || '',
                    metadata: payload.pickup_address.metadata || {}
                };

                const pickupAddress = await db.addresses.create(pickupAddressData, { transaction });

                // 3. Determine carrier type
                const isInternal = payload.carrier_slug === 'obana' || 
                                 (payload.dispatcher && payload.dispatcher.carrier_slug === 'obana');
                
                // 4. Generate shipment reference
                const shipmentReference = generateShipmentReference(isInternal);
                
                // 5. Calculate total weight and value
                const { totalWeight, totalValue, itemCount } = calculateShipmentTotals(payload.items);

                // 6. Create shipment
                const shipment = await db.shippings.create({
                    user_id: user.id,
                    shipment_reference: shipmentReference,
                    order_reference: payload.order_id || `ORDER-${Date.now()}`,
                    vendor_name: payload.vendor_name || 'Unknown Vendor',
                    carrier_type: isInternal ? 'internal' : 'external',
                    carrier_name: isInternal ? 'Obana Logistics' : (payload.dispatcher?.carrier_name || 'External Carrier'),
                    carrier_slug: isInternal ? 'obana' : (payload.dispatcher?.carrier_slug || 'external'),
                    transport_mode: payload.transport_mode || 'road',
                    service_level: payload.service_level || 'Standard',
                    external_carrier_reference: isInternal ? null : payload.carrier_reference,
                    external_rate_id: isInternal ? null : payload.rate_id,
                    delivery_address_id: deliveryAddress.id,
                    pickup_address_id: pickupAddress.id,
                    product_value: totalValue,
                    shipping_fee: payload.shipping_fee || 0,
                    currency: payload.currency?.symbol || 'NGN',
                    total_weight: totalWeight,
                    total_items: itemCount,
                    status: 'pending',
                    is_insured: payload.is_insured || false,
                    insurance_amount: payload.insurance_amount || 0,
                    metadata: {
                        original_payload: payload,
                        dispatcher: payload.dispatcher,
                        carrier_details: {
                            carrier_name: payload.dispatcher?.carrier_name,
                            carrier_logo: payload.dispatcher?.carrier_logo,
                            delivery_time: payload.dispatcher?.delivery_time,
                            delivery_eta: payload.dispatcher?.delivery_eta,
                            pickup_time: payload.dispatcher?.pickup_time,
                            pickup_eta: payload.dispatcher?.pickup_eta
                        }
                    },
                    notes: payload.notes || ''
                }, { transaction });

                // 6.5 Auto-assign driver for internal shipments
                if (isInternal) {
                    try {
                        // Find an available driver based on transport mode
                        const availableDriver = await db.drivers.findOne({
                            where: {
                                status: 'active',
                                vehicle_type: {
                                    [Op.in]: getVehicleTypesForTransportMode(payload.transport_mode)
                                }
                            },
                            order: [
                                // Prefer drivers with lower delivery count
                                ['total_deliveries', 'ASC']
                            ]
                        });

                        if (availableDriver) {
                            shipment.driver_id = availableDriver.id;
                            await shipment.save({ transaction });
                            console.log(`[DRIVER ASSIGNMENT] Assigned driver ${availableDriver.driver_code} to shipment ${shipmentReference}`);
                        } else {
                            console.warn(`[DRIVER ASSIGNMENT] No available driver found for transport_mode: ${payload.transport_mode}`);
                        }
                    } catch (driverError) {
                        console.error('[DRIVER ASSIGNMENT] Error assigning driver:', driverError);
                        // Don't fail the shipment creation if driver assignment fails
                    }
                }

                // 7. Create shipment items
                if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
                    await db.shipment_items.bulkCreate(
                        payload.items.map((item, index) => {
                            const itemNumber = String(index + 1).padStart(3, '0');
                            return {
                            shipment_id: shipment.id,
                            item_id: `ITEM-${itemNumber}`,
                            name: item.name,
                            description: item.description || '',
                            quantity: parseInt(item.quantity) || 1,
                            unit_price: parseFloat(item.price) || parseFloat(item.value) || 0,
                            total_price: parseFloat(item.total_price) || parseFloat(item.value) || 0,
                            weight: parseFloat(item.weight) || 0,
                            dimensions: item.dimensions || null,
                            currency: item.currency || 'NGN',
                            metadata: { original_item: item }
                        }}),
                        { transaction }
                    );
                }

                // 8. Create initial tracking event
                await db.shipment_tracking.create({
                    shipment_id: shipment.id,
                    status: 'created',
                    description: 'Shipment created successfully',
                    source: 'system',
                    performed_by: 'system',
                    metadata: {
                        action: 'shipment_creation',
                        carrier_type: isInternal ? 'internal' : 'external'
                    }
                }, { transaction });
                
                
                if (!isInternal) {
                    console.log(`[EXTERNAL CARRIER] Shipment ${shipmentReference} assigned to ${payload.dispatcher?.carrier_name || 'External Carrier'}`);
                    console.log(`[EXTERNAL CARRIER] Reference: ${payload.carrier_reference}, Rate ID: ${payload.rate_id}`);
                    
                    // TODO: Implement actual API call to Terminal Africa or other external carriers
                    // await callExternalCarrierAPI(payload, shipment);
                }

                await transaction.commit();
                await sendNewShipmentEmail(shipment, deliveryAddress, pickupAddress);
                // 10. Trigger async post-creation processes
                triggerPostCreationProcesses(shipment.id, isInternal);

                return res.status(201).json({
                    success: true,
                    message: 'Shipment created successfully',
                    data: {
                        shipment_id: shipment.id,
                        shipment_reference: shipment.shipment_reference,
                        tracking_url: `${process.env.BASE_URL || 'http://localhost:3000'}/track/${shipment.shipment_reference}`,
                        carrier: shipment.carrier_name,
                        status: shipment.status,
                        estimated_delivery: shipment.metadata?.carrier_details?.delivery_time || 'To be determined',
                        external_reference: shipment.external_carrier_reference
                    }
                });

            } catch (error) {
                await transaction.rollback();
                console.error('Transaction error:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error creating shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error creating shipment',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
   /**
 * Get all shipments for admin overview/monitoring
 */
getAllShipments: async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            carrier_type,
            start_date,
            end_date,
            search,
            sort_by = 'createdAt',
            sort_order = 'DESC'
        } = req.query;

        // Build where clause
        const where = {};

        // Filter by status
        if (status) {
            if (status === 'active') {
                // Active shipments are those not completed/cancelled
                where.status = {
                    [Op.notIn]: ['delivered', 'cancelled', 'returned']
                };
            } else {
                where.status = status;
            }
        }

        
        if (carrier_type) {
            where.carrier_type = carrier_type;
        }

        
        if (start_date || end_date) {
            where.createdAt = {};
            
            if (start_date) {
                where.createdAt[Op.gte] = new Date(start_date);
            }
            
            if (end_date) {
                where.createdAt[Op.lte] = new Date(end_date);
            }
        }

        // Search filter (by reference, order reference, vendor name, customer)
        if (search) {
            where[Op.or] = [
                { shipment_reference: { [Op.like]: `%${search}%` } },
                { order_reference: { [Op.like]: `%${search}%` } },
                { vendor_name: { [Op.like]: `%${search}%` } },
                { user_id: { [Op.like]: `%${search}%` } }
            ];
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Sorting
        const order = [];
        if (sort_by) {
            order.push([sort_by, sort_order.toUpperCase()]);
        }

        // Get shipments with pagination and includes
        const shipments = await db.shippings.findAndCountAll({
            where,
            include: [
                {
                    model: db.addresses,
                    as: 'delivery_address',
                    attributes: ['city', 'state', 'country', 'phone']
                },
                {
                    model: db.addresses,
                    as: 'pickup_address',
                    attributes: ['city', 'state', 'country']
                },
                {
                    model: db.drivers,
                    as: 'driver',
                    // attributes: ['driver_code', 'first_name', 'last_name', 'phone']
                    attributes: ['driver_code', 'user_id'] 
                },
                {
                    model: db.shipment_tracking,
                    as: 'tracking_events',
                    attributes: ['status', 'createdAt'],
                    order: [['createdAt', 'DESC']],
                    limit: 1
                }
            ],
            attributes: [
                'id',
                'shipment_reference',
                'order_reference',
                'user_id',
                'vendor_name',
                'carrier_type',
                'carrier_name',
                'status',
                'product_value',
                'shipping_fee',
                'currency',
                'total_weight',
                'total_items',
                'actual_delivery_at',
                'createdAt',
                'updatedAt'
            ],
            order,
            limit: parseInt(limit),
            offset: offset,
            distinct: true // Important for count with includes
        });

        // Calculate statistics
        const statistics = {
            total: shipments.count,
            by_status: {},
            by_carrier: {},
            by_day: {}
        };

        // Get status counts
        const statusCounts = await db.shippings.findAll({
            attributes: [
                'status',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['status']
        });

        statusCounts.forEach(item => {
            statistics.by_status[item.status] = parseInt(item.dataValues.count);
        });

        // Get carrier type counts
        const carrierCounts = await db.shippings.findAll({
            attributes: [
                'carrier_type',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['carrier_type']
        });

        carrierCounts.forEach(item => {
            statistics.by_carrier[item.carrier_type] = parseInt(item.dataValues.count);
        });

        // Get daily counts for last 7 days
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const dailyCounts = await db.shippings.findAll({
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: {
                createdAt: {
                    [Op.gte]: last7Days
                }
            },
            group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
            order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
        });

        dailyCounts.forEach(item => {
            statistics.by_day[item.dataValues.date] = parseInt(item.dataValues.count);
        });

        return res.status(200).json({
            success: true,
            data: {
                shipments: shipments.rows,
                pagination: {
                    total: shipments.count,
                    page: parseInt(page),
                    pages: Math.ceil(shipments.count / parseInt(limit)),
                    limit: parseInt(limit)
                },
                statistics: statistics,
                filters: {
                    status,
                    carrier_type,
                    start_date,
                    end_date,
                    search
                }
            }
        });

    } catch (error) {
        console.error('Error getting all shipments:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching shipments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},
    /**
     * Get shipment status
     */
    getShipment: async (req, res) => {
        try {
        const { shipment_reference } = req.params;
            const { user_id } = req.body;
            
            const shipment = await db.shippings.findOne({
                where: { shipment_reference, user_id },
                include: [
                    { 
                        model: db.addresses, 
                        as: 'delivery_address' 
                    },
                    { 
                        model: db.addresses, 
                        as: 'pickup_address' 
                    },
                    { 
                        model: db.shipment_items, 
                        as: 'items' 
                    },
                    { 
                        model: db.shipment_tracking, 
                        as: 'tracking_events',
                        order: [['createdAt', 'DESC']]
                    },
                    {
                        model: db.drivers,
                        as: 'driver',
                        required: false 
                    }
                ]
            });

            if (!shipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: shipment
            });
        } catch (error) {
            console.error('Error fetching shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching shipment'
            });
        }
    },

    /**
     * Update shipment status
     */
    updateShipmentStatus: async (req, res) => {
        try {
            const { shipment_id } = req.params;
            const { status, description, location, notes, source = 'system', performed_by } = req.body;
            
            // Validate status
            const validStatuses = ['pending', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const shipment = await db.shippings.findByPk(shipment_id);
            
            if (!shipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }

            // Update shipment status
            const updateData = { status };
            
            if (status === 'delivered') {
                updateData.actual_delivery_at = new Date();
            }
            
            await shipment.update(updateData);

            // Create tracking event
            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status,
                location: location || '',
                description: description || `Status updated to ${status}`,
                notes: notes || '',
                source,
                performed_by: performed_by || (req.user ? `user_${req.user.id}` : 'system'),
                metadata: {
                    updated_by: performed_by || 'system',
                    previous_status: shipment.status
                }
            });
    await sendStatusUpdateEmail(shipment, status, req.body);
            return res.status(200).json({
                success: true,
                message: 'Shipment status updated',
                data: {
                    shipment_id: shipment.id,
                    status: shipment.status,
                    updated_at: shipment.updatedAt
                }
            });
        } catch (error) {
            console.error('Error updating shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error updating shipment'
            });
        }
    },

    /**
     * Cancel shipment
     */
    cancelShipment: async (req, res) => {
        const { shipment_id } = req.params;
        const { reason } = req.body;

        try {
            const shipment = await db.shippings.findByPk(shipment_id);
            
            if (!shipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }

            // Check if shipment can be cancelled
            const cancellableStatuses = ['pending'];
            if (!cancellableStatuses.includes(shipment.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Shipment cannot be cancelled in ${shipment.status} status`
                });
            }

            // If external carrier, log cancellation request
            if (shipment.carrier_type === 'external') {
                console.log(`[EXTERNAL CANCELLATION] Would cancel external shipment: ${shipment.external_carrier_reference} with ${shipment.carrier_name}`);
                // TODO: Call external carrier cancellation API
            }

            // Update shipment status
            await shipment.update({
                status: 'cancelled',
                notes: `Cancelled: ${reason || 'No reason provided'}`
            });

            // Add tracking event
            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: 'cancelled',
                description: `Shipment cancelled: ${reason || 'No reason provided'}`,
                performed_by: req.user?.id ? `user_${req.user.id}` : 'system',
                source: 'system'
            });

            return res.status(200).json({
                success: true,
                message: 'Shipment cancelled successfully'
            });
        } catch (error) {
            console.error('Error cancelling shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    /**
     * Get all shipments for a user
     */
    getUserShipments: async (req, res) => {
        
        try {
            const { user_id } = req.params;
            const { status, carrier_type, page = 1, limit = 20 } = req.query;
            
            const where = { user_id };
            
            if (status) where.status = status;
            if (carrier_type) where.carrier_type = carrier_type;
            
            const offset = (page - 1) * limit;
            
            const shipments = await db.shippings.findAndCountAll({
                where,
                include: [
                    { model: db.addresses, as: 'delivery_address' },
                    { model: db.addresses, as: 'pickup_address' },
                    { 
                        model: db.shipment_tracking, 
                        as: 'tracking_events',
                        order: [['createdAt', 'DESC']],
                        limit: 1 
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: offset
            });
            console.log(`Fetched ${shipments.rows.length} shipments for user ${user_id} (total: ${shipments.count})`);
            return res.status(200).json({
                success: true,
                data: {
                    shipments: shipments.rows,
                    pagination: {
                        total: shipments.count,
                        page: parseInt(page),
                        pages: Math.ceil(shipments.count / limit),
                        limit: parseInt(limit)
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching user shipments:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching shipments'
            });
        }
    },

    /**
     * Webhook handler for external carriers
     */
    handleCarrierWebhook: async (req, res) => {
        try {
            const { carrier } = req.params;
            const webhookData = req.body;
            
            console.log(`[WEBHOOK] Received from ${carrier}:`, JSON.stringify(webhookData, null, 2));
            
            // Look for external reference in webhook data
            let externalReference = webhookData.tracking_number || 
                                   webhookData.reference || 
                                   webhookData.carrier_reference;
            
            if (!externalReference) {
                return res.status(400).json({
                    success: false,
                    message: 'No tracking reference found in webhook'
                });
            }
            
            // Find shipment by external reference
            const shipment = await db.shippings.findOne({
                where: { 
                    external_carrier_reference: externalReference,
                    carrier_type: 'external'
                }
            });
            
            if (!shipment) {
                console.log(`[WEBHOOK] No shipment found for external reference: ${externalReference}`);
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }
            
            // Map carrier status to our status
            const statusMapping = {
                'in_transit': 'in_transit',
                'delivered': 'delivered',
                'failed': 'failed',
                'exception': 'failed',
                'cancelled': 'cancelled'
            };
            
            const carrierStatus = webhookData.status || webhookData.tracking_status;
            const ourStatus = statusMapping[carrierStatus] || 'in_transit';
            
            // Update shipment status
            await shipment.update({
                status: ourStatus,
                metadata: {
                    ...shipment.metadata,
                    last_webhook: {
                        carrier: carrier,
                        data: webhookData,
                        received_at: new Date()
                    }
                }
            });
            
            // Create tracking event
            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: ourStatus,
                location: webhookData.location || webhookData.city || '',
                description: `Carrier update: ${carrierStatus || 'Status update'}`,
                source: 'carrier_api',
                performed_by: carrier,
                metadata: { webhook_data: webhookData }
            });
            
            return res.status(200).json({
                success: true,
                message: 'Webhook processed successfully'
            });
            
        } catch (error) {
            console.error('Error processing webhook:', error);
            return res.status(500).json({
                success: false,
                message: 'Error processing webhook'
            });
        }
    }
};

module.exports = shipmentController;