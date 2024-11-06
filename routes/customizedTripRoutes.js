const express = require('express');

const authController = require('../controllers/authController');
const factory = require('./../controllers/handlerFactory');
const customizedTripsController = require('../controllers/customizedTripsController');

const router = express.Router();

router.use(authController.protect);

router
  .route('/my-cust-trips')
  .get(
    authController.restrictTo('user'),
    customizedTripsController.getMyCustTripsStatus
  );

router
  .route('/')
  .get(
    authController.restrictTo('admin'),
    customizedTripsController.updateCusTripStatus,
    customizedTripsController.getAllCustTrips
  )
  .post(
    authController.restrictTo('user'),
    customizedTripsController.createCusTrip
  );

router
  .route('/receipts/:id')
  .get(
    authController.restrictTo('admin'),
    customizedTripsController.getCusTripsReceipts
  );

router
  .route('/:id')
  .get(
    customizedTripsController.updateCusTripStatus,
    customizedTripsController.getCusTrip
  );

router
  .route('/user-response/:id')
  .post(
    authController.restrictTo('user'),
    customizedTripsController.updateCusTripStatus,
    customizedTripsController.userResponse,
    customizedTripsController.cusTripUploadReceipts
  );

router
  .route('/admin-response/:id')
  .post(
    authController.restrictTo('admin'),
    customizedTripsController.updateCusTripStatus,
    customizedTripsController.adminResponse
  );

module.exports = router;
