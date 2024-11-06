/* eslint-disable no-unused-vars */
const client = require('./../db');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const AppError = require('./../utils/appError');
const catchAsync = require('./../utils/catchAsync');
const Email = require('./../utils/email');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { isEmail } = require('validator');
const { now } = require('mongoose');

//Used to compare passwords
const comparePassword = async (candidatePassword, userPassword) => {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const createPassowrdResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  return resetToken;
};

exports.updateLastLoggedInAndActive = catchAsync(async (req, res, next) => {
  await client.query(
    `UPDATE users SET last_logged_in = NOW(), active = $1 WHERE email = $2`,
    [true, req.body.email]
  );
});

//issue a token for the user
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

//.........................................................................................................................................

const createSendToken = (user, statusCode, res) => {
  //sign the token
  const token = signToken(user.id);
  //create cookie options
  let cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);
  //Send the response to user
  res.status(statusCode).json({
    status: 'success',
    token,
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
    },
  });
};
//.........................................................................................................................................

exports.signup = catchAsync(async (req, res, next) => {
  //1) Get values
  const { first_name, last_name, email, password, password_confirm } = req.body;
  if (!isEmail(email)) {
    return next(new AppError('Please provide a valid email', 401));
  }

  //2) email verification variable to check if the email already exists
  const emailVerification = await client.query(
    `SELECT email FROM users WHERE email = $1`,
    [email]
  );

  //3) Check if the email already exists
  if (emailVerification.rows.length > 0) {
    return next(new AppError('This email already has an account', 401));
  }

  //4) check if the entered passwords are the same
  if (password !== password_confirm) {
    return next(new AppError('Password is not the same', 401));
  }

  //5) hash the password before inserting it in database
  const hashedPassword = await bcrypt.hash(password, 12);

  //6) Insert the values
  const result = await client.query(
    `INSERT INTO users (first_name, last_name, email, password, last_logged_in)
    VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name, email`,
    [first_name, last_name, email, hashedPassword, now()]
  );

  const newUser = result.rows[0];
  //Create the token and respond to user
  createSendToken(newUser, 201, res);

  next();
});

//.........................................................................................................................................

exports.login = catchAsync(async (req, res, next) => {
  //1) Check if the email sent with the request
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  //2) Check if the user exists by email
  const userResult = await client.query(
    `SELECT id, email, password FROM users WHERE email = $1`,
    [email]
  );

  //3) If it doesn't exist then throw an error
  if (userResult.rows.length === 0) {
    return next(new AppError('Incorrect email or password!', 401));
  }

  //4) Assign the userEmail
  const user = userResult.rows[0];

  //7) Compare the passwords
  const passwordVerification = await bcrypt.compare(password, user.password);

  //8) If the compared passwords are false then throw an error
  if (!passwordVerification) {
    return next(new AppError('Incorrect password or email'));
  }

  //9) Assign the token to the user
  createSendToken(user, 200, res);

  next();
});

//.........................................................................................................................................

/**
 Protect is used to ensure that the user is logged in, check if the token is valid, make sure that the user still exists and to check that the user didn't
 change his password then send (req.user) which we can use in future operations to het user's id as an example
 */
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  //1)get the token and check if its there
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  console.log(token);
  if (!token) {
    return next(new AppError(
      'You are not logged in! Please login to get access',
      401
    ));
  }

  //2)Token verification
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  console.log(decoded);
  //3) Check if the user still exists
  const userReult = await client.query(`SELECT * FROM users WHERE id = $1`, [
    decoded.id,
  ]);

  //4) if the user doesnt exist throw an error
  if (userReult.rows.length === 0) {
    return new AppError(
      'The user belonging to this token does no longer exist!',
      401
    );
  }

  //5) assign the user
  const freshUser = userReult.rows[0];

  //6)get the password changed at for the user
  const passwordChangedAt = freshUser.password_changed_at;

  //7) get the time of issued token
  const tokenIssuedAt = new Date(decoded.iat * 1000);

  //8)check if the password changed
  if (passwordChangedAt && passwordChangedAt > tokenIssuedAt) {
    return next(
      new AppError(
        'User that belong to that token changed his password, please log in again!',
        401
      )
    );
  }
  //9)Grant access to the user
  req.user = freshUser;
  next();
});

//.........................................................................................................................................

/**
 Restrict to is used to secure private routes, so the user can't operate as an admin and vice versa 
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

//.........................................................................................................................................

/*
Forgot password is used by user so he can get a token sent to his email and he can use this token to reset his password
 */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user
  let queryResult;
  try {
    queryResult = await client.query(`SELECT * FROM users WHERE email = $1`, [
      req.body.email,
    ]);
    console.log('Query result:', queryResult);
  } catch (error) {
    console.error('Error executing query:', error);
    return next(new AppError('Database query error', 500));
  }

  const user = queryResult.rows[0];

  if (user.length === 0) {
    return next(new AppError('No user found with that email', 404));
  }

  const resetToken = createPassowrdResetToken();

  try {
    const password_reset_token = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    await client.query(
      `UPDATE users SET password_reset_token = $1, password_reset_token_expires = NOW() + INTERVAL '10 MINUTES' WHERE email = $2`,
      [password_reset_token, req.body.email]
    );
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Reset url sent to email!',
    });
  } catch (err) {
    return next(new AppError('Error sending the url', 401));
  }
});

//.........................................................................................................................................

/*
Reset password is used to get user based on token sent to his email and compare it with his (ResetPasswordToken) stored in db 
*/
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const query = await client.query(
    `SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_token_expires > NOW()`,
    [req.params.token]
  );

  const user = query.rows[0];
  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  if (!req.body.password || !req.body.password_confirm) {
    return next(
      new AppError(
        'Please make sure that you entered your passowrd and confirmed your password',
        401
      )
    );
  }
  if (req.body.password !== req.body.password_confirm) {
    return next(new AppError('Your passwords do not match', 401));
  }

  const password = await bcrypt.hash(req.body.password, 12);
  await client.query(
    `UPDATE users SET password = $1, password_reset_token = NULL, password_reset_token_expires = NULL, password_changed_at = NOW() WHERE password_reset_token = $2 `,
    [password, req.params.token]
  );

  // 3) Update changedPasswordAt property for the user

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

//.........................................................................................................................................

/**
 User can use this function to update his password
 */
exports.updateMyPassword = catchAsync(async (req, res, next) => {
  const query = await client.query(`SELECT * FROM users WHERE id = $1`, [
    req.user.id,
  ]);

  const user = query.rows[0];

  if (!(await comparePassword(req.body.currentPassword, user.password))) {
    return next(new AppError('You entered a wrong password, try again!', 400));
  }
  if (req.body.password_confirm !== req.body.newPassword) {
    return next(new AppError('Passwords are not the same', 401));
  }
  const hashedPassword = await bcrypt.hash(req.body.newPassword, 12);
  await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [
    hashedPassword,
    req.user.id,
  ]);
  createSendToken(user, 200, res);
});
