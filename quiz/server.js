const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/quizapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Quiz Schema
const questionSchema = new mongoose.Schema({
  questionText: { 
    type: String, 
    required: true,
    trim: true
  },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    default: 'multiple-choice'
  },
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  points: { 
    type: Number, 
    default: 1 
  }
});

const quizSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  questions: [questionSchema],
  timeLimit: { 
    type: Number, 
    default: 10 
  },
  category: { 
    type: String, 
    required: true 
  },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'], 
    default: 'medium' 
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

quizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Quiz = mongoose.model('Quiz', quizSchema);

// Result Schema
const resultSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  quiz: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Quiz', 
    required: true 
  },
  score: { 
    type: Number, 
    required: true 
  },
  totalQuestions: { 
    type: Number, 
    required: true 
  },
  percentage: { 
    type: Number, 
    required: true 
  },
  timeTaken: { 
    type: Number, 
    required: true 
  },
  answers: [{
    question: String,
    userAnswer: String,
    correctAnswer: String,
    isCorrect: Boolean
  }],
  completedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Result = mongoose.model('Result', resultSchema);

// Auth middleware
const auth = async (req, res, next) => {
  try {
    // accept Authorization: Bearer <token> or ?token=... or cookie
    let token = req.header('Authorization')?.replace('Bearer ', '') || req.query?.token || (req.cookies && req.cookies.token);

    if (!token) {
      console.warn('Auth middleware: no token provided for', req.method, req.originalUrl);
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    console.log('Auth middleware: token received (first 20 chars):', String(token).slice(0, 20));

    try {
      const decoded = jwt.verify(token, 'quiz-app-secret');
      const user = await User.findById(decoded.id);
      if (!user) {
        console.warn('Auth middleware: token valid but user not found, id:', decoded.id);
        return res.status(401).json({ message: 'Token is not valid' });
      }
      req.user = user;
      next();
    } catch (err) {
      console.error('Auth middleware - token verify error:', err.name, err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      return res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Auth middleware general error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Quiz API Server is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      quizzes: {
        list: 'GET /api/quizzes',
        single: 'GET /api/quizzes/:id',
        create: 'POST /api/quizzes'
      },
      results: {
        submit: 'POST /api/results',
        userResults: 'GET /api/results/user'
      },
      init: 'GET /api/init-data'
    }
  });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters' 
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists with this email or username' 
      });
    }

    const user = await User.create({ 
      username, 
      email: email.toLowerCase(), 
      password 
    });

    const token = jwt.sign({ id: user._id }, 'quiz-app-secret', {
      expiresIn: '7d'
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const isPasswordCorrect = await user.correctPassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign({ id: user._id }, 'quiz-app-secret', {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login'
    });
  }
});

// Quiz Routes
app.get('/api/quizzes', async (req, res) => {
  try {
    const quizzes = await Quiz.find({ isPublic: true })
      .populate('createdBy', 'username')
      .select('-questions.options.isCorrect')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: quizzes.length,
      quizzes
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching quizzes'
    });
  }
});

app.get('/api/quizzes/:id', async (req, res) => {
  try {
    // removed .select('-questions.options.isCorrect') so single-quiz returns isCorrect
    const quiz = await Quiz.findById(req.params.id)
      .populate('createdBy', 'username');

    if (!quiz) {
      return res.status(404).json({ 
        success: false,
        message: 'Quiz not found' 
      });
    }

    res.json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching quiz'
    });
  }
});

app.post('/api/quizzes', auth, async (req, res) => {
  try {
    const { title, description, questions, timeLimit, category, difficulty } = req.body;

    if (!title || !category || !questions || questions.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Title, category, and at least one question are required' 
      });
    }

    const quiz = await Quiz.create({ 
      title, 
      description, 
      questions, 
      timeLimit, 
      category, 
      difficulty,
      createdBy: req.user._id 
    });

    const populatedQuiz = await Quiz.findById(quiz._id)
      .populate('createdBy', 'username');

    res.status(201).json({
      success: true,
      quiz: populatedQuiz
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while creating quiz'
    });
  }
});

