const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/authMiddleware');

// In-memory fallback user store when MongoDB is disconnected
const inMemoryUsers = new Map();

/**
 * Helper to generate JWT token
 */
function generateToken(user) {
  const uid = String(user._id || user.id || '');
  return jwt.sign(
    {
      id: uid,
      userId: uid,
      _id: uid,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    if (mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({ $or: [{ email: cleanEmail }, { username: cleanUsername }] });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'Username or email already exists' });
      }

      const user = new User({
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        settings: { theme: 'vs-dark', fontSize: 14, tabSize: 2 },
      });

      await user.save();
      const token = generateToken(user);

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        data: {
          token,
          user: { id: user._id, userId: user._id, username: user.username, email: user.email },
        },
      });
    }

    // In-memory Fallback
    if (inMemoryUsers.has(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const mockId = 'usr_' + Date.now();
    const mockUser = { id: mockId, username: cleanUsername, email: cleanEmail, password: hashedPassword };
    inMemoryUsers.set(cleanEmail, mockUser);

    const token = generateToken(mockUser);
    return res.status(201).json({
      success: true,
      message: 'Account registered successfully (in-memory mode)',
      data: {
        token,
        user: { id: mockUser.id, userId: mockUser.id, username: mockUser.username, email: mockUser.email },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const cleanInput = email.trim().toLowerCase();

  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ $or: [{ email: cleanInput }, { username: email.trim() }] });
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      const token = generateToken(user);
      return res.status(200).json({
        success: true,
        message: 'Logged in successfully',
        data: {
          token,
          user: { id: user._id, userId: user._id, username: user.username, email: user.email },
        },
      });
    }

    // In-memory Fallback
    const mockUser = inMemoryUsers.get(cleanInput);
    if (!mockUser) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, mockUser.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = generateToken(mockUser);
    return res.status(200).json({
      success: true,
      message: 'Logged in successfully (in-memory mode)',
      data: {
        token,
        user: { id: mockUser.id, userId: mockUser.id, username: mockUser.username, email: mockUser.email },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      userId: req.user.id || req.user.userId,
      id: req.user.id || req.user.userId,
      username: req.user.username,
      email: req.user.email,
    },
  });
}

module.exports = {
  register,
  login,
  getMe,
};
