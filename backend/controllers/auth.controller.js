const authService = require('../services/auth.service');

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const deviceInfo = req.headers['user-agent'] || 'Unknown device';
    const result = await authService.login(email, password, deviceInfo);

    res.json({
      message: 'Login successful',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      userType: result.userType,
    });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const result = await authService.refreshAccessToken(refreshToken);
    res.json({
      accessToken: result.accessToken,
      user: result.user,
      userType: result.userType,
    });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/auth/logout-all
exports.logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id; // comes from auth middleware
    await authService.logoutAllDevices(userId);
    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
