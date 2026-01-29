const crypto = require('crypto');
const db = require('../models/db.js')
const { Op } = require('sequelize')
const { sendRequest } = require('../helpers/sendRequestHelper')
const { validateRequest, getTenantAndEndpoint } = require('../helpers/requestValidator')

const userController = require('../controllers/userController'); // ADD THIS
const { flattenObj } = require('../../utils');
const utils = require('../../utils');
const e = require('cors');
const mailer = require('../mailer/nodemailer')
const WebhookController = require('../controllers/webhookController');

/**
 * Extract email from shipment_details
 */
const extractCustomerEmailFromShipment = (shipmentDetails) => {
    try {
        if (typeof shipmentDetails === 'string') {
            shipmentDetails = JSON.parse(shipmentDetails);
        }
        return shipmentDetails?.delivery_address?.email;
    } catch (error) {
        console.error('Error extracting email from shipment details:', error);
        return null;
    }
};

/**
 * Check if user is agent using proper user controller
 */
const isUserAgent = async (userId) => {
    try {
        if (!userId) return false;

        const user = await userController.getUser(null, null, true, null, null, userId);
        if (!user || !user.attributes?.account_types) return false;

        return user.attributes.account_types.split(',').includes('agent');
    } catch (error) {
        console.error('Error checking user agent status:', error);
        return false;
    }
};

/**
 * Get user email by ID
 */
const getUserEmailById = async (userId) => {
    try {
        const user = await userController.getUser(null, null, false, null, null, userId);
        return user?.email || null;
    } catch (error) {
        console.error('Error getting user email:', error);
        return null;
    }
};

/**
 * Send email to customer (always sent if email exists in shipment_details)
 */
const sendCustomerEmail = async (order, subject, content, emailType = 'order_update') => {
    try {
        const customerEmail = extractCustomerEmailFromShipment(order.shipment_details);

        if (!customerEmail) {
            return false;
        }


        await mailer.sendMail({
            email: customerEmail,
            subject: subject,
            content: content,
            type: emailType
        });

        // Log email sent to webhook_logs for tracking
        await db.webhook_logs.create({
            event_type: `email_${emailType}_sent`,
            order_id: order.id,
            payload: JSON.stringify({
                recipient: customerEmail,
                subject: subject,
                email_type: emailType,
                sent_at: new Date()
            }),
            processed: true,
            source: 'system'
        });

        return true;
    } catch (error) {
        console.error('Error sending customer email:', error);

        // Log email failure
        await db.webhook_logs.create({
            event_type: `email_${emailType}_failed`,
            order_id: order.id,
            payload: JSON.stringify({
                error: error.message,
                subject: subject
            }),
            processed: false,
            error_message: error.message,
            source: 'system'
        });

        return false;
    }
};

/**
 * Send email to agent (only if user is agent)
 */
const sendAgentEmail = async (userId, order, subject, content, emailType = 'agent_notification') => {
    try {
        const userIsAgent = await isUserAgent(userId);
        if (!userIsAgent) {
            return false;
        }

        const agentEmail = await getUserEmailById(userId);
        if (!agentEmail) {
            return false;
        }


        await mailer.sendMail({
            email: agentEmail,
            subject: subject,
            content: content,
            type: emailType
        });

        // Log agent email
        await db.webhook_logs.create({
            event_type: `email_agent_${emailType}_sent`,
            order_id: order.id,
            payload: JSON.stringify({
                recipient: agentEmail,
                agent_id: userId,
                subject: subject,
                sent_at: new Date()
            }),
            processed: true,
            source: 'system'
        });

        return true;
    } catch (error) {
        console.error('Error sending agent email:', error);

        await db.webhook_logs.create({
            event_type: `email_agent_${emailType}_failed`,
            order_id: order.id,
            payload: JSON.stringify({
                error: error.message,
                agent_id: userId
            }),
            processed: false,
            error_message: error.message,
            source: 'system'
        });

        return false;
    }
};

/**
 * Enhanced shopperNotification to always use shipment_details email
 */
const shopperNotification = async (order, user, zohoOrder, agentDetails) => {
    try {
        // ALWAYS USE EMAIL FROM SHIPMENT_DETAILS, NOT USER EMAIL
        const customerEmail = extractCustomerEmailFromShipment(order.shipment_details);

        if (!customerEmail) {
            return;
        }

        const orderNumber = zohoOrder?.salesorder?.salesorder_number || order.order_ref;
        const totalAmount = order.amount?.toLocaleString() || '0';

        await mailer.sendMail({
            email: customerEmail,
            subject: `Order Confirmation - ${orderNumber}`,
            content: `
                <h2>Order Confirmed!</h2>
                <p>Thank you for your order ${orderNumber}</p>
                <p>Total Amount: ₦${totalAmount}</p>
                <p>We'll notify you when your order ships.</p>
            `
        });

    } catch (error) {
        console.error('Error in shopper notification:', error);
    }
};

/**
 * Enhanced agentNotification to respect agent check
 */
const agentNotification = async (order, user, customerData, zohoOrder) => {
    try {
        // ONLY SEND IF USER IS AGENT
        const userIsAgent = await isUserAgent(user.id);
        if (!userIsAgent) {
            return;
        }

        const agentEmail = await getUserEmailById(user.id);
        if (!agentEmail) {
            return;
        }

        const orderNumber = zohoOrder?.salesorder?.salesorder_number || order.order_ref;
        const totalAmount = order.amount?.toLocaleString() || '0';

        await mailer.sendMail({
            email: agentEmail,
            subject: `New Order - ${orderNumber}`,
            content: `
                <h2>New Order Received</h2>
                <p>Order Number: ${orderNumber}</p>
                <p>Customer: ${customerData.first_name} ${customerData.last_name}</p>
                <p>Total Amount: ₦${totalAmount}</p>
                <p>Commission: ₦${order.commission?.toLocaleString() || '0'}</p>
            `
        });


    } catch (error) {
        console.error('Error in agent notification:', error);
    }
};

/**
 * SHIPMENT STATUS EMAIL FUNCTION
 */
