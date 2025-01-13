const nodemailer = require('nodemailer');

const email = 'travelwithmefpl.work@gmail.com';
const password = 'ctdp cxpz slip vzvl';


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: email,
        pass: password
    },
    port: 587,
    secure: true
})

const handleSendEmail = async ({

    userEmail,
    subject,
    text
}) => {
    try {
        await transporter.sendMail({
            from: email,
            to: userEmail,
            subject,
            text,
        });
        console.log('Email sent successfully!');
    } catch (error) {
        console.error('Error sending email:', error.message);
        throw new Error(error);
    }
}
module.exports = { transporter, email, password, handleSendEmail }