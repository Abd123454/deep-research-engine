// Home tab — chat interface
//
// Functional chat scaffold: text input + send button + scrollable
// message list, wired to the Quaesitor backend via `mobile/lib/api-client.ts`.
//
// This is a scaffold — the streaming is parsed line-by-line as SSE-ish
// chunks (the Quaesitor /api/v1/chat endpoint emits `data: {token}`
// frames). Real error handling, retry, conversation persistence, etc.
// is left to the next pass; the goal here is "looks good and the basic
// chat loop works against the API client".
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  type KeyboardAvoidingViewProps,
} from "react-native";
import { Send, Compass } from "lucide-react-native";
import { QuaesitorAPI } from "../../lib/api-client";

// ---- Types ----

type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  /** True while the assistant message is still receiving stream tokens. */
  streaming?: boolean;
}

// ---- Singleton API client ----
// The mobile scaffold doesn't yet wire API key + instance URL through
// a settings store; the QuaesitorAPI defaults to http://localhost:3000.
// When the user configures a real instance URL + API key in Settings,
// the next pass will inject them here via a React context.
const api = new QuaesitorAPI();

// ---- Component ----

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll to the bottom whenever the message list grows.
  useEffect(() => {
    if (messages.length === 0) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      text: "",
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    try {
      const stream = await api.chat(text);
      await readStream(stream, (token) => {
        // Append each streamed token to the assistant message.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, text: m.text + token } : m
          )
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, text: m.text || `⚠️ ${msg}`, streaming: false }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m))
      );
      setSending(false);
    }
  }, [input, sending]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageBubble message={item} />,
    []
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Compass color="#8b4513" size={22} />
          <Text style={styles.headerTitle}>Quaesitor</Text>
        </View>

        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>What shall we investigate?</Text>
            <Text style={styles.emptyHint}>
              Ask anything — research, code, analysis. The response streams
              live from your Quaesitor instance.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Quaesitor…"
            placeholderTextColor="#9b9081"
            multiline
            editable={!sending}
            onSubmitEditing={send}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator color="#f4f1ea" size="small" />
            ) : (
              <Send color="#f4f1ea" size={18} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---- Message bubble ----

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
          {message.text}
          {message.streaming && !message.text ? (
            <Text style={styles.cursor}>▍</Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

// ---- Stream reader ----
//
// The Quaesitor /api/v1/chat endpoint emits SSE-style chunks. On React
// Native, `fetch().body` is a ReadableStream<Uint8Array> — we decode
// it incrementally and extract `data:` lines, calling `onToken` for each.
async function readStream(
  stream: ReadableStream<Uint8Array>,
  onToken: (token: string) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          onToken(payload);
        }
      } else if (!line.startsWith(":") && !line.startsWith("event:") && !line.startsWith("id:")) {
        // Not an SSE control line — treat as a raw token (the v1/chat
        // endpoint may also emit plain-text streaming).
        onToken(line);
      }
    }
  }
}

// ---- Styles (Amber & Ink palette) ----

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: "#f4f1ea", // aged paper
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d9d4c7", // deckle edge
    backgroundColor: "#f4f1ea",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "serif",
    color: "#2a2620", // sepia ink
    fontWeight: "600",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: "serif",
    color: "#2a2620",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 14,
    color: "#6b6358", // faded ink
    textAlign: "center",
    lineHeight: 20,
  },
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowAssistant: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bubbleUser: {
    backgroundColor: "#8b4513", // saddle brown (primary)
  },
  bubbleAssistant: {
    backgroundColor: "#ece6d8", // slightly darker than the paper bg
    borderWidth: 1,
    borderColor: "#d9d4c7",
  },
  bubbleTextUser: {
    color: "#f4f1ea", // aged paper (contrast on saddle brown)
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextAssistant: {
    color: "#2a2620",
    fontSize: 15,
    lineHeight: 20,
  },
  cursor: {
    color: "#8b4513",
    fontWeight: "700",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#d9d4c7",
    backgroundColor: "#f4f1ea",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#ece6d8",
    borderWidth: 1,
    borderColor: "#d9d4c7",
    color: "#2a2620",
    fontSize: 15,
    fontFamily: "serif",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8b4513",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#b89a7c", // faded saddle
  },
});

// Cast the KeyboardAvoidingView behavior to satisfy RN's prop typing
// (the union type doesn't survive the conditional ternary on some
// TS versions).
export type { KeyboardAvoidingViewProps };
