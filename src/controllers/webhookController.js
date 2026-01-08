const db = require('../models/db.js');
const { Op } = require('sequelize');
const crypto = require('crypto');
const nodemailer = require('../mailer/nodemailer.js');
const userController = require('./userController');
const walletController = require('./walletController');

class WebhookController {

    /**
     * MAIN TERMINAL AFRICA WEBHOOK HANDLER
     * Use this as the single source of truth for Terminal Africa webhooks
     */
    handleTerminalAfricaWebhook = async (req, res, updateOrderfunc) => {
        const io = req.app.get('socketio');

        try {
            // Verify webhook signature
            const SECRET_KEY = process.env.TERMINAL_AFRICA_SECRET_KEY;
            const signature = req.headers['x-terminal-signature'];
            const payload = req.body;

            const hash = req.headers['x-terminal-signature'];

            if (signature !== hash) {
                await this.logWebhook('invalid_signature', null, null, payload, 'Invalid webhook signature');
                return res.status(401).send('Invalid signature');
            }

            const { event, data } = payload;
            

            // Process the webhook
            await this.processTerminalAfricaEvent(event, data, io, updateOrderfunc);

            await this.logWebhook(event, data?.shipment_id, null, payload);
            return res.status(200).send('Webhook processed');

        } catch (error) {
            console.error('Webhook processing error:', error);
            await this.logWebhook('processing_error', null, null, req.body, error.message);
            return res.status(500).send('Error processing webhook');
        }
    }

    /**
     * PROCESS TERMINAL AFRICA EVENTS
     */
    processTerminalAfricaEvent = async (event, data, io, updateOrderfunc) => {
        // Find shipment by shipment_id
        let shipment = null;
        if (data?.shipment_id) {
            shipment = await db.shipment.findOne({
                where: { shipment_id: data.shipment_id }
            });
        }

        // Find order
        let order = null;
        if (shipment) {
            order = await db.orders.findOne({ where: { id: shipment.order_id } });
        } else if (data?.order_id) {
            order = await db.orders.findOne({ where: { order_id: data.order_id } });
        }

        // Shipment status mapping
        const eventToStatus = {
            'shipment.created': 'created',
            'shipment.updated': 'in_transit',
            'shipment.in-transit': 'in_transit',
            'shipment.out-for-delivery': 'out_for_delivery',
            'shipment.delivered': 'delivered',
            'shipment.cancelled': 'cancelled',
            'shipment.exception': 'exception'
        };

        // Handle different webhook events
        switch (event) {
            case 'shipment.created':
            case 'shipment.updated':
            case 'shipment.in-transit':
            case 'shipment.out-for-delivery':
            case 'shipment.delivered':
            case 'shipment.cancelled':
            case 'shipment.exception':
                await this.handleShipmentEvent(event, data, shipment, order, io, updateOrderfunc);
                break;

            case 'transaction.success':
                // await this.handleTransactionSuccess(event, data, order, io);

                break;

            case 'transaction.failed':
                await this.handleTransactionFailed(event, data, order, io);
                break;

            case 'tracking.updated':
                await this.handleTrackingUpdate(event, data, shipment, order, io);
                break;

            default:
                console.log(`Unhandled webhook event: ${event}`);
                await this.logWebhook(event, data?.shipment_id, order?.id, data, 'Unhandled event type');
                break;
        }
    }

