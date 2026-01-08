// shipmentController.js
const { Op } = require('sequelize');
const crypto = require('crypto');

class ShipmentController {
    constructor(db) {
        this.db = db;
        this.externalCarrierAPIs = {
            'gigl': this.callGiglAPI,
            'fedex': this.callFedExAPI,
            'ups': this.callUPSAPI,
            'dhl': this.callDHLAPI
        };
    }

    /**
     * Main endpoint to create shipments
     * Handles both internal and external shipments
     */
    async createShipment(req, res) {
        try {
            const payload = req.body;
            
            // Validate payload
            const validation = this.validateShipmentPayload(payload);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payload',
                    errors: validation.errors
                });
            }

            // Determine carrier type
            const carrierType = this.determineCarrierType(payload);
            
            if (carrierType === 'internal') {
                // Handle internally with Obana Logistics
                return await this.handleInternalShipment(payload, res);
            } else {
                // Handle externally - call external carrier API
                return await this.handleExternalShipment(payload, res);
            }
        } catch (error) {
            console.error('Error creating shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Validate shipment payload
     */
    validateShipmentPayload(payload) {
        const errors = [];

        // Basic validation
        if (!payload.customer_id) {
            errors.push('customer_id is required');
        }
        if (!payload.delivery_address) {
            errors.push('delivery_address is required');
        }
        if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
            errors.push('items array is required with at least one item');
        }
        if (!payload.currency) {
            errors.push('currency is required');
        }
        
        // Delivery address validation
        if (payload.delivery_address) {
            const addr = payload.delivery_address;
            if (!addr.line1 || !addr.city || !addr.state || !addr.country) {
                errors.push('delivery_address requires line1, city, state, and country');
            }
            if (!addr.phone) {
                errors.push('delivery_address.phone is required');
            }
        }

        // Validate multi-vendor structure if applicable
        if (payload.isMultiVendor || payload.delivery_type === 'per-vendor' || payload.delivery_type === 'aggregated') {
            if (!payload.vendor_groups && !payload.vendor_selections) {
                errors.push('vendor_groups or vendor_selections required for multi-vendor orders');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Determine if shipment should be handled internally or externally
     */
    determineCarrierType(payload) {
        // Check if dispatcher info indicates external carrier
        if (payload.dispatcher && payload.dispatcher.carrier_slug) {
            const externalCarriers = ['gigl', 'fedex', 'ups', 'dhl', 'usps'];
            if (externalCarriers.includes(payload.dispatcher.carrier_slug)) {
                return 'external';
            }
        }

        // Check if any vendor selection has external carrier
        if (payload.vendor_selections) {
            for (const vendor of payload.vendor_selections) {
                if (vendor.carrier_reference && vendor.carrier_reference.startsWith('CA-')) {
                    // External carrier reference format
                    return 'external';
                }
            }
        }

        // Default to internal (Obana Logistics)
        return 'internal';
    }

    /**
     * Handle shipments for Obana Logistics (internal)
     */
    async handleInternalShipment(payload, res) {
        const transaction = await this.db.sequelize.transaction();
        
        try {
            // 1. Generate unique shipment reference
            const shipmentReference = this.generateShipmentReference();
            
            // 2. Create delivery address record
            const deliveryAddress = await this.db.addresses.create({
                address_type: 'delivery',
                first_name: payload.delivery_address.first_name || '',
                last_name: payload.delivery_address.last_name || '',
                email: payload.delivery_address.email || '',
                phone: payload.delivery_address.phone || '',
                line1: payload.delivery_address.line1,
                line2: payload.delivery_address.line2 || '',
                city: payload.delivery_address.city,
                state: payload.delivery_address.state,
                country: payload.delivery_address.country,
                zip_code: payload.delivery_address.zip || '',
                is_residential: payload.delivery_address.is_residential || false,
                metadata: payload.delivery_address.metadata || {}
            }, { transaction });

            
            const { totalWeight, itemCount } = this.calculateShipmentTotals(payload);

            
            const shipment = await this.db.shipments.create({
                shipment_reference: shipmentReference,
                order_reference: payload.order_id || `ORDER-${Date.now()}`,
                customer_id: payload.customer_id,
                delivery_address_id: deliveryAddress.id,
                delivery_type: payload.delivery_type || 'single',
                is_multi_vendor: payload.isMultiVendor || false,
                dispatch_type: payload.dispatchType || 'delivery',
                pickup_method: payload.pickUpMethod || 'delivery',
                total_amount: payload.amount || 0,
                shipping_fee: payload.shipping_fee || 0,
                currency: payload.currency?.symbol || 'NGN',
                total_weight: totalWeight,
                total_items: itemCount,
                status: 'pending',
                carrier_type: 'internal',
                metadata: {
                    original_payload: payload,
                    platform_order_id: payload.order_id,
                    external_references: {
                        rate_id: payload.rate_id,
                        carrier_reference: payload.carrier_reference
                    }
                }
            }, { transaction });

            
            if (!payload.isMultiVendor && payload.delivery_type === 'single') {
                await this.handleSingleVendorShipment(shipment, payload, transaction);
            }
            
            else if (payload.delivery_type === 'aggregated' && payload.vendor_groups) {
                await this.handleAggregatedShipment(shipment, payload, transaction);
            }
            
            else if (payload.delivery_type === 'per-vendor' && payload.vendor_selections) {
                await this.handlePerVendorShipment(shipment, payload, transaction);
            }

            
            await this.db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: 'pending',
                description: 'Shipment created and awaiting pickup scheduling',
                performed_by: 'system',
                metadata: { source: 'api_creation' }
            }, { transaction });

            
            await transaction.commit();

            
            this.triggerPostCreationProcesses(shipment.id);

            return res.status(201).json({
                success: true,
                message: 'Shipment created successfully for Obana Logistics',
                data: {
                    shipment_id: shipment.id,
                    shipment_reference: shipment.shipment_reference,
                    tracking_url: `${process.env.BASE_URL}/track/${shipment.shipment_reference}`,
                    estimated_delivery: shipment.estimated_delivery_at,
                    status: shipment.status
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('Error creating internal shipment:', error);
            throw error;
        }
    }

    /**
     * Handle single vendor shipment
     */
    async handleSingleVendorShipment(shipment, payload, transaction) {
        // Create pickup address if provided in dispatcher metadata
        let pickupAddressId = null;
        if (payload.dispatcher?.metadata?.address_payload?.pickup_address) {
            const pickupAddr = payload.dispatcher.metadata.address_payload.pickup_address;
            const pickupAddress = await this.db.addresses.create({
                address_type: 'pickup',
                line1: pickupAddr.line1 || 'Vendor Warehouse',
                city: pickupAddr.city,
                state: pickupAddr.state,
                country: pickupAddr.country,
                zip_code: pickupAddr.zip || '',
                phone: payload.delivery_address.phone || '',
                metadata: { source: 'dispatcher_metadata' }
            }, { transaction });
            pickupAddressId = pickupAddress.id;
        }

        // Update shipment with pickup address
        if (pickupAddressId) {
            await shipment.update({ pickup_address_id: pickupAddressId }, { transaction });
        }

        // Create shipment items
        await this.createShipmentItems(shipment.id, null, payload.items, transaction);

        // Schedule pickup if dispatcher has pickup date
        if (payload.dispatcher?.pickup_date) {
            await shipment.update({
                pickup_scheduled_at: new Date(payload.dispatcher.pickup_date),
                estimated_delivery_at: new Date(payload.dispatcher.delivery_date),
                status: 'pickup_scheduled'
            }, { transaction });

            // Add tracking event
            await this.db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: 'pickup_scheduled',
                description: `Pickup scheduled for ${new Date(payload.dispatcher.pickup_date).toLocaleDateString()}`,
                performed_by: 'system'
            }, { transaction });
        }
    }

    /**
     * Handle aggregated multi-vendor shipment (single carrier, multiple pickups)
     */
    async handleAggregatedShipment(shipment, payload, transaction) {
        for (const vendorGroup of payload.vendor_groups) {
            // Create or find vendor
            const vendor = await this.findOrCreateVendor(vendorGroup.vendor_id, transaction);
            
            // Create pickup address for vendor
            const pickupAddress = await this.db.addresses.create({
                address_type: 'vendor',
                line1: vendorGroup.pickup_address.line1,
                city: vendorGroup.pickup_address.city,
                state: vendorGroup.pickup_address.state,
                country: vendorGroup.pickup_address.country,
                phone: vendorGroup.pickup_address.phone || '',
                metadata: { vendor_id: vendorGroup.vendor_id }
            }, { transaction });

            // Create vendor group
            const vendorGroupRecord = await this.db.shipment_vendor_groups.create({
                vendor_id: vendorGroup.vendor_id,
                vendor_db_id: vendor.id,
                shipment_id: shipment.id,
                pickup_address_id: pickupAddress.id,
                shipping_fee: this.calculateVendorShippingFee(vendorGroup, payload),
                weight: this.calculateVendorWeight(vendorGroup.items),
                item_count: vendorGroup.items.length,
                status: 'pending',
                carrier_type: 'internal',
                metadata: {
                    actual_rate_id: vendorGroup.actual_rate_id,
                    vendor_pickup_time: payload.dispatcher?.pickup_time,
                    vendor_delivery_time: payload.dispatcher?.delivery_time
                }
            }, { transaction });

            // Create shipment items for this vendor
            await this.createShipmentItems(shipment.id, vendorGroupRecord.id, vendorGroup.items, transaction);
        }
    }

    /**
     * Handle per-vendor shipment (each vendor may have different carrier)
     */
    async handlePerVendorShipment(shipment, payload, transaction) {
        for (const vendorSelection of payload.vendor_selections) {
            // Create or find vendor
            const vendor = await this.findOrCreateVendor(vendorSelection.vendor_id, transaction);
            
            // Create pickup address for vendor
            const pickupAddress = await this.db.addresses.create({
                address_type: 'vendor',
                line1: vendorSelection.pickup_address.line1,
                city: vendorSelection.pickup_address.city,
                state: vendorSelection.pickup_address.state,
                country: vendorSelection.pickup_address.country,
                phone: vendorSelection.pickup_address.phone || '',
                metadata: { vendor_id: vendorSelection.vendor_id }
            }, { transaction });

            // Determine if this vendor uses internal or external carrier
            const carrierType = vendorSelection.carrier_reference?.startsWith('CA-') ? 'external' : 'internal';
            
            // Create vendor group
            const vendorGroupRecord = await this.db.shipment_vendor_groups.create({
                vendor_id: vendorSelection.vendor_id,
                vendor_db_id: vendor.id,
                shipment_id: shipment.id,
                pickup_address_id: pickupAddress.id,
                shipping_fee: vendorSelection.cost || 0,
                weight: this.calculateVendorWeight(vendorSelection.items),
                item_count: vendorSelection.items.length,
                status: 'pending',
                carrier_type: carrierType,
                external_carrier_name: carrierType === 'external' ? this.getCarrierName(vendorSelection.carrier_reference) : null,
                external_rate_id: vendorSelection.rate_id,
                metadata: {
                    actual_rate_id: vendorSelection.actual_rate_id,
                    carrier_reference: vendorSelection.carrier_reference
                }
            }, { transaction });

            // Create shipment items
            await this.createShipmentItems(shipment.id, vendorGroupRecord.id, vendorSelection.items, transaction);

            // If external carrier, create external shipment record
            if (carrierType === 'external') {
                await this.createExternalShipmentRecord(vendorGroupRecord, vendorSelection, transaction);
            }
        }
    }

    /**
     * Handle shipments for external carriers
     */
    async handleExternalShipment(payload, res) {
        try {
            // Extract carrier information
            const carrierSlug = payload.dispatcher?.carrier_slug || this.detectCarrierFromReference(payload);
            
            if (!carrierSlug) {
                return res.status(400).json({
                    success: false,
                    message: 'Unable to determine external carrier'
                });
            }

            // Create a minimal record for tracking
            const shipmentReference = `EXT-${this.generateShipmentReference()}`;
            
            const externalShipment = await this.db.shipments.create({
                shipment_reference: shipmentReference,
                order_reference: payload.order_id || `ORDER-${Date.now()}`,
                customer_id: payload.customer_id,
                delivery_type: payload.delivery_type || 'single',
                is_multi_vendor: payload.isMultiVendor || false,
                total_amount: payload.amount || 0,
                shipping_fee: payload.shipping_fee || 0,
                currency: payload.currency?.symbol || 'NGN',
                status: 'pending',
                carrier_type: 'external',
                external_carrier_name: payload.dispatcher?.carrier_name || carrierSlug,
                external_carrier_reference: payload.carrier_reference,
                external_rate_id: payload.rate_id,
                metadata: {
                    original_payload: payload,
                    carrier_slug: carrierSlug,
                    dispatcher_info: payload.dispatcher
                },
                notes: 'External carrier shipment - tracking via carrier API'
            });


            // PLACEHOLDER: External Carrier API Integration
            



            // Log the external shipment request (for monitoring)
            console.log(`External shipment requested for carrier: ${carrierSlug}`, {
                shipment_id: externalShipment.id,
                carrier_reference: payload.carrier_reference,
                rate_id: payload.rate_id,
                shipping_fee: payload.shipping_fee
            });

            return res.status(200).json({
                success: true,
                message: 'External shipment request processed',
                data: {
                    shipment_id: externalShipment.id,
                    shipment_reference: externalShipment.shipment_reference,
                    carrier: payload.dispatcher?.carrier_name || carrierSlug,
                    note: 'External carrier will handle shipment tracking',
                    tracking_instruction: `Track your shipment using carrier reference: ${payload.carrier_reference}`,
                    
                    // Placeholder response - would be replaced with actual carrier response
                    placeholder_api_response: {
                        message: `API call to ${carrierSlug.toUpperCase()} would be implemented here`,
                        endpoints: this.getCarrierEndpoints(carrierSlug),
                        payload_schema: this.getCarrierPayloadSchema(carrierSlug),
                        authentication: 'API Key or OAuth would be configured',
                        webhook_url: `${process.env.BASE_URL}/webhooks/${carrierSlug}/updates`
                    }
                }
            });

        } catch (error) {
            console.error('Error processing external shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error processing external shipment',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Helper Methods
     */

    generateShipmentReference() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        return `OBANA-${dateStr}-${random}`;
    }

    calculateShipmentTotals(payload) {
        let totalWeight = 0;
        let itemCount = 0;

        if (payload.items) {
            payload.items.forEach(item => {
                totalWeight += parseFloat(item.weight) || 0;
                itemCount += parseInt(item.quantity) || 1;
            });
        }

        if (payload.vendor_groups) {
            payload.vendor_groups.forEach(group => {
                group.items.forEach(item => {
                    totalWeight += parseFloat(item.weight) || 0;
                    itemCount += parseInt(item.quantity) || 1;
                });
            });
        }

        if (payload.vendor_selections) {
            payload.vendor_selections.forEach(selection => {
                selection.items.forEach(item => {
                    totalWeight += parseFloat(item.weight) || 0;
                    itemCount += parseInt(item.quantity) || 1;
                });
            });
        }

        return { totalWeight, itemCount };
    }

    calculateVendorShippingFee(vendorGroup, payload) {
        // Logic to calculate vendor-specific shipping fee
        // Could be based on weight, distance, or from dispatcher metadata
        if (payload.dispatcher?.metadata?.vendor_breakdown) {
            const vendorBreakdown = payload.dispatcher.metadata.vendor_breakdown.find(
                v => v.vendor_id === vendorGroup.vendor_id
            );
            if (vendorBreakdown?.cost) {
                return vendorBreakdown.cost;
            }
        }
        
        // Fallback: divide total shipping fee equally among vendors
        if (payload.shipping_fee && payload.vendor_groups) {
            return payload.shipping_fee / payload.vendor_groups.length;
        }
        
        return 0;
    }

    calculateVendorWeight(items) {
        return items.reduce((total, item) => total + (parseFloat(item.weight) || 0), 0);
    }

    async findOrCreateVendor(vendorId, transaction) {
        let vendor = await this.db.vendors.findOne({
            where: { vendor_id: vendorId },
            transaction
        });

        if (!vendor) {
            vendor = await this.db.vendors.create({
                vendor_id: vendorId,
                name: `Vendor ${vendorId}`,
                status: 'active'
            }, { transaction });
        }

        return vendor;
    }

    async createShipmentItems(shipmentId, vendorGroupId, items, transaction) {
        const shipmentItems = items.map(item => ({
            shipment_id: shipmentId,
            vendor_group_id: vendorGroupId,
            item_id: item.item_id,
            name: item.name,
            description: item.description || '',
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price) || parseFloat(item.value) || 0,
            total_price: parseFloat(item.total_price) || parseFloat(item.value) || 0,
            weight: parseFloat(item.weight) || 0,
            currency: item.currency || 'NGN',
            metadata: {
                original_item: item
            }
        }));

        return await this.db.shipment_items.bulkCreate(shipmentItems, { transaction });
    }

    async createExternalShipmentRecord(vendorGroupRecord, vendorSelection, transaction) {
        // Creates record linking our vendor group to external shipment
        await this.db.sequelize.query(
            `INSERT INTO external_shipment_mappings 
             (vendor_group_id, external_carrier, external_reference, rate_id, created_at) 
             VALUES (?, ?, ?, ?, NOW())`,
            {
                replacements: [
                    vendorGroupRecord.id,
                    vendorSelection.carrier_reference?.startsWith('CA-') ? 'external' : 'unknown',
                    vendorSelection.carrier_reference,
                    vendorSelection.rate_id
                ],
                transaction
            }
        );
    }








    triggerPostCreationProcesses(shipmentId) {
        
        setImmediate(async () => {
            try {
                // 1. Send confirmation email
                await this.sendShipmentConfirmation(shipmentId);
                
                // 2. Notify warehouse/drivers if pickup is scheduled
                await this.notifyPickupTeam(shipmentId);
                
                
            } catch (error) {
                console.error('Error in post-creation processes:', error);
                
            }
        });
    }

    async sendShipmentConfirmation(shipmentId) {
        
        console.log(`Sending confirmation for shipment ${shipmentId}`);
    }

    async notifyPickupTeam(shipmentId) {
        
        console.log(`Notifying pickup team for shipment ${shipmentId}`);
    }

    async updateInventory(shipmentId) {
        
        console.log(`Updating inventory for shipment ${shipmentId}`);
    }

    async sendPlatformWebhook(shipmentId) {
        
        console.log(`Sending webhook for shipment ${shipmentId}`);
    }

    
    /**
     * Get shipment status
     */
    async getShipmentStatus(req, res) {
        const { shipment_reference } = req.params;
        
        try {
            const shipment = await this.db.shipments.findOne({
                where: { shipment_reference },
                include: [
                    { 
                        model: this.db.addresses, 
                        as: 'delivery_address' 
                    },
                    { 
                        model: this.db.shipment_items, 
                        as: 'items' 
                    },
                    { 
                        model: this.db.shipment_tracking, 
                        as: 'tracking_events',
                        order: [['createdAt', 'DESC']]
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
                message: 'Internal server error'
            });
        }
    }

    /**
     * Cancel shipment
     * */
    async cancelShipment(req, res) {
        const { shipment_id } = req.params;
        const { reason } = req.body;

        try {
            const shipment = await this.db.shipments.findByPk(shipment_id);
            
            if (!shipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }

            
            const cancellableStatuses = ['pending', 'pickup_scheduled'];
            if (!cancellableStatuses.includes(shipment.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Shipment cannot be cancelled in ${shipment.status} status`
                });
            }

            
            if (shipment.carrier_type === 'external') {
                console.log(`Would call cancellation API for external carrier: ${shipment.external_carrier_name}`);
            }

            
            await shipment.update({
                status: 'cancelled',
                notes: `Cancelled: ${reason || 'No reason provided'}`
                
            });

            await this.db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: 'cancelled',
                description: `Shipment cancelled: ${reason || 'No reason provided'}`,
                performed_by: req.user?.id ? `user_${req.user.id}` : 'system'
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
    }
}

module.exports = ShipmentController;