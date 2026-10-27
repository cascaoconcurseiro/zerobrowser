const fs = require('fs');
const path = require('path');

const DEFAULT_LIMIT = 200;
const SAVED_FIELDS = ['id', 'filename', 'url', 'state', 'path', 'receivedBytes', 'totalBytes', 'startedAt'];

// Lê o histórico gravado. Download que estava em andamento quando o app fechou vira "interrupted".
function loadDownloadHistory(file, limit = DEFAULT_LIMIT) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === 'string' && typeof item.filename === 'string')
      .map((item) => ({
        id: item.id,
        tabId: null,
        filename: item.filename,
        url: typeof item.url === 'string' ? item.url : '',
        state: item.state === 'completed' || item.state === 'cancelled' ? item.state : 'interrupted',
        path: typeof item.path === 'string' ? item.path : '',
        receivedBytes: Number(item.receivedBytes) || 0,
        totalBytes: Number(item.totalBytes) || 0,
        startedAt: Number(item.startedAt) || 0
      }))
      .slice(-limit);
  } catch {
    return [];
  }
}

// Grava só downloads do usuário (os de avaliação do agente ficam de fora), com troca atômica do arquivo.
function saveDownloadHistory(file, records, limit = DEFAULT_LIMIT) {
  try {
    const data = records
      .filter((record) => !record.evaluation)
      .slice(-limit)
      .map((record) => Object.fromEntries(SAVED_FIELDS.map((key) => [key, record[key]])));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data));
    fs.renameSync(temp, file);
    return true;
  } catch {
    return false;
  }
}

// Próximo número de id (d1, d2, ...) sem repetir os já gravados.
function nextDownloadSequence(records) {
  return records.reduce((max, record) => Math.max(max, Number(String(record.id).replace(/^d/, '')) || 0), 0);
}

module.exports = { loadDownloadHistory, saveDownloadHistory, nextDownloadSequence, DEFAULT_LIMIT };
