// Document Q&A — uses NVIDIA LLM to answer questions about document text.
//
// Three modes:
//   qa         — answer a specific question with citations [page N] / [para N]
//   summarize  — generate a summary
//   questions  — suggest 3 follow-up questions
//
// Streaming via SSE (same pattern as /api/modes/quick). Tokens are
// estimated via the trackLLMTokens pattern in research-engine.ts.

import { getLLM, type LLMMessage } from "./llm-provider";

export type QAMode = "qa" | "summarize" | "questions";

export interface QARequest {
  question: string;
  mode: QAMode;
}

export interface QAResult {
  content: string;
  tokensUsed?: number;
}

const MAX_QUESTION_CHARS = 2000;
const MAX_CONTEXT_CHARS = 50_000; // cap document text sent to LLM

function buildMessages(
  docText: string,
  req: QARequest
): { messages: LLMMessage[]; maxTokens: number; json: boolean } {
  const context = docText.slice(0, MAX_CONTEXT_CHARS);

  if (req.mode === "summarize") {
    return {
      messages: [
        {
          role: "system",
          content:
            "You are a precise document analyst. Summarize the provided document. Capture the key points, main arguments, and important data. Use markdown headings and bullet points. Be thorough but concise. Do not invent information not in the document.",
        },
        {
          role: "user",
          content: `Summarize this document:\n\n<document>\n${context}\n</document>`,
        },
      ],
      maxTokens: 1500,
      json: false,
    };
  }

  if (req.mode === "questions") {
    return {
      messages: [
        {
          role: "system",
          content:
            "You are a curious research assistant. Given a document, suggest 3 insightful follow-up questions that would help the user dig deeper. Return ONLY a JSON array of 3 strings, e.g. [\"question 1\", \"question 2\", \"question 3\"].",
        },
        {
          role: "user",
          content: `Document:\n<document>\n${context}\n</document>\n\nGenerate 3 follow-up questions as a JSON array.`,
        },
      ],
      maxTokens: 400,
      json: true,
    };
  }

  // qa mode (default)
  return {
    messages: [
      {
        role: "system",
        content:
          "You are a precise document analyst. Answer the user's question based ONLY on the provided document. Cite sources using [para N] where N is the approximate paragraph number (count from 1). If the answer is not in the document, say so explicitly. Use markdown for formatting. Do not invent information.",
      },
      {
        role: "user",
        content: `Document:\n<document>\n${context}\n</document>\n\nQuestion: ${req.question}`,
      },
    ],
    maxTokens: 1200,
    json: false,
  };
}

export function validateQARequest(req: Partial<QARequest>): string | null {
  if (!req.mode || !["qa", "summarize", "questions"].includes(req.mode)) {
    return "Invalid mode. Must be 'qa', 'summarize', or 'questions'.";
  }
  if (req.mode === "qa" && (!req.question || !req.question.trim())) {
    return "Question is required for 'qa' mode.";
  }
  if (req.question && req.question.length > MAX_QUESTION_CHARS) {
    return `Question exceeds ${MAX_QUESTION_CHARS} character limit.`;
  }
  return null;
}

export async function answerDocumentQuestion(
  docText: string,
  req: QARequest,
  onToken?: (token: string) => void
): Promise<QAResult> {
  const { messages, maxTokens, json } = buildMessages(docText, req);
  const llm = await getLLM();

  const result = await llm.smart({
    messages,
    maxTokens,
    temperature: 0.3,
    stream: !!onToken,
    json,
    onToken,
  });

  return {
    content: result.content,
    tokensUsed: result.tokensUsed,
  };
}
