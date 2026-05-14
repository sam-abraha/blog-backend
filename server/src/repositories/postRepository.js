const prisma = require('../confiq/prisma')

class PostRepository {
    async findAll() {
        return prisma.post.findMany({
        include: {
            author: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        });
    }

    async findById(id) {
        return prisma.post.findUnique({
        where: { 
            id: parseInt(id) 
        },
        include: { author: { select: { name: true }}},
    });
    }

    async create(data)  {
        return prisma.post.create({
            data
        })
    }

    async update(id, data) {
        return prisma.post.update({
                where: {
                id: parseInt(id),
      },data,
    });
  }

  async delete(id) {
    return prisma.post.delete({
      where: {
        id: parseInt(id),
      },
    });
  }

}
module.exports = new PostRepository();