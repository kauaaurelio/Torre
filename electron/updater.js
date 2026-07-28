// Torre — auto-update via electron-updater (GitHub Releases, repo privado).
//
// Fluxo (ver spec do usuário):
//  1. ao iniciar, verifica se há versão nova (sem baixar ainda).
//  2. se houver, o main manda 'update:available' pro renderer -> modal elegante.
//  3. usuário clica "Atualizar agora" -> renderer chama startDownload.
//  4. progresso (%, velocidade) é transmitido em 'update:progress'.
//  5. baixou -> 'update:downloaded' -> renderer mostra a mensagem de conclusão e,
//     depois de um instante, pede install -> quitAndInstall() reinicia no novo.
//  6. já na última versão -> 'update:none', nenhuma janela aparece.
//  7. erro -> log no console/arquivo + mensagem amigável no renderer.
//
// Token do repo PRIVADO: nunca embutido no código nem no instalador. É lido de
// GH_TOKEN (env) ou de <pasta-de-dados>/update-token.txt (o operador larga o
// arquivo uma vez na máquina). Sem token, o updater só loga e não incomoda.

const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');

function lerToken(dataDir) {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  try {
    const p = path.join(dataDir, 'update-token.txt');
    const t = fs.readFileSync(p, 'utf8').trim();
    return t || null;
  } catch {
    return null;
  }
}

// Traduz o erro cru do updater em algo que o operador entende.
function mensagemAmigavel(err) {
  const txt = String((err && err.message) || err || '');
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|getaddrinfo/i.test(txt))
    return 'Sem conexão para verificar atualizações. Tenta de novo mais tarde.';
  if (/404|Not Found/i.test(txt))
    return 'Não encontrei o arquivo da atualização no servidor de releases.';
  if (/401|403|Bad credentials|token/i.test(txt))
    return 'Falha de autenticação com o GitHub. Verifique o token de atualização.';
  return 'Não consegui concluir a atualização. Detalhe no log.';
}

// Retorna um controlador { check, download, install }. Se o auto-update não se
// aplica (dev sem TORRE_UPDATE_DEV), os métodos viram no-op.
function initUpdater({ app, getWindow, dataDir, log }) {
  const forcarDev = process.env.TORRE_UPDATE_DEV === '1';
  const noop = { check() {}, download() {}, install() {} };

  if (!app.isPackaged && !forcarDev) {
    log('updater: pulado (dev — defina TORRE_UPDATE_DEV=1 para testar)');
    return noop;
  }

  // Em teste (dev forçado) lê o feed de dev-app-update.yml na raiz do projeto.
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.updateConfigPath = path.join(__dirname, '..', 'dev-app-update.yml');
  }

  autoUpdater.autoDownload = false; // só baixa quando o usuário mandar
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (m) => log('[updater]', typeof m === 'string' ? m : JSON.stringify(m)),
    warn: (m) => log('[updater:warn]', typeof m === 'string' ? m : JSON.stringify(m)),
    error: (m) => log('[updater:err]', typeof m === 'string' ? m : JSON.stringify(m)),
    debug: () => {},
  };

  // Repo de releases é PÚBLICO: não precisa de token. O token só é usado se o
  // operador quiser voltar a um repo privado (larga GH_TOKEN ou update-token.txt).
  const token = lerToken(dataDir);
  if (token) {
    autoUpdater.addAuthHeader(`token ${token}`);
    log('updater: token de atualização carregado (repo privado)');
  } else {
    log('updater: sem token — usando repo público de releases');
  }

  const send = (canal, dados) => {
    const w = getWindow();
    if (w && !w.isDestroyed()) w.webContents.send(canal, dados ?? null);
  };

  autoUpdater.on('checking-for-update', () => send('update:checking'));
  autoUpdater.on('update-available', (info) => {
    log('updater: versão disponível', info.version);
    send('update:available', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    log('updater: já na última versão');
    send('update:none');
  });
  autoUpdater.on('download-progress', (p) => {
    send('update:progress', {
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    log('updater: download concluído', info.version);
    send('update:downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    log('updater: erro', err && err.stack ? err.stack : String(err));
    send('update:error', { message: mensagemAmigavel(err) });
  });

  return {
    check: () =>
      autoUpdater.checkForUpdates().catch((e) => log('updater: check falhou', String(e))),
    download: () =>
      autoUpdater.downloadUpdate().catch((e) => log('updater: download falhou', String(e))),
    install: () => {
      // isSilent=false (mostra o instalador), isForceRunAfter=true (reabre a Torre)
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (e) {
        log('updater: quitAndInstall falhou', String(e));
      }
    },
  };
}

module.exports = { initUpdater };
