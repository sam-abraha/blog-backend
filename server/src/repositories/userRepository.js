const prisma = require('../confiq/prisma')

class UserRepository {
    async create(data) {
        return prisma.user.create({
            data
        })
    }

    async findByName(data) {
        return prisma.user.findUnique({
            where : {
                name
            }
        })
    }

    async findById(data) {
        return prisma.user.findUnique({
            where : {
                id
            }
        })
    }
}

module.exports = new UserRepository();