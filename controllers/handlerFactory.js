const catchAsync = require('./../utils/catchAsync');
const client = require('./../db');
const AppError = require('./../utils/appError');
const multer = require('multer');
const { Readable } = require('stream'); // Import Readable from stream module
const { now } = require('mongoose');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const cloudinary = require('./../utils/cloudinary');
const upload = require('./../utils/multer');

exports.getAll = (modelName) =>
  catchAsync(async (req, res, next) => {
    //1)Get all (modelName) provided
    const query = await client.query(
      `SELECT * FROM ${modelName} ORDER BY id ASC`
    );

    //2)assign the results
    const results = query.rows;

    //3)if no results then throw an error
    if (results.length === 0) {
      return next(new AppError(`No ${modelName} found!`, 401));
    }

    //4) Respond to the user
    res.status(200).json({
      status: 'success',
      resultsLength: results.length,
      results,
    });
  });

exports.getOne = (modelName) =>
  catchAsync(async (req, res, next) => {
    const query = await client.query(
      `SELECT * FROM ${modelName} WHERE id = $1`,
      [req.params.id]
    );

    const result = query.rows[0];

    if (!result) {
      return next(new AppError(`No ${modelName} found with that id`, 404));
    }

    res.status(200).json({
      status: 'success',
      message: `Found your ${modelName} successfully`,
      data: result,
    });
  });

exports.updateOne = (modelName) =>
  catchAsync(async (req, res, next) => {
    if (req.body.password || req.body.password_confirm) {
      return next(new AppError("You can't update your password here", 401));
    }
    let updates = req.body;
    let updatedColumns = [];
    let values = [];

    Object.keys(updates).forEach((key, index) => {
      updatedColumns.push(`${key} = $${index + 1}`);
      values.push(updates[key]);
    });

    // Join the update columns to form the SET part of the query
    const setClause = updatedColumns.join(', ');

    // Build the complete SQL query
    const query = `
      UPDATE ${modelName}
      SET ${setClause}
      WHERE id = $${values.length + 1} 
      RETURNING *
    `;

    // Add the ID to the values array
    values.push(req.params.id);

    const result = await client.query(query, values);

    // Check if any rows were updated
    const doc = result.rows[0];
    if (!doc) {
      return next(new AppError(`${modelName} not found with that id!`, 404));
    }
    res.status(201).json({
      status: 'success',
      message: `Updated your ${modelName} successfully`,
      doc,
    });
  });

exports.deleteOne = (modelName) =>
  catchAsync(async (req, res, next) => {
    const query = await client.query(`DELETE FROM ${modelName} WHERE id = $1`, [
      req.params.id,
    ]);

    const deletedDoc = query.rowCount;

    if (deletedDoc === 0) {
      return next(new AppError(`No ${modelName} found with that id!`, 401));
    }

    res.status(200).json({
      status: 'success',
      message: `Deleted your ${modelName} successfuly`,
    });
  });

