const express = require('express');
const { createUser, authenticateUser, getUserFromToken } = require('../services/authService');

const router = express.Router();

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await createUser(username, password);
        res.status(200).json(user);
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    try {
        const authResult = await authenticateUser(username, password);
        if (!authResult) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const { token, user } = authResult;
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'none',
            secure: process.env.NODE_ENV === 'production',
        }).json(user);
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/profile', async (req, res) => {
    const { token } = req.cookies;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    try {
        const user = await getUserFromToken(token);
        res.json({ id: user.id, name: user.name });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(401).json({ error: 'Unauthorized' });
    }
});

router.post('/signout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'none',
        secure: process.env.NODE_ENV === 'production',
    });
    res.json({ message: 'Success: User signed out' });
});

module.exports = router;
