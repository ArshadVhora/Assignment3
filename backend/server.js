require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const helmet  = require('helmet');
const passport = require('./config/passport');
const session = require('express-session');
const NotificationScheduler = require('./utils/notificationScheduler');
const recordsRoutes = require('./routes/records');
const prometheusBundle = require('express-prom-bundle');

const app = express();
connectDB().then(() => {
    console.log('Connected to MongoDB');
    NotificationScheduler.start(); // Start the notification scheduler
});

// --- Security Headers (Helmet with CSP & frameguard) ---
app.use(helmet({
  // Disable the default CSP to define our own
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'"],
      styleSrc:      ["'self'", "https://fonts.googleapis.com"],
      imgSrc:        ["'self'", "data:"],
      connectSrc:    ["'self'", process.env.CLIENT_URL],
      fontSrc:       ["'self'", "https://fonts.gstatic.com"],
      frameSources:  ["'none'"],
      frameAncestors:["'none'"],       // prevents clickjacking
      objectSrc:     ["'none'"],
      formAction:    ["'self'"],       // only allows form submissions back to this origin
      baseUri:       ["'self'"]
    }
  },
  // also sets X-Frame-Options to DENY, X-Content-Type-Options, etc.
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true
}));


app.use(prometheusBundle({
  includeMethod: true,
  includePath: true,
  metricsPath: '/metrics',
  collectDefaultMetrics: { timeout: 5000 },
  buckets: [0.1, 0.3, 1.5, 10]
}));


// --- CORS Setup (for React frontend to access cookies/sessions) ---
app.use(cors({
    origin: process.env.CLIENT_URL,  // e.g., "http://localhost:3000"
    credentials: true                // allow cookies/sessions cross-origin
}));

app.use(express.json());

// --- Session & Passport Setup ---
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Your Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/messages', require('./controllers/messageController'));
app.use('/api', require('./routes/records'));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
