require('dotenv').config()
const express = require('express');
const cors = require('cors')


const usersRoute = require('./src/routes/users');
const verificationRoute = require('./src/routes/verification');
const requestsRoute = require('./src/routes/requests');
const shipmentRoutes = require('./src/routes/shipments')


const PORT = process.env.PORT;
const app = express();

app.use(express.json());
const http = require('http');
const socketIo = require('socket.io');

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: [
		"http://localhost:3005",
		"http://localhost:4005",
		"http://localhost:3000",
		"https://salesforce.obana.africa",
		"https://salesforce-virid.vercel.app",
		"https://obana-admin-frontend.vercel.app",
		"https://shop.obana.africa",
		"https://www.obana.africa",
		"https://obana.africa",
		"https://obana-vendor.vercel.app",
		"https://admin.obana.africa",
		"https://staging.obana.africa",
		"https://staging.shop.obana.africa",
		"https://staging.salesforce.obana.africa",
		"https://staging.admin.obana.africa",
    ],
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('socketio', io);

// Socket connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Join room for specific order/shipment updates
  socket.on('join_shipment', (shipmentId) => {
    socket.join(`shipment_${shipmentId}`);
    console.log(`Client ${socket.id} joined shipment_${shipmentId}`);
  });

  socket.on('join_order', (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`Client ${socket.id} joined order_${orderId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});




// Session and Passport setup
const session = require('express-session');
const passport = require('./src/config/passport');
app.use(session({ secret: 'tajiri_secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

/**
 * Cross Origin Request Service
 * -Set all allowed origins here to enable cross origin requests 
 **/
const corsOptions = {
    origin: [
        "http://localhost:3005",
        "http://localhost:4005",
        "http://localhost:3000",
        "https://salesforce.obana.africa",
        "https://salesforce-virid.vercel.app",
        "https://obana-admin-frontend.vercel.app",
		"https://www.obana.africa",
        "https://shop.obana.africa",
        "https://obana.africa",
        "https://obana-vendor.vercel.app",
        "https://admin.obana.africa",
        "https://staging.obana.africa",
        "https://staging.shop.obana.africa",
        "https://staging.salesforce.obana.africa",
        "https://staging.admin.obana.africa",
    ],
};
app.use(cors(corsOptions));

// Mount Google OAuth routes
const authRoute = require('./src/routes/auth').router;
app.use('/auth', authRoute);


/**
 * Swagger setup and definitions
 **/
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Obana API',
            version: '1.0.0',
            description: 'Obana E-Commerce API Docummentation',
            contact: {
                name: "Anyanwu Chimebuka"
            },
        },
        servers: [
            {
                url: `http://localhost:${PORT}`
            },
            {
                url: `http://api.tajiri.xyz`
            }
        ]
    },
    apis: [
        './app.js',
        './src/routes/*.js',
    ]
}
const swaggerSpec = swaggerJSDoc(swaggerOptions)
app.use('/api-doc', swaggerUi.serve, swaggerUi.setup(swaggerSpec))


/**
 * @swagger
 * /:
 *  get:
 *    description: Default api test url
 *    responses:
 *      '200':
 *        description: API is running
 */
app.get('/', (req, res) => {
    res.send('Welcome to Obana Project.');
})


/**
 * Middlewares and routes
 **/

app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    console.log(`${req.method} - ${req.url}`);
    next();
})


app.use('/shipments', shipmentRoutes);
app.use('/users', usersRoute);



app.use('/verify', verificationRoute);

app.use('/requests', requestsRoute);



// app.listen(PORT, () => {
//     console.log(`Obana is running on port ${PORT}`);
// })

// Update your app.listen to use server instead of app
server.listen(PORT, () => {
  console.log(`Obana is running on port ${PORT}`);
});
