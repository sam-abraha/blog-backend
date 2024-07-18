const { PrismaClient } = require('@prisma/client');
const { bucket } = require('../firebase');

const prisma = new PrismaClient();

async function getPosts() {
    return await prisma.post.findMany({
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

async function getPostById(id) {
    return await prisma.post.findUnique({
        where: { 
            id: parseInt(id) 
        },
        include: { author: { select: { name: true }}},
    });
}

async function createPost(data) {
    const { title, summary, content, imgCredit, cover, authorId } = data;
    return await prisma.post.create({
        data: {
            title,
            summary,
            content,
            imgCredit,
            cover,
            published: true,
            authorId,
        },
    });
}

async function updatePost(id, data) {
    return await prisma.post.update({
        where: { 
            id: parseInt(id) 
        },
        data,
    });
}

async function deletePost(id) {
    const post = await prisma.post.findUnique({
         where: { 
            id: parseInt(id) 
        } 
        });
    if (post) {
        const fileName = decodeURIComponent(new URL(post.cover).pathname.split('/').pop());

        try {
            await bucket.file(fileName).delete();
            console.log('File deleted successfully');
        } catch (error) {
            if (error.code === 404) {
                console.warn('File not found in the bucket');
            } else {
                console.error('Error deleting file from bucket:', error);
                throw error;
            }
        }

        await prisma.post.delete({ 
            where: { 
                id: parseInt(id) 
            } 
        });
    }
}

module.exports = {
    getPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,
};
