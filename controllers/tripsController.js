const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const client = require('../db');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const { now } = require('mongoose');

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

  await client.query(
    `UPDATE trips
   SET status = CASE
     WHEN CURRENT_DATE < start_date THEN 'Not started'
     WHEN CURRENT_DATE BETWEEN start_date AND end_date THEN 'Ongoing'
     WHEN CURRENT_DATE > end_date THEN 'Reservation ended'
     ELSE 'Unknown status'
   END`
  );
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
