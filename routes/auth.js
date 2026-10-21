const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'servicenode_super_secret_key_123!';

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// GET / - Render Login Page
router.get('/', (req, res) => {
  res.render('login', { error: null });
});

// GET /register - Render Registration Page
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// POST /register - Create New User
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.render('register', { error: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    res.redirect('/');
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.render('register', { error: 'Server error during registration.' });
  }
});

// POST /login - Authenticate User & Issue JWT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    // Sign JWT Token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Store in httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('❌ Login error:', err);
    res.render('login', { error: 'Server error during login.' });
  }
});

// GET /logout - Clear Cookie
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// GET /forgot-password - Render request form
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { error: null, success: null });
});

// POST /forgot-password - Send OTP
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.render('auth/forgot-password', {
        error: 'No account found with that email address.',
        success: null
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    await transporter.sendMail({
      from: `"ServiceNode Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'ServiceNode - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Your one-time password (OTP) to reset your account password is:</p>
          <h1 style="color: #0d6efd; letter-spacing: 4px;">${otp}</h1>
          <p>This code expires in <strong>10 minutes</strong>.</p>
        </div>
      `
    });

    res.render('auth/verify-otp', { email: user.email, error: null });
  } catch (err) {
    console.error('❌ Forgot Password Error:', err);
    res.render('auth/forgot-password', {
      error: 'Failed to send OTP email. Check server configuration.',
      success: null
    });
  }
});

// POST /reset-password - Verify OTP & update password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (
      !user ||
      !user.resetOtp ||
      user.resetOtp !== otp.trim() ||
      new Date() > user.resetOtpExpires
    ) {
      return res.render('auth/verify-otp', {
        email,
        error: 'Invalid or expired OTP code. Please try again.'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    res.render('login', {
      error: null
    });
  } catch (err) {
    console.error('❌ Reset Password Error:', err);
    res.render('auth/verify-otp', {
      email,
      error: 'Failed to reset password. Please try again.'
    });
  }
});

module.exports = router;