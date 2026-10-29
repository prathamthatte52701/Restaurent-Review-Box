import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/** In test mode every email is captured here so tests can read OTPs / reset links. */
export const outbox = [];

let transport;
const getTransport = () =>
  (transport ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  }));

/** Never throws. Without SMTP_HOST the whole email is logged to the console. */
export async function sendMail({ to, subject, text }) {
  if (env.isTest) outbox.push({ to, subject, text });
  if (!env.smtp.host) {
    if (!env.isTest) console.log(`\n[mail:console] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  try {
    await getTransport().sendMail({ from: env.smtp.from, to, subject, text });
    return true;
  } catch (err) {
    console.error(`[mail] failed to send "${subject}" to ${to}: ${err.message}`);
    return false;
  }
}

export const sendOtpMail = (user, code) =>
  sendMail({
    to: user.email,
    subject: 'Your Restaurant Review Box verification code',
    text: `Hi ${user.fullName},\n\nYour verification code is ${code}\nIt expires in 10 minutes.\n\nIf you did not sign up, ignore this email.`,
  });

export const sendResetMail = (user, token) => {
  const link = `${env.clientUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
  return sendMail({
    to: user.email,
    subject: 'Reset your Restaurant Review Box password',
    text: `Hi ${user.fullName},\n\nReset your password using this link (valid for 15 minutes, single use):\n${link}\n\nIf you did not request this, ignore this email.`,
  });
};
