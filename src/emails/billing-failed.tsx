// Billing-failed — sent when a recurring payment fails.
//
// Tells the customer their payment didn’t go through and links to the billing
// portal to update their payment method.

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

export interface BillingFailedEmailProps {
  name?: string;
  /** Human-readable plan name (e.g. "Pro"). */
  planName: string;
  /** Formatted amount with currency symbol, e.g. "$20.00". */
  amount: string;
  /** Short reason for the failure, e.g. "card_declined". */
  reason?: string;
  /** Number of retry attempts remaining before the subscription is cancelled. */
  retriesLeft?: number;
  /** Link to the customer billing portal to update payment method. */
  updatePaymentUrl?: string;
}

export function BillingFailedEmail({
  name,
  planName,
  amount,
  reason,
  retriesLeft,
  updatePaymentUrl,
}: BillingFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Action needed: your Quaesitor payment failed.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Payment failed</Heading>
          <Text style={text}>Hi {name || "there"},</Text>
          <Text style={text}>
            We tried to charge <strong style={strong}>{amount}</strong> for your{" "}
            <strong style={strong}>{planName}</strong> plan, but the payment was
            declined.
            {reason ? ` Reason: ${reason}.` : ""}
          </Text>
          {retriesLeft !== undefined ? (
            <Text style={text}>
              We’ll automatically retry{" "}
              {retriesLeft === 0
                ? "one more time"
                : `${retriesLeft} more time${retriesLeft === 1 ? "" : "s"}`}
              . Please update your payment method to avoid losing access.
            </Text>
          ) : (
            <Text style={text}>
              Please update your payment method to avoid losing access.
            </Text>
          )}
          {updatePaymentUrl ? (
            <Button style={button} href={updatePaymentUrl}>
              Update payment method
            </Button>
          ) : null}
          <Hr style={hr} />
          <Text style={footer}>
            Quaesitor · Self-hosted AI Workstation. Need help? Reply to this
            email.
            {updatePaymentUrl ? (
              <>
                {" "}
                ·{" "}
                <Link style={footerLink} href={updatePaymentUrl}>
                  Billing portal
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

BillingFailedEmail.subject = (_props: BillingFailedEmailProps) =>
  "Payment failed";

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
  color: "#dc2626",
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

const strong = {
  color: "#111827",
  fontWeight: 600,
};

const button = {
  backgroundColor: "#dc2626",
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

export default BillingFailedEmail;