const sendShipmentStatusEmail = async (order, shipment, status, data) => {
    try {
        const statusEmails = {
            'created': {
                subject: 'Shipment Created - Tracking Information',
                template: 'shipment_created'
            },
            'in_transit': {
                subject: 'Your Order is In Transit',
                template: 'shipment_in_transit'
            },
            'out_for_delivery': {
                subject: 'Your Order is Out for Delivery',
                template: 'shipment_out_for_delivery'
            },
            'delivered': {
                subject: 'Order Delivered Successfully',
                template: 'shipment_delivered'
            },
            'cancelled': {
                subject: 'Shipment Cancelled',
                template: 'shipment_cancelled'
            }
        };

        const emailConfig = statusEmails[status];
        if (!emailConfig) return;

        const trackingInfo = shipment?.tracking_number ?
            `<p><strong>Tracking Number:</strong> ${shipment.tracking_number}</p>` :
            '';

        const trackingLink = shipment?.tracking_url ?
            `<p><a href="${shipment.tracking_url}" style="color: #1b3b5f;">Track Your Package</a></p>` :
            '';

        const emailContent = `
            <h2>Shipment Update</h2>
            <p>Your order <strong>${order.order_ref}</strong> has been updated:</p>
            <p><strong>Status:</strong> ${status.replace('_', ' ').toUpperCase()}</p>
            ${trackingInfo}
            ${trackingLink}
            <p>Thank you for your business!</p>
        `;

        // ALWAYS SEND TO CUSTOMER (from shipment_details)
        await sendCustomerEmail(
            order,
            emailConfig.subject,
            emailContent,
            emailConfig.template
        );

    } catch (error) {
        console.error('Error sending shipment status email:', error);
    }
};

// Helper to post notifications to frontend (for toast)
const postToFrontend = async (payload) => {
    const url = process.env.FRONTEND_NOTIFICATION_URL
    if (!url) return { ok: false, error: 'NO_FRONTEND_NOTIFICATION_URL' }
    // Use global fetch if available (Node 18+), otherwise try node-fetch
    let fetchFn = global.fetch
    if (!fetchFn) {
        try { fetchFn = require('node-fetch') } catch (e) { return { ok: false, error: 'NO_FETCH_AVAILABLE' } }
    }
    try {
        const res = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        return { ok: res.ok, status: res.status }
    } catch (err) {
        console.error('postToFrontend error', err.message)
        return { ok: false, error: err.message }
    }
}

// Helper: Log webhook event
async function logWebhook(event, data, orderId = null, error = null) {
    try {
        await db.webhook_logs.create({
            event_type: event,
            shipment_id: data?.shipment_id || null,
            order_id: orderId,
            payload: JSON.stringify(data),
            processed: !error,
            error_message: error?.message || null
        });
    } catch (logError) {
        console.error('Failed to log webhook:', logError);
    }
}

// Helper: Find shipment and order
async function findShipmentAndOrder(shipmentId) {
    const shipment = await db.shipment.findOne({ where: { shipment_id: shipmentId } });
    const order = shipment ? await db.orders.findOne({ where: { id: shipment.order_id } }) : null;
    return { shipment, order };
}



// UPDATE ORDER SHIPMENT STATUS HELPER
const updateOrderShipmentStatus = async (order, shipment, status, event, data) => {
    try {
        // For multi-vendor orders, aggregate all shipment statuses
        const allShipments = await db.shipment.findAll({
            where: { order_id: order.id }
        });

        const statuses = allShipments.map(s => s.status);

        // Determine overall order shipment_status
        let aggStatus = 'pending';
        if (statuses.every(s => s === 'delivered')) {
            aggStatus = 'delivered';
        } else if (statuses.some(s => s === 'out_for_delivery')) {
            aggStatus = 'out_for_delivery';
        } else if (statuses.some(s => s === 'in_transit')) {
            aggStatus = 'in_transit';
        } else if (statuses.some(s => s === 'created')) {
            aggStatus = 'created';
        } else if (statuses.some(s => s === 'cancelled')) {
            aggStatus = 'cancelled';
        } else if (statuses.some(s => s === 'exception')) {
            aggStatus = 'exception';
        }

        const updateData = {
            shipment_status: aggStatus,

        };

        if (event === 'shipment.delivered' && status === 'delivered') {
            updateData.delivered_at = new Date();
        }

        if (event === 'shipment.cancelled') {
            updateData.cancellation_reason = data.cancellation_reason;
        }

        await order.update(updateData);

        // Append to tracking history
        await appendTrackingHistory(
            order,
            status,
            `Shipment ${event.replace('shipment.', '')}`,
            {
                shipment_id: data.shipment_id,
                event: event
            }
        );
    } catch (error) {
        console.error('Error updating order shipment status:', error);
    }
};

// NOTIFY FRONTEND VIA SOCKET.IO
const notifyFrontend = (io, event, data) => {
    try {
        if (io) {
            io.emit('shipment_update', {
                event,
                ...data,
                timestamp: new Date()
            });
        }
    } catch (error) {
        console.error('Error notifying frontend:', error);
    }
};

// AGENT COMMISSION APPROVAL
const approveAgentCommission = async (order) => {
    try {
        if (order.agent_id && order.commission > 0) {
            // await walletController.approveCommission(order.agent_id, order.commission, order.id);
        }
    } catch (error) {
        console.error('Error approving agent commission:', error);
    }
};

/**
* Enhanced tracking history appender
*/
const appendTrackingHistory = async (order, status, description, metadata = {}) => {
    try {
        let trackingHistory = [];

        if (order.tracking_history) {
            try {
                trackingHistory = JSON.parse(order.tracking_history);
            } catch (e) {
                console.error('Error parsing tracking history:', e);
            }
        }

        trackingHistory.push({
            timestamp: new Date(),
            status: status,
            description: description,
            metadata: metadata,
            source: 'system'
        });

        // Keep only last 50 entries to prevent bloating
        if (trackingHistory.length > 50) {
            trackingHistory = trackingHistory.slice(-50);
        }

        order.tracking_history = JSON.stringify(trackingHistory);
    } catch (error) {
        console.error('Error appending tracking history:', error);
    }
};

const buildCustomerOrderEmailContent = (order, shipmentResults, zohoOrder) => {
    const orderNumber = zohoOrder?.salesorder?.salesorder_number || order.order_ref;
    const totalAmount = order.amount?.toLocaleString() || '0';
    const hasShipments = shipmentResults.successful.length > 0;

    let emailContent = `
        <h2>Order Confirmation</h2>
        <p>Thank you for your order!</p>
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Total Amount:</strong> ₦${totalAmount}</p>
    `;

    if (hasShipments) {
        emailContent += `
            <p><strong>Shipping:</strong> ${shipmentResults.successful.length} shipment(s) created</p>
            <p>You will receive tracking updates as your package moves through the delivery process.</p>
        `;
    } else {
        emailContent += `
            <p><strong>Shipping:</strong> Pickup order - no shipment required</p>
        `;
    }

    emailContent += `
        <p>You can track your order status in your account dashboard.</p>
        <p>Thank you for choosing us!</p>
    `;

    return emailContent;
};

