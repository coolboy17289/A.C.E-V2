import React, { useEffect, useRef, useState } from 'react';
import { api, classNames, formatDate, type ChatMessage } from '@ace/shared';

/**
 * A.C.E AI Tutor - conversational study helper. The backend tries Ollama
 * first; if it isn't reachable we still answer from a study-aware stub.
 */
const AiApp: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [remote, setRemote] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function refresh() {
    try {
      const m = await api.listMessages();
      setMessages(m);
    } catch (e) { setError(String((e as Error).message)); }
  }

  async function send() {
    if (!input.trim() || sending) return;
    const text = input;
    setInput('');
    setSending(true);
    setError(null);

    const optimistic: ChatMessage = {
      id: `tmp_${Math.random()}`, role: 'user', content: text, ts: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);

    try {
      const resp = await api.sendMessage(text);
      setRemote(Boolean((resp as { remote?: boolean }).remote));
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    await api.resetChat();
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3 flex-none">
        <div>
          <h1 className="text-xl font-semibold">AI Tutor</h1>
          <p className="text-xs text-ace-muted">
            {remote === false && 'Using offline fallback (no Ollama)'}
            {remote === true && 'Connected to Ollama'}
            {remote === null && 'Connecting…'}
          </p>
        </div>
        <button className="ace-btn" onClick={reset}>Reset chat</button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 && (
          <div className="ace-card text-sm text-ace-muted">
            Hi! Ask me anything about your study topics. Try one of:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>“Give me a quiz on algebra.”</li>
              <li>“Help me plan revision for the chemistry exam.”</li>
              <li>“Explain how to solve a quadratic equation.”</li>
            </ul>
          </div>
        )}
        {messages.map((m) => <Bubble key={m.id} message={m} />)}
        {sending && <TypingBubble />}
        {error && <div className="text-xs text-red-300">{error}</div>}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="border-t border-white/10 p-3 flex gap-2 flex-none"
      >
        <input
          className="ace-input"
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="ace-btn-primary" type="submit" disabled={sending || !input.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
};

const Bubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const user = message.role === 'user';
  return (
    <div className={classNames('flex', user ? 'justify-end' : 'justify-start')}>
      <div
        className={classNames(
          'max-w-[80%] rounded-2xl px-3 py-2 border',
          user ? 'bg-ace-accent/20 border-ace-accent/40' : 'bg-white/5 border-white/10',
        )}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        <div className="text-[10px] text-ace-muted mt-1 flex items-center gap-2">
          <span>{formatDate(message.ts)}</span>
          {message.model && <span className="ace-pill text-[9px]">{message.model}</span>}
        </div>
      </div>
    </div>
  );
};

const TypingBubble: React.FC = () => (
  <div className="flex justify-start">
    <div className="rounded-2xl px-3 py-2 bg-white/5 border border-white/10">
      <div className="flex gap-1">
        {[0,1,2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    </div>
  </div>
);

export default AiApp;
