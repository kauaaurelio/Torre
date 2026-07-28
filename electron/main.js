// Torre — processo principal do Electron. Embrulha o painel Next + o worker
// Baileys numa janela nativa. Sem navegador, sem terminal.
//
// Responsabilidades:
//  1. resolver onde ficam os dados (banco SQLite + .baileys) — em dev, a raiz
//     do projeto; empacotado, um caminho fixo apontado no build.
//  2. subir o servidor Next (produção ou dev) amarrado em 127.0.0.1.
//  3. subir o worker (dist/worker.cjs) como processo filho, automático.
//  4. abrir a janela quando o servidor responder; matar tudo ao fechar.
//
// O 127.0.0.1 continua sendo a fronteira (ver CLAUDE.md): nada escuta na rede.

const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { fork } = require('node:child_process');
const { initUpdater } = require('./updater');

// --- modo -------------------------------------------------------------------
const DEV = process.env.TORRE_MODE === 'dev';
const HOST = '127.0.0.1';
const PORT = Number(process.env.TORRE_PORT) || 41300;

// Raiz do app: onde vivem .next, node_modules, dist/. Em dev é a pasta do
// projeto (pai de electron/); empacotado é a pasta de recursos do app.
const APP_ROOT = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');

// Pasta de dados: banco + credenciais de chip. Precisa ser gravável e ESTÁVEL
// (não pode mudar entre versões, senão o chip pareado "some"). Em dev, a raiz
// do projeto (usa ./data e ./.baileys que já existem). Empacotado, lê o caminho
// de electron/data-dir.txt (baked no build) — apontado pra mesma pasta do
// projeto, pra não perder o chip nem os contatos reais. Fallback: userData.
function resolveDataDir() {
  if (process.env.TORRE_DATA_DIR) return process.env.TORRE_DATA_DIR;
  if (app.isPackaged) {
    try {
      const p = fs.readFileSync(path.join(__dirname, 'data-dir.txt'), 'utf8').trim();
      if (p) return p;
    } catch {}
    return app.getPath('userData');
  }
  return APP_ROOT;
}
const DATA_DIR = resolveDataDir();

// Banco: caminho absoluto explícito. Vence o .env que o Prisma auto-carrega.
const DB_PATH = path.join(DATA_DIR, 'data', 'torre.db');
process.env.DATABASE_URL = `file:${DB_PATH.replace(/\\/g, '/')}`;
if (!process.env.NODE_ENV) process.env.NODE_ENV = DEV ? 'development' : 'production';

// --- log --------------------------------------------------------------------
// Empacotado não tem console visível; joga num arquivo pra depurar.
const LOG_PATH = path.join(DATA_DIR, 'torre-electron.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch {}
  console.log(line);
}

let mainWindow = null;
let worker = null;
let nextServer = null;
let updater = null;

const ICON_PATH = path.join(APP_ROOT, 'assets', 'icon.ico');

// --- autostart --------------------------------------------------------------
// Abre com o Windows. Ativado UMA vez na primeira execução do app instalado
// (marcador em disco); se o usuário desligar depois no Startup do Windows, a
// escolha é respeitada — não reativa à força. Coerente com a pendência do
// CLAUDE.md: manter a Torre viva no boot ajuda a não derrubar a sessão do chip.
function ensureAutoStart() {
  if (!app.isPackaged) return; // só o .exe instalado, nunca em dev
  const marker = path.join(DATA_DIR, '.torre-autostart');
  if (fs.existsSync(marker)) return;
  try {
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
    fs.writeFileSync(marker, new Date().toISOString());
    log('autostart: ativado na primeira execução');
  } catch (e) {
    log('autostart falhou:', String(e));
  }
}

// --- worker -----------------------------------------------------------------
function startWorker() {
  const workerPath = path.join(APP_ROOT, 'dist', 'worker.cjs');
  if (!fs.existsSync(workerPath)) {
    log('WORKER ausente em', workerPath, '— rode o build do worker');
    return;
  }
  log('worker: iniciando', workerPath);
  worker = fork(workerPath, [], {
    // cwd = pasta de dados: o worker grava .baileys/<id> relativo ao cwd.
    cwd: DATA_DIR,
    // fork usa o binário do Electron; ELECTRON_RUN_AS_NODE o faz agir como node.
    execPath: process.execPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DATABASE_URL: process.env.DATABASE_URL,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  worker.stdout?.on('data', (d) => log('[worker]', String(d).trimEnd()));
  worker.stderr?.on('data', (d) => log('[worker:err]', String(d).trimEnd()));
  worker.on('exit', (code, sig) => {
    log('worker: saiu', code, sig || '');
    worker = null;
  });
}

// --- next -------------------------------------------------------------------
async function startNext() {
  log('next: preparando', DEV ? '(dev)' : '(prod)', 'root=', APP_ROOT);
  // require a partir do node_modules do app (resolve pela localização deste
  // arquivo; empacotado, APP_ROOT/node_modules).
  const next = require(path.join(APP_ROOT, 'node_modules', 'next'));
  const nextApp = next({ dev: DEV, dir: APP_ROOT, hostname: HOST, port: PORT });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  await new Promise((resolve, reject) => {
    nextServer = http.createServer((req, res) => handle(req, res));
    nextServer.on('error', reject);
    nextServer.listen(PORT, HOST, resolve);
  });
  log('next: escutando em', `http://${HOST}:${PORT}`);
}

// --- auto-update ------------------------------------------------------------
// Verifica no boot; o modal no renderer só aparece se houver versão nova. Os
// comandos "baixar" e "instalar" vêm do renderer via IPC (botão do modal).
function setupUpdater() {
  updater = initUpdater({
    app,
    getWindow: () => mainWindow,
    dataDir: DATA_DIR,
    log,
  });
  ipcMain.handle('update:start-download', () => updater && updater.download());
  ipcMain.handle('update:install', () => updater && updater.install());
  // Espera a janela terminar de carregar E o React montar/assinar o IPC antes de
  // checar, pra não perder o evento 'update:available' (uma checagem que falha
  // rápido — 401/404 — poderia chegar antes do modal estar ouvindo).
  if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => updater.check(), 1500);
    });
  }
}

// Espera o servidor responder antes de carregar a janela.
function waitForServer(timeoutMs = 30000) {
  const url = `http://${HOST}:${PORT}/`;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('timeout no servidor Next'));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

// --- janela -----------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#131110', // grafite morno — evita flash branco ao abrir
    title: 'Torre',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Links externos abrem no navegador do sistema, não dentro do app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://${HOST}:${PORT}`)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://${HOST}:${PORT}/`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- ciclo de vida ----------------------------------------------------------
async function boot() {
  try {
    fs.mkdirSync(path.join(DATA_DIR, 'data'), { recursive: true });
    ensureAutoStart();
    startWorker();
    await startNext();
    await waitForServer();
    createWindow();
    setupUpdater();
  } catch (err) {
    log('BOOT FALHOU:', err && err.stack ? err.stack : String(err));
    dialog.showErrorBox('Torre não subiu', String(err && err.message ? err.message : err) + `\n\nLog: ${LOG_PATH}`);
    app.quit();
  }
}

// Uma instância só — segunda execução foca a janela existente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(boot);
}

app.on('window-all-closed', () => app.quit());

function shutdown() {
  log('encerrando…');
  if (worker) { try { worker.kill(); } catch {} }
  if (nextServer) { try { nextServer.close(); } catch {} }
}
app.on('before-quit', shutdown);
process.on('exit', shutdown);
