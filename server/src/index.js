const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

dotenv.config();
const prisma = new PrismaClient();

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');



const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://myfullstacktechblog.netlify.app'
];

const app = express();
const corsOptions = {
    origin: function (origin, callback) {
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

app.use('/auth', authRoutes);
app.use('/posts', postRoutes);

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


const PORT = parseInt(process.env.PORT) || 3000;
app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server listening at http://localhost:${PORT}`);
    connectWithRetry();
    testConnection();

});