const buildAgentOrderEmailContent = (order, shipmentResults, zohoOrder, customerData) => {
    const orderNumber = zohoOrder?.salesorder?.salesorder_number || order.order_ref;
    const totalAmount = order.amount?.toLocaleString() || '0';
    const commission = order.commission?.toLocaleString() || '0';
    const customerName = customerData ? `${customerData.first_name} ${customerData.last_name}` : 'Customer';

    return `
        <h2>New Order Received</h2>
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Total Amount:</strong> ₦${totalAmount}</p>
        <p><strong>Your Commission:</strong> ₦${commission}</p>
        <p><strong>Shipments Created:</strong> ${shipmentResults.successful.length}</p>
        <p><strong>Failed Shipments:</strong> ${shipmentResults.failed.length}</p>
        <p>Please monitor the order in your agent dashboard for updates.</p>
    `;
};



/**
 * Update order status based on shipment creation results
 */
const updateOrderStatusBasedOnShipments = async (order, shipmentResults) => {
    try {
        const totalShipments = shipmentResults.successful.length + shipmentResults.failed.length;

        if (totalShipments === 0) {
            // No shipments attempted (pickup order)
            order.shipment_status = 'not_required';
        } else if (shipmentResults.failed.length === 0) {
            // All shipments created successfully
            order.shipment_status = 'shipments_created';

            // ADD TO TRACKING HISTORY
            await appendTrackingHistory(
                order,
                'shipments_created',
                `All ${shipmentResults.successful.length} shipment(s) created successfully`,
                {
                    successful_shipments: shipmentResults.successful.length,
                    total_shipments: totalShipments
                }
            );

        } else if (shipmentResults.successful.length > 0) {
            // Partial success
            order.shipment_status = 'partial_shipments';

            await appendTrackingHistory(
                order,
                'partial_shipments',
                `${shipmentResults.successful.length} of ${totalShipments} shipment(s) created. ${shipmentResults.failed.length} failed.`,
                {
                    successful: shipmentResults.successful.length,
                    failed: shipmentResults.failed.length,
                    total: totalShipments
                }
            );

        } else {
            // All failed
            order.shipment_status = 'shipment_failed';

            await appendTrackingHistory(
                order,
                'shipment_failed',
                `Shipment creation failed for all ${totalShipments} vendor(s)`,
                {
                    failed_shipments: shipmentResults.failed.length,
                    errors: shipmentResults.failed.map(f => f.error)
                }
            );
        }

        await order.save();
    } catch (error) {
        console.error('Error updating order status:', error);
    }
};




/**
 * Log initial webhook events for shipment creation
 */
const logInitialWebhookEvents = async (order, shipmentResults) => {
    try {
        // Log successful shipment creations
        for (const success of shipmentResults.successful) {
            await db.webhook_logs.create({
                event_type: 'shipment.created',
                shipment_id: success.shipment_id,
                order_id: order.id,
                payload: JSON.stringify({
                    shipment_id: success.shipment_id,
                    vendor_id: success.vendor_id,
                    status: 'created',
                    carrier_reference: success.carrier_reference,
                    tracking_number: success.tracking_number,
                    created_at: new Date()
                }),
                processed: true,
                source: 'order_creation'
            });
        }

        // Log failed shipment attempts
        for (const failure of shipmentResults.failed) {
            await db.webhook_logs.create({
                event_type: 'shipment.creation_failed',
                shipment_id: failure.attempted_shipment_id,
                order_id: order.id,
                payload: JSON.stringify({
                    vendor_id: failure.vendor_id,
                    error: failure.error,
                    error_stage: failure.error_stage,
                    attempted_rate_id: failure.attempted_rate_id
                }),
                processed: false,
                error_message: failure.error,
                source: 'order_creation'
            });
        }
    } catch (error) {
        console.error('Error logging initial webhook events:', error);
    }
};


// ==================== DELIVERY PROCESSING FUNCTIONS ==================== 

/**
 * Process aggregated delivery
 */
const processAggregatedDelivery = async function (vendorRateMapping, shipmentDetailPayload, order, shipmentResults, shipmentIds, deliveryType, carrierReference) {
    const vendorBreakdown = shipmentDetailPayload.metadata?.vendor_breakdown || [];

    for (let vendorMapping of vendorRateMapping) {
        try {
            if (!vendorMapping.actual_rate_id) {
                throw new Error(`No actual_rate_id found for vendor ${vendorMapping.vendor_id}`);
            }

            const vendorGroup = shipmentDetailPayload.vendor_groups?.find(
                group => group.vendor_id === vendorMapping.vendor_id
            ) || vendorBreakdown.find(
                breakdown => breakdown.vendor_id === vendorMapping.vendor_id
            );

            const cashToCollect = vendorGroup?.items?.reduce((total, item) => {
                return total + ((item.value || 0) * (item.quantity || 1));
            }, 0) || vendorMapping.amount || 0;

            this.requestDetails.req.params.endpoint = 'pickup';
            this.requestDetails.req.body = {
                rate_id: vendorMapping.actual_rate_id,
                cash_to_collect: cashToCollect,
                purchase_insurance: false
            };


            // FIXED: Use proper request handling with this context
            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const pickupEndpoint = await db.endpoints.findOne({ where: { slug: 'pickup', tenant_id: tenant.id } });
            if (!pickupEndpoint) throw new Error('Pickup endpoint not configured');

            const pickupRequestDetails = await validateRequest({ tenant, endpoint: pickupEndpoint, req: this.requestDetails.req, res: this.requestDetails.res });
            const pickupResponse = await sendRequest(pickupRequestDetails);
            const pickupData = JSON.parse(pickupResponse.data);

            if (!pickupData.status) {
                throw new Error(`Terminal Africa Pickup Error: ${pickupData.message || 'Unknown error'}`);
            }

            const shipmentId = pickupData?.data?.shipment_id;

            // Create shipment record
            await db.shipment.create({
                order_id: order.id,
                shipment_id: shipmentId,
                status: pickupData?.data?.status || 'created',
                carrier_reference: vendorMapping.carrier_reference || carrierReference,
                rate_id: vendorMapping.actual_rate_id,
                tracking_number: pickupData?.data?.extras?.tracking_number,
                tracking_url: pickupData?.data?.extras?.tracking_url,
                vendor_id: vendorMapping.vendor_id,
                cash_collected: cashToCollect
            });

            shipmentResults.successful.push({
                vendor_id: vendorMapping.vendor_id,
                shipment_id: shipmentId,
                rate_id: vendorMapping.actual_rate_id,
                carrier_reference: vendorMapping.carrier_reference || carrierReference,
                tracking_number: pickupData?.data?.extras?.tracking_number,
                tracking_url: pickupData?.data?.extras?.tracking_url,
                delivery_type: deliveryType,
                status: pickupData?.data?.status,
                cash_collected: cashToCollect,
                pickup_address: vendorMapping.pickup_address
            });

            shipmentIds.push(shipmentId);

        } catch (error) {
            console.error(` Failed to arrange pickup for vendor ${vendorMapping.vendor_id}:`, error.message);
            shipmentResults.failed.push({
                vendor_id: vendorMapping.vendor_id,
                pickup_address: vendorMapping.pickup_address?.line1,
                error: error.message,
                rate_id: vendorMapping.actual_rate_id,
                carrier_reference: vendorMapping.carrier_reference || carrierReference,
                error_stage: 'pickup_arrangement'
            });
        }
    }
};