    /**
     * HANDLE SHIPMENT EVENTS
     */
    handleShipmentEvent = async (event, data, shipment, order, io, updateOrderfunc) => {
        const eventToStatus = {
            'shipment.created': 'created',
            'shipment.updated': 'in_transit',
            'shipment.in-transit': 'in_transit',
            'shipment.out-for-delivery': 'out_for_delivery',
            'shipment.delivered': 'delivered',
            'shipment.cancelled': 'cancelled',
            'shipment.exception': 'exception'
        };

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
            await this.updateOrderShipmentStatus(order, shipment, status, event, data);
            updateOrderfunc(order.order_id, null, status, order.order_ref);
            // Send status email to customer
            await this.sendShipmentStatusEmail(order, shipment, status, data);

            // Notify frontend
            this.notifyFrontend(io, event, {
                shipment_id: data.shipment_id,
                order_id: order.id,
                status: status,
                tracking_number: data.tracking_number,
                tracking_url: data.tracking_url
            });

            // Handle special cases
            if (event === 'shipment.delivered') {
                await this.handleDeliveryCompletion(order);
            }

            if (event === 'shipment.cancelled') {
                await this.handleShipmentCancellation(order, data);
            }
        }
    }

    /**
     * HANDLE TRANSACTION SUCCESS
     */
    handleTransactionSuccess = async (event, data, order, io) => {
        if (order) {
            await order.update({
                payments: 'paid',

                shipping_fee: data.amount
            });

            this.notifyFrontend(io, event, {
                order_id: order.id,
                transaction_id: data.transaction_id,
                amount: data.amount
            });

            await this.sendPaymentEmail(order, 'success', data);
        }
    }

    /**
     * HANDLE TRANSACTION FAILED
     */
    handleTransactionFailed = async (event, data, order, io) => {
        if (order) {
            await order.update({
                payments: 'failed',
                payment_failure_reason: data.reason
            });

            this.notifyFrontend(io, event, {
                order_id: order.id,
                reason: data.reason
            });

            await this.sendPaymentEmail(order, 'failed', data);
        }
    }

    /**
     * HANDLE TRACKING UPDATE
     */
    handleTrackingUpdate = async (event, data, shipment, order, io) => {
        if (shipment) {
            await shipment.update({
                tracking_number: data.tracking_number,
                tracking_url: data.tracking_url
            });

            this.notifyFrontend(io, event, {
                shipment_id: data.shipment_id,
                tracking_number: data.tracking_number,
                tracking_url: data.tracking_url
            });
        }
    }

    /**
     * UPDATE ORDER SHIPMENT STATUS
     */
    updateOrderShipmentStatus = async (order, shipment, status, event, data) => {
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
            last_tracking_update: new Date()
        };

        if (event === 'shipment.delivered' && status === 'delivered') {
            updateData.delivered_at = new Date();
        }

        if (event === 'shipment.cancelled') {
            updateData.cancellation_reason = data.cancellation_reason;
        }

        await order.update(updateData);

        // Append to tracking history
        await this.appendTrackingHistory(
            order,
            status,
            `Shipment ${event.replace('shipment.', '')}`,
            {
                shipment_id: data.shipment_id,
                event: event
            }
        );
    }

    /**
     * SHIPMENT STATUS EMAIL FUNCTION
     */
    sendShipmentStatusEmail = async (order, shipment, status, data) => {
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

            // Send to customer (from shipment_details)
            await this.sendCustomerEmail(
                order,
                emailConfig.subject,
                emailContent,
                emailConfig.template
            );

            console.log(` Sent ${status} email to customer for order ${order.id}`);

        } catch (error) {
            console.error('Error sending shipment status email:', error);
        }
    }

    /**
     * PAYMENT EMAIL
     */
    sendPaymentEmail = async (order, status, data) => {
        try {
            const subject = status === 'success'
                ? 'Payment Received Successfully'
                : 'Payment Failed';

            const content = status === 'success'
                ? `
                    <h2>Payment Confirmed</h2>
                    <p>Your payment for order <strong>${order.order_ref}</strong> was successful.</p>
                    <p><strong>Transaction ID:</strong> ${data.transaction_id}</p>
                    <p><strong>Amount Paid:</strong> ₦${data.amount}</p>
                    <p>Thank you for your payment!</p>
                `
                : `
                    <h2>Payment Failed</h2>
                    <p>Your payment for order <strong>${order.order_ref}</strong> failed.</p>
                    <p><strong>Reason:</strong> ${data.reason}</p>
                    <p>Please try again or contact support.</p>
                `;

            await this.sendCustomerEmail(order, subject, content, `payment_${status}`);

        } catch (error) {
            console.error('Error sending payment email:', error);
        }
    }

    /**
     * HANDLE DELIVERY COMPLETION
     */
    handleDeliveryCompletion = async (order) => {
        try {
            order.delivered_at = new Date();
            await order.save();

            // Approve agent commission
            await this.approveAgentCommission(order);

        } catch (error) {
            console.error('Error handling delivery completion:', error);
        }
    }

    /**
     * HANDLE SHIPMENT CANCELLATION
     */
    handleShipmentCancellation = async (order, data) => {
        try {
            order.cancellation_reason = data.cancellation_reason;
            await order.save();

            // Reverse commission if needed
            if (order.commission && order.order_id) {
                await walletController.reverseCommision(order.order_id, order.amount);
            }

        } catch (error) {
            console.error('Error handling shipment cancellation:', error);
        }
    }

    /**
     * APPROVE AGENT COMMISSION
     */
    approveAgentCommission = async (order) => {
        try {
            if (order.agent_id && order.commission > 0) {
                console.log(` Commission approved for agent ${order.agent_id}: ₦${order.commission}`);
                // Implement your commission approval logic here
                // await walletController.approveCommission(order.agent_id, order.commission, order.id);
            }
        } catch (error) {
            console.error('Error approving agent commission:', error);
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Extract email from shipment_details
     */
    extractCustomerEmailFromShipment = (shipmentDetails) => {
        try {
            if (typeof shipmentDetails === 'string') {
                shipmentDetails = JSON.parse(shipmentDetails);
            }
            return shipmentDetails?.delivery_address?.email;
        } catch (error) {
            console.error('Error extracting email from shipment details:', error);
            return null;
        }
    }

    /**
     * Send email to customer
     */
    sendCustomerEmail = async (order, subject, content, emailType = 'order_update') => {
        try {
            const customerEmail = this.extractCustomerEmailFromShipment(order.shipment_details);

            if (!customerEmail) {
                console.log(' No customer email found in shipment details for order:', order.id);
                return false;
            }

            console.log(` Sending ${emailType} email to customer:`, customerEmail);

            await nodemailer.sendMail({
                email: customerEmail,
                subject: subject,
                content: content,
                type: emailType
            });

            await this.logWebhook(`email_${emailType}_sent`, null, order.id, {
                recipient: customerEmail,
                subject: subject,
                email_type: emailType,
                sent_at: new Date()
            });

            return true;
        } catch (error) {
            console.error('Error sending customer email:', error);

            await this.logWebhook(`email_${emailType}_failed`, null, order.id, {
                error: error.message,
                subject: subject
            }, error.message);

            return false;
        }
    }

    /**
     * Log webhook events
     */
    logWebhook = async (event_type, shipment_id, order_id, payload, error_message = null) => {
        try {
            await db.webhook_logs.create({
                event_type,
                shipment_id,
                order_id,
                payload: JSON.stringify(payload),
                error_message,
                processed: !error_message
            });
        } catch (error) {
            console.error('Error logging webhook:', error);
        }
    }

    /**
     * Append tracking history
     */
    appendTrackingHistory = async (order, status, description, metadata = {}) => {
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
                source: 'terminal_africa'
            });

            order.tracking_history = JSON.stringify(trackingHistory);
            await order.save();
        } catch (error) {
            console.error('Error appending tracking history:', error);
        }
    }

    /**
     * Notify frontend via Socket.IO
     */
    notifyFrontend = (io, event, data) => {
        try {
            if (io) {
                io.emit('shipment_update', {
                    event,
                    ...data,
                    timestamp: new Date()
                });
                console.log(` Socket.IO notification sent: ${event} for shipment ${data.shipment_id}`);
            }
        } catch (error) {
            console.error('Error notifying frontend:', error);
        }
    }

    /**
     * Get webhook logs for debugging
     */
    getWebhookLogs = async (req, res) => {
        try {
            const { page = 1, limit = 20, event_type, processed } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (event_type) whereClause.event_type = event_type;
            if (processed !== undefined) whereClause.processed = processed === 'true';

            const logs = await db.webhook_logs.findAndCountAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return res.status(200).json({
                success: true,
                data: logs.rows,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(logs.count / limit),
                    total_items: logs.count
                }
            });

        } catch (error) {
            console.error('Get webhook logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching webhook logs',
                error: error.message
            });
        }
    }


}

// Export singleton instance
module.exports = new WebhookController();