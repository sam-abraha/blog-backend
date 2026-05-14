const {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
} = require('../services/postService');

const { bucket } = require('../firebase');

async function getAllPosts(req, res, next) {
  try {
    const posts = await getPosts();
    res.json(posts);
  } catch (error) {
    next(error);
  }
}

async function createNewPost(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { originalname, buffer } = req.file;
  const blob = bucket.file(originalname);
  const blobStream = blob.createWriteStream();

  blobStream.on('error', (err) => {
    console.error('Blob stream error:', err);
    res.status(500).json({ error: 'File upload error' });
  });

  blobStream.on('finish', async () => {
    try {
      const filePath = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blob.name)}?alt=media`;

      const {
        title,
        summary,
        content,
        imgCredit,
      } = req.body;

      const post = await createPost({
        title,
        summary,
        content,
        imgCredit,
        cover: filePath,
        authorId: req.user.id,
      });

      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  });

  blobStream.end(buffer);
}

async function getSinglePost(req, res, next) {
  try {
    const post = await getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    next(error);
  }
}

async function updateExistingPost(req, res, next) {
  try {
    const post = await getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let cover = post.cover;

    if (req.file) {
      const blob = bucket.file(req.file.originalname);
      const blobStream = blob.createWriteStream();

      await new Promise((resolve, reject) => {
        blobStream.on('error', reject);
        blobStream.on('finish', resolve);
        blobStream.end(req.file.buffer);
      });

      cover = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blob.name)}?alt=media`;
    }

    const updatedPost = await updatePost(req.params.id, {
      title: req.body.title,
      summary: req.body.summary,
      content: req.body.content,
      imgCredit: req.body.imgCredit,
      cover,
    });

    res.json(updatedPost);
  } catch (error) {
    next(error);
  }
}

async function removePost(req, res, next) {
  try {
    const post = await getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await deletePost(req.params.id);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllPosts,
  getSinglePost,
  createNewPost,
  updateExistingPost,
  removePost,
};