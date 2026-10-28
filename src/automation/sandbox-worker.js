// Worker do sandbox: recebe { code, input } por stdin e devolve { ok, result } por stdout.
// Sem require, sem rede, sem acesso a arquivos: o contexto tem só dados e matemática.

const vm = require('vm');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    process.stdout.write(JSON.stringify({ ok: false, error: 'payload inválido' }));
    return;
  }
  try {
    const script = new vm.Script(`(function (input) {\n${String(payload.code || '')}\n})`, { filename: 'transform.js' });
    const fn = script.runInNewContext(Object.create(null), { timeout: 500 });
    const result = fn(payload.input === undefined ? null : payload.input);
    const text = JSON.stringify({ ok: true, result: result === undefined ? null : result });
    process.stdout.write(text.length > 256000 ? JSON.stringify({ ok: false, error: 'resultado grande demais' }) : text);
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: String(error?.message || error).slice(0, 300) }));
  }
});
