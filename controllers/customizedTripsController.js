const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const client = require('./../db');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const { now } = require('mongoose');

exports.updateCusTripStatus = catchAsync(async (req, res, next) => {
  await client.query(
    `UPDATE customized_trips
   SET status = CASE
     WHEN CURRENT_DATE < start_date THEN 'Not started'
     WHEN CURRENT_DATE BETWEEN start_date AND end_date THEN 'Ongoing'
     WHEN CURRENT_DATE > end_date THEN 'Trip Ended'
     ELSE 'Unknown status'
   END
   WHERE id = $1`,
    [req.params.id]
  );
  next();
});

//*** --/api/v1/cus-trips/:id ---> get a customized trip by id*/
exports.getCusTrip = catchAsync(async (req, res, next) => {
  const query = await client.query(
    `SELECT customized_trips.id, 
            customized_trips.destination, 
            customized_trips.itinerary, 
            customized_trips.number_of_persons, 
            customized_trips.comment, 
            customized_trips.created_at, 
            customized_trips.trip_payment_status, 
            customized_trips.user_response, 
            customized_trips.admin_response, 
            customized_trips.start_date, 
            customized_trips.end_date, 
            users.first_name, 
            users.last_name, 
            users.email
     FROM customized_trips
     JOIN users ON customized_trips.user_id = users.id
     WHERE customized_trips.id = $1`,
    [req.params.id]
  );

  const result = query.rows[0];

  if (!result) {
    return next(new AppError('No customized trip found with that id', 404));
  }

  res.status(200).json({
    status: 'success',
    result,
  });
});

//****--get all available customized trips with status 'Pending'*/
exports.getAllCustTrips = catchAsync(async (req, res, next) => {
  const query = await client.query(
    `SELECT customized_trips.id, 
            customized_trips.destination, 
            customized_trips.itinerary, 
            customized_trips.number_of_persons, 
            customized_trips.comment, 
            customized_trips.created_at, 
            customized_trips.trip_payment_status, 
            customized_trips.user_response, 
            customized_trips.admin_response, 
            customized_trips.start_date, 
            customized_trips.end_date, 
            users.first_name, 
            users.last_name, 
            users.email
     FROM customized_trips
     JOIN users ON customized_trips.user_id = users.id
     WHERE customized_trips.status = 'Not started'`
  );

  const result = query.rows;

  if (result.length === 0) {
    return next(new AppError('No customized trips yet', 404));
  }

  res.status(200).json({
    status: 'success',
    result,
  });
});

//**** ---/api/v1/cus-trips  -----> it is used by (users to create customized trips) **/
exports.createCusTrip = catchAsync(async (req, res, next) => {
  //get the values from req.body
  const {
    destination,
    itinerary,
    number_of_persons,
    comment,
    start_date,
    end_date,
  } = req.body;

  //check if the user already applied for a customized trip
  const userQuery = await client.query(
    `SELECT user_id, status FROM customized_trips WHERE user_id = ${req.user.id}`
  );

  //assign the values
  const result = userQuery.rows;

  //check in result if there are any rows contain 'Pending'
  const hasPendingStatus = result.some((rows) => rows.status == 'Pending');

  //if it contains 'Pending' then thorw an error
  if (hasPendingStatus) {
    return next(
      new AppError(
        'You have already applied for a customized trip, please wait for admin response to apply for another trip',
        401
      )
    );
  }

  //insert into db
  const query = await client.query(
    `INSERT INTO customized_trips (destination, itinerary, number_of_persons, comment, created_at, user_id, start_date, end_date) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING destination, price, itinerary, number_of_persons,comment, created_at, status`,
    [
      destination,
      itinerary,
      number_of_persons,
      comment,
      now(),
      req.user.id,
      start_date,
      end_date,
    ]
  );

  //assign the values to cusTrip
  const cusTrip = query.rows[0];

  //if there any error creating the trip throw an error
  if (cusTrip.length === 0) {
    return next(
      new AppError(
        'There was a problem creating your customized trip, please try again later!',
        401
      )
    );
  }

  //respond to the user
  res.status(200).json({
    status: 'success',
    message:
      "Created your customized trip successfully, Please stay updated on the satus of your trip to stay informed of the admin's response.",
    cusTrip,
  });
});

//** ---api/v1/cus-trips/my-cus-trips ---> it is used by users to get his own cusomized trips */
exports.getMyCustTripsStatus = catchAsync(async (req, res, next) => {
  const query = await client.query(
    `SELECT status, destination, itinerary, price, start_date, end_date, trip_payment_status FROM customized_trips WHERE user_id = $1 `,
    [req.user.id]
  );

  const myCusTrips = query.rows;

  if (myCusTrips.length === 0) {
    return next(new AppError('You have no customized trips!', 404));
  }

  res.status(200).json({
    status: 'success',
    myCusTrips,
  });
});

// /api/v1/admin-response/:id
exports.adminResponse = catchAsync(async (req, res, next) => {
  const { price } = req.body;

  const query = await client.query(
    `SELECT * FROM customized_trips WHERE id = $1`,
    [req.params.id]
  );

  const trip = query.rows[0];
  if (!trip) {
    return next(new AppError('No trip with that id found', 404));
  }

  if (trip.admin_response == 'Responded') {
    return next(
      new AppError('You have already responded to that customized trip', 401)
    );
  }

  await client.query(
    `UPDATE customized_trips SET admin_response = $1 WHERE id = $2`,
    ['Responded', req.params.id]
  );

  await client.query(`UPDATE customized_trips SET price = $1 WHERE id = $2`, [
    price,
    req.params.id,
  ]);
  const userQuery = await client.query(
    `SELECT customized_trips.user_id, users.email, users.first_name
   FROM customized_trips 
   JOIN users ON customized_trips.user_id = users.id 
   WHERE customized_trips.id = $1`,
    [req.params.id]
  );

  //assign the value
  const user = userQuery.rows[0];

  await new Email(user, process.env.VODAFONE_CASH, price).sendCusTripPrice();
  res.status(200).json({
    status: 'success',
    message: 'Responded to the user successfully',
    price,
  });
});

// /api/v1/cus-trips/user-response/:id
exports.userResponse = catchAsync(async (req, res, next) => {
  const query = await client.query(
    `SELECT * FROM customized_trips WHERE id = $1`,
    [req.params.id]
  );

  const cusTrip = query.rows[0];

  if (cusTrip.status !== 'Not started') {
    return next(new AppError('The trip is either ongoing or finished', 401));
  }

  if (
    cusTrip.user_response == 'Rejected' ||
    cusTrip.user_response == 'Accepted' ||
    cusTrip.user_response == 'Rejected' ||
    cusTrip.user_response == 'Accepted'
  ) {
    return next(new AppError('You have already responded', 401));
  }

  const { response } = req.body;

  if (response == 'Reject' || response == 'reject') {
    await client.query(`DELETE FROM customized_trips WHERE id = $1`, [
      req.params.id,
    ]);

    return res.status(201).json({
      status: 'success',
      message: 'You have rejected the offer successfully',
    });
  }

  await client.query(
    `UPDATE customized_trips SET user_response = 'Accepted' WHERE id = $1`,
    [req.params.id]
  );

  next();
});

exports.cusTripUploadReceipts = factory.uploadReceipt('customized');

exports.getCusTripsReceipts = factory.getTripReceipts('customized');