/**
 * Process per-vendor delivery
 */
const processPerVendorDelivery = async function (vendorSelections, order, shipmentResults, shipmentIds, deliveryType) {
    for (let vendorSelection of vendorSelections) {
        try {
            if (!vendorSelection.actual_rate_id) {
                throw new Error(`No rate_id found for vendor ${vendorSelection.vendor_id}`);
            }

            const cashToCollect = vendorSelection.items?.reduce((total, item) => {
                return total + ((item.value || 0) * (item.quantity || 1));
            }, 0) || vendorSelection.cost || 0;

            this.requestDetails.req.params.endpoint = 'pickup';
            this.requestDetails.req.body = {
                rate_id: vendorSelection.actual_rate_id,
                cash_to_collect: cashToCollect,
                purchase_insurance: false
            };


            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const pickupEndpoint = await db.endpoints.findOne({ where: { slug: 'pickup', tenant_id: tenant.id } });
            if (!pickupEndpoint) throw new Error('Pickup endpoint not configured');

            const pickupRequestDetails = await validateRequest({ tenant, endpoint: pickupEndpoint, req: this.requestDetails.req, res: this.requestDetails.res });
            const pickupResponse = await sendRequest(pickupRequestDetails);
            const pickupData = JSON.parse(pickupResponse.data);

            if (!pickupData.status) {
                throw new Error(`Terminal Africa Pickup Error: ${pickupData.message || 'Unknown error'}`);
            }

            const shipmentId = pickupData?.data?.shipment_id;

            // Create shipment record
            await db.shipment.create({
                order_id: order.id,
                shipment_id: shipmentId,
                status: pickupData?.data?.status || 'created',
                carrier_reference: vendorSelection.carrier_reference,
                rate_id: vendorSelection.actual_rate_id,
                tracking_number: pickupData?.data?.extras?.tracking_number,
                tracking_url: pickupData?.data?.extras?.tracking_url,
                vendor_id: vendorSelection.vendor_id,
                cash_collected: cashToCollect
            });

            shipmentResults.successful.push({
                vendor_id: vendorSelection.vendor_id,
                shipment_id: shipmentId,
                rate_id: vendorSelection.actual_rate_id,
                carrier_reference: vendorSelection.carrier_reference,
                tracking_number: pickupData?.data?.extras?.tracking_number,
                tracking_url: pickupData?.data?.extras?.tracking_url,
                delivery_type: deliveryType,
                status: pickupData?.data?.status,
                cash_collected: cashToCollect
            });

            shipmentIds.push(shipmentId);

        } catch (error) {
            console.error(` Failed to arrange pickup for vendor ${vendorSelection.vendor_id}:`, error.message);
            shipmentResults.failed.push({
                vendor_id: vendorSelection.vendor_id,
                pickup_address: vendorSelection.pickup_address?.line1,
                error: error.message,
                rate_id: vendorSelection.actual_rate_id,
                carrier_reference: vendorSelection.carrier_reference,
                error_stage: 'pickup_arrangement'
            });
        }
    }
};

/**
 * Process single vendor delivery - FIXED VERSION
 */
const processSingleVendorDelivery = async function (shipmentDetailPayload, order, shipmentResults, shipmentIds, deliveryType) {
    try {
        if (!shipmentDetailPayload.rate_id) {
            throw new Error(`No rate_id found for single vendor delivery`);
        }

        const cashToCollect = shipmentDetailPayload.parcel?.items?.reduce((total, item) => {
            return total + ((item.value || 0) * (item.quantity || 1));
        }, 0) || 0;

        // FIXED: Properly set up the request for single vendor
        this.requestDetails.req.params.endpoint = 'pickup';
        this.requestDetails.req.body = {
            rate_id: shipmentDetailPayload.rate_id,
            cash_to_collect: cashToCollect,
            purchase_insurance: false
        };



        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
        const pickupEndpoint = await db.endpoints.findOne({ where: { slug: 'pickup', tenant_id: tenant.id } });
        if (!pickupEndpoint) throw new Error('Pickup endpoint not configured');

        const pickupRequestDetails = await validateRequest({ tenant, endpoint: pickupEndpoint, req: this.requestDetails.req, res: this.requestDetails.res });
        const pickupResponse = await sendRequest(pickupRequestDetails);
        const pickupData = JSON.parse(pickupResponse.data);

        if (!pickupData.status) {
            throw new Error(`Terminal Africa Pickup Error: ${pickupData.message || 'Unknown error'}`);
        }

        const shipmentId = pickupData?.data?.shipment_id;

        // Create shipment record
        await db.shipment.create({
            order_id: order.id,
            shipment_id: shipmentId,
            status: pickupData?.data?.status || 'created',
            carrier_reference: shipmentDetailPayload.carrier_reference,
            rate_id: shipmentDetailPayload.rate_id,
            tracking_number: pickupData?.data?.extras?.tracking_number,
            tracking_url: pickupData?.data?.extras?.tracking_url,
            vendor_id: 'single_vendor',
            cash_collected: cashToCollect
        });

        shipmentResults.successful.push({
            vendor_id: 'single_vendor',
            shipment_id: shipmentId,
            rate_id: shipmentDetailPayload.rate_id,
            carrier_reference: shipmentDetailPayload.carrier_reference,
            tracking_number: pickupData?.data?.extras?.tracking_number,
            tracking_url: pickupData?.data?.extras?.tracking_url,
            delivery_type: deliveryType,
            status: pickupData?.data?.status,
            cash_collected: cashToCollect
        });

        shipmentIds.push(shipmentId);

    } catch (error) {
        console.error(` Failed to arrange pickup for single vendor:`, error);
        shipmentResults.failed.push({
            vendor_id: 'single_vendor',
            error: error.message,
            rate_id: shipmentDetailPayload.rate_id,
            carrier_reference: shipmentDetailPayload.carrier_reference,
            error_stage: 'pickup_arrangement'
        });
    }
};

