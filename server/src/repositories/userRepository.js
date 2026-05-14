const prisma = require('../config/prisma')

class UserRepository {
    async create(data) {
        return prisma.user.create({
            data
        })
    }

    async findByName(name) {
        return prisma.user.findUnique({
            where : {
                name
            }
        })
    }

    async findById(id) {
        return prisma.user.findUnique({
            where : {
                id
            }
        })
    }
}

module.exports = new UserRepository();