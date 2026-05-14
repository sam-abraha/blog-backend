const express = require('express');
const multer = require('multer');
const authMiddleware = require(
  '../middlewares/authMiddleware'
);
const {getAllPosts,getSinglePost,createNewPost,updateExistingPost,removePost} = require('../controllers/postController');

const router = express.Router();
const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage });

router.get('/',getAllPosts)
router.get('/:id',getSinglePost)
router.post('/',authMiddleware,uploadMiddleware.single('file'),createNewPost)
router.put('/:id',authMiddleware,uploadMiddleware.single('file'),updateExistingPost)
router.delete('/:id',authMiddleware,removePost)

module.exports = router;
