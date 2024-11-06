const express = require('express');
const cors = require('cors');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const errorController = require('./controllers/errorController');
const tripsRouter = require('./routes/tripsRoutes');
const userRouter = require('./routes/userRoutes');
const customizedTripsRouter = require('./routes/customizedTripRoutes');

const app = express();

//Setting HTTP headers
app.use(helmet());

app.use(cors());

//limiting IP requests with this middleware to avoid DOS & brute force attacks
const limiter = rateLimit({
  max: 90,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, Please try again after an hour!',
});

app.use('/api', limiter);

//Data sanitization against noSql queries injection
app.use(mongoSanitize());
//Data sanitization against XSS
app.use(xss());

//bodyParser, reading data from body into req.body
app.use(express.json({ limit: '50kb' }));

//serving static files
app.use(express.static(`${__dirname}/public`));

app.use(express.json());

app.use('/api/v1/trips', tripsRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/cus-trips', customizedTripsRouter);
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on the server`,
  });
  next();
});

app.use(errorController);

module.exports = app;
