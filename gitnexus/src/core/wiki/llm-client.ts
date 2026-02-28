/**
 * LLM Client for Wiki Generation
 *
 * OpenAI-compatible API client using native fetch.
 * Supports OpenAI, Azure, LiteLLM, Ollama, and any OpenAI-compatible endpoint.
 * Also supports agent CLI subprocess backends (Claude Code, Cursor).
 *
 * Config priority: CLI flags > env vars > defaults
 */

import { execFileSync, spawn } from 'child_process';

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMResponse {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Resolve LLM configuration from env vars, saved config, and optional overrides.
 * Priority: overrides (CLI flags) > env vars > ~/.gitnexus/config.json > error
 * 
 * If no API key is found, returns config with empty apiKey (caller should handle).
 */
export async function resolveLLMConfig(overrides?: Partial<LLMConfig>): Promise<LLMConfig> {
  const { loadCLIConfig } = await import('../../storage/repo-manager.js');
  const savedConfig = await loadCLIConfig();

  const apiKey = overrides?.apiKey
    || process.env.GITNEXUS_API_KEY
    || process.env.OPENAI_API_KEY
    || savedConfig.apiKey
    || '';

  return {
    apiKey,
    baseUrl: overrides?.baseUrl
      || process.env.GITNEXUS_LLM_BASE_URL
      || savedConfig.baseUrl
      || 'https://openrouter.ai/api/v1',
    model: overrides?.model
      || process.env.GITNEXUS_MODEL
      || savedConfig.model
      || 'minimax/minimax-m2.5',
    maxTokens: overrides?.maxTokens ?? 16_384,
    temperature: overrides?.temperature ?? 0,
  };
}

/**
 * Estimate token count from text (rough heuristic: ~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CallLLMOptions {
  onChunk?: (charsReceived: number) => void;
}

/**
 * Pluggable LLM caller function type.
 * Abstracts over HTTP-based and subprocess-based backends.
 */
export type LLMCaller = (prompt: string, systemPrompt?: string, opts?: CallLLMOptions) => Promise<LLMResponse>;

// ─── Agent CLI backend ────────────────────────────────────────────────────────

let _detectedAgent: 'claude' | 'cursor' | null | undefined = undefined;

/**
 * Probe PATH for a supported agent CLI. Returns the first found, or null.
 * Result is cached per process.
 */
export function detectAgentCLI(): 'claude' | 'cursor' | null {
  if (_detectedAgent !== undefined) return _detectedAgent;
  try { execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 5000 }); _detectedAgent = 'claude'; return 'claude'; } catch {}
  try { execFileSync('agent', ['--version'], { stdio: 'ignore', timeout: 5000 }); _detectedAgent = 'cursor'; return 'cursor'; } catch {}
  _detectedAgent = null;
  return null;
}

const AGENT_TIMEOUT_MS = 120_000;

/**
 * Call a local agent CLI subprocess (Claude Code or Cursor) with a prompt.
 *
 * For Claude Code: passes systemPrompt as the -p argument (short instruction) and
 * pipes the large user prompt via stdin. This follows Claude Code's documented pattern:
 *   cat content.txt | claude -p "instruction"
 * This avoids ARG_MAX (E2BIG) — only the short instruction goes as a CLI arg.
 *
 * For Cursor: concatenates system+user prompt and pipes the whole thing via stdin.
 *
 * Enforces a 120-second hard timeout with SIGKILL.
 */
export function callAgentCLI(
  prompt: string,
  agent: 'claude' | 'cursor',
  model?: string,
  systemPrompt?: string,
  options?: CallLLMOptions,
): Promise<LLMResponse> {
  let binary: string;
  let args: string[];
  let stdinContent: string;

  if (agent === 'claude') {
    binary = 'claude';
    if (systemPrompt) {
      // System prompt → -p instruction (always short); user prompt → stdin (can be huge).
      args = ['-p', systemPrompt];
      stdinContent = prompt;
    } else {
      args = ['-p', prompt];
      stdinContent = '';
    }
    if (model) args.push('--model', model);
  } else {
    // Cursor: no way to split instruction/content — combine inline and pipe via stdin.
    binary = 'agent';
    stdinContent = systemPrompt ? `[System: ${systemPrompt}]\n\n${prompt}` : prompt;
    args = ['--print', '--force', '--output-format=text'];
    if (model) args.push('--model', model);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch {}
    }, AGENT_TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    // Ignore EPIPE: child may close stdin before we finish writing (not an error).
    child.stdin.on('error', () => {});

    if (stdinContent) {
      child.stdin.write(stdinContent, 'utf-8');
    }
    child.stdin.end();

    child.on('close', (code, signal) => {
      clearTimeout(killTimer);

      if (timedOut || signal === 'SIGKILL') {
        const msg = agent === 'claude'
          ? 'claude timed out (120s)'
          : 'agent timed out (120s) — try reducing --concurrency';
        reject(new Error(msg));
        return;
      }

      if (code !== 0) {
        // Claude prints errors to stdout, not stderr — include both in the message.
        const errMsg = stderr.trim() || stdout.trim() || `exited with code ${code}`;
        reject(new Error(`${binary} failed: ${errMsg}`));
        return;
      }

      const output = stdout.trim();
      if (!output) {
        reject(new Error(`${agent} returned empty response`));
        return;
      }

      options?.onChunk?.(output.length);
      resolve({ content: output });
    });

    child.on('error', (err: any) => {
      clearTimeout(killTimer);
      if (err.code === 'ENOENT') {
        const e = new Error(`${binary} not found in PATH`) as any;
        e.code = 'ENOENT';
        reject(e);
        return;
      }
      reject(err);
    });
  });
}

/**
 * Call an OpenAI-compatible LLM API.
 * Uses streaming when onChunk callback is provided for real-time progress.
 * Retries up to 3 times on transient failures (429, 5xx, network errors).
 */
export async function callLLM(
  prompt: string,
  config: LLMConfig,
  systemPrompt?: string,
  options?: CallLLMOptions,
): Promise<LLMResponse> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const useStream = !!options?.onChunk;

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  };
  if (useStream) body.stream = true;

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');

        // Rate limit — wait with exponential backoff and retry
        if (response.status === 429 && attempt < MAX_RETRIES - 1) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
          const delay = retryAfter > 0 ? retryAfter * 1000 : (2 ** attempt) * 3000;
          await sleep(delay);
          continue;
        }

        // Server error — retry with backoff
        if (response.status >= 500 && attempt < MAX_RETRIES - 1) {
          await sleep((attempt + 1) * 2000);
          continue;
        }

        throw new Error(`LLM API error (${response.status}): ${errorText.slice(0, 500)}`);
      }

      // Streaming path
      if (useStream && response.body) {
        return await readSSEStream(response.body, options!.onChunk!);
      }

      // Non-streaming path
      const json = await response.json() as any;
      const choice = json.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error('LLM returned empty response');
      }

      return {
        content: choice.message.content,
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
      };
    } catch (err: any) {
      lastError = err;

      // Network error — retry with backoff
      if (attempt < MAX_RETRIES - 1 && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message?.includes('fetch'))) {
        await sleep((attempt + 1) * 3000);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('LLM call failed after retries');
}

/**
 * Read an SSE stream from an OpenAI-compatible streaming response.
 */
async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (charsReceived: number) => void,
): Promise<LLMResponse> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let content = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          onChunk(content.length);
        }
      } catch {
        // Skip malformed SSE chunks
      }
    }
  }

  if (!content) {
    throw new Error('LLM returned empty streaming response');
  }

  return { content };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
