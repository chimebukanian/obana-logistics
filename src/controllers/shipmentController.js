const db = require('../models/db.js');
const { Op } = require('sequelize');
const userController = require('../controllers/userController');


const shipmentController = {

  // Get all shipments with pagination and filtering

  // Fix getAllShipments function
  getAllShipments: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        order_id,
        shipment_id,
        vendor_id,
        start_date,
        end_date
      } = req.query;

      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause = {};

      if (status) whereClause.status = status;
      if (order_id) whereClause.order_id = order_id;
      if (shipment_id) whereClause.shipment_id = { [Op.like]: `%${shipment_id}%` };
      if (vendor_id) whereClause.vendor_id = vendor_id;

      // Date range filter
      if (start_date || end_date) {
        whereClause.createdAt = {};
        if (start_date) whereClause.createdAt[Op.gte] = new Date(start_date);
        if (end_date) whereClause.createdAt[Op.lte] = new Date(end_date);
      }
    const userId = req.user?.id;
    
      // Get shipments with order data (without user includes)
      const shipments = await db.shipment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: db.orders,
            as: 'order',
            attributes: ['id', 'order_id', 'amount', 'status', 'order_ref', 'user_id'],
            required: true,
            where: {
            user_id: userId
          }
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
         distinct: true 
      });

      // Enrich shipments with user data using your existing userController
      const enrichedShipments = await Promise.all(
        shipments.rows.map(async (shipment) => {
          const shipmentData = shipment.toJSON();

          if (shipmentData.order && shipmentData.order.user_id) {
            try {
              const user = await userController.getUser(null, null, true, null, null, shipmentData.order.user_id);

              if (user) {
                shipmentData.order.user = user;
              } else {
                shipmentData.order.user = null;
              }
            } catch (error) {
              console.error('Error fetching user details:', error);
              shipmentData.order.user = null;
            }
          }

          return shipmentData;
        })
      );

      return res.status(200).json({
        success: true,
        data: enrichedShipments,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(shipments.count / limit),
          total_items: shipments.count,
          items_per_page: parseInt(limit),
          has_next_page: page < Math.ceil(shipments.count / limit),
          has_prev_page: page > 1
        }
      });

    } catch (error) {
      console.error('Get shipments error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching shipments',
        error: error.message
      });
    }
  },
  // Get shipment by ID
  getShipmentById: async (req, res) => {
    try {
      const { id } = req.params;

      const shipment = await db.shipment.findOne({
        where: { id },
        include: [
          {
            model: db.orders,
            attributes: ['id', 'order_id', 'amount', 'status', 'order_ref', 'shipment_details'],
            include: [
              {
                model: db.users,
                attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
              }
            ]
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
      console.error('Get shipment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching shipment',
        error: error.message
      });
    }
  },

  // Get shipments by order ID
  getShipmentsByOrderId: async (req, res) => {
    try {
      const { orderId } = req.params;

      const shipments = await db.shipment.findAll({
        where: { order_id: orderId },
        include: [
          {
            model: db.orders,
            attributes: ['id', 'order_id', 'amount', 'status', 'order_ref']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        data: shipments
      });

    } catch (error) {
      console.error('Get order shipments error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching order shipments',
        error: error.message
      });
    }
  },

  // Update shipment status manually
  updateShipmentStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, tracking_number, tracking_url, notes } = req.body;

      const shipment = await db.shipment.findOne({ where: { id } });

      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      // Update shipment
      const updateData = {};
      if (status) updateData.status = status;
      if (tracking_number) updateData.tracking_number = tracking_number;
      if (tracking_url) updateData.tracking_url = tracking_url;

      await shipment.update(updateData);

      // Log the status change
      await db.shipment_history.create({
        shipment_id: shipment.id,
        status: status || shipment.status,
        notes: notes || `Manual status update`,
        updated_by: req.user?.id || 'system'
      });

      return res.status(200).json({
        success: true,
        message: 'Shipment updated successfully',
        data: shipment
      });

    } catch (error) {
      console.error('Update shipment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating shipment',
        error: error.message
      });
    }
  },

  // Get shipment tracking history
  getShipmentTracking: async (req, res) => {
    try {
      const { id } = req.params;

      const trackingHistory = await db.shipment_history.findAll({
        where: { shipment_id: id },
        order: [['createdAt', 'DESC']]
      });

      const shipment = await db.shipment.findOne({
        where: { id },
        attributes: ['id', 'shipment_id', 'status', 'tracking_number', 'tracking_url']
      });

      return res.status(200).json({
        success: true,
        data: {
          shipment,
          tracking_history: trackingHistory
        }
      });

    } catch (error) {
      console.error('Get tracking error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching tracking information',
        error: error.message
      });
    }
  },

  // Get dashboard statistics

getShipmentStats: async (req, res) => {
  try {
    
    const { start_date, end_date } = req.query;

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // 4. Create base where clause for shipments
    const whereClause = {};
    
    // 5. Add date range filtering if provided
    if (start_date || end_date) {
      whereClause.createdAt = {};
      if (start_date) whereClause.createdAt[Op.gte] = new Date(start_date);
      if (end_date) whereClause.createdAt[Op.lte] = new Date(end_date);
    }

    // 6. GET STATUS BREAKDOWN STATISTICS - FIXED FOR MYSQL
    const stats = await db.shipment.findAll({
      where: whereClause,
      include: [
        {
          model: db.orders,
          as: 'order',
          attributes: [],
          required: true,
          where: {
            user_id: userId
          }
        }
      ],
      attributes: [
        // FIX: Use literal with backticks for MySQL
        [db.Sequelize.literal('`shipment`.`status`'), 'status'],
        [db.Sequelize.fn('COUNT', db.Sequelize.col('shipment.id')), 'count']
      ],
      group: ['shipment.status'], // FIX: Simple string for MySQL
      raw: true
    });

    // 7. GET TOTAL SHIPMENTS COUNT
    const totalShipments = await db.shipment.count({
      where: whereClause,
      include: [
        {
          model: db.orders,
          as: 'order',
          attributes: [],
          required: true,
          where: {
            user_id: userId
          }
        }
      ],
      distinct: true
    });

    // 8. GET RECENT SHIPMENTS
    const recentShipments = await db.shipment.findAll({
      where: whereClause,
      include: [
        {
          model: db.orders,
          as: 'order',
          attributes: ['order_ref', 'id', 'amount', 'status', 'user_id'],
          required: true,
          where: {
            user_id: userId
          }
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // 9. ENRICH RECENT SHIPMENTS WITH USER DETAILS
    const enrichedRecentShipments = await Promise.all(
      recentShipments.map(async (shipment) => {
        const shipmentData = shipment.toJSON();
        
        if (shipmentData.order && shipmentData.order.user_id) {
          try {
            const user = await userController.getUser(
              null, 
              null, 
              true, 
              req, 
              res, 
              shipmentData.order.user_id
            );

            if (user) {
              shipmentData.order.user = {
                id: user.id,
                email: user.email,
                first_name: user.attributes?.first_name || '',
                last_name: user.attributes?.last_name || '',
                account_types: user.attributes?.account_types || '',
                phone: user.attributes?.phone || ''
              };
            }
          } catch (error) {
            console.error('Error fetching user details for recent shipment:', error);
          }
        }
        
        return shipmentData;
      })
    );

    // 10. RETURN SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      data: {
        total_shipments: totalShipments,
        status_breakdown: stats,
        recent_shipments: enrichedRecentShipments
      },
      user_context: {
        user_id: userId
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching shipment statistics',
      error: error.message
    });
  }
}
};

module.exports = shipmentController;