// Lê uma resposta de chat-completions em streaming (SSE) e devolve o mesmo formato da resposta sem streaming:
// { choices: [{ message }], usage }. Também informa o tempo até o primeiro token e chama onToolCall assim que uma
// chamada de ferramenta termina de chegar (quando a próxima começa ou o fluxo acaba).

async function readStreamedCompletion(body, { onToolCall = null, idleTimeoutMs = 45000, now = Date.now } = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const startedAt = now();
  let firstTokenMs = null;
  let buffer = '';
  let content = '';
  let reasoning = '';
  let usage = null;
  let finishReason = null;
  const calls = [];
  let announced = 0;

  const announceUpTo = (limit) => {
    while (announced < limit && announced < calls.length) {
      const call = calls[announced++];
      if (call && onToolCall) onToolCall(call, announced - 1);
    }
  };

  const handleEvent = (payload) => {
    if (payload === '[DONE]') return;
    let json;
    try { json = JSON.parse(payload); } catch { return; }
    if (json.error) throw new Error(json.error.message || 'Erro no streaming do provedor');
    if (json.usage) usage = json.usage;
    const choice = json.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta || {};
    if ((delta.content || delta.reasoning_content || delta.tool_calls) && firstTokenMs === null) firstTokenMs = now() - startedAt;
    if (typeof delta.content === 'string') content += delta.content;
    if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content;
    for (const part of delta.tool_calls || []) {
      const index = Number.isInteger(part.index) ? part.index : calls.length;
      if (!calls[index]) calls[index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
      const call = calls[index];
      if (part.id) call.id = part.id;
      if (part.function?.name) call.function.name += part.function.name;
      if (typeof part.function?.arguments === 'string') call.function.arguments += part.function.arguments;
      announceUpTo(index);
    }
  };

  for (;;) {
    let idleTimer;
    const idle = new Promise((_, reject) => {
      idleTimer = setTimeout(() => reject(Object.assign(new Error('Streaming parado'), { name: 'TimeoutError' })), idleTimeoutMs);
    });
    let chunk;
    try {
      chunk = await Promise.race([reader.read(), idle]);
    } finally {
      clearTimeout(idleTimer);
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let separator;
    while ((separator = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buffer.slice(0, separator);
      buffer = buffer.slice(separator).replace(/^\r?\n\r?\n/, '');
      const data = raw.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
      if (data) handleEvent(data);
    }
  }
  if (buffer.trim().startsWith('data:')) handleEvent(buffer.trim().slice(5).trimStart());
  announceUpTo(calls.length);

  const message = { role: 'assistant', content: content || null };
  if (reasoning) message.reasoning_content = reasoning;
  const toolCalls = calls.filter(Boolean);
  if (toolCalls.length) message.tool_calls = toolCalls.map((call, i) => ({ ...call, id: call.id || `stream-call-${i}` }));
  return { choices: [{ message, finish_reason: finishReason }], ...(usage ? { usage } : {}), firstTokenMs };
}

module.exports = { readStreamedCompletion };