// Result Routes
app.post('/api/results', auth, async (req, res) => {
  try {
    const { quiz: quizId, score, totalQuestions, timeTaken, answers } = req.body;

    if (!quizId || score === undefined || !totalQuestions || !timeTaken || !answers) {
      return res.status(400).json({ 
        success: false,
        message: 'All result fields are required' 
      });
    }

    const percentage = (score / totalQuestions) * 100;

    const result = await Result.create({
      user: req.user._id,
      quiz: quizId,
      score,
      totalQuestions,
      percentage,
      timeTaken,
      answers
    });

    const populatedResult = await Result.findById(result._id)
      .populate('quiz', 'title category');

    res.status(201).json({
      success: true,
      result: populatedResult
    });
  } catch (error) {
    console.error('Submit result error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while submitting result'
    });
  }
});

app.get('/api/results/user', auth, async (req, res) => {
  try {
    const results = await Result.find({ user: req.user._id })
      .populate('quiz', 'title category difficulty')
      .sort({ completedAt: -1 });

    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Get user results error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching results'
    });
  }
});

// Initialize sample data
app.get('/api/init-data', async (req, res) => {
  try {
    let sampleUser = await User.findOne({ email: 'admin@quiz.com' });
    
    if (!sampleUser) {
      sampleUser = await User.create({
        username: 'quizadmin',
        email: 'admin@quiz.com',
        password: 'admin123',
        role: 'admin'
      });
    }

    const sampleQuizzes = [
      {
        title: "JavaScript Basics",
        description: "Test your JavaScript fundamentals with this beginner-friendly quiz",
        category: "Programming",
        difficulty: "easy",
        timeLimit: 10,
        createdBy: sampleUser._id,
        questions: [
          {
            questionText: "Which keyword is used to declare a variable in JavaScript?",
            options: [
              { text: "var", isCorrect: true },
              { text: "let", isCorrect: true },
              { text: "const", isCorrect: true },
              { text: "variable", isCorrect: false }
            ],
            points: 1
          },
          {
            questionText: "What is the result of 2 + '2' in JavaScript?",
            options: [
              { text: "4", isCorrect: false },
              { text: "22", isCorrect: true },
              { text: "NaN", isCorrect: false },
              { text: "Error", isCorrect: false }
            ],
            points: 1
          },
          {
            questionText: "Which of the following is NOT a JavaScript data type?",
            options: [
              { text: "string", isCorrect: false },
              { text: "boolean", isCorrect: false },
              { text: "number", isCorrect: false },
              { text: "character", isCorrect: true }
            ],
            points: 1
          }
        ]
      },
      {
        title: "General Knowledge",
        description: "Test your general knowledge about the world",
        category: "General",
        difficulty: "medium",
        timeLimit: 15,
        createdBy: sampleUser._id,
        questions: [
          {
            questionText: "What is the capital of France?",
            options: [
              { text: "London", isCorrect: false },
              { text: "Berlin", isCorrect: false },
              { text: "Paris", isCorrect: true },
              { text: "Madrid", isCorrect: false }
            ],
            points: 1
          },
          {
            questionText: "Which planet is known as the Red Planet?",
            options: [
              { text: "Venus", isCorrect: false },
              { text: "Mars", isCorrect: true },
              { text: "Jupiter", isCorrect: false },
              { text: "Saturn", isCorrect: false }
            ],
            points: 1
          },
          {
            questionText: "What is the largest ocean on Earth?",
            options: [
              { text: "Atlantic Ocean", isCorrect: false },
              { text: "Indian Ocean", isCorrect: false },
              { text: "Arctic Ocean", isCorrect: false },
              { text: "Pacific Ocean", isCorrect: true }
            ],
            points: 1
          }
        ]
      }
    ];

    await Quiz.deleteMany({});
    const createdQuizzes = await Quiz.create(sampleQuizzes);
    
    res.json({ 
      success: true,
      message: "Sample data initialized successfully!",
      quizzesCount: createdQuizzes.length,
      user: {
        username: sampleUser.username,
        email: sampleUser.email,
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error('Init data error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while initializing data'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}`);
  console.log(`🎯 Initialize sample data: http://localhost:${PORT}/api/init-data`);
  console.log(`📊 View all quizzes: http://localhost:${PORT}/api/quizzes`);
  console.log(`🔑 Test login: admin@quiz.com / admin123`);
});
