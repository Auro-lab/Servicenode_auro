const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const { sequelize, Category } = require('./models');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 1. Body & Static Parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// 2. Cookie & Session Parsers
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'servicenode_fallback_secret',
  resave: false,
  saveUninitialized: false
}));

// 3. JWT Decoding Middleware (Runs BEFORE notificationMiddleware & Routes)
app.use((req, res, next) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'servicenode_super_secret_key_123!';
      const decodedUser = jwt.verify(token, JWT_SECRET);
      
      // Attach user object to req and res.locals for EJS views
      req.user = decodedUser;
      res.locals.user = decodedUser;

      // Keep session in sync with JWT
      if (!req.session.user) {
        req.session.user = decodedUser;
      }
    } catch (err) {
      // Clear token if invalid or expired
      res.clearCookie('token');
      req.user = null;
      res.locals.user = null;
    }
  } else {
    req.user = null;
    res.locals.user = null;
  }

  // Default notifications fallback variable
  res.locals.notifications = res.locals.notifications || [];
  next();
});

// 4. Notification Middleware (Now has access to req.user / req.session.user)
const notificationMiddleware = require('./middleware/notifications');
app.use(notificationMiddleware);

// 5. Load & Mount Routes
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const categoryRoutes = require('./routes/categories');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews'); // 👈 ADDED: Import Review Routes

app.use('/', authRoutes);
app.use('/', ticketRoutes);
app.use('/', categoryRoutes);
app.use('/', adminRoutes);
app.use('/reviews', reviewRoutes); // 👈 ADDED: Mount Review Routes at /reviews

app.get('/test', (req, res) => {
  res.send('<h1>Express is working!</h1>');
});

// Sync Database & Start Server
const PORT = process.env.PORT || 3000;
sequelize.sync({ alter: true }).then(async () => {
  console.log('✅ MySQL Connected');
  
  const count = await Category.count();
  if (count === 0) {
    await Category.bulkCreate([
      { name: 'Hardware' },
      { name: 'Software' },
      { name: 'Network' },
      { name: 'Account Access' }
    ]);
    console.log('✅ Default categories seeded!');
  }

  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => {
  console.error('❌ Sync Error:', err.message);
});

// Add this right before sequelize.sync in app.js
app.use((err, req, res, next) => {
  console.error('🔥 Global Server Error:', err.stack);
  res.status(500).send(`Server Error: ${err.message}`);
});