//*************************-PAYMENT FUNCTIONS-********************************************** */
exports.uploadReceipt = (trip_type) =>
  catchAsync(async (req, res, next) => {
    // Handle the file upload with multer
    upload.single('image')(req, res, async (err) => {
      if (err) {
        return next(new AppError(`Upload Error: ${err.message}`, 400));
      }

      // Check if a file was uploaded
      if (!req.file) {
        return next(new AppError('No file uploaded', 400));
      }

      let tripType;
      trip_type === 'normal'
        ? (tripType = 'normal')
        : (tripType = 'customized');

      // Create a readable stream from the file buffer
      const stream = new Readable();
      stream.push(req.file.buffer);
      stream.push(null); // Signal end of stream

      // Upload to Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
        },
        async (error, result) => {
          if (error) {
            return next(
              new AppError(`Cloudinary Error: ${error.message}`, 500)
            );
          }

          // Now you can use result.secure_url here
          let message;

          // Handle the database insertion based on trip type
          if (tripType === 'normal') {
            await client.query(
              `INSERT INTO payment_receipt (user_id, trip_id, image, created_at, trip_type) VALUES($1, $2, $3, $4, $5)`,
              [
                req.user.id,
                req.params.id,
                result.secure_url,
                new Date(),
                tripType,
              ] // Use new Date() for the timestamp
            );
            message = 'You have uploaded your receipt successfully';
          } else {
            const query = await client.query(
              `SELECT * FROM customized_trips WHERE id = $1`,
              [req.params.id]
            );

            const trip = query.rows[0];

            if (trip.trip_payment_status === 'Paid') {
              return next(
                new AppError('You have already uploaded your receipt', 401)
              );
            }

            await client.query(
              `INSERT INTO payment_receipt (user_id, cus_trip_id, image, created_at, trip_type) VALUES($1, $2, $3, $4, $5)`,
              [
                req.user.id,
                req.params.id,
                result.secure_url,
                new Date(),
                tripType,
              ]
            );

            await client.query(
              `UPDATE customized_trips SET trip_payment_status = $1 WHERE user_id = $2 AND trip_payment_status = $3 AND id = $4`,
              ['Paid', req.user.id, 'Pending', req.params.id]
            );

            message =
              'Your receipt has been uploaded successfully! An admin will review it soon and reach out to you with further updates.';
          }

          // Send the response after successful upload
          res.status(200).json({
            status: 'success',
            message,
            data: {
              url: result.secure_url,
            },
          });
        }
      );

      // Pipe the stream to Cloudinary
      stream.pipe(uploadStream);
    });
  });

exports.getTripReceipts = (trip_type) =>
  catchAsync(async (req, res, next) => {
    let tripType;
    let query;

    if (trip_type === 'normal') {
      tripType = 'normal';
      query = await client.query(
        `SELECT 
          payment_receipt.image, 
          users.first_name AS user_fname,
          users.last_name AS user_lname,
          users.email
         FROM payment_receipt 
         JOIN users ON payment_receipt.user_id = users.id 
         WHERE payment_receipt.trip_id = $1 AND trip_type = $2`,
        [req.params.id, tripType]
      );
    } else {
      tripType = 'customized';
      query = await client.query(
        `SELECT 
          payment_receipt.image, 
          users.first_name AS user_fname,
          users.last_name AS user_lname,
          users.email
         FROM payment_receipt 
         JOIN users ON payment_receipt.user_id = users.id 
         WHERE payment_receipt.cus_trip_id = $1 AND trip_type = $2`,
        [req.params.id, tripType]
      );
    }

    const receipts = query.rows;

    if (receipts.length === 0) {
      return next(new AppError('No receipts for this trip yet', 404));
    }

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });
    const fileName = `trip_receipts_${req.params.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    for (const receipt of receipts) {
      if (receipts.indexOf(receipt) !== 0) doc.addPage();

      // Header section
      doc
        .fillColor('#2B547E')
        .fontSize(22)
        .text('Trip Receipts', { align: 'center', underline: true });
      doc.moveDown(1.5);

      // User information with background box for clarity
      doc
        .rect(50, doc.y, 500, 50)
        .fill('#E8F8F5')
        .fillColor('#1F618D')
        .fontSize(14)
        .text(
          `User: ${receipt.user_fname} ${receipt.user_lname}`,
          60,
          doc.y + 10,
          { continued: true }
        )
        .text(`| Email: ${receipt.email}`, { align: 'right' });
      doc.moveDown(1.5);

      // Draw a separating line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#AED6F1').stroke();
      doc.moveDown(1);

      // Download and add the image from Cloudinary
      try {
        const response = await axios.get(receipt.image, {
          responseType: 'arraybuffer',
        });

        doc.image(Buffer.from(response.data), {
          fit: [450, 300],
          align: 'center',
          valign: 'center',
          x: 70,
          y: doc.y,
        });
        doc.moveDown(1.5);
      } catch (error) {
        console.error(`Error downloading image: ${error.message}`);
        doc
          .fillColor('red')
          .fontSize(12)
          .text('Image could not be loaded.', { align: 'center' });
        doc.moveDown(1.5);
      }
    }

    // Finalize the PDF and end the stream
    doc.end();
  });
