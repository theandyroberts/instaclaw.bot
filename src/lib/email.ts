import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "InstaClaw <noreply@instaclaw.bot>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Email send error:", error);
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export function welcomeEmail(name: string) {
  return {
    subject: "Welcome to InstaClaw!",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Welcome to InstaClaw!</h1>
        <p>Hi ${name || "there"},</p>
        <p>Thanks for signing up! You're one step away from having your own personal AI assistant on Telegram.</p>
        <p>Here's what happens next:</p>
        <ol>
          <li>Choose your plan (Starter or Pro)</li>
          <li>We'll set up your dedicated server (takes ~3 minutes)</li>
          <li>Create a Telegram bot via @BotFather</li>
          <li>Start chatting with your AI assistant!</li>
        </ol>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a></p>
        <p>Questions? Just reply to this email.</p>
        <p>-- The InstaClaw Team</p>
      </div>
    `,
  };
}

export function instanceReadyEmail(botUsername: string) {
  return {
    subject: "Your AI Assistant is Live!",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Your AI Assistant is Ready!</h1>
        <p>Great news! Your personal AI assistant is now live on Telegram.</p>
        <p><a href="https://t.me/${botUsername}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Chat with @${botUsername}</a></p>
        <p>Just open Telegram and start chatting. Your AI assistant can help with:</p>
        <ul>
          <li>Research and questions</li>
          <li>Writing and editing</li>
          <li>Coding assistance</li>
          <li>Web browsing</li>
          <li>And much more!</li>
        </ul>
        <p>-- The InstaClaw Team</p>
      </div>
    `,
  };
}

export function instanceSuspendedEmail(name: string) {
  return {
    subject: "Your InstaClaw Instance Has Been Suspended",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444;">Instance Suspended</h1>
        <p>Hi ${name || "there"},</p>
        <p>Your AI assistant has been suspended due to a payment issue. Your Telegram bot will not respond until the issue is resolved.</p>
        <p>To reactivate your assistant, please update your payment method:</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment</a></p>
        <p>Your data is safe -- we'll keep your configuration for 30 days.</p>
        <p>-- The InstaClaw Team</p>
      </div>
    `,
  };
}

export function adminAlertEmail(subject: string, message: string) {
  return {
    subject: `[InstaClaw Admin] ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444;">Admin Alert</h1>
        <p>${message}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open Admin Panel</a></p>
      </div>
    `,
  };
}