/**
 * Build comprehensive order response
 */
const buildOrderResponse = (zohoOrder, shipmentResults, order) => {
    const hasShipmentResults = shipmentResults.successful.length > 0 || shipmentResults.failed.length > 0;

    const response = {
        success: true,
        salesorder: {
            salesorder_id: zohoOrder.salesorder?.salesorder_id,
            salesorder_number: zohoOrder.salesorder?.salesorder_number,
            status: 'created',
            message: 'Order created successfully'
        }
    };

    // Add shipment results if shipments were attempted
    if (hasShipmentResults) {
        const totalShipments = shipmentResults.successful.length + shipmentResults.failed.length;
        const successfulShipments = shipmentResults.successful.length;
        const failedShipments = shipmentResults.failed.length;

        response.shipment_summary = {
            total_vendors: totalShipments,
            successful: successfulShipments,
            failed: failedShipments,
            all_successful: failedShipments === 0,
            status: failedShipments === 0
                ? 'all_shipments_created'
                : successfulShipments > 0
                    ? 'partial_shipments_created'
                    : 'no_shipments_created'
        };

        response.shipment_results = shipmentResults;

        // User-friendly message
        if (failedShipments === 0) {
            response.message = `Order created successfully. All ${successfulShipments} shipment(s) created and awaiting carrier pickup.`;
        } else if (successfulShipments > 0) {
            response.message = `Order created successfully. ${successfulShipments} of ${totalShipments} shipment(s) created. ${failedShipments} failed. Support will contact you regarding the failed shipments.`;
        } else {
            response.message = `Order created successfully, but shipment creation failed for all ${totalShipments} vendor(s). Our team will contact you to arrange alternative delivery.`;
        }
    } else {
        response.message = 'Order created successfully.';
    }

    return response;
};

class WeebHooksHelper {
    log
    constructor(endpoint, req, res, makeRequest) {
        this.endpoint = endpoint
        this.req = req
        this.res = res
        this.makeRequest = makeRequest
    }

    async callMethods() {
        let method = this.endpoint + '()'
        this.log = await db.requests.create({
            originating_route: this.req.originalUrl,
            payload: JSON.stringify(this.req.body)
        })
        try {
            return await eval('this.' + method)
        } catch (error) {
            console.log(error.message)
            this.log.response = JSON.stringify(error)
            await this.log.save()
            return this.res.status(400).send(error.message)
        }
    }

    terminalafrica = async () => {
        return await WebhookController.handleTerminalAfricaWebhook(this.req, this.res, this.updateZohoSalesOrder.bind(this));
    }

    // HANDLE SHIPMENT EVENT FUNCTION
    handleShipmentEvent = async (event, data, shipment, order, io) => {
        const status = eventToStatus[event] || 'unknown';

        if (shipment) {
            // Update shipment status
            await shipment.update({
                status: status,
                ...(data.tracking_number && { tracking_number: data.tracking_number }),
                ...(data.tracking_url && { tracking_url: data.tracking_url })
            });

            // Create shipment history record
            await db.shipment_history.create({
                shipment_id: shipment.id,
                status: status,
                description: `Shipment ${event.replace('shipment.', '')}`,
                metadata: JSON.stringify(data),
                source: 'terminal_africa'
            });
        }

        if (order) {
            // Update order shipment status
            await updateOrderShipmentStatus(order, shipment, status, event, data);

            // SEND STATUS EMAIL TO CUSTOMER (ALWAYS)
            await sendShipmentStatusEmail(order, shipment, status, data);

            // Notify frontend
            notifyFrontend(io, event, {
                shipment_id: data.shipment_id,
                order_id: order.id,
                status: status,
                tracking_number: data.tracking_number,
                tracking_url: data.tracking_url
            });

            if (event === 'shipment.delivered') {
                order.delivered_at = new Date();
                // Approve commission
                await approveAgentCommission(order);
            }

            if (event === 'shipment.cancelled') {
                order.cancellation_reason = data.cancellation_reason;
                // Reverse commission if needed
                if (order.commission && order.order_id) {
                    await walletController.reverseCommision(order.order_id, order.amount);
                }
            }

            await order.save();
        }

        await logWebhook(event, data, order?.id);
    }

    /**
  *  shipment creation pstack, startbutton
  */

    createShipmentsForOrder = async function (order) {
        try {
            let shipmentResults = {
                successful: [],
                failed: [],
                details: []
            };

            let shipmentIds = [];
            let shipmentDetailPayload = JSON.parse(order.shipment_details);

            // Extract delivery configuration
            const deliveryType = shipmentDetailPayload.delivery_type;
            const isMultiVendor = shipmentDetailPayload.isMultiVendor;

            // Extract vendor data
            const vendorRateMapping = shipmentDetailPayload.metadata?.vendor_rate_mapping ||
                shipmentDetailPayload.dispatcher?.metadata?.vendor_rate_mapping || [];

            const vendorBreakdown = shipmentDetailPayload.metadata?.vendor_breakdown ||
                shipmentDetailPayload.dispatcher?.metadata?.vendor_breakdown || [];

            const carrierReference = shipmentDetailPayload.metadata?.carrier_reference ||
                shipmentDetailPayload.carrier_reference ||
                shipmentDetailPayload.dispatcher?.carrier_reference;

            // Set up request context for delivery processing functions
            this.req.params = { "tenant": "terminalAfrica" };

            // Delivery type detection and processing
            const hasAggregatedDelivery = deliveryType === 'aggregated' && vendorRateMapping.length > 0;
            const hasPerVendorDelivery = deliveryType === 'per-vendor' && shipmentDetailPayload.vendor_selections;
            const hasSingleVendorDelivery = deliveryType === 'single' && shipmentDetailPayload.rate_id;

            if (hasAggregatedDelivery) {
                await processAggregatedDelivery.call(
                    { requestDetails: { req: this.req, res: this.res } },
                    vendorRateMapping,
                    shipmentDetailPayload,
                    order,
                    shipmentResults,
                    shipmentIds,
                    deliveryType,
                    carrierReference
                );
            } else if (hasPerVendorDelivery) {
                await processPerVendorDelivery.call(
                    { requestDetails: { req: this.req, res: this.res } },
                    shipmentDetailPayload.vendor_selections,
                    order,
                    shipmentResults,
                    shipmentIds,
                    deliveryType
                );
            } else if (hasSingleVendorDelivery) {
                await processSingleVendorDelivery.call(
                    { requestDetails: { req: this.req, res: this.res } },
                    shipmentDetailPayload,
                    order,
                    shipmentResults,
                    shipmentIds,
                    deliveryType
                );
            } else {
                console.warn(" No valid delivery configuration found for shipment creation in webhook");
            }

            // Update order status and tracking history
            await updateOrderStatusBasedOnShipments(order, shipmentResults);

            // Log webhook events for shipment creation
            await logInitialWebhookEvents(order, shipmentResults);

            // Send notification emails
            const user = await db.users.findOne({ where: { id: order.user_id } });
            if (user) {
                const zohoOrder = { salesorder: { salesorder_number: order.order_ref } };
                const customerData = await this.getCustomerDataFromOrder(order);

                // Send customer notification
                const customerEmailContent = buildCustomerOrderEmailContent(order, shipmentResults, zohoOrder);
                await sendCustomerEmail(
                    order,
                    'Your Order is Confirmed & Shipping Arranged',
                    customerEmailContent,
                    'order_shipped'
                );

                // Send agent notification if applicable
                if (order.agent_id) {
                    const agent = await db.users.findOne({ where: { id: order.agent_id } });
                    if (agent) {
                        const agentEmailContent = buildAgentOrderEmailContent(order, shipmentResults, zohoOrder, customerData);
                        await sendAgentEmail(
                            agent,
                            order,
                            `Order ${order.order_ref} - Shipment Arranged`,
                            agentEmailContent,
                            'order_shipped'
                        );
                    }
                }
            }

            return shipmentIds.toString();

        } catch (error) {
            console.error('Error creating shipments in webhook:', error);

            // Log the error
            await db.webhook_logs.create({
                event_type: 'webhook_shipment_creation_failed',
                order_id: order.id,
                payload: JSON.stringify({
                    error: error.message,
                    stack: error.stack,
                    order_id: order.id
                }),
                processed: false,
                error_message: error.message,
                source: 'payment_webhook'
            });

            throw error;
        }
    };


