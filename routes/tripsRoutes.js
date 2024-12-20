const express = require('express');

const tripsController = require('./../controllers/tripsController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(tripsController.updateTripStatus, tripsController.getAllTrips)
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    tripsController.createTrip,
    tripsController.updateTripStatus
  );

router
  .route('/receipts/:id')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    tripsController.getTripReceipts
  )
  .post(
    authController.protect,
    authController.restrictTo('user'),
    tripsController.tripReceiptUpload
  );

router
  .route('/images-upload/:id')
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    tripsController.uploadTripImages
  );
router
  .route('/:id')
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    tripsController.updateTrip
  )
  .get(
    authController.protect,
    authController.restrictTo('admin', 'user'),
    tripsController.updateTripStatus,
    tripsController.getTrip
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    tripsController.deleteTrip
  )
  .post(
    authController.protect,
    authController.restrictTo('user'),
    tripsController.updateTripStatus,
    tripsController.applyForTrip
  );

module.exports = router;
