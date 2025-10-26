import React, { useState, useEffect } from 'react';
import './App.css';

// API base URL
const API_BASE = 'http://localhost:5000/api';

// Auth Context
const AuthContext = React.createContext();

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState('home');
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  useEffect(() => {
    if (token) {
      const verifyToken = async () => {
        try {
          const userData = JSON.parse(localStorage.getItem('user'));
          if (userData) {
            setUser(userData);
          }
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
        }
      };
      verifyToken();
    }
  }, [token]);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentView('quizzes');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentView('home');
  };

  const navigateTo = (view, quiz = null) => {
    setCurrentView(view);
    if (quiz) {
      setSelectedQuiz(quiz);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      API_BASE,
      navigateTo,
      currentView,
      selectedQuiz,
      setSelectedQuiz
    }}>
      <div className="App">
        <Navbar />
        <MainContent />
      </div>
    </AuthContext.Provider>
  );
}

// Navbar Component
function Navbar() {
  const { user, logout, navigateTo } = React.useContext(AuthContext);
  
  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1 className="nav-logo" onClick={() => navigateTo('home')}>QuizApp</h1>
        <div className="nav-links">
          {user ? (
            <>
              <button onClick={() => navigateTo('quizzes')} className="nav-link">Quizzes</button>
              <button onClick={() => navigateTo('results')} className="nav-link">My Results</button>
              <button onClick={() => navigateTo('create')} className="nav-link">Create Quiz</button>
              <button onClick={logout} className="logout-btn">
                Logout ({user.username})
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigateTo('home')} className="nav-link">Home</button>
              <button onClick={() => navigateTo('login')} className="nav-link">Login</button>
              <button onClick={() => navigateTo('register')} className="nav-link">Register</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// Main Content Component
function MainContent() {
  const { currentView, user } = React.useContext(AuthContext);

  // If user is not logged in, show auth pages
  if (!user) {
    switch (currentView) {
      case 'login':
        return <Login />;
      case 'register':
        return <Register />;
      default:
        return <Home />;
    }
  }

  // If user is logged in, show app pages
  switch (currentView) {
    case 'quizzes':
      return <QuizList />;
    case 'takeQuiz':
      return <TakeQuiz />;
    case 'results':
      return <Results />;
    case 'create':
      return <CreateQuiz />;
    default:
      return <QuizList />;
  }
}

// Home Component
function Home() {
  const { navigateTo } = React.useContext(AuthContext);

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>Welcome to QuizApp</h1>
        <p>Test your knowledge with our interactive quizzes</p>
        <div className="hero-buttons">
          <button onClick={() => navigateTo('login')} className="cta-button primary">
            Get Started
          </button>
          <button onClick={() => navigateTo('register')} className="cta-button secondary">
            Create Account
          </button>
        </div>
        <div className="features">
          <div className="feature-card">
            <h3>📚 Multiple Categories</h3>
            <p>Quizzes in programming, general knowledge, science and more</p>
          </div>
          <div className="feature-card">
            <h3>📊 Track Progress</h3>
            <p>Monitor your improvement with detailed results</p>
          </div>
          <div className="feature-card">
            <h3>🎯 Create Quizzes</h3>
            <p>Build your own quizzes and share with others</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Login Component
function Login() {
  const { login, API_BASE, navigateTo } = React.useContext(AuthContext);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        login(data.user, data.token);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      setError('Failed to connect to server. Make sure backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="auth-switch">
          <p>Don't have an account? <button onClick={() => navigateTo('register')} className="link-button">Register here</button></p>
        </div>
        <div className="test-credentials">
          <p><strong>Test Account:</strong></p>
          <p>Email: admin@quiz.com</p>
          <p>Password: admin123</p>
        </div>
      </div>
    </div>
  );
}

// Register Component
function Register() {
  const { login, API_BASE, navigateTo } = React.useContext(AuthContext);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        login(data.user, data.token);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (error) {
      setError('Failed to connect to server. Make sure backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Register</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="Choose a username"
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="Choose a password (min 6 characters)"
              required
              minLength="6"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <div className="auth-switch">
          <p>Already have an account? <button onClick={() => navigateTo('login')} className="link-button">Login here</button></p>
        </div>
      </div>
    </div>
  );
}

// Quiz List Component
function QuizList() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { API_BASE, navigateTo } = React.useContext(AuthContext);

  const fetchQuizzes = async () => {
    try {
      const response = await fetch(`${API_BASE}/quizzes`);
      const data = await response.json();
      console.log('Quizzes data:', data);
      if (data.success) {
        setQuizzes(data.quizzes);
      } else {
        setError('Failed to load quizzes');
      }
    } catch (error) {
      setError('Failed to connect to server. Make sure backend is running.');
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return (
    <div className="loading-container">
      <div className="loading">Loading quizzes...</div>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <div className="error-message">{error}</div>
      <button onClick={fetchQuizzes} className="retry-btn">Retry</button>
    </div>
  );

  return (
    <div className="quizzes-container">
      <div className="page-header">
        <h2>Available Quizzes</h2>
        <p>Test your knowledge with these amazing quizzes</p>
      </div>
      
      {quizzes.length === 0 ? (
        <div className="no-data">
          <h3>No quizzes available</h3>
          <p>Be the first to create a quiz!</p>
          <button onClick={() => navigateTo('create')} className="cta-button">
            Create First Quiz
          </button>
        </div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.map(quiz => (
            <QuizCard key={quiz._id} quiz={quiz} />
          ))}
        </div>
      )}
    </div>
  );
}


// ...existing code...
function QuizCard({ quiz }) {
  const { navigateTo, API_BASE } = React.useContext(AuthContext);

  const handleStartQuiz = async () => {
    try {
      const res = await fetch(`${API_BASE}/quizzes/${quiz._id}`);
      const data = await res.json();
      if (res.ok && data.success && data.quiz) {
        navigateTo('takeQuiz', data.quiz);
      } else {
        console.warn('Falling back to list item quiz:', data);
        navigateTo('takeQuiz', quiz);
      }
    } catch (err) {
      console.error('Error fetching quiz detail:', err);
      navigateTo('takeQuiz', quiz);
    }
  };

  const questionsCount = quiz.questions ? quiz.questions.length : 0;

  const questionPreviews = quiz.questions ?
    quiz.questions.slice(0, 2).map((q, index) => (
      <div key={index} className="question-preview">
        • {q.questionText || 'No question text'}
      </div>
    )) : [];

  return (
    <div className="quiz-card">
      <div className="quiz-header">
        <h3>{quiz.title || 'Untitled Quiz'}</h3>
        <span className={`difficulty-badge ${quiz.difficulty || 'medium'}`}>
          {quiz.difficulty ? quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1) : 'Medium'}
        </span>
      </div>
      <p className="quiz-description">{quiz.description || 'No description available'}</p>

      <div className="quiz-preview">
        <div className="preview-header">Sample Questions:</div>
        {questionPreviews.length > 0 ? (
          <div className="question-previews">
            {questionPreviews}
            {questionsCount > 2 && (
              <div className="more-questions">... and {questionsCount - 2} more</div>
            )}
          </div>
        ) : (
          <div className="no-questions-preview">No questions available</div>
        )}
      </div>

      <div className="quiz-meta">
        <span className="meta-item">
          <strong>Category:</strong> {quiz.category || 'Uncategorized'}
        </span>
        <span className="meta-item">
          <strong>Questions:</strong> {questionsCount}
        </span>
        <span className="meta-item">
          <strong>Time:</strong> {quiz.timeLimit || 10} min
        </span>
      </div>

      <div className="quiz-footer">
        <span className="author">By: {quiz.createdBy?.username || 'Unknown'}</span>
        <button onClick={handleStartQuiz} className="start-btn">
          Start Quiz
        </button>
      </div>
    </div>
  );
}
// ...existing code...


// Take Quiz Component - COMPLETELY FIXED VERSION
function TakeQuiz() {
  const { user, API_BASE, navigateTo, selectedQuiz } = React.useContext(AuthContext);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadQuiz = async () => {
      if (selectedQuiz) {
        try {
          console.log('Selected Quiz:', selectedQuiz);
          console.log('Quiz Questions:', selectedQuiz.questions);
          
          if (selectedQuiz.questions && selectedQuiz.questions.length > 0) {
            const firstQuestion = selectedQuiz.questions[0];
            console.log('First question:', firstQuestion);
            console.log('First question options:', firstQuestion.options);
            console.log('Options type:', typeof firstQuestion.options);
            console.log('Options length:', firstQuestion.options.length);
            
            // Log each option to see the structure
            firstQuestion.options.forEach((opt, idx) => {
              console.log(`Option ${idx}:`, opt);
            });
          }
          
          setQuiz(selectedQuiz);
          setTimeLeft((selectedQuiz.timeLimit || 10) * 60);
        } catch (error) {
          setError('Failed to load quiz data');
          console.error('Error loading quiz:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setError('No quiz selected');
        setLoading(false);
      }
    };

    loadQuiz();
  }, [selectedQuiz]);

  useEffect(() => {
    if (quiz && timeLeft > 0 && !quizCompleted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && quiz && !quizCompleted) {
      handleSubmit();
    }
  }, [timeLeft, quiz, quizCompleted]);

  const handleAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (!user) {
      alert('Please login to submit quiz');
      return;
    }

    if (!quiz || !quiz.questions) {
      setError('Quiz data is incomplete');
      return;
    }

    // Calculate score
    let score = 0;
    const userAnswers = [];

    quiz.questions.forEach((question, questionIndex) => {
      const userAnswerIndex = answers[question._id || questionIndex];
      let userSelectedOption = null;
      let correctOptionIndex = -1;
      let correctOption = null;

      // Safely get user selected option
      if (userAnswerIndex !== undefined && question.options && question.options[userAnswerIndex]) {
        userSelectedOption = question.options[userAnswerIndex];
      }

      // Safely find correct option
      if (question.options) {
        correctOptionIndex = question.options.findIndex(opt => 
          opt.isCorrect === true || opt.isCorrect === 'true'
        );
        if (correctOptionIndex !== -1) {
          correctOption = question.options[correctOptionIndex];
        }
      }

      const isCorrect = userAnswerIndex === correctOptionIndex;
      
      if (isCorrect) score += question.points || 1;
      
      userAnswers.push({
        question: question.questionText,
        userAnswer: userSelectedOption ? 
          (userSelectedOption.text || userSelectedOption.optionText || `Option ${userAnswerIndex + 1}`) 
          : 'Not answered',
        correctAnswer: correctOption ? 
          (correctOption.text || correctOption.optionText || `Option ${correctOptionIndex + 1}`)
          : 'No correct answer set',
        isCorrect
      });
    });

    const totalPoints = quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

    const resultData = {
      quiz: quiz._id,
      quizTitle: quiz.title,
      score,
      totalPoints,
      totalQuestions: quiz.questions.length,
      percentage: percentage,
      timeTaken: (quiz.timeLimit || 10) * 60 - timeLeft,
      answers: userAnswers,
      completedAt: new Date().toISOString()
    };

    console.log('Submitting result:', resultData);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(resultData)
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(resultData);
        setQuizCompleted(true);
      } else {
        setError(data.message || 'Failed to save result');
        // Still show results even if backend fails
        setResult(resultData);
        setQuizCompleted(true);
      }
    } catch (error) {
      console.error('Error submitting result:', error);
      // Show results even if backend fails
      setResult(resultData);
      setQuizCompleted(true);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to safely get option text
  const getOptionText = (option, index) => {
    if (!option) return `Option ${index + 1}`;
    
    // Try different possible property names
    return option.text || option.optionText || option.option || `Option ${index + 1}`;
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading">Loading quiz...</div>
    </div>
  );

  if (error && !quizCompleted) return (
    <div className="error-container">
      <div className="error-message">{error}</div>
      <button onClick={() => navigateTo('quizzes')} className="cta-button">
        Back to Quizzes
      </button>
    </div>
  );

  if (!quiz) return (
    <div className="error-container">
      <div className="error-message">Quiz not found</div>
      <button onClick={() => navigateTo('quizzes')} className="cta-button">
        Back to Quizzes
      </button>
    </div>
  );

  if (quizCompleted) {
    return (
      <div className="quiz-completed-container">
        <div className="quiz-result">
          <div className="result-header">
            <h2>🎉 Quiz Completed!</h2>
            <p>You've finished "{quiz.title}"</p>
          </div>
          
          <div className="score-display">
            <div className="score-circle">
              <span className="score-percentage">{result.percentage}%</span>
            </div>
            <div className="score-details">
              <p className="score-text">
                Score: <strong>{result.score}</strong> out of <strong>{result.totalPoints}</strong>
              </p>
              <p className="time-taken">
                Time Taken: {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s
              </p>
            </div>
          </div>

          <div className="answers-review">
            <h3>Your Answers</h3>
            {result.answers.map((answer, index) => (
              <div key={index} className={`answer-item ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                <div className="question-number">Question {index + 1}</div>
                <p className="question-text">{answer.question}</p>
                <div className="answer-comparison">
                  <div className="user-answer">
                    <strong>Your answer:</strong> {answer.userAnswer}
                  </div>
                  {!answer.isCorrect && (
                    <div className="correct-answer">
                      <strong>Correct answer:</strong> {answer.correctAnswer}
                    </div>
                  )}
                </div>
                <div className={`answer-status ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                  {answer.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </div>
              </div>
            ))}
          </div>

          <div className="result-actions">
            <button onClick={() => navigateTo('quizzes')} className="cta-button primary">
              Take Another Quiz
            </button>
            <button onClick={() => navigateTo('results')} className="cta-button secondary">
              View All Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];

  if (!question) {
    return (
      <div className="error-container">
        <div className="error-message">Question data is missing</div>
        <button onClick={() => navigateTo('quizzes')} className="cta-button">
          Back to Quizzes
        </button>
      </div>
    );
  }

  console.log('Current question:', question);
  console.log('Question options:', question.options);

  return (
    <div className="take-quiz-container">
      <div className="quiz-header">
        <div className="quiz-info">
          <h2>{quiz.title}</h2>
          <p>{quiz.description}</p>
        </div>
        <div className="quiz-timer">
          <div className="timer-display">
            ⏱️ {formatTime(timeLeft)}
          </div>
          <div className="timer-label">Time Remaining</div>
        </div>
      </div>

      <div className="quiz-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
          ></div>
        </div>
        <div className="progress-text">
          Question {currentQuestion + 1} of {quiz.questions.length}
        </div>
      </div>

      <div className="question-container">
        <div className="question-header">
          <h3 className="question-text">{question.questionText}</h3>
          <span className="question-points">Points: {question.points || 1}</span>
        </div>

        <div className="options-container">
          {question.options && question.options.length > 0 ? (
            question.options.map((option, index) => (
              <button
                key={index}
                className={`option-button ${answers[question._id] === index ? 'selected' : ''}`}
                onClick={() => handleAnswer(question._id, index)}
              >
                <span className="option-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="option-text">{getOptionText(option, index)}</span>
              </button>
            ))
          ) : (
            <div className="no-options-message">
              No options available for this question
            </div>
          )}
        </div>

        <div className="navigation-buttons">
          <button
            className="nav-button prev"
            onClick={() => setCurrentQuestion(prev => prev - 1)}
            disabled={currentQuestion === 0}
          >
            ← Previous
          </button>
          
          {currentQuestion === quiz.questions.length - 1 ? (
            <button
              className="nav-button submit"
              onClick={handleSubmit}
            >
              Submit Quiz ✓
            </button>
          ) : (
            <button
              className="nav-button next"
              onClick={() => setCurrentQuestion(prev => prev + 1)}
            >
              Next →
            </button>
          )}
        </div>

        <div className="quiz-notes">
          <p>💡 Select an answer to proceed to the next question</p>
          <p>⏰ The quiz will auto-submit when time runs out</p>
        </div>
      </div>
    </div>
  );
}

// Results Component
function Results() {
  const { user, API_BASE, navigateTo } = React.useContext(AuthContext);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/results/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setResults(data.results);
      } else {
        setError(data.message || 'Failed to load results');
      }
    } catch (error) {
      setError('Failed to connect to server');
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchResults();
    }
  }, [user]);

  if (!user) return (
    <div className="message-container">
      <div className="message">Please login to view results</div>
    </div>
  );

  if (loading) return (
    <div className="loading-container">
      <div className="loading">Loading results...</div>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <div className="error-message">{error}</div>
      <button onClick={fetchResults} className="retry-btn">Retry</button>
    </div>
  );

  return (
    <div className="results-container">
      <div className="page-header">
        <h2>My Quiz Results</h2>
        <p>Track your progress and performance</p>
        <button onClick={fetchResults} className="refresh-btn">🔄 Refresh</button>
      </div>
      
      {results.length === 0 ? (
        <div className="no-data">
          <h3>No results yet</h3>
          <p>Take a quiz to see your results here!</p>
          <button onClick={() => navigateTo('quizzes')} className="cta-button">
            Take a Quiz
          </button>
        </div>
      ) : (
        <div className="results-list">
          {results.map(result => (
            <div key={result._id} className="result-card">
              <div className="result-header">
                <h3>{result.quizTitle || 'Quiz'}</h3>
                <span className={`score-badge ${result.percentage >= 70 ? 'high-score' : result.percentage >= 50 ? 'medium-score' : 'low-score'}`}>
                  {result.score}/{result.totalPoints || result.totalQuestions}
                </span>
              </div>
              <div className="result-details">
                <div className="result-meta">
                  <span className={`percentage ${result.percentage >= 70 ? 'high-score' : result.percentage >= 50 ? 'medium-score' : 'low-score'}`}>
                    {result.percentage}%
                  </span>
                  <span className="date">
                    {new Date(result.completedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="result-stats">
                  <div className="stat">
                    <label>Time Taken</label>
                    <span>{Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</span>
                  </div>
                  <div className="stat">
                    <label>Questions</label>
                    <span>{result.totalQuestions}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Create Quiz Component
function CreateQuiz() {
  const { user, API_BASE, navigateTo } = React.useContext(AuthContext);
  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: 'medium',
    timeLimit: 10,
    questions: []
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const addQuestion = () => {
    setQuiz(prev => ({
      ...prev,
      questions: [...prev.questions, {
        questionText: '',
        options: [
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ],
        points: 1
      }]
    }));
  };

  const updateQuestion = (qIndex, field, value) => {
    const newQuestions = [...quiz.questions];
    newQuestions[qIndex][field] = value;
    setQuiz({...quiz, questions: newQuestions});
  };

  const updateOption = (qIndex, oIndex, field, value) => {
    const newQuestions = [...quiz.questions];
    newQuestions[qIndex].options[oIndex][field] = value;
    setQuiz({...quiz, questions: newQuestions});
  };

  const setCorrectOption = (qIndex, oIndex) => {
    const newQuestions = [...quiz.questions];
    newQuestions[qIndex].options.forEach(opt => opt.isCorrect = false);
    newQuestions[qIndex].options[oIndex].isCorrect = true;
    setQuiz({...quiz, questions: newQuestions});
  };

  const removeQuestion = (qIndex) => {
    const newQuestions = quiz.questions.filter((_, index) => index !== qIndex);
    setQuiz({...quiz, questions: newQuestions});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setMessage('Please login to create quizzes');
      return;
    }

    if (quiz.questions.length === 0) {
      setMessage('Please add at least one question');
      return;
    }

    // Validation
    if (!quiz.title.trim() || !quiz.category.trim()) {
      setMessage('Please fill in all required fields');
      return;
    }

    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      if (!question.questionText.trim()) {
        setMessage(`Question ${i + 1} must have text`);
        return;
      }
      
      const hasCorrectOption = question.options.some(opt => opt.isCorrect && opt.text.trim());
      if (!hasCorrectOption) {
        setMessage(`Question ${i + 1} must have at least one correct option`);
        return;
      }

      for (let j = 0; j < question.options.length; j++) {
        if (!question.options[j].text.trim()) {
          setMessage(`Question ${i + 1}, Option ${j + 1} must have text`);
          return;
        }
      }
    }

    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(quiz)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage('✅ Quiz created successfully!');
        setQuiz({
          title: '',
          description: '',
          category: '',
          difficulty: 'medium',
          timeLimit: 10,
          questions: []
        });
        setTimeout(() => {
          navigateTo('quizzes');
        }, 2000);
      } else {
        setMessage(`❌ ${data.message || 'Failed to create quiz'}`);
      }
    } catch (error) {
      setMessage('❌ Failed to connect to server. Make sure backend is running.');
      console.error('Create quiz error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="message-container">
        <div className="message">Please login to create quizzes</div>
      </div>
    );
  }

  return (
    <div className="create-quiz-container">
      <div className="page-header">
        <h2>Create New Quiz</h2>
        <p>Build your own quiz and share it with others</p>
      </div>
      
      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="create-quiz-form">
        <div className="form-section">
          <h3>Quiz Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Quiz Title *</label>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz({...quiz, title: e.target.value})}
                placeholder="Enter quiz title"
                required
              />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <input
                type="text"
                value={quiz.category}
                onChange={(e) => setQuiz({...quiz, category: e.target.value})}
                placeholder="e.g., Programming, Science, History"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={quiz.description}
              onChange={(e) => setQuiz({...quiz, description: e.target.value})}
              placeholder="Describe your quiz..."
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Difficulty</label>
              <select
                value={quiz.difficulty}
                onChange={(e) => setQuiz({...quiz, difficulty: e.target.value})}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Time Limit (minutes) *</label>
              <input
                type="number"
                value={quiz.timeLimit}
                onChange={(e) => setQuiz({...quiz, timeLimit: parseInt(e.target.value) || 10})}
                min="1"
                max="180"
                required
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h3>Questions ({quiz.questions.length})</h3>
            <button type="button" onClick={addQuestion} className="add-btn">
              + Add Question
            </button>
          </div>
          
          {quiz.questions.length === 0 && (
            <div className="no-questions">
              <p>No questions added yet. Click "Add Question" to get started!</p>
            </div>
          )}
          
          {quiz.questions.map((question, qIndex) => (
            <div key={qIndex} className="question-card">
              <div className="question-header">
                <h4>Question {qIndex + 1}</h4>
                <button 
                  type="button" 
                  onClick={() => removeQuestion(qIndex)}
                  className="remove-btn"
                >
                  Remove
                </button>
              </div>
              
              <div className="form-group">
                <label>Question Text *</label>
                <input
                  type="text"
                  value={question.questionText}
                  onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                  placeholder="Enter your question..."
                  required
                />
              </div>
              
              <div className="options-section">
                <label>Options * (Select one correct answer)</label>
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="option-row">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={option.isCorrect}
                      onChange={() => setCorrectOption(qIndex, oIndex)}
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(qIndex, oIndex, 'text', e.target.value)}
                      placeholder={`Option ${oIndex + 1}`}
                      className={option.isCorrect ? 'correct-option' : ''}
                      required
                    />
                    {option.isCorrect && (
                      <span className="correct-badge">Correct</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading || quiz.questions.length === 0}
          >
            {loading ? 'Creating Quiz...' : 'Create Quiz'}
          </button>
          <button 
            type="button" 
            onClick={() => navigateTo('quizzes')}
            className="cancel-btn"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
