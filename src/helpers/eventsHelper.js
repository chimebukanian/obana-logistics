const { sendRequest } = require('../helpers/sendRequestHelper')
const { validateRequest, getTenantAndEndpoint } = require('../helpers/requestValidator')
const walletController = require('../controllers/walletController')
const cartControler = require("../controllers/cartController.js")
const VendorOrderHelper = require("./vendorOrderHelper.js")
const ContactHelper = require('./zohoContactHelper.js')
const { AdminHelper } = require('./adminHelper.js')
const { QuoteRequest } = require('./quoteRequestHelper.js')
const { SampleRequest } = require('./sampleRequestHelper.js')
const db = require('../models/db.js')
const util = require('../../utils.js')
const { Op } = require('sequelize')
const utils = require('../../utils.js')
const nodemailer = require('../mailer/nodemailer.js')
const { OrderHelper } = require('./orderHelper.js')
const { default: axios } = require('axios')
const { request } = require('express')
const { ErrorReply } = require('redis')

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
 * Check if user is agent
 */
const isUserAgent = (user) => {
    try {
        if (!user || !user.account_types) return false;
        return user.account_types.split(',').includes('agent');
    } catch (error) {
        console.error('Error checking user agent status:', error);
        return false;
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



        await nodemailer.sendMail({
            email: customerEmail,
            subject: subject,
            content: content,
            type: emailType
        });


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
const sendAgentEmail = async (user, order, subject, content, emailType = 'agent_notification') => {
    try {
        if (!isUserAgent(user)) {
            return false;
        }

        if (!user.email) {
            return false;
        }


        await nodemailer.sendMail({
            email: user.email,
            subject: subject,
            content: content,
            type: emailType
        });

        // Log agent email
        await db.webhook_logs.create({
            event_type: `email_agent_${emailType}_sent`,
            order_id: order.id,
            payload: JSON.stringify({
                recipient: user.email,
                agent_id: user.id,
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
                agent_id: user.id
            }),
            processed: false,
            error_message: error.message,
            source: 'system'
        });

        return false;
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
const processSingleVendorDelivery = async function (shipmentDetailPayload, order, shipmentResults, shipmentIds, deliveryType, rate) {
    let tracking_url;
    let carrierName;
    let shipmentId;
    let order_created;
    const originalReq = { ...this.requestDetails.req };

    try {
        if (!shipmentDetailPayload.rate_id) {
            throw new Error(`No rate_id found for single vendor delivery`);
        }

        const cashToCollect = shipmentDetailPayload.parcel?.items?.reduce((total, item) => {
            return total + ((item.value || 0) * (item.quantity || 1));
        }, 0) || 0;


        this.requestDetails.req.params.endpoint = 'pickup';
        this.requestDetails.req.body = {
            rate_id: shipmentDetailPayload.rate_id,
            cash_to_collect: cashToCollect,
            purchase_insurance: false
        };



        let { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
        const pickupEndpoint = await db.endpoints.findOne({ where: { slug: 'pickup', tenant_id: tenant.id } });
        if (!pickupEndpoint) throw new Error('Pickup endpoint not configured');

        const pickupRequestDetails = await validateRequest({ tenant, endpoint: pickupEndpoint, req: this.requestDetails.req, res: this.requestDetails.res });
        const pickupResponse = await sendRequest(pickupRequestDetails);
        const pickupData = JSON.parse(pickupResponse.data);

        if (!pickupData.status) {
            throw new Error(`Terminal Africa Pickup Error: ${pickupData.message || 'Unknown error'}`);
        }

        shipmentId = pickupData?.data?.shipment_id;

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

        order_created = shipmentResults.successful[0] ? 'pending' : "failed"
        const shipmentDetails = typeof order.shipment_details === 'string'
            ? JSON.parse(order.shipment_details)
            : order.shipment_details || {};

        carrierName = shipmentDetails?.dispatcher?.carrier_name || 'Unknown Carrier';

        // const shipmentInfo = {
        //     shipment_status: order_created,
        //     shipment_id: shipmentId,
        //     tracking_url,
        //     shipping_fee: order?.shipping_fee,
        //     carrier_name: carrierName
        // };

        let response = await this.zoho_update(order, shipmentId, order_created, tracking_url, carrierName, rate)

        this.requestDetails.req = originalReq;


        return response
    } catch (error) {
        console.error(` Failed to arrange pickup for single vendor:`, error);
        shipmentResults.failed.push({
            vendor_id: 'single_vendor',
            error: error.message,
            rate_id: shipmentDetailPayload.rate_id,
            carrier_reference: shipmentDetailPayload.carrier_reference,
            error_stage: 'pickup_arrangement'
        });
        const shipmentDetails = typeof order.shipment_details === 'string'
            ? JSON.parse(order.shipment_details)
            : order.shipment_details || {};
        carrierName = shipmentDetails?.dispatcher?.carrier_name || 'Unknown Carrier';
        const originalReq = { ...this.requestDetails.req };

        try {


            this.requestDetails.req.params = { 'tenant': 'zoho', 'endpoint': 'update-orders' }
            this.requestDetails.req.query = { 'order_id': order.order_id }
            this.requestDetails.req.body = {
                "return": 1,
                "salesorder_number": order.order_ref.toString(),
                "shipping_charge": order.shipping_fee.toString(),
                "custom_fields": [
                    { "label": "Shipment Status", "value": "failed" },
                    { "label": "Shipment Id", "value": "Null" },
                    // { "label": "Shipment Fee", "value": order.shipping_fee.toString() },
                    { "label": "Tracking URL", "value": 'Null' },
                    { "label": "Carrier Name", "value": carrierName }
                ]
            };
            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });

            let response = await sendRequest(requestDetails);

            this.requestDetails.req = originalReq;
        } catch (error) {
            console.error('Error syncing to zoho:', error);
            this.requestDetails.req = originalReq;

        } finally {
            this.requestDetails.req = originalReq;
        }
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

// FIXED: Add the missing shopperNotification method
const shopperNotification = async (order, user, zohoOrder, agentDetails) => {
    let d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }))
    const date = d.toDateString() + " " + d.toLocaleTimeString()


    const customerEmail = extractCustomerEmailFromShipment(order.shipment_details);

    if (customerEmail) {
        nodemailer.sendMail({
            email: customerEmail,
            content: {
                orderNumber: order.order_ref,
                user: `${user.last_name} ${user.first_name}`,
                date: zohoOrder.salesorder?.created_time_formatted ?? date,
                total: zohoOrder.salesorder?.total_formatted ?? order?.amount ?? 0.0
            },
            subject: 'Order Placement',
            template: 'customerOrder'
        })
    }

    if (agentDetails)
        nodemailer.sendMail({
            email: agentDetails.email,
            content: {
                orderNumber: order.order_ref,
                user: `${agentDetails.last_name} ${agentDetails.first_name}`,
                date: zohoOrder.salesorder?.created_time_formatted ?? date,
                total: zohoOrder.salesorder?.total_formatted ?? order?.amount ?? 0.0,
                name: `${user?.last_name} ${user?.first_name}`,
                phone: user.phone
            },
            subject: 'Order Placement',
            template: 'customerAgentOrder'
        })
}



const updateZohoSalesOrder = async (requestDetails, salesordersId, shipmentData, order_ref) => {
    const { shipment_status, shipment_id, tracking_url, shipment_fee, carrier_name } = shipmentData;


    requestDetails.params = { tenant: 'zoho', endpoint: 'update-orders' };
    requestDetails.query = { order_id: salesordersId };

    requestDetails.payload = {
        return: 1,
        salesorder_number: order_ref.toString(),
        shipping_charge: shipping_fee,
        custom_fields: [
            { label: "Shipment Status", value: shipment_status },
            { label: "Shipment ID", value: shipment_id },
            { label: "Shipment Fee", value: shipment_fee },
            { label: "Tracking URL", value: tracking_url },
            { label: "Carrier Name", value: carrier_name }
        ]
    };

    const response = await this.makeRequest(this.req, this.res);

    return response;
};
class EventstHelper {

    requestDetails

    constructor(requestDetails) {
        this.requestDetails = requestDetails
        this.adminHelper = new AdminHelper()
        this.QuoteRequest = new QuoteRequest(db, requestDetails.req.params.endpoint, requestDetails.req, requestDetails.res)
        this.SampleRequest = new SampleRequest(db, requestDetails.req.params.endpoint, requestDetails.req, requestDetails.res)
    }

    //     async checkFulfilmentCentre() {
    //         const { pickup_address, delivery_address } = this.requestDetails.payload

    //         const sameAddress =
    //             pickup_address?.line1?.toLowerCase().trim() === delivery_address?.line1?.toLowerCase().trim() &&
    //             pickup_address?.city?.toLowerCase().trim() === delivery_address?.city?.toLowerCase().trim()

    //         if (sameAddress) {
    //             return {
    //                 carriers: [
    //                     {
    //                         id: "obana-fulfilment-centre",
    //                         name: "Fulfilment Centre Pickup",
    //                         service_type: "pickup",
    //                         cost: 0,
    //                         currency: "NGN",
    //                         eta_days: 0
    //                     }
    //                 ]
    //             }
    //         }

    //         // If rule doesn’t apply → let it continue
    //         return null
    //     }
    // }

    /*
    update zoho sales order
*/
    zoho_update = async (order, shipmentId, order_created, tracking_url, carrierName, rate) => {
        this.requestDetails.req.params.tenant = 'zoho';
        this.requestDetails.req.params.endpoint = 'update-orders';
        this.requestDetails.req.query = { order_id: order.order_id }

        this.requestDetails.req.body = {
            "return": 1,
            salesorder_number: order.order_ref.toString(),
            shipping_charge: order.shipping_fee / rate,
            custom_fields: [
                { label: "Shipment Status", value: order_created },
                { label: "Shipment Id", value: shipmentId },
                // { label: "Shipment Fee", value: order.shipping_fee },
                { label: "Tracking URL", value: tracking_url },
                { label: "Carrier Name", value: carrierName }
            ]
        };
        //    const response = await this.makeRequest(this.requestDetails.req, this.requestDetails.res);           
        const response = await require('../controllers/requestController.js').makeRequest(this.requestDetails.req, this.requestDetails.res);
        if (!response.code === '0') {
            throw new Error(response.message)
        }



        return response
    }

    manageRequestState = (action) => {
        const originalReq = { ...this.requestDetails.req };
        const originalRes = { ...this.requestDetails.res };

        try {
            return action();
        } finally {
            this.requestDetails.req = originalReq;
            this.requestDetails.res = originalRes;
        }
    };

    walletTransferPrep = async () => {
    return this.manageRequestState(async () => {
    const originalReq = { ...this.requestDetails.req };

    let userWallet;
    let superAdminWallet;
    let withdrawalAmount;
    const userController = require("../controllers/userController.js");
    const init_user = this.requestDetails.user;
    const req = this.requestDetails.req;
    const res = this.requestDetails.res;
    const user = await userController.getUser(init_user.email, init_user.phone, true, req, res, init_user.id);
    const payload = this.requestDetails.payload;
    const userAttributes = user.attributes || {};
    
    payload.payment_information = {}    
    payload.payment_information.bvn = payload.bvn || userAttributes.bvn
    payload.payment_information.bank_name = payload.bank_name || userAttributes.bank_name || ''
    payload.payment_information.account_number = payload.account_number || userAttributes.account_number || ''
    payload.payment_information.account_name = payload.account_name || userAttributes.account_name || ''

        userAttributes.phone =  user.phone;
    if (user.email && user.phone) {
        payload["email"] = user.email;
        payload["phone"] = userAttributes.phone 
    }
    try{
        // Required fields for wallet creation
        const alwaysRequiredFields = [
            'first_name', 'middle_name', 'last_name',
            'email', 'phone', 'customer_type',
            'date_of_birth', 'gender',
            'address', 'city', 'state', 'country', 'currency'
        ];
if (this.requestDetails.req.params.endpooint === "embedly-wallet-transfer") {

        const oneOfRequired = ['proof_of_address', 'bvn', 'nin'];
            const hasOneRequired = oneOfRequired.some(field =>
            userAttributes[field] || payload[field]
        );

        if (!hasOneRequired) {
            this.requestDetails.exit = true;
            this.requestDetails.exitMessage =
                `At least one of the following is required: ${oneOfRequired.join(', ')}.`;
            this.requestDetails.exitStatus = 400;
            return this.requestDetails.res.status(this.requestDetails.exitStatus).send({ 
                message: this.requestDetails.exitMessage, 
                code: this.requestDetails.exitStatus 
            });
        }
}

        
        const missingAlwaysRequired = alwaysRequiredFields.filter(field =>
            !userAttributes[field] && !payload[field]
        );
        if (missingAlwaysRequired.length > 0) {
            this.requestDetails.exit = true;
            this.requestDetails.exitMessage =
                `Missing required fields: ${missingAlwaysRequired.join(', ')}. Please update your profile.`;
            this.requestDetails.exitStatus = 400;
            throw new Error(this.requestDetails.exitMessage);
        }



        if (Object.keys(payload).length > 0) {
            await userController.createUserAttributes(user.id, payload);
            const updatedUser = await userController.getUser(user.email, user.phone, true, req, res, user.id);
            this.requestDetails.user = updatedUser;
            Object.assign(userAttributes, updatedUser.attributes);
        }
    withdrawalAmount = payload.amount;

            if (originalReq.params.endpoint === "embedly-wallet-transfer") {

    let isInterbankTransfer = false;

    const hasEmbedlyAccount = user.attributes?.customer_id && user.attributes?.wallet_id;
    let wallet_embedly;
    if (!hasEmbedlyAccount ||  (!Boolean(userAttributes.bvn_kyc) && (userAttributes.bvn || payload.bvn)) 
        || (!Boolean(userAttributes.nin_kyc) && (userAttributes.nin || payload.nin)) || (!Boolean(userAttributes.addr_kyc) && ((userAttributes.proof_of_address || payload.proof_of_address) && 
            (userAttributes.address || payload.address)))) {
        wallet_embedly = await this.createEmbedlyCustomerAndWallet();
        
        
        if (this.requestDetails.exit) {
            this.requestDetails.response = { statusCode: 400, data: this.requestDetails.exitMessage };
            return;
        }
    }

    
    this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'embedly-wallet' };
    this.requestDetails.req.query = { walletId: userAttributes.wallet_id || wallet_embedly.walletId};
    
                  const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });

    let  unparsedWalletResponse = await sendRequest(requestDetails);
    // console.log("walletResponse",unparsedWalletResponse)
    const walletResponse = typeof unparsedWalletResponse.data === "string"
    ? JSON.parse(unparsedWalletResponse.data)
    : unparsedWalletResponse.data;
    wallet_embedly = walletResponse;

    withdrawalAmount = payload.amount;
    if (!withdrawalAmount || withdrawalAmount <= 0) {
        this.requestDetails.exit = true;
        this.requestDetails.exitMessage = 'Invalid withdrawal amount';
        this.requestDetails.exitStatus = 400;
        throw new Error('Invalid withdrawal amount');

    }

    
    userWallet = wallet_embedly.data || wallet_embedly;
    if (!userWallet.id ) {
        this.requestDetails.exit = true;
        this.requestDetails.exitMessage = ' Embedly wallet not found for user';
        this.requestDetails.exitStatus = 400;
        throw new Error('Embedly wallet not found for user');
    }
    }

    let wallet = await db.wallets.findOne({ where: { user_id: user.id } });
        if (!wallet) {
            wallet = await db.wallets.create({
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
            });
            
        }
    // if (userWallet.balance < withdrawalAmount) {
    if (wallet.ledger_balance < withdrawalAmount) {

        this.requestDetails.exit = true;
        this.requestDetails.exitMessage = 'Insufficient funds in user wallet';
        this.requestDetails.exitStatus = 400;
        throw new Error('Insufficient funds in user wallet');
    }

    // if (superAdminWallet.balance < withdrawalAmount) {
    //     this.requestDetails.exit = true;
    //     this.requestDetails.exitMessage = 'Insufficient funds in system wallet. Please contact support.';
    //     this.requestDetails.exitStatus = 500;
    //     throw new Error('Insufficient funds in system wallet');

    // }
} catch (error) {
    console.error('trasnfer prep failed:', error);
         if (this.requestDetails.exit) {
            this.requestDetails.response = { statusCode: 400, data: this.requestDetails.exitMessage };
            return;
        }
}

    let transferPayload;
    let isInterbankTransfer = false;
    let bankName;
    if ((payload.account_number && originalReq.params.endpoint === "embedly-bank-transfer") && 
    (payload.bank_name || userAttributes.bank_name)) {
    
    
    isInterbankTransfer = true;
    
    
    bankName = payload.bank_name || userAttributes.bank_name;
    const bankCode = await this.getBankCode(bankName);
    // console.log("bankCode",bankCode)

    if (!bankCode) {
        this.requestDetails.response = { statusCode: 400, data: this.requestDetails.exitMessage };
        this.requestDetails.payload.return = true;
        return;
        
    }

    
    const currencyId = await this.getCurrencyId(payload.currency || userAttributes.currency || 'NGN');
    if (!currencyId) {
        this.requestDetails.response = { statusCode: 400, data: this.requestDetails.exitMessage };
        this.requestDetails.payload.return = true;
        return;
    }

    transferPayload = {
        destinationBankCode: bankCode,
        destinationAccountNumber: payload.account_number || userAttributes.account_number,
        destinationAccountName: payload.account_name || userAttributes.account_name || `${userAttributes.first_name} ${userAttributes.last_name}`,
        sourceAccountNumber: process.env.ADMIN_ACCOUNT_NO,
        sourceAccountName: process.env.ADMIN_ACCOUNT_NAME || "Icon Tech And Ecommerce Service Limited",
        remarks: `Withdrawal for user ${user.attributes.agent_id || user.id}`,
        amount: withdrawalAmount,
        currencyId: currencyId,
        customerTransactionReference: `EMBEDLY-IB-${user.id}-${Date.now()}`,
        webhookUrl: process.env.WEBHOOK_URL 
    };
   
} else {
    
    isInterbankTransfer = false;
    

     transferPayload = {
        fromAccount: process.env.ADMIN_ACCOUNT_NO,
        toAccount: userWallet?.virtualAccount.accountNumber || userAttributes.account_number,
        amount: withdrawalAmount,
        transactionReference: `EMBEDLY-${user.id}-${Date.now()}`,
        remarks: `Withdrawal for user ${user.attributes.agent_id || user.id}`,
        transactionTypeId: 1 
    };

}

    this.requestDetails.payload = transferPayload;
    
this.requestDetails.withdrawalInfo = {
    user_id: user.id,
    amount: withdrawalAmount,
    wallet_id: userWallet?.id,
    currency: payload.currency || 'NGN',
    fromAccount: process.env.ADMIN_ACCOUNT_NO,
    toAccount: userWallet?.virtualAccount.accountNumber,
    customerId: userWallet?.customerId,
    user: user,
    isInterbankTransfer: isInterbankTransfer,
    bankCode: isInterbankTransfer ? transferPayload.destinationBankCode : null,
    destinationAccount: isInterbankTransfer ? transferPayload.destinationAccountNumber : null,
    bank: bankName
};
        });
        
};


    /**
     * Create Embedly customer and wallet
     */
    createEmbedlyCustomerAndWallet = async () => {
        let walletId;
        let customerId;
        const userController = require("../controllers/userController.js");
        const init_user = this.requestDetails.user;
        const req = this.requestDetails.req;
        const res = this.requestDetails.res;
        const user = await userController.getUser(init_user.email, init_user.phone, true, req, res, init_user.id);
        const payload = this.requestDetails.payload;
        const userAttributes = user.attributes || {};


        try {

            // Get customer type ID
            const customerTypeId = await this.getCustomerTypeId(payload.customer_type || userAttributes.customer_type || 'Individual');

            if (!customerTypeId) {
                this.requestDetails.exit = true;
                this.requestDetails.exitMessage = 'Invalid customer type: ' + (payload.customer_type || userAttributes.customer_type);
                this.requestDetails.exitStatus = 400;
                throw new Error(this.requestDetails.exitMessage);
            }

            // Get country ID
            const countryId = await this.getCountryId(userAttributes.country || payload.country || 'Nigeria');
            if (!countryId) {
                this.requestDetails.exit = true;
                this.requestDetails.exitMessage = 'Invalid country';
                this.requestDetails.exitStatus = 400;
                throw new Error(this.requestDetails.exitMessage);
            }

            // Get currency ID
            const currencyId = await this.getCurrencyId(userAttributes.currency || payload.currency || 'NGN');
            if (!currencyId) {
                this.requestDetails.exit = true;
                this.requestDetails.exitMessage = 'Invalid currency';
                this.requestDetails.exitStatus = 400;
                throw new Error(this.requestDetails.exitMessage);
            }

            if (!userAttributes.customer_id) {
                const customerPayload = {
                    "OrganizationId": process.env.EMBEDLY_ORG_ID,
                    "FirstName": userAttributes.first_name || payload.first_name,
                    "LastName": userAttributes.last_name || payload.last_name,
                    "middleName": userAttributes.middle_name || payload.middle_name || '',
                    "emailAddress": user.email,
                    "MobileNumber": user.phone,
                    "dob": userAttributes.date_of_birth || payload.date_of_birth,
                    "customerTypeId": customerTypeId,
                    "Address": userAttributes.address || payload.address,
                    "City": userAttributes.city || payload.city || 'Lagos',
                    "countryId": countryId,
                    "alias": userAttributes.agent_id || `${user.id}`
                };


                let customerResponse;

                try {
                    this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'create-embedly-customer' };
                    this.requestDetails.req.body = customerPayload;

                    const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
                    const requestDetails = await validateRequest({
                        tenant,
                        endpoint,
                        req: this.requestDetails.req,
                        res: this.requestDetails.res
                    });
                    customerResponse = await sendRequest(requestDetails);

                    const parsed = typeof customerResponse.data === "string"
                        ? JSON.parse(customerResponse.data)
                        : customerResponse.data;

                    // Check for errors in response
                    if (!parsed.data || !parsed.code === '00' || !parsed.success) {
                        console.error("Customer creation validation errors:", parsed);
                        this.requestDetails.exit = true;
                        this.requestDetails.exitMessage = 'Customer creation failed: ' + JSON.stringify(parsed.message);
                        this.requestDetails.exitStatus = 400;
                        throw new Error(this.requestDetails.exitMessage);
                    }

                    customerResponse.data = parsed;

                } catch (error) {
                    console.error('Customer create error:', error);
                    this.requestDetails.exit = true;
                    this.requestDetails.exitMessage = 'Failed to create customer: ' + error;
                    this.requestDetails.exitStatus = 500;
                    return
                }

                const parsed = customerResponse.data;
                customerId = parsed.data?.id || parsed.id || parsed.customerId;

                if (!customerId) {
                    console.error("No customer ID in response:", parsed);
                    this.requestDetails.exit = true;
                    this.requestDetails.exitMessage = 'Customer created but no ID returned';
                    this.requestDetails.exitStatus = 500;
                    throw new Error(this.requestDetails.exitMessage);
                }

                await userController.createUserAttributes(user.id, { customer_id: customerId })
            }
            // KYC verifications - BVN (with better error handling)
            if (!Boolean(userAttributes.bvn_kyc) && (userAttributes.bvn || payload.bvn)) {
                try {
                    this.requestDetails.req.params = { tenant: "embedlly", endpoint: "premium-kyc-bvn" };
                    this.requestDetails.req.body = {
                        bvn: userAttributes.bvn || payload.bvn,
                        customerId: userAttributes.customer_id || customerId
                    };

                    const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
                    const requestDetails = await validateRequest({
                        tenant,
                        endpoint,
                        req: this.requestDetails.req,
                        res: this.requestDetails.res
                    });

                    let bvnResponse = await sendRequest(requestDetails);

                    let bvnResponseParse = typeof bvnResponse.data === "string"
                        ? JSON.parse(bvnResponse.data)
                        : bvnResponse.data;
                    console.log("bvnResponseParse", bvnResponseParse)
                    if (bvnResponseParse.success) {
                        const bvnData = bvnResponseParse.data?.response?.bvn || bvnResponseParse.data?.bvn;
                        if (bvnData) {
                            const firstNameMatch = bvnData.firstname?.toLowerCase() === (userAttributes.first_name || payload.first_name)?.toLowerCase();
                            const lastNameMatch = bvnData.lastname?.toLowerCase() === (userAttributes.last_name || payload.last_name)?.toLowerCase();

                            if (!firstNameMatch || !lastNameMatch) {
                                userAttributes.first_name = bvnData.firstname || userAttributes.first_name
                                userAttributes.last_name = bvnData.lastname || userAttributes.last_name

                            }

                            await userController.createUserAttributes(user.id, { bvn_kyc: true, bvn: payload.bvn });
                        } else {
                            this.requestDetails.exit = true;
                            this.requestDetails.exitMessage = "BVN verification failed: No BVN data returned";
                            this.requestDetails.exitStatus = 400;
                            throw new Error(this.requestDetails.exitMessage);
                        }
                    } else {
                        this.requestDetails.exit = true;
                        this.requestDetails.exitMessage = "BVN KYC failed: " + JSON.stringify(bvnResponseParse.errors || bvnResponseParse.message);
                        this.requestDetails.exitStatus = 400;
                        throw new Error(this.requestDetails.exitMessage);

                    }

                } catch (error) {
                    console.error('BVN KYC failed:', error);
                    this.requestDetails.exit = true;
                    this.requestDetails.exitMessage = "BVN KYC failed: " + error.message;
                    this.requestDetails.exitStatus = 400;
                    return;
                }
            }

            // KYC verifications - NIN (with better error handling)
            if (!userAttributes.nin_kyc && (userAttributes.nin || payload.nin)) {
                try {
                    this.requestDetails.req.params = { tenant: "embedlly", endpoint: "kyc-nin" };
                    this.requestDetails.req.query = {
                        nin: userAttributes.nin || payload.nin,
                        customerId: userAttributes.customer_id || customerId,
                        verify: 1
                    };
                    this.requestDetails.req.body = {
                        firstname: userAttributes.first_name || payload.first_name,
                        lastname: userAttributes.last_name || payload.last_name,
                        dob: userAttributes.date_of_birth || payload.date_of_birth
                    };

                    const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
                    const requestDetails = await validateRequest({
                        tenant,
                        endpoint,
                        req: this.requestDetails.req,
                        res: this.requestDetails.res
                    });

                    let ninResponse = await sendRequest(requestDetails);

                    let ninResponseParse = typeof ninResponse.data === "string"
                        ? JSON.parse(ninResponse.data)
                        : ninResponse.data;

                    console.log("ninResponseParse", ninResponseParse)
                    if (ninResponseParse.success) {
                        const ninData = ninResponseParse.data?.nin || ninResponseParse.data;
                        if (ninData) {
                            const firstNameMatch = ninData.firstname?.toLowerCase() === (userAttributes.first_name || payload.first_name)?.toLowerCase();
                            const lastNameMatch = ninData.lastname?.toLowerCase() === (userAttributes.last_name || payload.last_name)?.toLowerCase();

                            if (!firstNameMatch || !lastNameMatch) {
                                userAttributes.first_name = ninData.firstname || userAttributes.first_name
                                userAttributes.last_name = ninData.lastname || userAttributes.last_name
                            }

                            await userController.createUserAttributes(user.id, { nin_kyc: true, nin: payload.nin });
                        }
                    } else {
                        this.requestDetails.exit = true;
                        this.requestDetails.exitMessage = "NIN KYC failed: " + JSON.stringify(ninResponseParse.errors || ninResponseParse.message);
                        this.requestDetails.exitStatus = 400;
                        throw new Error(this.requestDetails.exitMessage);
                    }

                } catch (error) {
                    console.error('NIN KYC failed:', error);
                    this.requestDetails.exit = true;
                    this.requestDetails.exitMessage = "NIN KYC failed: " + error;
                    this.requestDetails.exitStatus = 400;
                    return;
                }
            }
            // KYC verifications - Address
            if (!userAttributes.addr_kyc && ((userAttributes.proof_of_address || payload.proof_of_address) &&
                (userAttributes.address || payload.address))) {
                try {
                    this.requestDetails.req.params = { tenant: "embedlly", endpoint: "kyc-address" };
                    this.requestDetails.req.body = {
                        customerId: userAttributes.customer_id || customerId,
                        meterNumber: userAttributes.proof_of_address || payload.proof_of_address,
                        houseAddress: userAttributes.address || payload.address
                    };

                    const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
                    const requestDetails = await validateRequest({
                        tenant,
                        endpoint,
                        req: this.requestDetails.req,
                        res: this.requestDetails.res
                    });

                    let addrResponse = await sendRequest(requestDetails);

                    let addrResponseParse = typeof addrResponse.data === "string"
                        ? JSON.parse(addrResponse.data)
                        : addrResponse.data;
                    console.log("addrResponse; ", addrResponse)
                    if (addrResponseParse.status === 400 && addrResponseParse.message === "Customer is already on Tier 3!") {
                        await userController.createUserAttributes(user.id, { addr_kyc: true, proof_of_address: payload.proof_of_address });
                    }
                    else if (addrResponseParse.data.data.verified || addrResponseParse.data?.status === "successful") {
                        await userController.createUserAttributes(user.id, { addr_kyc: true });
                    }
                    else if (addrResponseParse.data.status === 400) {
                        console.error('Address KYC failed with 400:', addrResponseParse.message);
                        this.requestDetails.exit = true;
                        this.requestDetails.exitMessage = "Address verification failed: " + addrResponseParse.message;
                        this.requestDetails.exitStatus = 400;
                        throw new Error(this.requestDetails.exitMessage);
                    }
                    else {
                        console.error('Address KYC failed:', addrResponseParse);
                        this.requestDetails.exit = true;
                        this.requestDetails.exitMessage = "Address verification failed: " + JSON.stringify(addrResponseParse.errors || addrResponseParse.message);
                        this.requestDetails.exitStatus = 400;
                        throw new Error(this.requestDetails.exitMessage);

                    }

                    if (!this.requestDetails.res.kycResults) {
                        this.requestDetails.res.kycResults = {};
                    }
                    this.requestDetails.res.kycResults.address = addrResponse;

                } catch (error) {
                    console.error('Address KYC failed:', error);
                    this.requestDetails.exit = true;
                    this.requestDetails.exitMessage = "Address verification failed: " + error;
                    this.requestDetails.exitStatus = 400;
                    return;
                }
            }

            if (!userAttributes.wallet_id) {
                // Create Embedly wallet
                const walletPayload = {
                    "customerId": userAttributes.customer_id,
                    "currencyId": currencyId,
                    "availableBalance": 0,
                    "ledgerBalance": 0,
                    "isInternal": false,
                    "isDefault": true,
                    "name": `${userAttributes.first_name || payload.first_name} ${userAttributes.last_name || payload.last_name}`,
                    "mobNum": user.phone,
                    "customerTypeId": customerTypeId
                };


                this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'create-embedly-wallet' };
                this.requestDetails.req.body = walletPayload;

                const walletTenant = await getTenantAndEndpoint(this.requestDetails.req.params);
                const walletRequestDetails = await validateRequest({
                    tenant: walletTenant.tenant,
                    endpoint: walletTenant.endpoint,
                    req: this.requestDetails.req,
                    res: this.requestDetails.res
                });
                let walletResponse = await sendRequest(walletRequestDetails);

                const parsedWalletResponse = typeof walletResponse.data === "string"
                    ? JSON.parse(walletResponse.data)
                    : walletResponse.data;
                console.log("parsedWalletResponse", parsedWalletResponse)
                walletId = parsedWalletResponse.data?.id || parsedWalletResponse.id;

                if (!walletId) {
                    console.error("Wallet creation failed - no wallet ID:", parsedWalletResponse);
                    this.requestDetails.exit = true;
                    this.requestDetails.exitMessage = 'Failed to create wallet: No wallet ID in response';
                    this.requestDetails.exitStatus = 500;
                    throw new Error(this.requestDetails.exitMessage + JSON.parse.stringify(parsedWalletResponse));

                }

                let payload = {
                    payment_information: {
                        account_number: parsedWalletResponse.virtualAccount?.accountNumber || parsedWalletResponse.data?.virtualAccount?.accountNumber,
                        bank_code: parsedWalletResponse.virtualAccount?.bankCode || parsedWalletResponse.data?.virtualAccount?.bankCode,
                        bank_name: parsedWalletResponse.virtualAccount?.bankName || parsedWalletResponse.data?.virtualAccount?.bankName
                    }
                }
                await userController.createUserAttributes(user.id, {
                    wallet_id: walletId,
                    ...payload
                });

                return {
                    walletId: walletId,
                    customerId: userAttributes.customer_id,
                    virtualAccount: parsedWalletResponse.virtualAccount || parsedWalletResponse.data?.virtualAccount,
                    kycResults: this.requestDetails.res.kycResults
                };
            }

    } catch (error) {
        console.error('Create Embedly customer/wallet error:', error);
        this.requestDetails.exit = true;
        this.requestDetails.exitMessage = 'Unable to create wallet at this moment: ' + error.message;
        this.requestDetails.exitStatus = 500;
        this.requestDetails.payload.return = true;
        return 
    } 
    
};

    /**
     * After execute for wallet transfer
     */
