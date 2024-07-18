const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
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

    const token = jwt.sign({ name: username, id: userDoc.id }, SECRET_KEY);
    return { token, user: { name: username, id: userDoc.id } };
}

async function getUserFromToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, SECRET_KEY, async (error, userInfo) => {
            if (error) return reject(error);
            const userDoc = await prisma.user.findUnique({ where: { id: userInfo.id } });
            resolve(userDoc);
        });
    });
}

module.exports = {
    createUser,
    authenticateUser,
    getUserFromToken,
};
