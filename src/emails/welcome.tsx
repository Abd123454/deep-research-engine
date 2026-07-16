// Welcome email — sent on signup.
//
// Renders a clean, branded welcome message with a primary CTA pointing to
// the app. The subject function is attached as a static property on the
// component (see src/lib/email.ts → sendEmail).

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

export interface WelcomeEmailProps {
  name: string;
  /** Base URL of the running Quaesitor instance (e.g. https://quaesitor.example.com). */
  appUrl?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function WelcomeEmail({ name, appUrl = APP_URL }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Quaesitor — your self-hosted AI workstation.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Welcome to Quaesitor!</Heading>
          <Text style={text}>Hi {name || "there"},</Text>
          <Text style={text}>
            Your self-hosted AI workstation is ready. Quaesitor gives you deep
            research, agent swarms, code execution, vision, and voice — all
            under your control.
          </Text>
          <Text style={text}>Here’s what you can do next:</Text>
          <ul style={list}>
            <li style={listItem}>Run a deep research query and get a cited report.</li>
            <li style={listItem}>Upload documents and chat with them.</li>
            <li style={listItem}>Spin up an agent swarm for parallel tasks.</li>
          </ul>
          <Button style={button} href={appUrl}>
            Get Started
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Quaesitor · Self-hosted AI Workstation ·{" "}
            <Link style={footerLink} href={appUrl}>
              {appUrl}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeEmail.subject = ({ name }: WelcomeEmailProps) =>
  `Welcome to Quaesitor${name ? `, ${name}` : ""}!`;

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

const list = {
  color: "#1f2937",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
  paddingLeft: "20px",
};

const listItem = {
  marginBottom: "4px",
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

const footerLink = {
  color: "#6b7280",
  textDecoration: "underline",
};

export default WelcomeEmail;
