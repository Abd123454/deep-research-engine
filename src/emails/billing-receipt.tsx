// Billing-receipt — sent after a successful payment.
//
// Renders a simple invoice/receipt with line items, totals, and a link to
// download the full invoice from the billing portal.

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
  Section,
  Row,
  Column,
} from "@react-email/components";

export interface BillingReceiptEmailProps {
  name?: string;
  /** Human-readable plan name (e.g. "Pro"). */
  planName: string;
  /** Formatted amount with currency symbol, e.g. "$20.00". */
  amount: string;
  /** ISO date the payment was collected, e.g. "2024-05-12". */
  paidAt: string;
  /** Last 4 digits of the card used, e.g. "4242". */
  last4?: string;
  /** Unique receipt/invoice ID. */
  receiptId: string;
  /** Optional link to the customer billing portal. */
  invoiceUrl?: string;
}

export function BillingReceiptEmail({
  name,
  planName,
  amount,
  paidAt,
  last4,
  receiptId,
  invoiceUrl,
}: BillingReceiptEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Payment receipt — Quaesitor {planName}.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Payment receipt</Heading>
          <Text style={text}>Hi {name || "there"},</Text>
          <Text style={text}>
            Your payment for the <strong style={strong}>{planName}</strong> plan
            was successful. Thanks for being a Quaesitor customer!
          </Text>

          <Section style={{ marginTop: "16px" }}>
            <Row style={row}>
              <Column style={labelCol}>Receipt ID</Column>
              <Column style={valueCol}>{receiptId}</Column>
            </Row>
            <Row style={row}>
              <Column style={labelCol}>Date</Column>
              <Column style={valueCol}>{paidAt}</Column>
            </Row>
            <Row style={row}>
              <Column style={labelCol}>Plan</Column>
              <Column style={valueCol}>{planName}</Column>
            </Row>
            {last4 ? (
              <Row style={row}>
                <Column style={labelCol}>Card</Column>
                <Column style={valueCol}>•••• {last4}</Column>
              </Row>
            ) : null}
            <Row style={totalRow}>
              <Column style={totalLabel}>Total paid</Column>
              <Column style={totalValue}>{amount}</Column>
            </Row>
          </Section>

          {invoiceUrl ? (
            <Button style={button} href={invoiceUrl}>
              View invoice
            </Button>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>
            Quaesitor · Self-hosted AI Workstation. Need help? Reply to this
            email.
            {invoiceUrl ? (
              <>
                {" "}
                ·{" "}
                <Link style={footerLink} href={invoiceUrl}>
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

BillingReceiptEmail.subject = (_props: BillingReceiptEmailProps) =>
  "Payment receipt";

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

const strong = {
  color: "#111827",
  fontWeight: 600,
};

const row = {
  borderBottom: "1px solid #f3f4f6",
  padding: "8px 0",
};

const labelCol = {
  color: "#6b7280",
  fontSize: "13px",
  width: "40%",
};

const valueCol = {
  color: "#1f2937",
  fontSize: "14px",
  fontWeight: 500,
};

const totalRow = {
  padding: "12px 0 4px",
};

const totalLabel = {
  color: "#111827",
  fontSize: "15px",
  fontWeight: 700,
};

const totalValue = {
  color: "#4f46e5",
  fontSize: "15px",
  fontWeight: 700,
};

const button = {
  backgroundColor: "#4f46e5",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  marginTop: "16px",
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

export default BillingReceiptEmail;
