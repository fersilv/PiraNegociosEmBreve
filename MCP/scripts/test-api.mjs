const base = process.env.PIRA_API_BASE_URL;
const key = process.env.PIRA_API_KEY;
const header = process.env.PIRA_API_KEY_HEADER || 'X-API-Key';
const path = process.env.PIRA_JOBS_CHECK_PATH || '/api/v1/jobs/check';

if (!base || !key) {
  console.error('Defina PIRA_API_BASE_URL e PIRA_API_KEY no .env');
  process.exit(1);
}

try {
  const response = await fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', [header]: key },
    body: '{}',
  });
  const text = await response.text();
  console.log(JSON.stringify({ reachable: true, status: response.status, statusText: response.statusText, body: text.slice(0, 1000) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ reachable: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(2);
}
