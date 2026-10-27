const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'servicenode_super_secret_key_123!';

const authenticateToken = (req, res, next) => {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];

  // Check if request is AJAX/API or explicitly asking for JSON
  const isApiOrAjax = req.xhr || 
                      req.headers.accept?.includes('json') || 
                      req.headers['content-type']?.includes('json') ||
                      req.originalUrl.startsWith('/reviews');

  if (!token) {
    if (isApiOrAjax) {
      return res.status(401).json({ error: 'Access denied. Please log in again.' });
    }
    return res.redirect('/');
  }

  try {
    const decodedUser = jwt.verify(token, JWT_SECRET);
    req.user = decodedUser;
    res.locals.user = decodedUser;

    if (req.session) {
      req.session.user = decodedUser;
    }

    return next();
  } catch (err) {
    console.error('JWT Verification failed:', err.message);
    
    // Clear bad cookie
    res.clearCookie('token');
    if (req.session) {
      req.session.destroy();
    }

    // STRICT JSON RESPONSE FOR AJAX/API REQUESTS
    if (isApiOrAjax) {
      return res.status(403).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
    return res.redirect('/');
  }
};

module.exports = { authenticateToken };