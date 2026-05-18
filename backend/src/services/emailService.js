const nodemailer = require('nodemailer');

let transporter = null;

function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isConfigured()) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

function getRecipientEmail(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.email || null;
}

async function sendMail({ to, subject, text }) {
  const recipient = getRecipientEmail(to);
  const activeTransporter = getTransporter();

  if (!recipient || !activeTransporter) {
    return { skipped: true };
  }

  return activeTransporter.sendMail({
    from: `"RE-VALUE" <${process.env.SMTP_USER}>`,
    to: recipient,
    subject,
    text,
  });
}

function sendWelcome(user) {
  const nome = user?.nome || 'utente';
  return sendMail({
    to: user,
    subject: 'Benvenuto su RE-VALUE',
    text: `Ciao ${nome}, benvenuto su RE-VALUE. Il tuo account e' stato creato correttamente.`,
  });
}

function sendBookingConfirmation(booking) {
  const annuncio = booking?.annuncio?.titolo || 'oggetto prenotato';
  return sendMail({
    to: booking?.acquirente,
    subject: 'Prenotazione confermata su RE-VALUE',
    text: `La tua prenotazione per "${annuncio}" e' stata confermata.`,
  });
}

function sendSwapCompleted(user, points) {
  return sendMail({
    to: user,
    subject: 'Scambio completato su RE-VALUE',
    text: `Scambio completato. Hai ricevuto ${points} crediti sul tuo wallet RE-VALUE.`,
  });
}

module.exports = {
  sendWelcome,
  sendBookingConfirmation,
  sendSwapCompleted,
};
