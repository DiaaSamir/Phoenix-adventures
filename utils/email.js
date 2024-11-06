const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, vodafoneCash, value, reason, resetURL) {
    this.to = user.email;
    this.firstName = user.first_name;
    this.vodafoneCash = vodafoneCash;
    this.value = value;
    this.reason = reason;
    this.from = `Phoenix Adventures<${process.env.EMAIL_FROM}>`;
    this.url = resetURL;
  }

  newTransport() {
    // Brevo code
    return nodemailer.createTransport({
      host: process.env.BREVO_HOST,
      port: process.env.BREVO_PORT,
      auth: {
        user: process.env.BREVO_USERNAME,
        pass: process.env.BREVO_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      vodafoneCash: this.vodafoneCash,
      value: this.value,
      url: this.url,
      reason: this.reason,
      subject,
    });

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject: subject,
      html,
      text: htmlToText.convert(html),
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the family!');
  }
  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset link!(Valid for 10 minutes)'
    );
  }
  async completeReservation() {
    await this.send('Payment', 'Please complete your reservation');
  }
  async sendCusTripAccept() {
    await this.send('cusTripAccept', 'Your customized trip has been accepted!');
  }
  async sendCusTripReject() {
    await this.send('cusTripReject', 'Your customized trip has been rejected!');
  }
  async sendCusTripPrice() {
    await this.send('sendCusTripPrice', 'Your customized trip pricing!');
  }
};
