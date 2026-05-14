const bcrypt = require('bcryptjs');
const {generateToken, verifyToken} = require('../utils/jwt')

const prisma = require('../confiq/prisma');
const SECRET_KEY = process.env.SECRET_KEY;
const SALT = bcrypt.genSaltSync(10);

const userRepository = require('../repositories/userRepository')

async function createUser(username, password) {
    const hashedPassword = await bcrypt.hash(password, SALT);
    const data = {name, password}
    return userRepository.create({
        name: username,
        password: hashedPassword,
  });
}

async function authenticateUser(username, password) {
    const userDoc = await userRepository.findByName(name)
    if (!userDoc) return null;

    const passwordMatch = bcrypt.compareSync(password, userDoc.password);
    if (!passwordMatch) return null;

    const token = generateToken({name: username, id: userDoc.id})
    return { token, user: { name: username, id: userDoc.id } };
}

async function getUserFromToken(token) {
    const userInfo = verifyToken(token)
    return userRepository.findById(userInfo)
}

module.exports = {
    createUser,
    authenticateUser,
    getUserFromToken,
};
