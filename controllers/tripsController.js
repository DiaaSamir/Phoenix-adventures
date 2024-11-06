const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const client = require('../db');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const cloudinary = require('./../utils/cloudinary');
const upload = require('./../utils/multer');
const { Readable } = require('stream');
const { default: axios } = require('axios');

exports.uploadTripImages = catchAsync(async (req, res, next) => {
  // Handle single and multiple file uploads with multer
  upload.fields([
    { name: 'image-cover', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ])(req, res, async (err) => {
    if (err) {
      return next(new AppError(`Upload Error: ${err.message}`, 400));
    }

    // Check if image cover was uploaded
    if (!req.files['image-cover']) {
      return next(new AppError('No image cover uploaded', 400));
    }

    // Handle uploading `image-cover` to Cloudinary
    const coverFile = req.files['image-cover'][0];
    const coverStream = new Readable();
    coverStream.push(coverFile.buffer);
    coverStream.push(null);

    const coverResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (error, result) => {
          if (error)
            reject(new AppError(`Cloudinary Error: ${error.message}`, 500));
          else resolve(result);
        }
      );
      coverStream.pipe(uploadStream);
    });

    // Update the `image_cover` field in the database
    await client.query(`UPDATE trips SET image_cover = $1 WHERE id = $2`, [
      coverResult.secure_url,
      req.params.id,
    ]);

    // Check if additional images were uploaded
    const imageUrls = [];
    if (req.files['images']) {
      for (const file of req.files['images']) {
        const stream = new Readable();
        stream.push(file.buffer);
        stream.push(null);

        // Upload each image to Cloudinary
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'image' },
            (error, result) => {
              if (error)
                reject(new AppError(`Cloudinary Error: ${error.message}`, 500));
              else resolve(result);
            }
          );
          stream.pipe(uploadStream);
        });

        imageUrls.push(result.secure_url);
      }

      // Update the `images` field in the database
      await client.query(
        `UPDATE trips SET images = $1 WHERE id = $2 RETURNING *`,
        [imageUrls, req.params.id]
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Uploaded trip images successfully',
      imageCover: coverResult.secure_url,
      images: imageUrls,
    });
  });
});

exports.updateTripStatus = catchAsync(async (req, res, next) => {
  await client.query(
    `UPDATE trips
   SET status = CASE
     WHEN CURRENT_DATE < start_date THEN 'Not started'
     WHEN CURRENT_DATE BETWEEN start_date AND end_date THEN 'Ongoing'
     WHEN CURRENT_DATE > end_date THEN 'Reservation ended'
     ELSE 'Unknown status'
   END
   WHERE id = $1`,
    [req.params.id]
  );
  next();
});

exports.getAllTrips = factory.getAll('trips');

exports.getTrip = factory.getOne('trips');
exports.deleteTrip = factory.deleteOne('trips');

exports.updateone = factory.updateOne('trips');

exports.createTrip = catchAsync(async (req, res, next) => {
  const {
    name,
    price,
    features,
    availability,
    itinerary,
    destination,
    vehicle_type,
    max_seats,
    status,
    start_date,
    end_date,
    start_time,
  } = req.body;
  const query = await client.query(
    `INSERT INTO trips (name, price, features, availability, itinerary, destination, vehicle_type, max_seats, status, start_date, end_date, start_time) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [
      name,
      price,
      features,
      availability,
      itinerary,
      destination,
      vehicle_type,
      max_seats,
      status,
      start_date,
      end_date,
      start_time,
    ]
  );

  const trips = query.rows[0];

  if (!trips) {
    return next(
      new AppError('Error creating trip, please try again later!', 401)
    );
  }

  res.status(200).json({
    status: 'success',
    message: 'Created your trip successfully',
    data: trips,
  });
});

exports.updateTrip = factory.updateOne('trips');

exports.deleteTrip = factory.deleteOne('trips');

exports.applyForTrip = catchAsync(async (req, res, next) => {
  const query = await client.query(`SELECT * FROM trips WHERE id = $1`, [
    req.params.id,
  ]);

  const trip = query.rows[0];

  console.log(trip);
  if (!trip) {
    return next(new AppError('No trip found with that id', 404));
  }

  if (trip.status !== 'Not started') {
    return next(
      new AppError(
        'You cant apply for this trip, please try another trip!',
        400
      )
    );
  }
  const userQuery = await client.query(
    `SELECT * FROM users WHERE trip_id = $1 AND id = $2`,
    [req.params.id, req.user.id]
  );

  if (userQuery.rows.length > 0) {
    return next(new AppError('You have already applied for that trip', 401));
  }

  const user = req.user;
  await client.query(`UPDATE users SET trip_id = $1 WHERE id = $2`, [
    req.params.id,
    req.user.id,
  ]);

  console.log(user.email, process.env.VODAFONE_CASH, trip.price);
  await new Email(
    user,
    process.env.VODAFONE_CASH,
    trip.price
  ).completeReservation();

  res.status(200).json({
    status: 'success',
    message:
      'You have successfully applied for the trip, please check your email to complete your reservation!',
  });
});

exports.getTripReceipts = factory.getTripReceipts('normal');

exports.tripReceiptUpload = factory.uploadReceipt('normal');
