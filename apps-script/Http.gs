/**
 * Http.gs: chamadas HTTP com paralelismo controlado, retentativas e espera progressiva.
 * Somente GET em APIs públicas. Nenhuma escrita em sistemas governamentais.
 */

/**
 * Executa várias URLs (GET) em lotes de `concurrency`. Retenta 429/5xx/erros de rede.
 * @return {Array<{url:string, ok:boolean, code:number, data:*, error:string}>}
 */
function httpGetJsonAll_(urls, concurrency, maxAttempts) {
  concurrency = concurrency || 4;
  maxAttempts = maxAttempts || 4;
  var results = new Array(urls.length);
  var pending = urls.map(function (u, i) { return i; });
  var attempt = 0;
  while (pending.length && attempt < maxAttempts) {
    attempt++;
    var retry = [];
    var saw429 = false;
    for (var s = 0; s < pending.length; s += concurrency) {
      var chunk = pending.slice(s, s + concurrency);
      var reqs = chunk.map(function (i) {
        return { url: urls[i], method: 'get', muteHttpExceptions: true, headers: { Accept: 'application/json' } };
      });
      var resps;
      try {
        resps = UrlFetchApp.fetchAll(reqs);
      } catch (e) {
        // Falha de rede do lote inteiro: marca todos para nova tentativa.
        chunk.forEach(function (i) { results[i] = { url: urls[i], ok: false, code: 0, data: null, error: String(e) }; retry.push(i); });
        continue;
      }
      for (var k = 0; k < chunk.length; k++) {
        var i = chunk[k];
        var r = parseResponse_(urls[i], resps[k]);
        results[i] = r;
        if (!r.ok && (r.code === 429 || r.code >= 500 || r.code === 0)) {
          retry.push(i);
          if (r.code === 429) saw429 = true;
        }
      }
      if (saw429) Utilities.sleep(3000);
    }
    pending = retry;
    if (pending.length) Utilities.sleep(Math.min(30000, 2000 * Math.pow(2, attempt)) + (saw429 ? 5000 : 0));
  }
  return results;
}

function httpGetJson_(url) { return httpGetJsonAll_([url], 1, 4)[0]; }

function parseResponse_(url, resp) {
  var code = resp.getResponseCode();
  if (code === 204) return { url: url, ok: true, code: code, data: null, error: '' };
  var text = resp.getContentText('UTF-8');
  if (code >= 200 && code < 300) {
    if (!text) return { url: url, ok: true, code: code, data: null, error: '' };
    try {
      return { url: url, ok: true, code: code, data: JSON.parse(text), error: '' };
    } catch (e) {
      return { url: url, ok: false, code: code, data: null, error: 'Resposta não é JSON' };
    }
  }
  var msg = 'HTTP ' + code;
  if (code === 429) msg += ' (limite de requisições excedido)';
  else if (code === 401 || code === 403) msg += ' (acesso negado/credencial)';
  else if (code >= 500) msg += ' (indisponibilidade da fonte)';
  try { var j = JSON.parse(text); if (j && j.message) msg += ': ' + String(j.message).slice(0, 200); } catch (e) { /* html */ }
  return { url: url, ok: false, code: code, data: null, error: msg };
}

function qs_(params) {
  return Object.keys(params).filter(function (k) { return params[k] !== '' && params[k] != null; })
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
}