    /**
     * Get customer data from order
     */
    getCustomerDataFromOrder = async (order) => {
        try {
            const shipmentDetails = JSON.parse(order.shipment_details);
            const deliveryAddress = shipmentDetails.delivery_address;

            return {
                first_name: deliveryAddress.first_name,
                last_name: deliveryAddress.last_name,
                email: deliveryAddress.email,
                phone: deliveryAddress.phone
            };
        } catch (error) {
            console.error('Error getting customer data from order:', error);
            return null;
        }
    };


    /**
     * PayStack webhook
     * @returns 
     */
    pstack = async () => {
        try {
            const secret = process.env.PAY_STACK_SECRET_KEY;
            const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(this.req.body)).digest('hex');

            if (hash !== this.req.headers['x-paystack-signature']) {
                return this.res.status(401).send();
            }

            const request = this.req?.body;
            let orderId = request?.data?.reference;

            // Log webhook receipt
            await db.webhook_logs.create({
                event_type: 'payment_webhook_received',
                order_id: orderId,
                payload: JSON.stringify({
                    provider: 'paystack',
                    event: request.event,
                    status: request.data?.status,
                    reference: orderId,
                    received_at: new Date()
                }),
                processed: true,
                source: 'paystack_webhook'
            });

            if (request?.data?.status == 'success') {
                const order = await db.orders.findOne({ where: { order_id: orderId } });

                if (order) {
                    // Update payment status
                    order.payments = 'paid';

                    // Create shipments if not a fulfilment centre pickup
                    if (order.pickUpMethod !== "fulfilment_centre") {
                        try {
                            order.shipment_id = await createShipmentsForOrder.call(this, order);

                            // Add to tracking history
                            await appendTrackingHistory(
                                order,
                                'payment_confirmed',
                                'Payment confirmed and shipments arranged',
                                {
                                    payment_provider: 'paystack',
                                    reference: orderId
                                }
                            );
                        } catch (shipmentError) {
                            console.error('Shipment creation failed in PayStack webhook:', shipmentError);

                            // Still update payment status even if shipment creation fails
                            await appendTrackingHistory(
                                order,
                                'payment_confirmed_shipment_failed',
                                'Payment confirmed but shipment creation failed. Support will contact you.',
                                {
                                    payment_provider: 'paystack',
                                    error: shipmentError.message
                                }
                            );
                        }
                    } else {
                        // For fulfilment centre orders, just update tracking
                        await appendTrackingHistory(
                            order,
                            'payment_confirmed',
                            'Payment confirmed - ready for pickup',
                            {
                                payment_provider: 'paystack',
                                pickup_location: 'fulfilment_centre'
                            }
                        );
                    }

                    await order.save();
                }

                // Update Zoho order status
                if (orderId) {
                    let status = this.mapWebHookPaymentResponse(request.data.status);
                    await this.updateZohoSalesOrder(orderId, status);
                }
            }

            return this.res.status(200).send();
        } catch (error) {
            console.error('PayStack webhook error:', error);

            // Log webhook error
            if (orderId) {
                await db.webhook_logs.create({
                    event_type: 'payment_webhook_error',
                    order_id: orderId,
                    payload: JSON.stringify({
                        provider: 'paystack',
                        error: error.message,
                        stack: error.stack
                    }),
                    processed: false,
                    error_message: error.message,
                    source: 'paystack_webhook'
                });
            }

            return this.res.status(500).send();
        }
    }

    /**
     * StartButton webhook
     * @returns
     */
    startbutton = async () => {
        try {
            const secret = process.env.STARTBUTTON_WEBHOOK_SECRET;
            const signature = this.req.headers['x-startbutton-signature'];
            const payload = JSON.stringify(this.req.body);
            const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

            if (signature !== expectedSignature) {
                return this.res.status(401).send();
            }

            const { event, data } = this.req.body;

            // Log webhook receipt
            await db.webhook_logs.create({
                event_type: 'payment_webhook_received',
                order_id: data.reference,
                payload: JSON.stringify({
                    provider: 'startbutton',
                    event: event,
                    status: data.status,
                    reference: data.reference,
                    received_at: new Date()
                }),
                processed: true,
                source: 'startbutton_webhook'
            });

            // Accept multiple success event types
            const isSuccess = (
                (event === 'payment.success' || event === 'verified' || event === 'successful') &&
                data.status && ['success', 'verified', 'successful'].includes(data.status)
            );

            if (isSuccess) {
                let orderId = data.reference;
                const order = await db.orders.findOne({ where: { order_id: orderId } });

                if (order) {
                    order.payments = 'paid';

                    if (order.pickUpMethod !== "fulfilment_centre") {
                        try {
                            order.shipment_id = await createShipmentsForOrder.call(this, order);

                            // Add to tracking history
                            await appendTrackingHistory(
                                order,
                                'payment_confirmed',
                                'Payment confirmed and shipments arranged',
                                {
                                    payment_provider: 'startbutton',
                                    reference: orderId
                                }
                            );
                        } catch (shipmentError) {
                            console.error('Shipment creation failed in StartButton webhook:', shipmentError);

                            await appendTrackingHistory(
                                order,
                                'payment_confirmed_shipment_failed',
                                'Payment confirmed but shipment creation failed. Support will contact you.',
                                {
                                    payment_provider: 'startbutton',
                                    error: shipmentError.message
                                }
                            );
                        }
                    } else {
                        await appendTrackingHistory(
                            order,
                            'payment_confirmed',
                            'Payment confirmed - ready for pickup',
                            {
                                payment_provider: 'startbutton',
                                pickup_location: 'fulfilment_centre'
                            }
                        );
                    }

                    await order.save();
                }
            }

            return this.res.status(200).send();
        } catch (err) {
            console.error('StartButton webhook error:', err);

            // Log webhook error
            if (data?.reference) {
                await db.webhook_logs.create({
                    event_type: 'payment_webhook_error',
                    order_id: data.reference,
                    payload: JSON.stringify({
                        provider: 'startbutton',
                        error: err.message,
                        stack: err.stack
                    }),
                    processed: false,
                    error_message: err.message,
                    source: 'startbutton_webhook'
                });
            }

            return this.res.status(500).send();
        }
    }
    /**
     * Zoho order webhook
     * @returns 
     */
    webHooks = async () => {
        const request = this.req.body
        const invoice = request.hasOwnProperty('invoice')
        let status = invoice ? request.invoice?.status : request.salesorder?.status
        let orderId = request.hasOwnProperty('invoice') ? request.invoice?.salesorder_id : request.salesorder?.salesorder_id
        if (!orderId) {
            this.log.response = 'No order id found'
            await this.log.save()
            return this.res.status(200).send()
        }
        const order = await db.orders.findOne({ where: { order_id: orderId } })
        if (order) {
            const user = await this.getAgentOnStoreOrder(order)
            const storeORderCurrency = order.currency ? JSON.parse(order.currency).rate : 1
            const storedOrderTotal = utils.getOrderDetailTotalAmount(order)
            const difTotla = !invoice ? parseFloat(storedOrderTotal) !== parseFloat(request.salesorder.total) : false
            if (difTotla) {
                order.order_details = await this.updateOrder(request, JSON.parse(order.order_details))
                order.amount = request.salesorder.total * storeORderCurrency
                if (order.types !== 'sample' && storeORderCurrency > 1 && user) {
                    await walletController.reverseCommision(request.salesorder.salesorder_id, storedOrderTotal)
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    order.commission = await walletController.createCommision(request.salesorder, user, storeORderCurrency)
                }
            }
            if (!invoice) order.status = status
            if (invoice) order.payments = status
            order.save()
        }
        if (!order && !invoice) await this.syncDirectOrder(request)
        this.log.response = 'Order found and handled'
        await this.log.save()
        return this.res.status(201).send()
    }


    payagent = async () => {
        const request = this.req.body
        const orderId = request.salesorder?.salesorder_id
        const customFields = request?.salesorder?.custom_fields
        const payTagPS = customFields ? customFields.find(dat => dat.label == 'PS')?.value ?? null : null
        try {
            if (!orderId && payTagPS !== "Yes") return this.res.status(400).send("Invalid request")
            const order = await db.orders.findOne({ where: { order_id: orderId } })
            if (!order) {
                this.log.response = "Order not found"
                return this.res.status(404).send("Order not found")
            } const updated = await this.updateWalletHistoryOnFulfill(orderId, order.status, order)
            this.log.response = JSON.stringify(updated)
            await this.log.save()
            return this.res.status(200).send(updated)
        } catch (error) {
            this.log.response = JSON.stringify(error)
            await this.log.save()
            throw new Error(error)
        }
    }


    updateWalletHistoryOnFulfill = async (orderId, status, order) => {
        const wallet_history = await db.wallet_history.findOne({
            where: { order_id: orderId, type: 'commission', status: 'pending' }
        })

        if (wallet_history && status == 'fulfilled') {
            const attribute = await db.attributes.findOne({ where: { slug: 'sales_person_id' } })
            const sales_person_id = (await db.user_attributes.findOne({ where: { user_id: wallet_history.user_id, attribute_id: attribute.id } }))?.value
            if (!sales_person_id) throw new Error('Sales person id not found for user ' + wallet_history.user_id)
            wallet_history.status = 'paid'
            wallet_history.save()
            try {
                const wallet = await this.updateWallet(wallet_history, order)
                return await this.updateSalesPersonZohoProfile(wallet, sales_person_id)
            } catch (error) {
                throw new Error(error.message)
            }
        } else {
            const mesg = wallet_history ? status : JSON.stringify(wallet_history)
            return { "meg": mesg }
        }
    }

    updateWallet = async (wallet_history, order) => {
        try {
            const wallet = await db.wallets.findOne({ where: { user_id: wallet_history.user_id } })
            wallet.ledger_balance += wallet_history?.amount ?? wallet.ledger_balance
            !isNaN(wallet.lifetime_sales_value_verified) ? wallet.lifetime_sales_value_verified += utils.getOrderDetailTotalAmount(order) : wallet.lifetime_sales_value_verified = utils.getOrderDetailTotalAmount(order)
            !isNaN(wallet.lifetime_sales_count_verified) ? wallet.lifetime_sales_count_verified += 1 : wallet.lifetime_sales_count_verified = 1
            !isNaN(wallet.lifetime_commision_verified) ? wallet.lifetime_commision_verified += wallet_history?.amount : wallet.lifetime_commision_verified = wallet_history?.amount
            await wallet.save()
            return wallet
        } catch (error) {
            throw new Error(error)
        }

    }

    updateSalesPersonZohoProfile = async (wallet, sales_person_id) => {
        this.req.params = { 'tenant': 'crm', 'endpoint': 'update-salesperson' }
        this.req.query = { 'sales_person_id': sales_person_id }
        this.req.body = { "data": [{ "Revenue_generated": wallet.lifetime_sales_value_verified.toString(), "Earned_Commission": wallet.lifetime_commision_verified.toString() }], return: 1 }
        return await this.makeRequest(this.req, this.res)

    }

    updateZohoSalesOrder = async (salesordersId, paymentStatus = '', shipment_status, order_ref) => {
        this.req.params = { 'tenant': 'zoho', 'endpoint': 'update-orders' }
        this.req.query = { 'order_id': salesordersId }
        if (paymentStatus) {
            this.req.body = {
                "return": 1,
                "salesorder_number": order_ref.toString(),
                "custom_fields": [
                    { "label": "Payment Status", "value": paymentStatus },
                ]
            }
        }

        this.req.body = {
            "return": 1,
            "salesorder_number": order_ref.toString(),
            "custom_fields": [
                { "label": "Shipment Status", "value": shipment_status }]
        }
        let response = await this.makeRequest(this.req, this.res)
        return response
    }

    shipOrder = async (order) => {
        const carrierId = order.shipment_details ? JSON.parse(order.shipment_details)?.carrier_id : null
        if (carrierId) {
            this.req.params = { "tenant": "terminalAfrica", "endpoint": 'pickup' }
            this.req.body = JSON.parse(order.shipment_details)
            const { tenant, endpoint } = await getTenantAndEndpoint(this.req.params)
            const requestDetails = await validateRequest({ tenant, endpoint, req: this.req, res: this.res })
            const shipment = await sendRequest(requestDetails)
            return JSON.parse(shipment.data)?.data?.shipment_id
        }
    }

    createAndCalculateCommision = async (orderId) => {

        let savedOrderId = this.requestDetails.req.query.orderId
        let order = await db.orders.findOne({ where: { order_id: orderId } })
        const commission = await walletController.createCommision(order, user)
        order.order_id = zohoOrder.salesorder?.salesorder_id
    }

    updateOrder = async (request, storeORder) => {
        for (let item of request.salesorder.line_items) {
            let found = storeORder?.filter(product => { return product?.item_id == item.product_id })
            let idx = storeORder.findIndex((stord) => { return stord.item_id == item.item_id })
            if (found.length > 0) {
                let { rate, quantity, item_total } = item
                let foundObj = found[0]
                foundObj.rate = rate
                foundObj.total_price = item_total
                foundObj.quantity = quantity
                storeORder[idx] = foundObj
            }
        }

        return JSON.stringify(storeORder)
    }
    mapWebHookPaymentResponse = (status) => {
        // Allowed status "Pending, Success, Fail"
        const items = { "pending": 'Pending', "success": 'Success', "failed": 'Fail', 'Declined': 'Fail' }
        return items[status] ?? 'Pending'
    }

    async syncDirectOrder(order) {
        const custom = order.salesorder.custom_fields
        const orderOnwner = custom.find(dat => dat.label == 'Agent Email')?.value ?? null
        const customerEmail = custom.find(dat => dat.label == 'Customer Email')?.value ?? null
        if (!(orderOnwner ?? customerEmail)) return
        const VendorOrderHelper = require("./vendorOrderHelper.js")
        try {
            const { getUser } = require('../controllers/userController')
            const { getCartDetails } = require('../controllers/cartController')
            const user = flattenObj(await getUser(orderOnwner, null, true) ?? {})
            const userCustomer = flattenObj(await getUser(customerEmail, null, true) ?? {})
            if ((Object.values(user).length + Object.values(userCustomer).length) < 1) return 'User not found'
            if ((Object.values(user).length + Object.values(userCustomer).length) < 1) return 'User not found'
            const lineItems = order.salesorder.line_items.map(items => {
                return {
                    productId: items.product_id,
                    qty: items.quantity
                }
            })
            const customerName = order.salesorder?.customer_name.split(' ')
            order.salesorder.shipping_address.first_name = customerName[0]
            order.salesorder.shipping_address.last_name = customerName[1]
            const rate = parseFloat(custom.find(dat => dat.label == 'Exchange Rate')?.value ?? "1")
            const symbol = custom.find(dat => dat.label == 'Currency code')?.value ?? 'USD'
            const currency = JSON.stringify({ symbol: symbol, rate: rate })
            const cartDetails = await getCartDetails({ products: JSON.stringify(lineItems) })
            const commission = user ? await walletController.createCommision(order?.salesorder, user, rate) : null
            if (Array.isArray(order.salesorder?.contact_persons_associated) && order.salesorder?.contact_persons_associated.length > 0)
                order.salesorder.shipping_address.email = order.salesorder?.contact_persons_associated[0].contact_person_email ?? null
            const savedOrder = await db.orders.create({
                order_id: order.salesorder.salesorder_id, status: order.salesorder.status, order_ref: order.salesorder.salesorder_number,
                user_id: user?.id ?? userCustomer?.id, agent_id: !user ? null : userCustomer?.id ?? null, order_details: JSON.stringify(cartDetails.items), payments: "admin", commission: commission,
                user_id: user?.id ?? userCustomer?.id, agent_id: !user ? null : userCustomer?.id ?? null, order_details: JSON.stringify(cartDetails.items), payments: "admin", commission: commission,
                shipment_details: JSON.stringify({ delivery_address: order.salesorder.shipping_address }), amount: order.salesorder.total * rate, currency: currency
            })
            await (new VendorOrderHelper()).createVendorOrderDetail(savedOrder.id)
            return savedOrder
        } catch (error) {
            console.log(error)
            return
        }
    }


    getAgentOnStoreOrder = async (savedOrder) => {
        const userControler = require('../controllers/userController');
        try {
            let order = savedOrder
            let agentDetails = utils.flattenObj(await userControler.getUser(null, null, true, null, null, order.user_id))
            let isAgent = agentDetails.account_types.split(',').includes('agent') ? agentDetails : null
            if (!isAgent) {
                const customerAgent = order.agent_id ? utils.flattenObj(await userControler.getUser(null, null, true, null, null, order.agent_id)) : null
                const isCustomerAgent = customerAgent ? customerAgent.account_types.split(',').includes('agent') : null
                isAgent = isCustomerAgent ? customerAgent : null
            }
            return isAgent
        } catch (error) {
            console.log(error)
            return false
        }
    }

    async sync_sales_person_revenue() {
        const email = this.req.body?.email ?? null
        if (!email) return this.res.status(200).send()
        const { getUser } = require('../controllers/userController')
        const user = flattenObj(await getUser(email, null, true) ?? {})
        if (!user) return this.res.status(200).send()
        const wallet = await db.wallets.findOne({ where: { user_id: user.id } })
        if (!wallet) return this.res.status(200).send()
        const response = await this.updateSalesPersonZohoProfile(wallet, user.sales_person_id)
        this.log.response = JSON.stringify(response)
        await this.log.save()
        return this.res.status(200).send(response)
    }
}

module.exports.WeebHooksHelper = WeebHooksHelper
