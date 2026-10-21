const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'servicenode_super_secret_key_123!';

const authenticateToken = (req, res, next) => {
  // Check cookie or Authorization header ('Bearer <token>')
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.redirect('/'); // Changed from /login to / to match your root login route
  }

  try {
    // Verify token validity and signature
    const decodedUser = jwt.verify(token, JWT_SECRET);
    
    // Attach decoded user info to req.user for downstream routes
    req.user = decodedUser;
    
    // Set res.locals.user to match app.js and EJS views
    res.locals.user = decodedUser;

    // Sync req.session.user if session object exists
    if (req.session) {
      req.session.user = decodedUser;
    }

    next();
  } catch (err) {
    console.error('JWT Verification failed:', err.message);
    res.clearCookie('token');
    if (req.session) {
      req.session.destroy();
    }
    return res.redirect('/'); // Changed from /login to /
  }
};

module.exports = { authenticateToken };