"use client";

// Barrel export for the chat sub-components extracted from ChatCard.tsx
// (FC-3, UI God-object split). ChatCard imports from here to keep its
// own import list short.
export { useChatMarkdown } from "./chat-markdown";
export type { ChatMarkdownHelpers } from "./chat-markdown";
export { AssistantMessage } from "./AssistantMessage";
export type { AssistantMessageProps } from "./AssistantMessage";
export { StreamingMessage } from "./StreamingMessage";
export type { StreamingMessageProps } from "./StreamingMessage";
