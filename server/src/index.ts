import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import multer from 'multer'
import fs from 'fs'
import path from 'path'

dotenv.config();
const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // Allow this origin
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
}));
app.use(express.json());
app.use(cookieParser())
// Middleware to serve static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const prisma = new PrismaClient();
const PORT = process.env.PORT;
const SECRET_KEY: string = process.env.SECRET_KEY as string; 
const SALT = bcrypt.genSaltSync(10)
const uploadMiddleware = multer({ dest: 'uploads/' });


app.get('/', (req: Request, res: Response) => {
  res.send('Test');
});

async function createUser(username: string, password: string) {
  try {
    const hashedPassword = await bcrypt.hash(password, SALT)
    const user = await prisma.user.create({
      data: {
        name: username,
        password: hashedPassword,
      },
    });
    console.log('User created:', user);
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

app.post('/signin', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    const userDoc = await prisma.user.findUnique({
      where: {
        name: username,
      },
    });

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userDoc.password) {
      return res.status(500).json({ error: 'Password not available' });
    }

    // Check password
    const passwordMatch = bcrypt.compareSync(password,userDoc.password);
    if (passwordMatch) {
      jwt.sign({
        name : username,
        id   : userDoc.id 
    },SECRET_KEY, {},  (error,token) => {
        if(error) {
          throw error;
        }
        // Store signed JWT token inside HTTP cookie
        res.cookie('token', token).json({name :username , id : userDoc.id});
    })

    }else if(!passwordMatch) {
      return res.status(401).json({ error: 'Password invalid' });
    }
  } catch (error) {
    console.error('Failed to signin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await createUser(username, password);
    res.status(200).json(user)
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/profile',(req: Request, res: Response) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, SECRET_KEY, (error: any, info: any) => {
    if (error) {
      throw error;
    }
    res.json(info);
  });

})

app.post('/signout', (req: Request, res : Response) => {
  // Invalidate token
  res.cookie('token', '').json('Success : User signed out')

})

app.get('/posts',async (req: Request, res : Response) => {

  // Fetches all posts from database
  try {
    const posts = await prisma.post.findMany({
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

    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Error' });
  }
})

app.post('/posts', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { originalname, path: tempPath } = req.file as Express.Multer.File; // Type assertion req.file should be treated as type Express.Multer.File

  if (!originalname) {
    return res.status(400).json({ error: 'No original file name found' });
  }

  if (!req.file.path) {
    return res.status(400).json({ error: 'No file path found' });
  }

  // Add extension to the file name; Replace back slashes with forward slashes in the path
  const ext = path.extname(originalname);
  const newPath = `${tempPath}${ext}`;
  const finalPath = newPath.replace(/\\/g, '/');

  // Rename file
  fs.renameSync(tempPath, newPath);


  const {title, summary, content} = req.body;
  const {token} = req.cookies;

  // Create a post entry in database
  try {
    // Get authorID by verifying the token
    jwt.verify(token, SECRET_KEY, async (error: any, info: any) => {
      if (error) throw error;
      const postDoc = await prisma.post.create({
        data : {
          title,
          summary,
          content,
          cover : finalPath,
          published : true,
          authorId : info.id
        }
      })
      res.status(201).json(postDoc);
      console.log(finalPath)
    });
  }catch(error) {
    res.status(500).json({message : ' Error creating post '})
  }

})

app.put('/posts/:id', uploadMiddleware.single('file'), async (req, res) => {
  const { id } = req.params;
  const { title, summary, content} = req.body;
  const { token } = req.cookies;
  let filePath: string;

  if (req.file) {
    const { originalname, path: tempPath } = req.file;

    if (!originalname || !tempPath) {
      return res.status(400).json({ error: 'No original file name or path found' });
    }

    // Add extension to the file name; Replace backslashes with forward slashes in the path
    const ext = path.extname(originalname);
    const newPath = `${tempPath}${ext}`;
    const finalPath = newPath.replace(/\\/g, '/');

    // Rename file
    fs.renameSync(tempPath, newPath);
    filePath = finalPath;
  }

  try {
      jwt.verify(token, SECRET_KEY, async (error : any , userInfo : any) => {
        if (error) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get post from database
      const post = await prisma.post.findUnique({
        where: { id: parseInt(id) },
      });

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Check if user is author of post
      if (post.authorId !== userInfo.id) {
        return res.status(403).json({ error: 'Forbidden: You are not the author of this post' });
      }

      // Update the post in the database
      const updatedPostDoc = await prisma.post.update({
        where: { id: parseInt(id) },
        data: {
          title,
          summary,
          content,
          cover: filePath ? filePath : post.cover, // Keep existing cover if no new file
        },
      });

      res.json(updatedPostDoc);
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
})

app.delete('/posts/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    jwt.verify(token, SECRET_KEY, async (error: any, info: any) => {
      if (error) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get post from database
      const post = await prisma.post.findUnique({
        where: {
          id: parseInt(id),
        },
      });

      if (!post) {
        return res.status(400).json({ error: 'Post not found' });
      }

      // Check if user is author of post
      if (post.authorId !== info.id) {
        return res.status(403).json({ error: 'Forbidden: You are not the author of this post' });
      }

      if(post.cover) {
        const filePath = path.join(__dirname,'..', post.cover)
        fs.unlink(filePath, (error) => {
          if(error) {
            console.log('Error deleting file:', error)
          } else {
            console.log('File deleted successfully:', filePath)
          }
        })
      }

      // Delete post from database
      await prisma.post.delete({
        where: {
          id: parseInt(id),
        },
      });

      res.json({ message: 'Post deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

app.get('/posts/:id', async (req : Request , res : Response) => {
  const {id} = req.params;
  const numericId = parseInt(id, 10);

  const postDoc = await prisma.post.findUnique({
    where : {
      id : numericId
    },
    include : {
      author : {
        select : {
          name : true
        }
      }
    }
  })
  if (!postDoc) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  res.json(postDoc)
})

// Starts the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});