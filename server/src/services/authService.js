const bcrypt = require('bcryptjs');
const {generateToken, verifyToken} = require('../utils/jwt')

const prisma = require('../confiq/prisma');
const SECRET_KEY = process.env.SECRET_KEY;
const SALT = bcrypt.genSaltSync(10);

async function createUser(username, password) {
    const hashedPassword = await bcrypt.hash(password, SALT);
    return await prisma.user.create({
        data: {
            name: username,
            password: hashedPassword,
        },
    });
}

async function authenticateUser(username, password) {
    const userDoc = await prisma.user.findUnique({
        where: { name: username },
    });
    if (!userDoc) return null;

    const passwordMatch = bcrypt.compareSync(password, userDoc.password);
    if (!passwordMatch) return null;

    const token = generateToken({name: username, id: userDoc.id})
    return { token, user: { name: username, id: userDoc.id } };
}

async function getUserFromToken(token) {
    const userInfo = verifyToken(token)
    return prisma.user.findUnique({
        where: {
            id: userInfo.id
        }
    })
}

module.exports = {
    createUser,
    authenticateUser,
    getUserFromToken,
};
