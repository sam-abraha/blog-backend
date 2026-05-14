
const { createUser,authenticateUser} = require('../services/authService');

async function signup(req, res, next) {
  try {
    const { username, password } = req.body;

    const user = await createUser(
      username,
      password,
    );

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

async function signin(req, res, next) {
  try {
    const { username, password } = req.body;

    const authResult =
      await authenticateUser(
        username,
        password,
      );

    if (!authResult) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const { token, user } = authResult;

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'none',
      secure:
        process.env.NODE_ENV ===
        'production',
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  signin,
};