walletTransferComplete = async () => {
    const withdrawalInfo = this.requestDetails.withdrawalInfo;
    let usersName = withdrawalInfo.user.attributes.first_name  ? `${withdrawalInfo.user.attributes.first_name} ${withdrawalInfo.user.attributes.last_name}` : withdrawalInfo.user.email
    
    const unparsedresponse = this.requestDetails.response;
    let response = typeof unparsedresponse === "string" 
    ? JSON.parse(unparsedresponse) 
    : unparsedresponse;
    let transactionRef;
    let embedlyWalletHistory
    // console.log("wallet transfer complete response", response)

    let originalReq = {...this.requestDetails.req};
        const isInterbankTransfer = withdrawalInfo.isInterbankTransfer;
    try {

        if (isInterbankTransfer) {
        
        if (!response || !response.succeeded) {
            console.error("Interbank failed:");

    nodemailer.sendMail({
       email: 'payout@obana.africa', content: { agent_id: withdrawalInfo.user.attributes.agent_id, user: usersName, amount:  withdrawalInfo.amount,
       date: new Date().toISOString().split('T')[0], acount: withdrawalInfo.destinationAccount, bank: withdrawalInfo.bank, currency: withdrawalInfo.currency ?? "" },
       subject: `New Payout Request from ${usersName} failed`, template: 'payOut'
     })
            throw new Error('Interbank transfer failed: ' + (response.message || 'Unknown error'));
        }
        
        transactionRef = response.data;
        
    } else {

    if (!response || response.code !== '00' || !response.success) {
        throw new Error('Wallet transfer failed: ' + JSON.stringify(response.message));
    }
    



     nodemailer.sendMail({
            email: 'payout@obana.africa', content: { agent_id: withdrawalInfo.user.attributes.agent_id, user: usersName, amount:  withdrawalInfo.amount,
            date: new Date().toISOString().split('T')[0], acount: withdrawalInfo.destinationAccount, bank: withdrawalInfo.bank, currency: withdrawalInfo.currency ?? "" },
            subject: `New Payout Request from ${usersName}`, template: 'payOut'
          })
        
    
        this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'wallet-history' };
        this.requestDetails.req.query = {
            "walletId": withdrawalInfo.user.attributes.wallet_id,
            "From": new Date().toISOString().split('T')[0],
            "To": new Date().toISOString().split('T')[0],
            "Page": 1,
            "PageSize": 10,
        };

        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
        const requestDetails = await validateRequest({
            tenant,
            endpoint,
            req: this.requestDetails.req,
            res: this.requestDetails.res
        });
        
         embedlyWalletHistory = await sendRequest(requestDetails);
        // console.log("embedlyWalletHistory parsed", embedlyWalletHistory)

        if (typeof embedlyWalletHistory === "string") {
            embedlyWalletHistory = JSON.parse(embedlyWalletHistory);
        }

        if (embedlyWalletHistory && embedlyWalletHistory.data) {
            if (typeof embedlyWalletHistory.data === "string") {
                embedlyWalletHistory = JSON.parse(embedlyWalletHistory.data);
            } 
            else if (embedlyWalletHistory.data.code && embedlyWalletHistory.data.success) {
                embedlyWalletHistory = embedlyWalletHistory.data;
            }
        }
        
        // console.log("Wallet history:", embedlyWalletHistory)

        if (!embedlyWalletHistory?.success || embedlyWalletHistory.code !== '00') {
            throw new Error('API returned error - code: ' + embedlyWalletHistory);
        }

        if (!embedlyWalletHistory?.data?.walletHistories || !Array.isArray(embedlyWalletHistory.data.walletHistories)) {
            throw new Error('Invalid response structure - missing walletHistories array');
        }

        if (embedlyWalletHistory.data.walletHistories.length === 0) {
            throw new Error('No wallet history found for this transaction');
        }
}

        let walletHistory = embedlyWalletHistory?.data?.walletHistories[0] ? embedlyWalletHistory.data.walletHistories[0] : null;
        
        this.requestDetails.req = originalReq;
        
        let wallet = await db.wallets.findOne({ where: { user_id: withdrawalInfo.user_id } });
        
        if (!wallet.embedly_wallet_id && walletHistory ) {
            wallet.embedly_wallet_id = walletHistory.walletId         
        };
            

        
        const currentLedgerBalance = Number(wallet.ledger_balance);
        
        const withdrawalAmount = Number(withdrawalInfo.amount);
        
        
        const newEmbedlyLedgerBalance = currentLedgerBalance - withdrawalAmount;
               
        
        wallet.ledger_balance = Math.round(newEmbedlyLedgerBalance * 100) / 100;
        
        await wallet.save();
        
        
        await db.wallet_history.create({
            user_id: withdrawalInfo.user_id,
            wallet_id: wallet.id,
            embedly_wallet_id: originalReq.params.endpoint === "embedly-wallet-transfer" ? walletHistory.walletId : null,
            customer_id: withdrawalInfo.customerId,
            type: 'withdrawal',
            status: 'paid',
            transaction_id: originalReq.params.endpoint === "embedly-wallet-transfer" ? walletHistory.transactionId : transactionRef,
            amount: withdrawalAmount,
            opening_balance: currentLedgerBalance,
            closing_balance: newEmbedlyLedgerBalance,
            embedly_opening_balance: originalReq.params.endpoint === "embedly-wallet-transfer" ?  walletHistory.balance - withdrawalAmount : null,
            embedly_closing_balance: originalReq.params.endpoint === "embedly-wallet-transfer" ? walletHistory.balance : null,
            remarks: originalReq.params.endpoint === "embedly-wallet-transfer" ?  walletHistory.remarks : 'withdraw',
            order_id: null,
            order_number: null
        });
  
    } catch (error) {
        console.error("Error in walletTransferComplete:", error);
        this.requestDetails.req = originalReq;
        this.requestDetails.exit = true;
        this.requestDetails.exitMessage = 'Error completing wallet transfer: ' + error.message;
        this.requestDetails.exitStatus = 500;
        this.requestDetails.response = { statusCode: 400, data: this.requestDetails.exitMessage };
        this.requestDetails.payload.return = true;
        return

    }
};


