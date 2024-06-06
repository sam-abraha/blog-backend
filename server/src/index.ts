import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { bucket } from './firebase'

dotenv.config();


const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://myfullstacktechblog.netlify.app'
];

const app = express();
const corsOptions = {
  origin: function (origin : any , callback : any) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
// Middleware to serve static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT as string, 10) || 3000;  // Ensure PORT is a number
const SECRET_KEY: string = process.env.SECRET_KEY as string;
const SALT = bcrypt.genSaltSync(10);
const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage });
//const uploadMiddleware = multer({ dest: 'uploads/' });

app.get('/', (req: Request, res: Response) => {
  res.send('Test');
});

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('Database connection successful!');
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function connectWithRetry() {
  let connected = false;
  while (!connected) {
    try {
      await prisma.$connect();
      connected = true;
      console.log('Connected to the database');
    } catch (error) {
      console.error('Database connection failed. Retrying in 5 seconds...', error);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

async function createUser(username: string, password: string) {
  try {
    const hashedPassword = await bcrypt.hash(password, SALT);
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
    const userDoc = await prisma.user.findUnique({
      where: { name: username },
    });

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userDoc.password) {
      return res.status(500).json({ error: 'Password not available' });
    }

    const passwordMatch = bcrypt.compareSync(password, userDoc.password);
    if (passwordMatch) {
      jwt.sign({ name: username, id: userDoc.id }, SECRET_KEY, {}, (error, token) => {
        if (error) {
          console.error('JWT sign error:', error);
          return res.status(500).json({ error: 'Error generating token' });
        }
        res.cookie('token', token, { httpOnly: true, sameSite: 'none', secure: true })
           .json({ name: username, id: userDoc.id });
      });
    } else {
      return res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await createUser(username, password);
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/profile', (req: Request, res: Response) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, SECRET_KEY, (error: any, info: any) => {
    if (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.json(info);
  });
});

app.post('/signout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ message: 'Success: User signed out' });
});

app.get('/posts', async (req: Request, res: Response) => {
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
});

app.post('/posts', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }


  /*
  const { originalname, path: tempPath } = req.file as Express.Multer.File;
  const ext = path.extname(originalname);
  const newPath = `${tempPath}${ext}`;
  const finalPath = newPath.replace(/\\/g, '/');
  */

  const { originalname, buffer } = req.file;
  const blob = bucket.file(originalname);
  const blobStream = blob.createWriteStream();

  blobStream.on('error', (err : any) => {
    console.error('Blob stream error:', err);
    res.status(500).json({ error: 'File upload error' });
  });

  blobStream.on('finish', async () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

    try {
      const { title, summary, content } = req.body;
      const { token } = req.cookies;

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      jwt.verify(token, SECRET_KEY, async (error : any, info : any) => {
        if (error) {
          return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        const postDoc = await prisma.post.create({
          data: {
            title,
            summary,
            content,
            cover: publicUrl,
            published: true,
            authorId: info.id,
          },
        });
        res.status(201).json(postDoc);
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      res.status(500).json({ message: 'Error creating post' });
    }
  });

  blobStream.end(buffer);
});



app.put('/posts/:id', uploadMiddleware.single('file'), async (req, res) => {
  const { id } = req.params;
  const { title, summary, content } = req.body;
  const { token } = req.cookies;
  let filePath: string;

  if (req.file) {
    const { originalname, path: tempPath } = req.file;

    if (!originalname || !tempPath) {
      return res.status(400).json({ error: 'No original file name or path found' });
    }

    const ext = path.extname(originalname);
    const newPath = `${tempPath}${ext}`;
    const finalPath = newPath.replace(/\\/g, '/');

    fs.renameSync(tempPath, newPath);
    filePath = finalPath;
  }

  try {
    jwt.verify(token, SECRET_KEY, async (error: any, userInfo: any) => {
      if (error) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const post = await prisma.post.findUnique({
        where: { id: parseInt(id) },
      });

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (post.authorId !== userInfo.id) {
        return res.status(403).json({ error: 'Forbidden: You are not the author of this post' });
      }

      const updatedPostDoc = await prisma.post.update({
        where: { id: parseInt(id) },
        data: {
          title,
          summary,
          content,
          cover: filePath ? filePath : post.cover,
        },
      });

      res.json(updatedPostDoc);
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

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

      const post = await prisma.post.findUnique({
        where: {
          id: parseInt(id),
        },
      });

      if (!post) {
        return res.status(400).json({ error: 'Post not found' });
      }

      if (post.authorId !== info.id) {
        return res.status(403).json({ error: 'Forbidden: You are not the author of this post' });
      }

      if (post.cover) {
        const filePath = path.join(__dirname, '..', post.cover);
        fs.unlink(filePath, (error) => {
          if (error) {
            console.log('Error deleting file:', error);
          } else {
            console.log('File deleted successfully:', filePath);
          }
        });
      }

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

app.get('/posts/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id, 10);

  const postDoc = await prisma.post.findUnique({
    where: {
      id: numericId,
    },
    include: {
      author: {
        select: {
          name: true,
        },
      },
    },
  });
  if (!postDoc) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  res.json(postDoc);
});

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  testConnection();
  connectWithRetry();
});
