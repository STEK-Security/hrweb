const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter object using Ethereal for testing
// In a real application, you'd use your actual SMTP server details or a service like SendGrid/Mailgun
const createTransporter = async () => {
  if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
    // Use Ethereal for development/testing if no SMTP_HOST is set
    try {
      let testAccount = await nodemailer.createTestAccount();
      console.log('Ethereal test account created:', testAccount.user, testAccount.pass);
      // It's good practice to log the preview URL when the transporter is created with Ethereal,
      // but getTestMessageUrl(info) is typically used after an email is sent.
      // For now, we'll just log that an Ethereal account is being used.
      console.log('Ethereal account will be used for sending emails. Preview URLs will appear after emails are sent.');
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
    } catch (error) {
      console.error('Failed to create Ethereal test account. Falling back to console log for emails.', error);
      // Fallback transporter that logs to console if Ethereal fails
      return {
        sendMail: async (mailOptions) => {
          console.log('Fallback: Email would be sent with options:', mailOptions);
          return { messageId: `fallback-${Date.now()}` };
        }
      };
    }
  } else {
    // Use real SMTP settings from .env for production/staging
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
};

let transporter; // Hold the transporter instance

// Initialize transporter and export a promise that resolves when it's ready
const transporterPromise = createTransporter().then(createdTransporter => {
    transporter = createdTransporter;
    if (transporter.options && transporter.options.host === 'smtp.ethereal.email') {
        console.log('Nodemailer Ethereal transporter initialized.');
    } else if (transporter.sendMail.name === 'sendMail') { // Check if it's our fallback
        console.log('Nodemailer fallback (console log) transporter initialized.');
    }
    else {
        console.log('Nodemailer SMTP transporter initialized with host:', process.env.SMTP_HOST);
    }
    return transporter;
}).catch(error => {
    console.error('Failed to initialize email transporter:', error);
    // Provide a fallback transporter on critical failure to prevent app crash on sendEmail call
    transporter = {
        sendMail: async (mailOptions) => {
          console.error('Critical Fallback: Email transporter failed to initialize. Email not sent.');
          console.log('Critical Fallback: Email would have been sent with options:', mailOptions);
          return { messageId: `critical-fallback-${Date.now()}` };
        }
      };
    return transporter;
});


const sendEmail = async (to, subject, html) => {
  // Ensure transporter is initialized
  if (!transporter) {
    // This might happen if sendEmail is called before transporterPromise resolves.
    // Awaiting the promise ensures we use the initialized transporter.
    try {
        await transporterPromise;
    } catch (error) {
        // If transporterPromise itself rejected and led to the critical fallback,
        // 'transporter' would be the critical fallback transporter.
        // This path should ideally not be hit if initialization logic is sound.
        console.error('Attempted to send email before transporter was ready, and initialization failed:', error);
        throw new Error('Email transporter could not be initialized.');
    }
  }

  // Additional check in case the promise resolved but transporter is still not set (defensive)
  if (!transporter || typeof transporter.sendMail !== 'function') {
    console.error('Transporter is not correctly initialized or is missing sendMail function.');
    throw new Error('Email transporter is not functional.');
  }

  try {
    const info = await transporter.sendMail({
      from: `"Performance Review System" <${process.env.EMAIL_FROM || 'noreply@example.com'}>`, // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      html: html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    // Preview only available when sending through an Ethereal account
    if (transporter.options && transporter.options.host === 'smtp.ethereal.email') {
         console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = { sendEmail, transporterPromise };
