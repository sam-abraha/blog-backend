const express = require('express');
const multer = require('multer');
const { getPosts, getPostById, createPost, updatePost, deletePost } = require('../services/postService');
const { getUserFromToken } = require('../services/authService');
const { bucket } = require ('../firebase')

const router = express.Router();
const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage });

router.get('/', async (req, res) => {
    try {
        const posts = await getPosts();
        res.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', uploadMiddleware.single('file'), async (req, res) => {
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
        const filePath = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blob.name)}?alt=media`;

        try {
            const { title, summary, content, imgCredit } = req.body;
            const { token } = req.cookies;

            if (!token) {
                return res.status(401).json({ error: 'Unauthorized: No token provided' });
            }

            const user = await getUserFromToken(token);
            if (!user) {
                return res.status(401).json({ error: 'Unauthorized: Invalid token' });
            }

            const data = {
                title,
                summary,
                content,
                imgCredit,
                cover: filePath,
                authorId: user.id
            };

            const postDoc = await createPost(data);
            res.status(201).json(postDoc);
        } catch (dbError) {
            console.error('Database error:', dbError);
            res.status(500).json({ message: 'Error creating post' });
        }
    });

    blobStream.end(buffer);
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const post = await getPostById(id);
        if (!post) {
            return res.status(400).json({ error: 'Invalid post ID' });
        }
        res.json(post);
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', uploadMiddleware.single('file'), async (req, res) => {
    const { id } = req.params;
    const { title, summary, content, imgCredit } = req.body;
    const { token } = req.cookies;
    
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const user = await getUserFromToken(token);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        const post = await getPostById(id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.authorId !== user.id) {
            return res.status(403).json({ error: 'Forbidden: You are not the author of this post' });
        }

        if (req.file) {
            const blob = bucket.file(req.file.originalname);
            const blobStream = blob.createWriteStream();

            blobStream.on('error', (err) => {
                console.error('Blob stream error:', err);
                return res.status(500).json({ error: 'File upload error' });
            });

            blobStream.on('finish', async () => {
                const cover = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blob.name)}?alt=media`;

                const updatedPost = await updatePost(id, { title, summary, content, imgCredit, cover });
                res.json(updatedPost);
            });

            blobStream.end(req.file.buffer);
        } else {
            const updatedPost = await updatePost(id, { title, summary, content, imgCredit });
            res.json(updatedPost);
        }
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});


router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { token } = req.cookies;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const user = await getUserFromToken(token);
        const post = await getPostById(id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.authorId !== user.id) {
            return res.status(403).json({ error: 'Forbidden: You are not the author of this post' });
        }

        await deletePost(id);
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;
