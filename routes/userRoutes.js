const express = require('express');
const authController = require('./../controllers/authController');
const userController = require('./../controllers/userController');

const router = express.Router();

router.post(
  '/signup',
  authController.signup,
  authController.updateLastLoggedInAndActive
);
router.post(
  '/login',
  authController.login,
  authController.updateLastLoggedInAndActive
);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

router.use(authController.protect);
router
  .route('/')
  .get(authController.restrictTo('admin'), userController.getAllUsers);

router
  .route('/updateMyPassword')
  .patch(authController.restrictTo('user'), authController.updateMyPassword);

router
  .route('/myAccount')
  .get(
    authController.restrictTo('user'),
    userController.getMe,
    userController.getUser
  )
  .patch(
    authController.restrictTo('user'),
    userController.checkDataInReqBody,
    userController.getMe,
    userController.updateMe
  )
  .delete(authController.restrictTo('user'), userController.deleteMe);
router
  .route('/:id')
  .get(authController.restrictTo('user'), userController.getUser)
  .patch(authController.restrictTo('user'), userController.updateUser)
  .delete(authController.restrictTo('user'), userController.deleteUser);

//.................................................................................

//User can control his profile from these routes

module.exports = router;
