// Research-complete — sent when a deep research job finishes.
//
// Renders a summary of the completed research with a link back to the report.

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

export interface ResearchCompleteEmailProps {
  name?: string;
  /** The original research query. */
  query: string;
  /** Direct URL to view the finished report. */
  reportUrl: string;
  /** Optional summary of the report (plain text). */
  summary?: string;
  /** Optional count of sources cited. */
  sourceCount?: number;
  /** Optional duration string, e.g. "2m 14s". */
  duration?: string;
}

export function ResearchCompleteEmail({
  name,
  query,
  reportUrl,
  summary,
  sourceCount,
  duration,
}: ResearchCompleteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your research on “{query}” is ready.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Your research is ready</Heading>
          <Text style={text}>Hi {name || "there"},</Text>
          <Text style={text}>
            Your deep research on{" "}
            <strong style={strong}>&ldquo;{query}&rdquo;</strong> is complete.
            {duration ? ` It took ${duration}.` : ""}
            {sourceCount !== undefined
              ? ` ${sourceCount} source${sourceCount === 1 ? "" : "s"} cited.`
              : ""}
          </Text>
          {summary ? (
            <Text style={mutedBox}>{summary}</Text>
          ) : null}
          <Button style={button} href={reportUrl}>
            View report
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Quaesitor ·{" "}
            <Link style={footerLink} href={reportUrl}>
              {reportUrl}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

ResearchCompleteEmail.subject = (_props: ResearchCompleteEmailProps) =>
  "Your research is ready";

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

const mutedBox = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 16px",
  padding: "12px 14px",
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
  wordBreak: "break-all" as const,
};

export default ResearchCompleteEmail;
