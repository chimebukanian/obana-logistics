const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const validator = require('validator');

// async..await is not allowed in global scope, must use a wrapper
const sendMail = async (payload) => {
  // Normalize payload keys
  const email = payload.email
  const content = payload.content ?? payload.contents ?? payload.text ?? payload.body ?? ''
  const template = payload.template
  const subject = payload.subject ?? 'Notification from Obana'

  const mailValidated = validator.isEmail(email)
  if (!mailValidated) {
    console.warn('nodemailer: invalid email', email)
    return { success: false, error: 'invalid_email' }
  }

  // Generate test SMTP service account from ethereal.email
  // Only needed if you don't have a real mail account for testing
  let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    //Service should be removed if you are using the SMTP settings
    // service: "gmail",
    // host: "smtp.ethereal.email",
    host: "smtppro.zoho.com",
    port: 465,
    secure: true,
    //secure: false, // true for 465, false for other ports
    auth: {
      //user: testAccount.user, // generated ethereal user
      //pass: testAccount.pass, // generated ethereal password
      user: process.env.EMAIL_SENDER_USER, // generated ethereal user
      pass: process.env.EMAIL_SENDER_PASSWORD, // generated ethereal password
    },
  });

  // Configure handlebars plugin
  const hbsOptions = {
    viewEngine: {
      layoutsDir: 'views',
      defaultLayout: false
    },
    viewPath: 'src/mailer/views'
  }
  transporter.use('compile', hbs(hbsOptions))
  // send mail with defined transport object

  const plainMailOption = {
    from: `"Obana Africa " <${process.env.EMAIL_SENDER_USER}>`,
    to: `${email}`,
    subject: `${subject}`,
    text: typeof content === 'string' ? content : JSON.stringify(content),
    html: `<div>${typeof content === 'string' ? content : JSON.stringify(content)}</div>`,
  }

  const templateMailOption = {
    from: `"Obana Africa " <${process.env.EMAIL_SENDER_USER}>`,
    to: `${email}`,
    subject: `${subject}`,
    template: template,
    context: {
      ...(typeof content === 'object' ? content : { message: content })
    }
  }
  try {
    let info = await transporter.sendMail(templateMailOption);

    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
  } catch (e) {
    console.log(e)
  }


}

module.exports = {
  sendMail,
}