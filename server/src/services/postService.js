
const { bucket } = require('../firebase');
const prisma = require('../confiq/prisma');
const postRepository = require('../repositories/postRepository')

async function getPosts() {
    return postRepository.findAll();
}

async function getPostById(id) {
    return postRepository.findById(id);
}

async function createPost(data) {
    const { title, summary, content, imgCredit, cover, authorId } = data;
    return postRepository.create({
    ...data,
    published: true,
  });
}

async function updatePost(id, data) {
    return postRepository.update(id,data)
}

async function deletePost(id) {
  const post =
    await postRepository.findById(id);

  if (!post) {
    return;
  }

  const fileName = decodeURIComponent(
    new URL(post.cover)
      .pathname
      .split('/')
      .pop(),
  );

  try {
    await bucket.file(fileName).delete();

    console.log(
      'File deleted successfully',
    );
  } catch (error) {
    if (error.code === 404) {
      console.warn(
        'File not found in bucket',
      );
    } else {
      throw error;
    }
  }

  await postRepository.delete(id);
}


module.exports = {
    getPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,
};