/**
 * Get bank code from bank name
 */
getBankCode = async (bankName) => {
    const originalReq = { ...this.requestDetails.req };

    try {
        this.requestDetails.req.params = { tenant: 'embedlyPayout', endpoint: 'embedly-payout' };
        
        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
        const requestDetails = await validateRequest({
            tenant,
            endpoint,
            req: this.requestDetails.req,
            res: this.requestDetails.res
        });

        const response = await sendRequest(requestDetails);
        // console.log("response", response)
        const parsed = typeof response.data === "string" 
            ? JSON.parse(response.data) 
            : response.data;
        // console.log("BANk RES", parsed)
        if (!parsed.succeeded || !parsed.data) {
            throw new Error('Failed to fetch bank list: ' + parsed.message);
        }

        const bankList = parsed.data;
        // console.log("bankList", bankList)
        const bank = bankList.find(
            b => b.bankname.toLowerCase() === bankName.toLowerCase()
        );

        if (!bank) {
            throw new Error(`Bank "${bankName}" not found in available banks`);
        }
        

        return bank.bankcode;

    } catch (error) {
        console.error('Error getting bank code:', error);
        this.requestDetails.exit = true;
        this.requestDetails.exitMessage = 'Error getting bank code: ' + error.message;
        this.requestDetails.exitStatus = 400;
        this.requestDetails.response = { statusCode: this.requestDetails.exitStatus, data: this.requestDetails.exitMessage };
        this.requestDetails.payload.return = true;
        return;
    } finally {
        this.requestDetails.req = originalReq;
    }
};

    /**
     * Get super admin wallet - Using role_id
     */
    getSuperAdminWallet = async () => {
        const req = this.requestDetails.req;
        const res = this.requestDetails.res;
        try {
            const superAdminRole = await db.roles.findOne({
                where: { role: 'super admin' }
            });
            if (!superAdminRole) {
                throw new Error('Super admin role not found');

            }

            const roleIdAttribute = await db.attributes.findOne({
                where: { slug: 'role_id' }
            });

            if (!roleIdAttribute) {
                throw new Error('role_id attribute not found');
            }

            const superAdminUserAttribute = await db.user_attributes.findOne({
                where: {
                    attribute_id: roleIdAttribute.id,
                    value: superAdminRole.id.toString()
                }
            });

            if (!superAdminUserAttribute) {
                throw new Error('No user assigned to super admin role');
            }

            const adminUser = await db.users.findOne({
                where: { id: superAdminUserAttribute.user_id }
            });

            if (!adminUser) {
                throw new Error('Super admin user not found');
            }

            const userController = require('../controllers/userController');
            const adminUserData = await userController.getUser(null, null, true, req, res, adminUser.id);

            if (!adminUserData.attributes?.wallet_id) {
                throw new Error('Super admin does not have an Embedly wallet');
            }

            this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'embedly-wallet' };
            this.requestDetails.req.query = { walletId: adminUserData.attributes.wallet_id };
            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });

            let walletResponse = await sendRequest(requestDetails);
            // await require('../controllers/requestController').makeRequest(req, res);
            walletResponse = typeof walletResponse.data === "string"
                ? JSON.parse(walletResponse.data)
                : walletResponse.data;
            // console.log("super admin wallet response", walletResponse)
            await userController.createUserAttributes(adminUserData.id, {
                wallet_id: walletResponse.id || walletResponse.data?.id,
                account_number: walletResponse.virtualAccount?.accountNumber || walletResponse.data?.virtualAccount?.accountNumber,
                bank_code: walletResponse.virtualAccount?.bankCode || walletResponse.data?.virtualAccount?.bankCode,
                bank_name: walletResponse.virtualAccount?.bankName || walletResponse.data?.virtualAccount?.bankName
            });
            return {
                embedly_wallet_id: adminUserData.attributes.wallet_id || walletResponse.id || walletResponse.data?.id,
                fromAccount: walletResponse.data?.virtualAccount?.accountNumber || walletResponse.virtualAccount?.accountNumber,
                balance: walletResponse.availableBalance || walletResponse.ledgerBalance || walletResponse.data?.ledgerBalance || walletResponse.data?.availableBalance
            };
        } catch (error) {
            console.error('Error getting super admin wallet:', error);
            this.requestDetails.exit = true;
            this.requestDetails.exitMessage = 'Error getting super admin wallet: ' + error;
            this.requestDetails.exitStatus = 500;
            return;
        }
    };

    /**
     * Get customer type ID
     */
    getCustomerTypeId = async (customerType) => {
        const originalReq = { ...this.requestDetails.req };

        try {

            this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'embedly-customer-types' }

            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });
            const response = await sendRequest(requestDetails);


            const parsed = typeof response.data === "string"
                ? JSON.parse(response.data)
                : response.data;
            // console.log("customer type response", parsed)


            let success = parsed.success
            if (!success) {

                return this.requestDetails.res.status(400).send({ message: "no customer", code: 400 });
            }

            const typeList = parsed.data;

            const type = typeList.find(
                t => t.name.toLowerCase() === customerType.toLowerCase()
            );

            return type?.id || null;

        } catch (error) {
            console.error('Error getting customer type ID:', error);
            this.requestDetails.exit = true;
            this.requestDetails.exitMessage = 'Error getting customer type ID:' + error;
            this.requestDetails.exitStatus = 400;
            return

        } finally {
            this.requestDetails.req = originalReq;
        }
    };

    /**
     * Get country ID
     */
    getCountryId = async (countryName) => {
        const originalReq = { ...this.requestDetails.req };

        try {

            this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'embedly-countries' }

            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });

            const response = await sendRequest(requestDetails);

            const parsed = typeof response.data === "string"
                ? JSON.parse(response.data)
                : response.data
            // console.log("country response", parsed)

            let success = parsed.success || false
            if (!success) {
                throw new Error('No country data found');
            }

            const typeList = parsed.data;

            const type = typeList.find(
                c => c.name.toLowerCase() === countryName.toLowerCase()
            );

            return type?.id || null;

        } catch (error) {
            console.error('Error getting country ID:', error);
            this.requestDetails.exit = true;
            this.requestDetails.exitMessage = 'Error getting country ID:' + error;
            this.requestDetails.exitStatus = 400;

            return
        } finally {
            this.requestDetails.req = originalReq;
        }
    };

    /**
     * Get currency ID
     */
    getCurrencyId = async (userCurrency) => {
        const originalReq = { ...this.requestDetails.req };

        try {

            this.requestDetails.req.params = { tenant: 'embedlly', endpoint: 'embedly-currencies' }

            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });

            const response = await sendRequest(requestDetails);


            const parsed = typeof response.data === "string"
                ? JSON.parse(response.data)
                : response.data;
            // console.log("currency response", parsed)
            let success = parsed.success || false;
            if (!success) {
                throw new Error('No currency data found');
            }

            const typeList = parsed.data;
            const type = typeList.find(
                c => c.shortName.toLowerCase() === userCurrency.toLowerCase()
            );
            // console.log("currency type", type)

            return type?.id || null;

    } catch (error) {
        console.error('Error getting currency ID:', error);
        this.requestDetails.exit = true;
        this.requestDetails.exitMessage = 'Error getting currency ID:' + error;
        this.requestDetails.exitStatus = 400;
        this.requestDetails.payload.return = true;
        return
    }finally {
            this.requestDetails.req = originalReq;
        }
    };



    sendOrderCreationNotifications = async (order, user, shipmentResults, zohoOrder, agentDetails) => {
        const customerData = JSON.parse(order.shipment_details).delivery_address;
        const hasShipments = shipmentResults.successful.length > 0;
        const orderNumber = zohoOrder?.salesorder?.salesorder_number || order.order_ref;
        const totalAmount = order.amount?.toLocaleString() || '0';

        // // 1. ALWAYS SEND TO CUSTOMER (from shipment_details)
        // const customerEmailSent = await sendCustomerEmail(
        //     order,
        //     `Order Confirmation - ${orderNumber}`,
        //     buildCustomerOrderEmailContent(order, shipmentResults, zohoOrder),
        //     'order_confirmation'
        // );

        // // 2. ONLY SEND TO AGENT IF USER IS AGENT
        // if (isUserAgent(user)) {
        //     await sendAgentEmail(
        //         user,
        //         order,
        //         `New Order Placed - ${orderNumber}`,
        //         buildAgentOrderEmailContent(order, shipmentResults, zohoOrder, customerData),
        //         'new_order'
        //     );
        // }


        if (isUserAgent(user)) {
            this.agentNotification(order, user, customerData, zohoOrder);
        }

        this.shopperNotification(order, user, zohoOrder, agentDetails);
    }



    aggregateMultiVendorRates = async () => {
        const payload = this.requestDetails.payload;

        if (!payload.parcel?.items || payload.parcel.items.length === 0) {
            return;
        }

        const hasMultipleVendors = payload.parcel.items.some(item => item.pickup_address);


        if (!hasMultipleVendors) {

            return await this.handleSingleVendorFlow(payload);
        }


        const vendorGroups = this.groupItemsByVendor(payload.parcel.items);

        if (vendorGroups.length === 1) {
            return await this.handleSingleVendorFlow(payload, vendorGroups[0]);
        }

        const vendorShipments = await Promise.all(
            vendorGroups.map(group => this.createQuickShipmentForVendor(group, payload))
        );


        const allVendorRates = await Promise.all(
            vendorShipments.map(shipment => this.getRatesForShipment(shipment))
        );



        const vendorsWithRates = allVendorRates.filter(vendor => vendor.rates && vendor.rates.length > 0);

        if (vendorsWithRates.length === 0) {

            return this.returnPerVendorRates(allVendorRates, vendorGroups);
        }

        const commonCarrierRefs = this.findCommonCarriers(vendorsWithRates);


        if (commonCarrierRefs.length > 0) {
            const aggregatedRates = this.aggregateCarrierCosts(commonCarrierRefs, vendorsWithRates);
            return this.returnAggregatedRates(aggregatedRates, allVendorRates, vendorGroups);
        } else {
            return this.returnPerVendorRates(allVendorRates, vendorGroups);
        }
    }


    handleSingleVendorFlow = async (payload, vendorGroup = null) => {


        const items = vendorGroup ? vendorGroup.items : payload.parcel.items;
        const pickupAddress = vendorGroup ? vendorGroup.pickup_address : this.getDefaultPickupAddress();

        // Default addresses
        const defaultPickup = this.getDefaultPickupAddress();
        const defaultDelivery = this.getDefaultDeliveryAddress();

        const mergedPickupAddress = Object.entries({
            ...defaultPickup,
            ...(pickupAddress || {})
        }).reduce((acc, [key, value]) => {
            acc[key] = value || defaultPickup[key];
            return acc;
        }, {});

        const mergedDeliveryAddress = Object.entries({
            ...defaultDelivery,
            ...(payload.delivery_address || {})
        }).reduce((acc, [key, value]) => {
            acc[key] = value || defaultDelivery[key];
            return acc;
        }, {});


        const quickShipmentPayload = {
            pickup_address: mergedPickupAddress,
            delivery_address: mergedDeliveryAddress,
            currency: payload.currency || "NGN",
            parcel: {
                description: payload.parcel.description || "Package delivery",
                weight_unit: payload.parcel.weight_unit || "kg",
                items: items.map((item) => ({
                    name: item.name,
                    description: item.description || item.name,
                    currency: item.currency || "NGN",
                    value: item.value || item.total_price || 0,
                    quantity: item.quantity || 1,
                    weight: item.weight || 1,
                })),
            },
            metadata: payload.metadata || {},
            shipment_purpose: "commercial"
        };
        try {
            const shipmentResponse = await this.createQuickShipment(quickShipmentPayload);
            if (!shipmentResponse.status) {
                throw new Error(`Quick shipment creation failed: ${shipmentResponse.message}`);
            }

            const shipmentId = shipmentResponse.data.shipment_id;

            const ratesResponse = await this.getRatesForShipmentId(shipmentId, payload.cash_on_delivery);



            if (!ratesResponse.status) {
                throw new Error(`Rates retrieval failed: ${shipmentResponse.message}`);
            }

            this.requestDetails.exit = true;

            return this.requestDetails.res.status(200).json({
                status: 'success',
                data: ratesResponse.data,
                metadata: {
                    isMultiVendor: false,
                    vendorCount: 1
                }
            });

        } catch (error) {
            console.error("Error in single vendor flow:", error);
            this.requestDetails.payload = quickShipmentPayload;
        }
    }

    createQuickShipmentForVendor = async (vendorGroup, originalPayload) => {
        const defaultDelivery = this.getDefaultDeliveryAddress();
        const mergedDeliveryAddress = Object.entries({
            ...defaultDelivery,
            ...(originalPayload.delivery_address || {})
        }).reduce((acc, [key, value]) => {
            acc[key] = value || defaultDelivery[key];
            return acc;
        }, {});

        const defaultPickup = this.getDefaultPickupAddress();
        const mergedPickupAddress = Object.entries({
            ...defaultPickup,
            ...(vendorGroup.pickup_address || {})
        }).reduce((acc, [key, value]) => {
            acc[key] = value || defaultPickup[key];
            return acc;
        }, {});

        const quickShipmentPayload = {
            pickup_address: mergedPickupAddress,
            delivery_address: mergedDeliveryAddress,
            currency: originalPayload.currency || "NGN",
            parcel: {
                description: `Package from vendor ${vendorGroup.vendor_id}`,
                weight_unit: originalPayload.parcel.weight_unit || "kg",
                items: vendorGroup.items.map(item => ({
                    name: item.name,
                    description: item.description || item.name,
                    currency: item.currency || "NGN",
                    value: item.value || item.total_price || 0,
                    quantity: item.quantity || 1,
                    weight: item.weight || 1,
                }))
            },
            metadata: originalPayload.metadata || {},
            shipment_purpose: "commercial"
        };

        try {
            const response = await this.createQuickShipment(quickShipmentPayload);

            return {
                vendor_id: vendorGroup.vendor_id,
                pickup_address: vendorGroup.pickup_address,
                items: vendorGroup.items,
                shipment: response.data,
                has_shipment: response.status,
                error: response.status ? null : response.message
            };
        } catch (error) {
            console.error("Error creating quick shipment for vendor:", error);
            return {
                vendor_id: vendorGroup.vendor_id,
                pickup_address: vendorGroup.pickup_address,
                items: vendorGroup.items,
                shipment: null,
                has_shipment: false,
                error: error.message
            };
        }
    }


    getRatesForShipment = async (vendorShipment) => {
        if (!vendorShipment.has_shipment === true) {
            return {
                ...vendorShipment,
                rates: [],
                has_rates: false
            };
        }

        try {
            const shipmentId = vendorShipment.shipment.shipment_id;
            const response = await this.getRatesForShipmentId(shipmentId);

            return {
                ...vendorShipment,
                rates: response.data || [],
                has_rates: response.status && response.data && response.data.length > 0
            };
        } catch (error) {
            console.error("Error getting rates for shipment:", error);
            return {
                ...vendorShipment,
                rates: [],
                has_rates: false,
                error: error.message
            };
        }
    }


    createQuickShipment = async (payload) => {
        // follow fazsion pattern: update this.requestDetails.req directly
        const originalReq = { ...this.requestDetails.req };
        try {
            this.requestDetails.req.params = { tenant: 'terminalAfrica', endpoint: 'shipment' };
            this.requestDetails.req.query = this.requestDetails.req.query || {};
            this.requestDetails.req.body = payload || {};
            this.requestDetails.req.headers = this.requestDetails.req.headers || {};

            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });

            const response = await sendRequest(requestDetails);
            return JSON.parse(response.data);
        } finally {
            // restore original request to avoid side effects
            this.requestDetails.req = originalReq;
        }
    }

    getRatesForShipmentId = async (shipmentId, cashOnDelivery = false) => {

        const originalReq = { ...this.requestDetails.req };
        try {
            this.requestDetails.req.params = { tenant: 'terminalAfrica', endpoint: 'get-shipment-rates' };
            this.requestDetails.req.query = this.requestDetails.req.query || {};
            this.requestDetails.req.query.shipment_id = shipmentId;
            this.requestDetails.req.query.cash_on_delivery = !!cashOnDelivery;
            this.requestDetails.req.query.currency = 'NGN';
            this.requestDetails.req.body = this.requestDetails.req.body || {};
            this.requestDetails.req.headers = this.requestDetails.req.headers || {};

            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const requestDetails = await validateRequest({
                tenant,
                endpoint,
                req: this.requestDetails.req,
                res: this.requestDetails.res
            });

            const response = await sendRequest(requestDetails);

            return JSON.parse(response.data);
        } finally {
            // restore original request to avoid side effects
            this.requestDetails.req = originalReq;
        }
    }

    getDefaultPickupAddress = () => {
        return {
            line1: "77 Opebi Road",
            line2: "Ikeja",
            first_name: "Obana",
            last_name: "Africa",
            phone: "+2348090335245",
            email: "obanaafrica@gmail.com",
            zip: "100001",
            city: "Ikeja",
            state: "Lagos",
            country: "NG",
            is_residential: false
        };
    }

    getDefaultDeliveryAddress = () => {
        return {
            line1: "77 Opebi Road",
            line2: "Ikeja",
            first_name: "Obana",
            last_name: "Africa",
            phone: "+2348090335245",
            email: "obanaafrica@gmail.com",
            zip: "100001",
            city: "Ikeja",
            state: "Lagos",
            country: "NG",
            is_residential: false
        };
    }

    returnAggregatedRates = (aggregatedRates, allVendorRates, vendorGroups) => {
        const vendorGroupsWithRates = vendorGroups.map((group, index) => {
            const vendorRates = allVendorRates[index];
            return {
                vendor_id: `vendor_${index + 1}`,
                pickup_address: group.pickup_address,
                items: group.items.map(item => ({
                    ...item,
                    item_id: item.item_id || item.id
                })),
                available_rates: vendorRates.rates.map(rate => ({
                    rate_id: rate.rate_id || rate.id,
                    carrier_reference: rate.carrier_reference,
                    carrier_name: rate.carrier_name,
                    amount: rate.amount,
                    delivery_time: rate.delivery_time,
                    delivery_eta: rate.delivery_eta,
                    pickup_time: rate.pickup_time,
                    currency: rate.currency,
                    carrier_logo: rate.carrier_logo,
                    carrier_rate_description: rate.carrier_rate_description
                })),
                has_rates: vendorRates.rates.length > 0
            };
        });

        const aggregatedRatesWithRateId = aggregatedRates.map(rate => ({
            ...rate,
            rate_id: rate.rate_id || rate.id
        }));

        this.requestDetails.exit = true;
        return this.requestDetails.res.status(200).json({
            status: "success",
            data: aggregatedRatesWithRateId,
            metadata: {
                isMultiVendor: true,
                hasCommonCarriers: true,
                vendorGroups: vendorGroupsWithRates,
                vendorCount: vendorGroups.length,
                totalCarriers: aggregatedRates.length,
                deliveryType: 'aggregated',
                message: `${aggregatedRates.length} common carriers available for all vendors`
            }
        });
    }


    returnPerVendorRates = (allVendorRates, vendorGroups) => {

        const vendorGroupsWithRates = vendorGroups.map((group, index) => {
            const vendorRates = allVendorRates[index];

            return {
                vendor_id: group.vendor_id,
                pickup_address: group.pickup_address,
                items: group.items.map(item => ({
                    ...item,
                    item_id: item.item_id || item.id
                })),
                available_rates: vendorRates.rates.map(rate => ({
                    rate_id: rate.rate_id || rate.id,
                    carrier_reference: rate.carrier_reference,
                    carrier_name: rate.carrier_name,
                    amount: rate.amount,
                    delivery_time: rate.delivery_time,
                    pickup_time: rate.pickup_time,
                    currency: rate.currency,
                    delivery_eta: rate.delivery_eta,
                    carrier_logo: rate.carrier_logo,
                    carrier_rate_description: rate.carrier_rate_description
                })),
                has_rates: vendorRates.rates.length > 0
            };
        });

        const totalVendorsWithRates = vendorGroupsWithRates.filter(group => group.has_rates).length;
// console.log("totalVendorsWithRates", totalVendorsWithRates)
        this.requestDetails.exit = true;
        return this.requestDetails.res.status(200).json({
            status: "success",
            data: [],
            metadata: {
                isMultiVendor: true,
                hasCommonCarriers: false,
                vendorGroups: vendorGroupsWithRates,
                vendorCount: vendorGroups.length,
                vendorsWithRates: totalVendorsWithRates,
                vendorsWithoutRates: vendorGroups.length - totalVendorsWithRates,
                totalCarriers: vendorGroupsWithRates.reduce((total, group) => total + group.available_rates.length, 0),
                deliveryType: 'per-vendor',
                message: totalVendorsWithRates === 0
                    ? "No carriers available for any vendor in this order"
                    : `Please select carriers for ${totalVendorsWithRates} vendor(s) with available rates`
            }
        });
    }


    groupItemsByVendor = (items) => {
        const groups = {};

        items.forEach(item => {
            const normalizedAddress = {
                line1: (item.pickup_address?.line1 || '').trim().toLowerCase(),
                city: (item.pickup_address?.city || '').trim().toLowerCase(),
                state: (item.pickup_address?.state || '').trim().toLowerCase(),
                country: (item.pickup_address?.country || '').trim().toUpperCase(),
            };

            const vendorKey = JSON.stringify(normalizedAddress);

            if (!groups[vendorKey]) {
                groups[vendorKey] = {
                    vendor_id: `vendor_${Object.keys(groups).length + 1}`,
                    pickup_address: item.pickup_address,
                    items: []
                };
            }

            const { pickup_address, ...itemWithoutAddress } = item;
            groups[vendorKey].items.push(itemWithoutAddress);
        });

        return Object.values(groups);
    }


    fetchRatesForVendor = async (vendorGroup, originalPayload) => {

        const defaultDelivery = {
            line2: "77 opebi street, ikeja, lagos",
            first_name: "obana",
            last_name: "africa",
            phone: "+2348090335245",
            email: "obanaafrica@gmail.com",
            zip: "100001",
            city: "ikeja",
            state: "Lagos",
            country: "NG",
        };
        const mergedDeliveryAddress = Object.entries({
            ...defaultDelivery,
            ...(originalPayload.delivery_address || {}),
        }).reduce((acc, [key, value]) => {
            acc[key] = value || defaultDelivery[key];
            return acc;
        }, {});


        const defaultPickup = {
            line2: "77 opebi street, ikeja, lagos",
            first_name: "obana",
            last_name: "africa",
            phone: "+234 809 033 5245",
            email: "obanaafrica@gmail.com",
            zip: "100001",
            city: "ikeja",
            state: "Lagos",
            country: "NG",
        };

        const mergedPickupAddress = Object.entries({
            ...defaultPickup,
            ...(vendorGroup.pickup_address || {}),
        }).reduce((acc, [key, value]) => {
            acc[key] = value || defaultPickup[key];
            return acc;
        }, {});


        const ratePayload = {
            delivery_address: mergedDeliveryAddress,
            pickup_address: mergedPickupAddress,
            currency: originalPayload.currency,

            cash_on_delivery: originalPayload.cash_on_delivery,
            parcel: {
                description: `Package from vendor`,
                weight_unit: originalPayload.parcel.weight_unit,
                items: vendorGroup.items
            },
            persist_data: true,
            // metadata: originalPayload.metadata
        };

        try {
            const originalReq = { ...this.requestDetails.req };
            try {
                this.requestDetails.req.params = { tenant: 'terminalAfrica', endpoint: 'get-qoute' };
                this.requestDetails.req.query = this.requestDetails.req.query || {};
                this.requestDetails.req.body = ratePayload || {};
                this.requestDetails.req.headers = this.requestDetails.req.headers || {};

                const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
                const requestDetails = await validateRequest({
                    tenant,
                    endpoint,
                    req: this.requestDetails.req,
                    res: this.requestDetails.res
                });

                requestDetails.payload.persist_data = true;

                const response = await sendRequest(requestDetails);

                const parsedResponse = JSON.parse(response.data);

                const rates = parsedResponse.data || [];


                return {
                    vendor_id: vendorGroup.vendor_id,
                    pickup_address: vendorGroup.pickup_address,
                    items: vendorGroup.items,
                    rates: rates,
                    has_rates: rates.length > 0
                };
            } finally {
                this.requestDetails.req = originalReq;
            }
        } catch (error) {
            console.error("Error fetching rates for vendor:", error);
            return {
                vendor_id: vendorGroup.vendor_id,
                pickup_address: vendorGroup.pickup_address,
                items: vendorGroup.items,
                rates: [],
                has_rates: false,
                error: error.message
            };
        }
    }


    findCommonCarriers = (allVendorRates) => {
        if (allVendorRates.length === 0) return [];
        if (allVendorRates.length === 1) {
            return allVendorRates[0].rates.map(r => r.carrier_reference);
        }

        const vendorsWithRates = allVendorRates.filter(vendor => vendor.rates && vendor.rates.length > 0);

        if (vendorsWithRates.length === 0) return [];

        const firstVendorCarriers = new Set(
            vendorsWithRates[0].rates.map(rate => rate.carrier_reference)
        );

        return Array.from(firstVendorCarriers).filter(carrierRef => {
            return vendorsWithRates.every(vendorRate =>
                vendorRate.rates.some(rate => rate.carrier_reference === carrierRef)
            );
        });
    }

    aggregateCarrierCosts = (commonCarrierRefs, allVendorRates) => {
        return commonCarrierRefs.map(carrierRef => {
            let totalAmount = 0;
            let totalShipmentCost = 0;
            let carrierDetails = null;
            let earliestPickup = null;
            let latestDelivery = null;
            let maxPickupEta = 0;
            let maxDeliveryEta = 0;


            const vendorRateDetails = [];

            allVendorRates.forEach(vendorRate => {
                const rate = vendorRate.rates.find(r => r.carrier_reference === carrierRef);

                if (rate) {
                    totalAmount += rate.amount;
                    totalShipmentCost += rate.metadata?.shipment_cost || 0;


                    vendorRateDetails.push({
                        vendor_id: vendorRate.vendor_id,
                        actual_rate_id: rate.rate_id || rate.id,
                        amount: rate.amount,
                        pickup_address: vendorRate.pickup_address
                    });

                    if (!carrierDetails) {
                        carrierDetails = {
                            carrier_name: rate.carrier_name,
                            carrier_logo: rate.carrier_logo,
                            carrier_slug: rate.carrier_slug,
                            carrier_rate_description: rate.carrier_rate_description,
                            currency: rate.currency
                        };
                    }

                    const pickupDate = new Date(rate.pickup_date);
                    const deliveryDate = new Date(rate.delivery_date);

                    if (!earliestPickup || pickupDate < earliestPickup) {
                        earliestPickup = pickupDate;
                    }
                    if (!latestDelivery || deliveryDate > latestDelivery) {
                        latestDelivery = deliveryDate;
                    }

                    maxPickupEta = Math.max(maxPickupEta, rate.pickup_eta || 0);
                    maxDeliveryEta = Math.max(maxDeliveryEta, rate.delivery_eta || 0);
                }
            });

            let totalWeight = 0;
            let totalValue = 0;
            const allItems = [];

            allVendorRates.forEach(vendorRate => {
                vendorRate.items.forEach(item => {
                    totalWeight += (item.weight || 1) * (item.quantity || 1);
                    totalValue += item.value * (item.quantity || 1);
                    allItems.push({
                        ...item,
                        vendor_pickup: vendorRate.pickup_address
                    });
                });
            });

            return {
                id: `aggregated_${carrierRef}_${Date.now()}`,
                rate_id: `RT-AGGREGATED-${carrierRef}-${Date.now()}`, // Keep aggregated rate_id for frontend
                carrier_reference: carrierRef,
                ...carrierDetails,
                amount: Math.round(totalAmount * 100) / 100,
                default_amount: Math.round(totalAmount * 100) / 100,
                default_currency: "NGN",
                pickup_date: earliestPickup?.toISOString(),
                pickup_eta: maxPickupEta,
                pickup_time: this.formatEta(maxPickupEta),
                delivery_date: latestDelivery?.toISOString(),
                delivery_eta: maxDeliveryEta,
                delivery_time: this.formatEta(maxDeliveryEta),
                insurance_coverage: 0,
                insurance_fee: 0,
                includes_insurance: false,
                used: false,
                dropoff_available: false,
                user: allVendorRates[0]?.rates[0]?.user || "",
                metadata: {
                    is_multi_vendor: true,
                    vendor_count: allVendorRates.length,
                    shipment_cost: totalShipmentCost,
                    score: 0,
                    avgRating: 0,
                    insurance_fee: 0,
                    insurance_currency: "NGN",
                    insurance_default_fee: 0,
                    insurance_default_currency: "NGN",
                    cod_processing_fee: 0,
                    default_parcel: {
                        parcel_total_weight: totalWeight,
                        parcel_value: totalValue,
                        packages: allItems.map(item => ({
                            weight: (item.weight || 1) * (item.quantity || 1)
                        }))
                    },
                    vendor_breakdown: allVendorRates.map(vendorRate => {
                        const rate = vendorRate.rates.find(r => r.carrier_reference === carrierRef);
                        return {
                            vendor_id: vendorRate.vendor_id,
                            pickup_address: vendorRate.pickup_address,
                            items: vendorRate.items,
                            cost: rate?.amount || 0,
                            pickup_time: rate?.pickup_time,
                            delivery_time: rate?.delivery_time,
                            actual_rate_id: rate?.rate_id || rate?.id // Include actual rate ID
                        };
                    }),
                    vendor_rate_mapping: vendorRateDetails
                }
            };
        });
    }
    formatEta = (minutes) => {
        if (minutes < 60) return `Within ${minutes} minutes`;
        if (minutes < 1440) return `Within ${Math.ceil(minutes / 60)} hours`;
        const days = Math.ceil(minutes / 1440);
        return days === 1 ? `Within 1 day` : `Within ${days} days`;
    }

    createCart = () => {
        db.carts.create(
            {
                tenant_id: this.requestDetails.tenant.id,
                user_id: this.requestDetails.user.id,
                qoute_id: this.requestDetails.response,
            }
        )
    }

    createOrder = async () => {

        this.requestDetails.req.query.orderID = parseInt(this.requestDetails.response.slice(1, -1))
        this.requestDetails.req.params.tenant = 'fazsion'
        this.requestDetails.req.params.endpoint = 'get-order-details'

        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params)
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res })
        const order = await sendRequest(requestDetails)

        let orderDetails
        if (order.data)
            orderDetails = JSON.parse(order.data)

        if (
            orderDetails.entity_id
            && orderDetails.entity_id == this.requestDetails.req.query.orderID
        ) {

            // db.carts.update({ status: "disabled" }, { where: { user_id: this.requestDetails.user.id } })

            const commission = await walletController.createCommision(orderDetails, this.requestDetails.user)

            await db.orders.create(
                {
                    tenant_id: this.requestDetails.tenant.id,
                    user_id: this.requestDetails.user.id,
                    order_id: orderDetails.entity_id,
                    status: orderDetails.status,
                    order_details: JSON.stringify(orderDetails),
                    commission
                }
            )

        }
    }

    updateCart = async () => {
        const cart = JSON.parse(this.requestDetails.response)
        const skus = []
        for (let item of cart.items) {
            skus.push(item.sku)
        }

        this.requestDetails.req.params.tenant = 'fazsion'
        this.requestDetails.req.params.endpoint = 'get-products'
        this.requestDetails.req.query.value = skus.toString()
        this.requestDetails.req.query.attribute = 'sku'
        this.requestDetails.req.query.condition = 'in'

        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params)
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res })
        let response = await sendRequest(requestDetails)


        for (let item of cart.items) {
            item.image = await this.getProductImage(item.sku, JSON.parse(response.data).items)
        }

        return cart
    }

    getProductImage = async (sku, products) => {
        const tenantConfig = JSON.parse(this.requestDetails.tenant.config)
        return tenantConfig.ImageBaseUrl + products.find((item) => item.sku == sku)
            .custom_attributes.find((item) => item.attribute_code == 'image')
            .value

    }

    getCategoryBanners = async () => {
        this.requestDetails.req.params.tenant = 'fazsion'
        this.requestDetails.req.params.endpoint = 'get-category-banners'

        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params)
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res })

        const response = await sendRequest(requestDetails)

        return response.data
    }

    mergeCategoryBanners = async () => {
        const categories = JSON.parse(this.requestDetails.response)
        const img = this.getCategoryImageUrlFromCategoryBanners(categories.id, 'slider')
        categories.image_url = img
        this.addChildrenCategoryImage(categories.children_data)
        return categories
    }

    getCategoryImageUrlFromCategoryBanners = (categoryId, type) => {
        let categzoryBanners = JSON.parse(this.requestDetails.categoryBanners)
        let image_url = ''

        if (type == 'slider') {
            categoryBanners = categoryBanners[0].banners
        } else {
            categoryBanners = categoryBanners[1].banners
        }

        categoryBanners.map((categoryBanner) => {
            if (categoryBanner.name == categoryId)
                image_url = categoryBanner.image_url
        })

        return image_url
    }

    addChildrenCategoryImage = async (children) => {
        for (let child of children) {
            child.image_url = this.getCategoryImageUrlFromCategoryBanners(child.id, 'slider')
            if (child.children_data.length > 0) {
                this.addChildrenCategoryImage(child.children_data)
            }
        }
    }

    formatBrand = async () => {
        const brands = JSON.parse(this.requestDetails.response)
        const tenantConfig = JSON.parse(this.requestDetails.tenant.config)
        const response = { total: brands[0], items: [] }
        for (let brand of brands[1]) {
            brand.image = `${tenantConfig.BrandImageBaseUrl}/${brand.image}`
            brand.small_image = `${tenantConfig.BrandImageBaseUrl}/${brand.small_image}`
            response.items.push(brand)
        }
        return response
    }

    formatProductDetails = async () => {
        const details = JSON.parse(this.requestDetails.response)
        const tenantConfig = JSON.parse(this.requestDetails.tenant.config)
        for (let mediaItem of details.media_gallery_entries) {
            mediaItem.file = `${tenantConfig.ImageBaseUrl}${mediaItem.file}`
        }
        return details
    }

    getItemFromCustomeAttribute = (attrs, itemName) => {
        return attrs.filter((item) => {
            return item.attribute_code == itemName
        }).value
    }

    getZohoInvetoryToken = async () => {
        let token = await db.cache.getZohoInvetoryToken()
        return token;
    }

    getGIGToken = async () => {
        let token = await db.cache.getGIGToken()
        return token;
    }

    crmToken = async () => {
        let token = await db.cache.crmToken()
        return token;
    }

    getZohoSalesOrderToken = async () => {
        let token = await db.cache.getZohoSalesOrderToken()
        return token;
    }

    getZohoBookToken = async () => {
        let token = await db.cache.zohoBookToken()
        return token;
    }


    orderDetails = async () => {
        const userControler = require("../controllers/userController.js");
        let user = util.flattenObj(this.requestDetails.req?.user ?? {});
        const isAgent = user.account_types.split(',').includes('agent');
        const customerEmail = this.requestDetails?.payload?.delivery_address?.email;
        const customerId = customerEmail && isAgent ? (await userControler.getUser(customerEmail, null))?.id : null;
        const salesPerson = user?.lead;
        let agentId = salesPerson ? (await db.user_attributes.findOne({ where: { value: salesPerson } }))?.user_id ?? null : null;

        let agentDetails = agentId ? util.flattenObj(await userControler.getUser(null, null, true, null, null, agentId)) : null;

        let cart = await db.carts.findOne({ where: { user_id: user.id } });
        if (!cart?.products || JSON.parse(cart?.products).length < 1) {
            throw this.requestDetails.res.status(404).send({ "message": "Add product to cart", code: 404 });
        }

        let cartDetails = await cartControler.getCartDetails(cart);
        if (cartDetails?.data?.code == 2006) {
            throw util.responseError(cartDetails, cartDetails?.data?.code);
        }

        let temp = structuredClone(cartDetails.items);

        //  Extract and validate all data from cart items
        cartDetails.items.forEach((item, index) => {

            // Validate weight and value
            const weight = parseFloat(item.weight);
            const value = parseFloat(item.value) || parseFloat(item.total_price);

            if (isNaN(weight) || weight <= 0) {
                console.warn(` Invalid weight for item ${item.name}: ${item.weight}`);
                // Set default weight
                cartDetails.items[index].weight = 1;
            }

            if (isNaN(value) || value < 0) {
                console.warn(` Invalid value for item ${item.name}: ${item.value}`);
                cartDetails.items[index].value = 0;
            }
        });

        // Prepare order details for Zoho
        let orderDetails = [];
        for (let item of cartDetails.items) {
            item.imageurl = '';
            item.description = item.name;
            item.currency = "NGN";
            orderDetails.push(item);
        }

        let owner = this.requestDetails.payload?.delivery_address?.first_name ?? 'Order';
        let customer_id = this.requestDetails?.payload?.customer_id;
        const orderAmount = this.requestDetails?.payload?.amount;
        const currency = this.requestDetails?.payload?.currency;

        // Extract delivery type and multi-vendor info
        const deliveryType = this.requestDetails?.payload?.delivery_type;
        const isMultiVendor = this.requestDetails?.payload?.isMultiVendor;
        const isPerVendor = deliveryType === 'per-vendor';
        const isAggregated = deliveryType === 'aggregated';


        // Store critical data before deletion 
        const originalDispatcher = this.requestDetails.payload?.dispatcher;
        const originalRateId = this.requestDetails.payload?.rate_id;
        const originalCarrierReference = this.requestDetails.payload?.carrier_reference;
        const originalVendorSelections = this.requestDetails.payload?.vendor_selections;
        const originalVendorGroups = this.requestDetails.payload?.vendorGroups;


        const vendorRateMapping = originalDispatcher?.metadata?.vendor_rate_mapping || [];
        const vendorBreakdown = originalDispatcher?.metadata?.vendor_breakdown || [];


        delete this.requestDetails?.payload?.customer_id;
        delete this.requestDetails?.payload?.amount;
        salesPerson ? delete this.requestDetails?.payload?.sales_person_id : "";


        let shipmentDetail;

        if (!deliveryType) {
            shipmentDetail = util.formatShipmentByDeliveryType(
                structuredClone(cartDetails.items),
                {
                    ...this.requestDetails.payload,
                    delivery_type: 'single',
                    rate_id: originalRateId,
                    carrier_reference: originalCarrierReference
                }
            );
        } else {
            shipmentDetail = util.formatShipmentByDeliveryType(
                structuredClone(cartDetails.items),
                {
                    ...this.requestDetails.payload,
                    rate_id: originalRateId,
                    carrier_reference: originalCarrierReference,
                    vendor_selections: originalVendorSelections,
                    vendor_groups: originalVendorGroups
                }
            );
        }


        let shipment = {
            delivery_address: this.requestDetails.payload.delivery_address,
            currency: "NGN",
            parcel: {
                description: `Package delivery for ${owner}`,
                weight_unit: "kg",
                items: shipmentDetail
            },
            delivery_type: deliveryType,
            isMultiVendor: isMultiVendor,

            dispatcher: originalDispatcher,
            rate_id: originalRateId,
            carrier_reference: originalCarrierReference,
            vendor_selections: originalVendorSelections,
            vendor_groups: originalVendorGroups,

            metadata: {
                vendor_rate_mapping: vendorRateMapping,
                vendor_breakdown: vendorBreakdown,
                carrier_reference: originalCarrierReference,
                aggregated_rate_id: originalRateId
            }
        };


        let salesperson = isAgent ? `${user?.first_name} ${user?.last_name ?? ""}` : `${agentDetails?.first_name ?? ""} ${agentDetails?.last_name ?? ""}`;
        let placingOrderUser = user.sales_person_id ?? user.zoho_id;

        if (!placingOrderUser) {
            user = util.flattenObj(await walletController.getUser(user.email, user.phone, true));
        }


        let savedOrder = await db.orders.create({
            user_id: user.id,
            agent_id: agentId,
            customer_id: customerId,
            order_details: JSON.stringify(temp),
            shipping_fee: this.requestDetails.payload.shipping_fee,
            shipment_details: JSON.stringify(shipment),
            amount: orderAmount,
            types: 'order',
            currency: JSON.stringify(currency)
        });


        await (new VendorOrderHelper()).createVendorOrderDetail(savedOrder.id);
        this.requestDetails.req.query.orderId = savedOrder.id;

        const paymentType = this.requestDetails?.req?.query.paymentMethod == 'PAY_NOW' ? 'Prepaid' : 'On delivery';


        this.requestDetails.payload = {
            "customer_id": customer_id,
            'custom_fields': [
                { "label": "Sales Person Name", "value": salesperson },
                { "label": "Agent Email", "value": isAgent ? user.email : agentDetails?.email ?? '' },
                { "label": "Payment Type", "value": paymentType },
                { "label": "Order Type", "value": 'order' }
            ],
            'line_items': orderDetails
        };

        this.requestDetails.headers.Authorization = await this.getZohoSalesOrderToken();
    }

    createZohoOrder = async () => {
        const userControler = require("../controllers/userController.js");
        const zohoOrder = JSON.parse(this.requestDetails.response);
        const user = util.flattenObj(this.requestDetails.req.user);
        const isAgent = user.account_types.split(',').includes('agent');

        if (!zohoOrder.salesorder?.salesorder_id) {
            throw this.requestDetails.res.status(406).send({
                "message": zohoOrder?.message ?? zohoOrder,
                code: zohoOrder?.code ?? 406
            });
        }


        const cart = await db.carts.findOne({ where: { user_id: user.id } });
        cart.products = JSON.stringify([]);
        await cart.save();

        let reqQuery = this.requestDetails.req.query;
        let savedOrderId = this.requestDetails.req.query.orderId;
        let order = await db.orders.findOne({ where: { id: savedOrderId } });

        let agentDetails = isAgent ? this.requestDetails.user : null;
        if (!isAgent) {
            const customerAgent = order.agent_id ? utils.flattenObj(await userControler.getUser(null, null, true, null, null, order.agent_id)) : null
            const isCustomerAgent = customerAgent ? customerAgent.account_types.split(',').includes('agent') : null
            agentDetails = isCustomerAgent ? customerAgent : null;
        }

        const rate = JSON.parse(order?.currency ?? "{}")?.rate;
        const commission = agentDetails && rate ? await walletController.createCommision(zohoOrder?.salesorder, agentDetails, rate) : null;

        order.order_id = zohoOrder.salesorder?.salesorder_id;
        order.commission = commission;
        order.order_ref = zohoOrder?.salesorder?.salesorder_number;

        const initialTrackingHistory = [{
            timestamp: new Date(),
            status: 'order_created',
            description: 'Order created successfully',
            source: 'system'
        }];
        order.tracking_history = JSON.stringify(initialTrackingHistory);

        let shipmentResults = {
            successful: [],
            failed: [],
            details: []
        };

        let shipmentIds = [];
        let shipmentDetailPayload = JSON.parse(order.shipment_details);

        const customerEmail = extractCustomerEmailFromShipment(order.shipment_details);

        let paymentMethod = ["STARTBUTTON", "POD", "SALADAFRICA"]
        const shouldCreateShipment = reqQuery?.deliveryMethod === "shipment" &&
            reqQuery?.paymentMethod === "SALADAFRICA" &&
            reqQuery?.pickUpMethod !== "fulfilment_centre";

        if (shouldCreateShipment) {
            this.requestDetails.req.params.tenant = "terminalAfrica";
            const deliveryType = shipmentDetailPayload.delivery_type;
            const isMultiVendor = shipmentDetailPayload.isMultiVendor;


            const vendorRateMapping = shipmentDetailPayload.metadata?.vendor_rate_mapping ||
                shipmentDetailPayload.dispatcher?.metadata?.vendor_rate_mapping || [];

            const vendorBreakdown = shipmentDetailPayload.metadata?.vendor_breakdown ||
                shipmentDetailPayload.dispatcher?.metadata?.vendor_breakdown || [];

            const carrierReference = shipmentDetailPayload.metadata?.carrier_reference ||
                shipmentDetailPayload.carrier_reference ||
                shipmentDetailPayload.dispatcher?.carrier_reference;

            const hasAggregatedDelivery = deliveryType === 'aggregated' && vendorRateMapping.length > 0;
            const hasPerVendorDelivery = deliveryType === 'per-vendor' && shipmentDetailPayload.vendor_selections;
            const hasSingleVendorDelivery = deliveryType === 'single' && shipmentDetailPayload.rate_id;


            if (hasAggregatedDelivery) {
                await processAggregatedDelivery.call(this, vendorRateMapping, shipmentDetailPayload, order, shipmentResults, shipmentIds, deliveryType, carrierReference);
                let shipments_pairs = this.buildShipmentStatusUpdatePayload(shipmentResults);

                await this.updateZohoSalesOrder(order.order_id,
                    shipments_pairs,
                    order.order_ref
                );
            } else if (hasPerVendorDelivery) {
                await processPerVendorDelivery.call(this, shipmentDetailPayload.vendor_selections, order, shipmentResults, shipmentIds, deliveryType);
                let shipments_pairs = this.buildShipmentStatusUpdatePayload(shipmentResults);

                await this.updateZohoSalesOrder(order.order_id,
                    shipments_pairs,
                    order.order_ref,
                    rate
                );
            } else if (hasSingleVendorDelivery) {
                await processSingleVendorDelivery.call(this, shipmentDetailPayload, order, shipmentResults, shipmentIds, deliveryType, rate);
            } else {
                console.warn(" No valid delivery configuration found for shipment creation");
            }

            await logInitialWebhookEvents(order, shipmentResults);
        } else {
            // console.log(" Shipment creation not required - pickup order");
        }

        order.shipment_id = shipmentIds.toString();
        // update zoho sales order


        await updateOrderStatusBasedOnShipments(order, shipmentResults);

        // await this.sendOrderCreationNotifications(order, user, shipmentResults, zohoOrder, agentDetails);

        order.processor = reqQuery?.paymentMethod;
        order.pickUpMethod = reqQuery?.pickUpMethod;
        await order.save();

        const response = buildOrderResponse(zohoOrder, shipmentResults, order);


        this.requestDetails.response = { statusCode: 200, data: response };
        this.requestDetails.exit = true;
    }

    updateZohoSalesOrder = async (salesordersId, shipment_status, order_ref, rate) => {
        const originalReq = { ...this.requestDetails.req };

        this.requestDetails.req.params = { 'tenant': 'zoho', 'endpoint': 'update-orders' }
        this.requestDetails.req.query = { 'order_id': salesordersId }

        this.req.body = {
            "return": 1,
            "salesorder_number": order_ref.toString(),
            "custom_fields": [
                { "label": "Shipment Status", "value": shipment_status }]
        }
        let response = await this.makeRequest(this.req, this.res)
        return response
    }


    buildShipmentStatusUpdatePayload = (shipmentResults) => {
        {
            let statusPayloadParts = [];
            shipmentResults.successful.forEach(shipment => {
                statusPayloadParts.push(`${shipment.shipment_id}:pending`);
            }
            );
            shipmentResults.failed.forEach(shipment => {
                statusPayloadParts.push(`${shipment.shipment_id}:failed`);
            }
            );
            // the above should ultimatelly yield the below on runtime:
            return statusPayloadParts.join(',');
        }

    }


    sendOrderCreationNotifications = async (order, user, shipmentResults, zohoOrder, agentDetails) => {
        const customerData = JSON.parse(order.shipment_details).delivery_address;
        const hasShipments = shipmentResults.successful.length > 0;
        const orderNumber = zohoOrder?.salesorder?.salesorder_number || order.order_ref;
        const totalAmount = order.amount?.toLocaleString() || '0';

        const customerEmailSent = await sendCustomerEmail(
            order,
            `Order Confirmation - ${orderNumber}`,
            buildCustomerOrderEmailContent(order, shipmentResults, zohoOrder),
            'order_confirmation'
        );

        if (isUserAgent(user)) {
            await sendAgentEmail(
                user,
                order,
                `New Order Placed - ${orderNumber}`,
                buildAgentOrderEmailContent(order, shipmentResults, zohoOrder, customerData),
                'new_order'
            );
        }

        if (isUserAgent(user)) {
            this.agentNotification(order, user, customerData, zohoOrder);
        }
        this.shopperNotification(order, user, zohoOrder, agentDetails);
    }

    getCategory = async () => {
        const categories = await this.zohoCategory(this.requestDetails.req?.query?.category_id ?? null, null,
            this.requestDetails.req.query?.name ?? null, this.requestDetails.req.query?.status ?? null)
        this.requestDetails.response = { statusCode: 200, data: { categories: this.formartCategories(categories) } }
        return this.requestDetails.exit = true
    }

    deleteLocalCategory = async () => {
        if (JSON.parse(this.requestDetails.response).code == 250019) return
        await db.categories.destroy({ where: { category_id: this.requestDetails.req.query.category_id } })
    }
    updateLocalCategory = async () => {
        if (JSON.parse(this.requestDetails.response).code == 250019) return
        const category = await this.zohoCategory(this.requestDetails.req.query.category_id, this.requestDetails.req.body)
        this.requestDetails.exit = true
        return this.requestDetails.response = { statusCode: 200, data: { category } }
    }
    createCategory = async (categoryId = null) => {
        const response = categoryId ?? JSON.parse(await this.requestDetails.response)
        let category_id = response?.category?.category_id ?? categoryId
        if (!category_id) {
            throw this.requestDetails.res.status(400).send({ measage: response?.message ?? 'Unable to create category.', code: response?.code ?? 400 })
        }
        const { name, parent_category_id, image, description } = this.requestDetails.req.body
        const payload = { "name": name, "parent_id": parent_category_id, "category_id": category_id, "image": image, description }
        const category = await this.zohoCategory(null, payload, null)
        this.requestDetails.response = { statusCode: 200, data: { category } }
        return this.requestDetails.exit = true
    }

    createCategoryLocal = async () => {
        if (this.requestDetails.req.query.platform == 'local') {
            const categoryId = this.requestDetails.req.body.category_id ?? null
            await this.createCategory(categoryId)
        }
        this.requestDetails.headers.Authorization = await this.getZohoInvetoryToken()
    }

    async zohoCategory(categoryId = null, payload = null, name = null, status = null) {
        let category
        // Update category || Get Cat by Id
        if (categoryId) {
            category = await db.categories.findOne({ where: { category_id: categoryId } })
            if (payload) {
                if (!category) return []
                category.name = payload.name ?? category.name
                category.image = payload.image ?? category.image
                category.description = payload.description ?? category.description
                category.status = payload?.status ?? category.status
                return await category.save()
            }
            if (!category) return []
            return category
        }
        if (status) {
            return await db.categories.findAll({
                where: { status: status },
                order: [['id', 'ASC']]
            })
        }
        // Create category 
        if (payload?.name && !categoryId)
            category = await db.categories.findOne({ where: { name: payload?.name, category_id: payload.category_id } })

        if (!category && payload?.name) {
            category = await db.categories.create(payload)
            return category
        }
        // Get category by name
        if (name) return await db.categories.findOne({ where: { name: name } })
        // Get categories
        return await db.categories.findAll({ order: [['id', 'ASC']] })
    }

    formartCategories = (categories) => {
        if (!Array.isArray(categories)) return categories
        const mainNewCat = categories.map(cat => cat.dataValues)
        const rootCategoryId = categories.filter(cat => cat.name == "ROOT")[0]?.category_id ?? -1
        const formatedCat = this.createCatdObj(mainNewCat, rootCategoryId)
        return formatedCat.length > 1 ? formatedCat : mainNewCat
    }

    createCatdObj = (data, parentId = null) => {
        return data
            .filter(item => item.parent_id === parentId)
            .map(item => ({
                ...item,
                sub_categories: this.createCatdObj(data, item.category_id)
            }));
    }

    getBrands = async () => {
        const brands = await this.zohoBrand(this.requestDetails.req.query.brand_id ?? null, null,
            this.requestDetails.req.query?.name ?? null,
            this.requestDetails.req.query?.status ?? null)
        this.requestDetails.response = { statusCode: 200, data: { brands } }
        return this.requestDetails.exit = true
    }

    createBrands = async (brandId = null) => {
        const response = brandId ?? JSON.parse(await this.requestDetails.response)
        const brand_id = response?.brand?.brand_id ?? brandId
        if (!brand_id) {
            this.requestDetails.response = { statusCode: response.code ?? 500, data: { response } }
            throw this.requestDetails.res.status(400).send({ code: response.code ?? 400, message: response?.measage ?? "Unable to create brand." })
        }
        const payload = { "name": this.requestDetails.req.body?.name, brand_id: brand_id, image: this.requestDetails.req.body?.image }
        const brand = await this.zohoBrand(null, payload, null)
        this.requestDetails.response = { statusCode: 200, data: { brand } }
        return this.requestDetails.exit = true
    }
    createBrandLocal = async () => {
        if (this.requestDetails.req.query.platform == 'local') {
            const brandId = this.requestDetails.req.body?.brand_id ?? null
            await this.createBrands(brandId)
        }
        this.requestDetails.headers.Authorization = await this.getZohoInvetoryToken()
    }

    deleteLocalBrands = async () => {
        if (JSON.parse(this.requestDetails.response).code == 250019) return
        await db.brand.destroy({ where: { brand_id: this.requestDetails.req.query.brand_id } })
    }

    updateLocalBrand = async () => {
        if (JSON.parse(this.requestDetails.response).code == 250019) return
        const brand = await this.zohoBrand(this.requestDetails.req.query.brand_id, this.requestDetails.req.body)
        this.requestDetails.exit = true
        return this.requestDetails.response = { statusCode: 200, data: { brand } }
    }

    zohoBrand = async (brandId = null, payload = null, name = null, status = null) => {
        let brand
        // Update Brand || Get Brand by Id
        if (brandId) {
            brand = await db.brand.findOne({ where: { brand_id: brandId } })
            if (payload) {
                if (!brand) return []
                brand.name = payload?.name ?? brand.name
                brand.image = payload?.image ?? brand.image
                brand.description = payload?.description ?? brand.description
                brand.status = payload?.status ?? brand.status
                return await brand.save()
            }
            if (!brand) return []
            return brand
        }
        if (status) {
            return await db.brand.findAll({
                where: { status: status },
                order: [['id', 'ASC']]
            })
        }
        // Create Brand 
        if (payload?.name && !brandId)
            brand = await db.brand.findOne({ where: { name: payload?.name }, order: [['id', 'ASC']] })

        if (!brand && payload?.name) {
            brand = await db.brand.create(payload)
            return brand
        }
        // Get Brand by name
        if (name) return await db.brand.findOne({ where: { name: name } })
        // Get Brands
        return await db.brand.findAll({
            order: [['id', 'ASC']]
        }
        )
    }

    scopeMiddlewareEvent = async () => {
        const rawScope = this.requestDetails.endpoint.scope
        const socpeObj = rawScope ? JSON.parse(rawScope) : null
        if (!this.requestDetails.req.user.permission?.scope.includes(socpeObj?.scope)) {
            throw this.requestDetails.res.status(403).send(
                { "message": `Access denied mising scope ${socpeObj?.scope}` })
        }
        if (socpeObj?.before_execute_method) {
            return await this[socpeObj?.before_execute_method]()
        }
    }

    getVendorOrders = async () => {
        const limit = this.requestDetails.req.query?.limit ?? 30
        const offset = this.requestDetails.req.query?.offset ?? 0
        const vendor = this.requestDetails.req.query?.vendor
        const status = this.requestDetails.req.query?.status
        const startDate = this.requestDetails.req.query?.startDate ?? util.default7DaysInterval().startDate
        const endDate = this.requestDetails.req.query?.endDate ?? util.default7DaysInterval().endDate
        const allowedKeys = ['vendor']
        const condition = util.validateAndCleanObject(this.requestDetails.req.query, allowedKeys)
        const statusCondition = status ? { '$orders.status$': { [Op.eq]: status } } : { '$orders.status$': { [Op.ne]: null } }
        const dateCondition = { '$order_details.createdAt$': { [Op.between]: [startDate, endDate + ' 23:59'] } }
        let orderDetails = []
        if (vendor)
            orderDetails = await db.order_details.findAndCountAll({
                where: Object.assign(condition, dateCondition, statusCondition),
                attributes: {
                    include: [db.Sequelize.col('orders.status'), db.Sequelize.col('orders.order_id'), db.Sequelize.col('orders.order_ref')],
                },
                include: [
                    {
                        model: db.orders, as: 'orders', attributes: []
                    }],
                limit: parseInt(limit), offset: parseInt(offset), order: [['id', 'DESC']],
                raw: true
            })
        this.requestDetails.response = { statusCode: 200, data: orderDetails }
        return this.requestDetails.exit = true
    }

    formatCreateZohoContactPayload = async () => {
        const reqPayload = this.requestDetails.req.body
        let isTaken = JSON.parse((await this.validateDuplicateCustomer(reqPayload.email)).data)
        if (isTaken?.contacts?.length > 0) {
            if (reqPayload.return) {
                this.requestDetails.response = { statusCode: 200, data: { message: "This customer email is already linked to a customer. Select from existing customers, or contact admin if not listed.", zoho_id: isTaken.contacts[0].contact_id } }
            } else
                throw this.requestDetails.res.status(400).send({ message: "This customer email is already linked to a customer. Select from existing customers, or contact admin if not listed.", zoho_id: isTaken.contacts[0].contact_id })
        }
        reqPayload.sales_person_id = this.requestDetails.req?.user?.attributes?.sales_person_id ?? this.requestDetails.req?.query.sales_person_id ?? null
        reqPayload.type = "B2B"
        const contact = new ContactHelper(reqPayload)
        let billingAddress = contact.getBillings()
        let shipping_address = contact.getAddres()
        let billing_address = Object.keys(billingAddress).length > 0 ? billingAddress : shipping_address
        let newPaylod = {
            contact_type: reqPayload.contact_type, customer_sub_type: 'individual',
            company_name: reqPayload.businessName,
            contact_name: `${reqPayload.first_name ?? reqPayload.email} ${reqPayload.last_name ?? reqPayload.phone}`,
            contact_persons: [contact.getContactDetails()],
            custom_fields: contact.getCustomerField(),
            billing_address: billing_address,
            shipping_address: shipping_address
        }
        newPaylod.contact_persons.communication_preference = { "is_whatsapp_enabled": true }
        if (reqPayload.return) newPaylod.return = 1
        this.requestDetails.payload = newPaylod
        this.requestDetails.headers.Authorization = await this.getZohoInvetoryToken()
    }

    formatUpdateContact = async () => {
        const reqPayload = this.requestDetails.req.body

        const contact = new ContactHelper(reqPayload)
        let billingAddress = contact.getBillings()
        let shipping_address = contact.getAddres()
        let billing_address = Object.keys(billingAddress).length > 0 ? billingAddress : shipping_address
        let custom_fields = contact.getCustomerField()
        let contactName = `${reqPayload.first_name} ${reqPayload.last_name}`

        let newPaylod = {
            company_name: reqPayload.businessName,
            contact_name: contactName,
            contact_persons: [contact.getContactDetails()],
            custom_fields, billing_address, shipping_address
        }
        if (!reqPayload.businessName) delete newPaylod.company_name
        this.requestDetails.payload = newPaylod
        this.requestDetails.headers.Authorization = await this.getZohoInvetoryToken()
    }

    linkSalesPerson = async () => {
        const userCreatedResponse = JSON.parse(this.requestDetails.response)
        const { contact_id, zcrm_contact_id } = userCreatedResponse?.contact
        const sales_person_id = this.requestDetails.req?.user?.attributes?.sales_person_id ?? this.requestDetails.req?.query?.sales_person_id
        if (zcrm_contact_id.length > 0 && sales_person_id) {
            this.requestDetails.req.params.tenant = "crm"
            this.requestDetails.req.params.endpoint = 'link-customer'
            this.requestDetails.req.body = { "data": [{ "id": zcrm_contact_id, "Contact_Owner": sales_person_id }] }
            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params, this.requestDetails.res)
            if (!tenant) return
            const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res })
            requestDetails.headers = { 'Content-Type': 'application/json', "Authorization": await this.crmToken() }
            const linked = await sendRequest(requestDetails)
            return
        }
        return
    }
    validateDuplicateCustomer = async (email) => {
        let req = this.requestDetails.req
        let res = this.requestDetails.res
        req.params.tenant = "zoho"
        req.params.endpoint = 'get-customer'
        req.query.email = email
        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params, this.requestDetails.res)
        const requestDetails = await validateRequest({ tenant, endpoint, req: req, res: res })
        requestDetails.headers = { 'Content-Type': 'application/json', "Authorization": await this.getZohoInvetoryToken() }
        return await sendRequest(requestDetails)

    }


    getCategoryTree = async () => {
        const category_id = this.requestDetails.req.query?.category_id
        if (category_id) {
            const categoryIds = (await db.sequelize.query(`WITH RECURSIVE cte AS(
            SELECT category_id, status FROM categories WHERE parent_id = '${category_id}'
            UNION ALL
            SELECT c.category_id, c.status FROM categories c JOIN cte
            ON cte.category_id=c.parent_id
            )
            SELECT category_id, status FROM cte LIMIT 19;`))[0]

            const catArray = [category_id, ...categoryIds.filter(cat => cat.status == 'active').map(list => list.category_id)].toString()
            this.requestDetails.query.category_ids = catArray
            delete this.requestDetails.query.category_id
        }
        this.requestDetails.headers.Authorization = await this.getZohoInvetoryToken()
    }
    createZohoTask = async () => {
        const user = utils.flattenObj(this.requestDetails.req?.user)
        let body = this.requestDetails.req.body
        if (!user.sales_person_id) {
            throw this.requestDetails.res.status(401).send({ message: "Missing salesperson_id" })
        }
        let payload = {
            Description: body.description,
            Send_Notification_Email: true,
            Due_Date: body.dueDate,
            Priority: body.priority,
            Subject: body.subject,
            Who_Id: {
                name: body.contactName,
                id: body.contactId,
            },
            What_Id: {
                name: `${user.file_name} ${user.last_name}`,
                id: user.sales_person_id
            },
            $se_module: "Salesperson",
            $approved: true
        }
        body?.recurring ? payload.Recurring_Activity = { RRULE: body.recurring } : null
        body?.remindAt ? payload.Remind_At = { "ALARM": body.remindAt } : null
        this.requestDetails.payload = { data: [payload] }
        this.requestDetails.headers.Authorization = await this.crmToken()
    }

    agentNotification = async (order, user, customerData, zohoOrder) => {
        let d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }))
        const date = d.toDateString() + " " + d.toLocaleTimeString()
        nodemailer.sendMail({
            email: user.email, content: {
                orderNumber: order.order_ref, user: `${user.last_name} ${user.first_name}`,
                customerName: `${customerData?.last_name} ${customerData?.first_name}`,
                date: zohoOrder?.salesorder?.created_time_formatted ?? date,
                total: zohoOrder?.salesorder?.total_formatted ?? order?.amount ?? 0.0
            }, subject: 'Order Placement', template: 'agentOrder'
        })

        nodemailer.sendMail({
            email: user.email, content: {
                orderNumber: order.order_ref, user: `${customerData?.last_name} ${customerData?.first_name}`,
                agentName: `${user?.last_name} ${user?.first_name}`,
                date: zohoOrder?.salesorder?.created_time_formatted ?? date,
                total: zohoOrder?.salesorder?.total_formatted ?? order?.amount ?? 0.0
            }, subject: 'Order Placement', template: 'agentCustOrder'
        })
    }

    shopperNotification = async (order, user, zohoOrder, agentDetails) => {
        let d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }))
        const date = d.toDateString() + " " + d.toLocaleTimeString()
        nodemailer.sendMail({
            email: user.email, content: {
                orderNumber: order.order_ref, user: `${user.last_name} ${user.first_name}`,
                date: zohoOrder.salesorder?.created_time_formatted ?? date,
                total: zohoOrder.salesorder?.total_formatted ?? order?.amount ?? 0.0
            }, subject: 'Order Placement', template: 'customerOrder'
        })
        if (agentDetails)
            nodemailer.sendMail({
                email: agentDetails.email, content: {
                    orderNumber: order.order_ref, user: `${agentDetails.last_name} ${agentDetails.first_name}`,
                    date: zohoOrder.salesorder?.created_time_formatted ?? date,
                    total: zohoOrder.salesorder?.total_formatted ?? order?.amount ?? 0.0,
                    name: `${user?.last_name} ${user?.first_name}`,
                    phone: user.phone
                }, subject: 'Order Placement', template: 'customerAgentOrder'
            })
    }

    helpers = async (req, res) => {
        this.requestDetails.exit = true

        const { route, endpoint } = this.requestDetails.query
        switch (route) {
            case 'sample':
                const sample = new SampleRequest(db, endpoint, req, res)
                typeof sample[endpoint] === 'function' ?
                    await sample.callMethods() :
                    res.status(400).send(utils.responseError("Method not implemented", 400))
                break
            case "quote":
                const quote = new QuoteRequest(db, endpoint, req, res)
                typeof quote[endpoint] === 'function' ?
                    await quote.callMethods() :
                    res.status(400).send(utils.responseError("Method not implemented", 400))
                break
            case "admin":
                const admin = new AdminHelper(db, endpoint, this.requestDetails.req, this.requestDetails.res)
                typeof admin[endpoint] === 'function' ?
                    await admin.callMethods() :
                    this.requestDetails.res.status(400).send(utils.responseError("Method not implemented", 400))
                break
            case "order":
                const orderHelper = new OrderHelper(db, endpoint, this.requestDetails.req, this.requestDetails.res)
                typeof orderHelper[endpoint] === 'function' ?
                    await orderHelper.callMethods() :
                    this.requestDetails.res.status(400).send(utils.responseError("Method not implemented", 400))
                break

        }
    }

    async rateConversionFallBack() {
        const date = this.requestDetails.req.query.date ?? new Date().toISOString().split('T')[0]
        const currency = this.requestDetails.req.query.currency ?? 'usd'
        const mainResponse = await JSON.parse(this.requestDetails?.response ?? "{}")
        if (!mainResponse?.success) {
            const url = `https://${date}.${process.env.CURRENCY_CONVERTION_BACKUP_URL}/${currency}.json`
            const rate = await axios.get(url, {})

            const symbol = Object.keys(rate.data)[1]
            const rates = rate.data[symbol]
            const forex = []
            if (Object.keys(rates) < 1) return
            for (let key in rates) {
                let formData = {
                    "symbol": key.toUpperCase(),
                    "buy": rates[key],
                    "sell": rates[key]
                }
                forex.push(formData)
            }
            this.requestDetails.res.status(rate.status).send({
                "success": true,
                "message": "forex",
                "data": forex
            })
            this.requestDetails.exit = true
        }
    }




    createReport = async () => {
        const payload = this.requestDetails.payload;
        const { name, customer, customer_email, next_step_follow_up, action_update, priority, status, follow_up_due_date } = payload;

        if (!name || !customer || !customer_email) {
            throw this.requestDetails.res.status(400).send({
                message: 'Missing required fields: name, customer, customer_email',
                code: 400
            });
        }

        const zohoPayload = {
            data: [{
                Name: name,
                Customer: customer,
                Customer_Email: customer_email,
                Next_Step_Follow_up: next_step_follow_up,
                Action_Update: action_update,
                Priority: priority,
                Status: status,
                Follow_up_Due_Date: follow_up_due_date
            }]
        };

        this.requestDetails.headers.Authorization = await this.crmToken();

        this.requestDetails.req.params.tenant = 'crm';
        this.requestDetails.req.params.endpoint = 'create-sales-partner-report';
        this.requestDetails.req.body = zohoPayload;

        const { tenant, endpoint } = await getTenantAndEndpoint({ tenant: 'crm', endpoint: 'report-salespartner-create' });
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res });

        const response = await sendRequest(requestDetails);
        const parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!parsedResponse.success || !parsedResponse.data) {
            throw this.requestDetails.res.status(400).send({
                message: 'Failed to create report in Zoho',
                code: 400,
                details: parsedResponse.message || parsedResponse
            });
        }

        const reportId = parsedResponse.data[0]?.id || parsedResponse.data[0]?.Report_Salespartner?.id;

        this.requestDetails.response = {
            statusCode: 201,
            data: {
                report_id: reportId,
                message: 'Report created successfully in Zoho',
                data: parsedResponse.data[0]
            }
        };
        this.requestDetails.exit = true;
    };

    getReport = async () => {
        const { report_id, name, customer, customer_email, from_date, to_date, status } = this.requestDetails.req.query;

        // Build Zoho search criteria
        let searchCriteria = '';
        if (name) searchCriteria += `Name:equals:${name},`;
        if (customer) searchCriteria += `Customer:equals:${customer},`;
        if (customer_email) searchCriteria += `Customer_Email:equals:${customer_email},`;
        if (status) searchCriteria += `Status:equals:${status},`;
        if (from_date && to_date) {
            searchCriteria += `Created_Time_Date:greater_equal:${from_date},Created_Time_Date:less_equal:${to_date},`;
        }
        searchCriteria = searchCriteria.slice(0, -1);

        this.requestDetails.headers.Authorization = await this.crmToken();

        // Prepare request
        this.requestDetails.req.params.tenant = 'crm';
        this.requestDetails.req.params.endpoint = 'get-sales-partner-report';
        this.requestDetails.req.query = {
            ...this.requestDetails.req.query,
            criteria: searchCriteria || '',
            fields: 'Name,Customer,Customer_Email,Next_Step_Follow_up,Action_Update,Priority,Status,Follow_up_Due_Date,Created_Time_Date',
            page: this.requestDetails.req.query.page || 1,
            per_page: this.requestDetails.req.query.per_page || 20
        };

        const { tenant, endpoint } = await getTenantAndEndpoint({ tenant: 'crm', endpoint: 'report-salespartner-get' });
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res });

        const response = await sendRequest(requestDetails);
        const parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!parsedResponse.success) {
            throw this.requestDetails.res.status(404).send({
                message: 'No reports found',
                code: 404,
                details: parsedResponse.message || parsedResponse
            });
        }

        this.requestDetails.response = {
            statusCode: 200,
            data: {
                reports: parsedResponse.data || [],
                total: parsedResponse.info?.count || 0
            }
        };
        this.requestDetails.exit = true;
    };

    updateReport = async () => {
        const { report_id } = this.requestDetails.req.query;
        const payload = this.requestDetails.payload;
        const { name, customer, customer_email, next_step_follow_up, action_update, priority, status, follow_up_due_date } = payload;

        if (!report_id) {
            throw this.requestDetails.res.status(400).send({
                message: 'Missing required field: report_id',
                code: 400
            });
        }

        const zohoPayload = {
            data: [{
                id: report_id,
                Name: name,
                Customer: customer,
                Customer_Email: customer_email,
                Next_Step_Follow_up: next_step_follow_up,
                Action_Update: action_update,
                Priority: priority,
                Status: status,
                Follow_up_Due_Date: follow_up_due_date
            }]
        };

        this.requestDetails.headers.Authorization = await this.crmToken();

        this.requestDetails.req.params.tenant = 'crm';
        this.requestDetails.req.params.endpoint = 'update-sales-partner-report';
        this.requestDetails.req.query = { id: report_id };
        this.requestDetails.req.body = zohoPayload;

        const { tenant, endpoint } = await getTenantAndEndpoint({ tenant: 'crm', endpoint: 'report-salespartner-update' });
        const requestDetails = await validateRequest({ tenant, endpoint, req: this.requestDetails.req, res: this.requestDetails.res });

        const response = await sendRequest(requestDetails);
        const parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!parsedResponse.success || !parsedResponse.data) {
            throw this.requestDetails.res.status(400).send({
                message: 'Failed to update report in Zoho',
                code: 400,
                details: parsedResponse.message || parsedResponse
            });
        }

        this.requestDetails.response = {
            statusCode: 200,
            data: {
                report_id,
                message: 'Report updated successfully in Zoho',
                data: parsedResponse.data[0]
            }
        };
        this.requestDetails.exit = true;
    };

}


module.exports.EventstHelper = EventstHelper
