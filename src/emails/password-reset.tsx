// Password-reset — sent when a user requests a reset via /api/auth/forgot-password.
//
// Renders a reset link that points to the front-end reset page, which then
// POSTs the token + new password to /api/auth/reset-password.

import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Link,
} from "@react-email/components";

export interface PasswordResetEmailProps {
  name?: string;
  /** Full reset URL — typically `${appUrl}/reset-password?token=${token}`. */
  resetUrl: string;
}

export function PasswordResetEmail({ name, resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Quaesitor password.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>Hi {name || "there"},</Text>
          <Text style={text}>
            We received a request to reset the password for your Quaesitor
            account. This link expires in 1 hour.
          </Text>
          <Button style={button} href={resetUrl}>
            Reset password
          </Button>
          <Text style={muted}>
            Or paste this link into your browser:
            <br />
            <Link style={link} href={resetUrl}>
              {resetUrl}
            </Link>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn’t request a password reset, you can safely ignore this
            email — your password will not be changed.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

PasswordResetEmail.subject = (_props: PasswordResetEmailProps) =>
  "Reset your password";

const body = {
  backgroundColor: "#f4f5f7",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
};

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 40px",
  border: "1px solid #e5e7eb",
};

const h1 = {
  color: "#4f46e5",
  fontSize: "24px",
  fontWeight: 700,
  margin: "0 0 16px",
};

const text = {
  color: "#1f2937",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 12px",
};

const muted = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "16px 0 0",
};

const link = {
  color: "#4f46e5",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};

const button = {
  backgroundColor: "#4f46e5",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
};

export default PasswordResetEmail;
