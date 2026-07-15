/**
 * A.C.E AI service.
 *
 * Speaks to a local Ollama instance when it's reachable. When it isn't
 * (most fresh Pi images, all developer laptops) it falls back to a small
 * deterministic study-aware response so the AI Tutor app always feels
 * responsive.
 *
 * The model name and host are configurable per environment. The default
 * (`llama3.2:3b`) is a great trade-off between quality and Pi 4/5 memory.
 */

import { newId } from '../util/ids.js';
import type { ChatMessage } from '@ace/shared';

const DEFAULT_HOST = process.env.ACE_OLLAMA_HOST ?? 'http://localhost:11434';
const DEFAULT_MODEL = process.env.ACE_OLLAMA_MODEL ?? 'llama3.2:3b';
const REQUEST_TIMEOUT_MS = 8_000;

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  stream: false;
}

interface OllamaChatResponse {
  message?: { role: string; content: string };
  model?: string;
  error?: string;
}

export interface AskOptions {
  history?: ChatMessage[];
  prompt: string;
  /** Override the model name for one request. */
  model?: string;
  /** Inject a system prompt context (subject, age, etc.). */
  system?: string;
}

export interface AskResult {
  message: ChatMessage;
  /** True if the response came from a real model. False if from the fallback. */
  remote: boolean;
  error?: string;
}

const SYSTEM_PROMPT = [
  'You are the A.C.E OS study assistant - concise, supportive, focused on helping a student learn.',
  'Use plain language. Break problems into steps. Always encourage understanding over rote answers.',
  'When asked to quiz the user, output 3 short questions and let them answer one at a time.',
].join(' ');

/**
 * Asks the configured model. Communicates the timeout implicitly by setting
 * `AbortSignal.timeout`; lets the fallback take over on any failure so the
 * AI app never stalls.
 */
export async function ask(opts: AskOptions): Promise<AskResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const messages = [
    { role: 'system' as const, content: opts.system ?? SYSTEM_PROMPT },
    ...((opts.history ?? []).slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))),
    { role: 'user' as const, content: opts.prompt },
  ];

  const payload: OllamaChatRequest = { model, messages, stream: false };

  try {
    const res = await fetch(`${DEFAULT_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`ollama http ${res.status}`);
    const json = (await res.json()) as OllamaChatResponse;
    if (!json.message?.content) throw new Error('ollama empty response');
    return {
      remote: true,
      message: {
        id: newId('msg'),
        role: 'assistant',
        content: json.message.content.trim(),
        ts: new Date().toISOString(),
        model: json.model ?? model,
      },
    };
  } catch (err) {
    return {
      remote: false,
      error: String((err as Error).message ?? err),
      message: {
        id: newId('msg'),
        role: 'assistant',
        content: fallbackAnswer(opts.prompt),
        ts: new Date().toISOString(),
        model: `fallback:${model}`,
      },
    };
  }
}

/** Image "vision" - the device camera hands a frame to the backend which
 * stores it briefly and forwards a prompt to the model. For now we always
 * use the fallback path because shipping a multi-modal model on a Pi is
 * very expensive and out of scope for v1. */
export async function describeImageWithFallback(prompt: string): Promise<AskResult> {
  return {
    remote: false,
    message: {
      id: newId('msg'),
      role: 'assistant',
      content: fallbackVisionAnswer(prompt),
      ts: new Date().toISOString(),
      model: 'fallback:vision',
    },
  };
}

const KEYWORDS: Record<string, string> = {
  math: 'Try breaking the problem into the parts you know vs the parts that stump you. Show every step; check the units; substitute back to verify.',
  algebra: 'Isolate the variable. Move terms across the equals sign, flipping their sign. Try to factor before substituting.',
  calculus: 'Identify what the question is asking (limit, derivative, integral). Draw a picture. Apply the rule that maps to your visual.',
  physics: 'List everything you know about the system. Draw the diagram. Label forces. Pick a frame; write F=ma or relevant conservation law.',
  chemistry: 'Write the full balanced equation first. Then track moles. Then apply stoichiometry.',
  biology: 'Sketch the cell or pathway. Name every input and output. State where energy is going.',
  english: 'Quote at least one line per point. Lead with the strongest evidence; follow with the effect on the reader.',
  history: 'Timeline first - place the event between two anchors. Then ask "what changed because of this?"',
  geography: 'Latitude/longitude, biome, climate, neighbours, trade. Five anchors beats one paragraph.',
  code: 'Pseudocode first; second pass to syntax; third pass to tests. Read errors top-down.',
  study: 'Set a 25-minute Pomodoro, single task, no phone. Review what you wrote at the end.',
  exam: 'Read the question twice; flag knowns and unknowns; solve the easy ones first.',
  schedule: 'Block study time after energy peaks. Leave a buffer the night before any deadline.',
};

function fallbackAnswer(prompt: string): string {
  const lower = prompt.toLowerCase();
  for (const [key, tip] of Object.entries(KEYWORDS)) {
    if (lower.includes(key)) {
      return `Here is a quick approach for **${key}**:\n\n- ${tip}\n\nTell me which bit is hardest and I'll walk through it step by step.`;
    }
  }
  if (lower.includes('quiz')) {
    return [
      'Here are three practice questions:',
      '1. Explain the difference between correlation and causation in one sentence.',
      '2. Solve: a body starts at rest and accelerates at 2 m/s². What is its velocity after 6 seconds?',
      '3. Translate: "She walked slowly." into your target language (or a more vivid English version).',
    ].join('\n');
  }
  if (lower.includes('plan')) {
    return [
      'A study plan that usually works:',
      '- 25 min focused work + 5 min break (one Pomodoro)',
      '- Two more Pomodoros followed by a 15 min break',
      '- One short review at the end of the day, one longer one at week-end',
      'Pick the topic most worth your time and start a 25 minute block now.',
    ].join('\n');
  }
  return (
    "I can help you break this down. " +
    "Could you tell me which subject this is for, and what's the smallest part you're stuck on?"
  );
}

function fallbackVisionAnswer(prompt: string): string {
  return (
    `I can't see the image on this device yet, but based on your prompt ("${prompt.slice(0, 80)}") ` +
    'try the following steps: ensure the page or object is well lit, hold the camera steady, ' +
    'and re-capture at the highest supported resolution.'
  );
}
