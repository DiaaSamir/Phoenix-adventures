const multer = require('multer');
const sharp = require('sharp');
const AppError = require('./../utils/appError');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handlerFactory');
const client = require('../db');
const { json } = require('stream/consumers');

//Pictures upload
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

//this is used as a middelware to not let the user update his password in routes like update first name or last name etc..
exports.checkDataInReqBody = catchAsync(async (req, res, next) => {
  //DO NOT let the user update his password here
  if (req.body.password || req.body.password_confirm || req.body.role) {
    return next(
      new AppError(
        'You are not allowed to update your password or any sensitive here',
        400
      )
    );
  }
  next();
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

//...........................................................................................

//These functions is for admins only
exports.getAllUsers = factory.getAll('users');

exports.getUser = factory.getOne('users');

exports.deleteUser = factory.deleteOne('users');
exports.updateUser = factory.updateOne('users');

//............................................................................................................................

//Operations for the user

exports.updateMe = catchAsync(async (req, res, next) => {
  const { first_name, last_name, email } = req.body;
  const query = await client.query(
    `UPDATE users 
     SET first_name = COALESCE($1, first_name), 
         last_name = COALESCE($2, last_name), 
         email = COALESCE($3, email) 
     WHERE id = $4 
     RETURNING first_name, last_name, email`,
    [first_name, last_name, email, req.user.id]
  );

  const updatedUser = query.rows[0];

  if (!updatedUser || updatedUser.length === 0) {
    return next(new AppError('User not found!', 404));
  }
  res.status(200).json({
    status: 'success',
    message: 'Updated Successfully',
    updatedUser,
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  //Find the user
  const query = await client.query(
    `UPDATE users SET active = $1 WHERE id = $2`,
    [false, req.user.id]
  );

  const user = query.rows[0];

  //check if user not found
  if (!user || user.length === 0) {
    return next(new AppError('User not found', 404));
  }

  //Send the response
  res.status(200).json({
    status: 'success',
    message:
      'Your account has been deactivated successfully, it will be deleted after 30 days',
  });
});

//Middleware to get the user
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};
