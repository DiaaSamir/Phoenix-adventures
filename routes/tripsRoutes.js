const express = require('express');

const tripsController = require('./../controllers/tripsController');
const authController = require('./../controllers/authController');

const router = express.Router();

router.use(authController.protect);
router
  .route('/')
  .get(
    authController.restrictTo('admin', 'user'),
    tripsController.updateTripStatus,
    tripsController.getAllTrips
  )
  .post(
    authController.restrictTo('admin'),
    tripsController.createTrip,
    tripsController.updateTripStatus
  );

router
  .route('/receipts/:id')
  .get(authController.restrictTo('admin'), tripsController.getTripReceipts)
  .post(authController.restrictTo('user'), tripsController.tripReceiptUpload);

router
  .route('/images-upload/:id')
  .post(
    authController.restrictTo('admin'),
    tripsController.uploadTripImages
  );
router
  .route('/:id')
  .patch(authController.restrictTo('admin'), tripsController.updateTrip)
  .get(
    authController.restrictTo('admin', 'user'),
    tripsController.updateTripStatus,
    tripsController.getTrip
  )
  .delete(authController.restrictTo('admin'), tripsController.deleteTrip)
  .post(
    authController.restrictTo('user'),
    tripsController.updateTripStatus,
    tripsController.applyForTrip
  );

module.exports = router;
