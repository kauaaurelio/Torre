# CLAUDE.md — Torre

Painel de disparo de mensagens no WhatsApp, rota não oficial (QR / Baileys),
para base própria com opt-in.

## Perfil
Tipo: CRM + dashboard operacional (app fechada) · Público: operador da agência
Objetivo: disparar campanhas para a base própria sem queimar o número.

Stack: Next.js (App Router) no painel · worker Node separado com `baileys` (linha 7.x)
Backend: Postgres + Prisma · fila BullMQ + Redis
Hospedagem: **local**, Docker Compose na máquina do usuário, amarrado em
`127.0.0.1` (nunca `0.0.0.0` — não expor na rede local).
Não é serverless-compatível: a sessão do Baileys é um processo vivo e com estado.

**Consequência da execução local:** PC suspenso ou desligado derruba a sessão, e
reconexão pede QR novo — sinal de conta suspeita. Suspensão automática precisa
ficar desativada durante campanha. Gatilho para migrar só o worker para VPS:
quando a dependência de deixar o PC ligado começar a atrapalhar.

Serviços separados de propósito: deploy do painel não pode derrubar a sessão.
Reconexão exige QR novo, e QR novo com frequência é sinal de conta suspeita.

## Design
Paleta: derivada da mesa do operador de despacho, não da categoria.
- `#E9A13B` âmbar de sinal — lâmpada de painel, primária, tudo em voo
- `#6FBF73` fósforo — entregue. Verde apagado de CRT, **deliberadamente longe
  do verde do WhatsApp (#25D366)**: o verde deles no nosso produto seria a marca
  deles no nosso produto
- `#D9503F` vermelho de sinal — falha, bloqueio, opt-out
- `#5C8C99` azul esmalte — chapa do equipamento, agendado, ocioso
- `#131110` grafite morno + `#F1EADB` papel telex

Tipografia: Barlow Condensed (etiqueta de painel) · Inter (corpo) ·
IBM Plex Mono (telefone, contador, log — alinhamento de dígito importa).

Tom: operacional e seco. Sem copy de marketing dentro da ferramenta.
Dark mode: **escuro é o padrão** (`:root`); claro em `[data-theme="light"]`.
Inversão do usual — é console olhado por horas.
Assinatura: **a fita de módulos** — a fila renderizada como tira de quadrados
no estilo dos módulos de um QR code, um por contato. Grafite = na fila,
âmbar pulsando = enviando, fósforo = entregue, vermelho = falhou, vazado = opt-out.
Barra de progresso e mapa da campanha ao mesmo tempo. Vem do único artefato
que só existe nesta rota: o QR do pareamento.
Gradiente: NÃO.

## Movimento
Nível: discreto. Exceção: a fita, que é movimento funcional contínuo.
Momento orquestrado: o pulso do módulo em voo + o LED de conexão. Só isso pulsa
na interface inteira — se mais coisas pulsarem, o sinal deixa de ser sinal.
Biblioteca: nenhuma. CSS resolve.

Hierarquia por tela:
- Fila / campanha rodando -> a fita
- Contatos -> a tabela
- Nova campanha -> o editor de mensagem
- Relatório -> a taxa de entrega
- Conexão -> o QR code

## Módulos ativos
Segurança: banco · APIs (validação de entrada continua valendo, inclusive local)
· rate limit na fila
Não se aplica **enquanto for local**: HTTPS/HSTS · headers de deploy · CORS ·
CSRF (sem exposição de rede) · auth multiusuário (um operador, uma máquina —
o `127.0.0.1` é a fronteira). **Todos voltam a valer no dia que sair da máquina.**
Não se aplica: SEO (app fechada) · multi-tenancy (uso interno) · conversão

Backup passa a ser responsabilidade manual: base de contatos e provas de opt-in
ficam num disco só. Definir rotina de `pg_dump` antes da primeira importação real.

## Escopo
Unidades (ordem de construção):
1. Fundação — globals.css + CLAUDE.md ✅
2. Shell — sidebar, barra de status com a fita, responsivo ✅
3. Conexão — QR, estado da sessão, reconexão ✅
4. Contatos — lista, importação CSV, prova de opt-in, segmentos ✅
5. Nova campanha — editor com variáveis e variações ✅
6. Fila — a fita em tamanho grande, controles de pausa ✅
7. Relatório — entrega, falha, opt-out ✅
8. Configurações — tetos, janela horária, rampa ✅

~~Todas as telas com dado real ficam atrás de um switcher DEV~~ — **feito**
(2026-07-27): mocks e switcher DEV removidos. As telas leem estado real via
`/api/*`; o worker Baileys + SQLite alimentam sessão, fila e relatório. Os
estados carregando/vazio/erro/cheio agora vêm do fetch de verdade.

Fora:
- Multi-tenant / revenda para clientes — decidido como base própria
- Atendente de IA respondendo — só escuta de opt-out por enquanto
- Cloud API oficial — rota descartada nesta versão

## Convenções
- Tema escuro em `:root`, claro em `[data-theme]` (inverso do padrão do skill)
- Estado nunca comunicado só por cor: sempre ícone + rótulo. `--color-warning`
  e `--color-primary` são vizinhos no espectro
- Todo número, telefone e contador usa `--font-mono` com `tabular-nums`

## Decisões
2026-07-27 — Rota QR (Baileys) em vez da Cloud API oficial — sem custo por
mensagem e sem aprovação de template — pedido pelo usuário.
2026-07-27 — Base própria com opt-in, sem prospecção fria — usuário.
2026-07-27 — Stack Next + worker Node + BullMQ + Postgres — confirmada pelo
usuário. Painel scaffoldado em **Next 15 (App Router) + React 19 + TypeScript**;
`dev`/`start` amarrados em `127.0.0.1`. Worker/fila/Postgres entram depois.
2026-07-27 — Nome "Torre" — confirmado pelo usuário.
2026-07-27 — Execução local em vez de VPS — usuário.
2026-07-27 — Componentes usam **CSS Modules** (só `var()` dentro); ícones em
**SVG inline**, sem biblioteca. Estado de sessão/campanha compartilhado via
contexto client, alimentado por mock até o worker existir.
2026-07-27 — **Recolher da sidebar é instantâneo, sem animação.** Animar a
largura (via `width` ou `grid-template-columns` que referenciam token) congela o
track do grid em 240px nesta engine — dependência circular grid×largura. Coerente
com o brief: movimento discreto, só a fita e o LED se mexem.
2026-07-27 — Vulnerabilidades `npm audit` (postcss, sharp — transitivas do Next)
não corrigidas: o "fix" rebaixa o Next à 9.3.3. Vetores não se aplicam (CSS e
imagens são nossos, sem `next/image`, app em `127.0.0.1`). Some ao subir o Next.
2026-07-27 — **Saída do estado demo para produção local (pedido: usar hoje).**
Mocks (`lib/mock.ts`) e o switcher DEV removidos; todas as telas leem estado real
via `/api/*`. Tipos foram para `lib/tipos.ts`.
2026-07-27 — **Persistência: SQLite via Prisma 6**, não Postgres. Máquina do
usuário não tem Docker; subir Postgres/Redis hoje não era viável. Banco em
`data/torre.db` (gitignore), `DATABASE_URL` absoluto no `.env` para painel e
worker resolverem o mesmo arquivo. Prisma **fixado em 6** — a 7 exige driver
adapters + `prisma.config.ts` (sem `url` no schema). Migração pra Postgres depois
não muda o front (só o datasource).
2026-07-27 — **Fila sem BullMQ/Redis**: o worker faz polling da tabela `Envio`
no SQLite (loop a cada 2s) e aplica os freios ali. Um operador, uma máquina —
não precisa de broker. BullMQ/Redis entram se virar multi-worker ou VPS.
2026-07-27 — **baileys fixado em 6.7.23**, não a linha 7.x. A 7.0.0-rc quebra no
boot: depende de `whatsapp-rust-bridge`, cujo `package.json` não tem `exports`
main e o resolver ESM (tsx) falha. 6.7.x é a linha estável. Reavaliar quando a 7
sair de RC.
2026-07-27 — **Import por XLSX (`exceljs`)**, não CSV. Normalização de telefone
BR em `lib/telefone.ts`: separa `mobile` (celular, único que recebe disparo) de
`fixo`/`invalido`. Fixo e inválido são importados e marcados, mas ficam fora da
fila — WhatsApp só existe em celular, e a lista raspada é cheia de linha fixa.
2026-07-27 — **Opt-in opcional na importação** (pedido do usuário). A lista atual
é raspada da web, sem prova de opt-in. Import grava origem = `Importação · <arquivo>`
e data do dia; envio liberado. Contradiz o invariante "base própria com opt-in";
risco de ban/LGPD assumido pelo usuário. O opt-out em runtime continua valendo.
2026-07-27 — **Worker é processo separado, iniciado à mão (`npm run worker`).** O
painel detecta se ele está vivo pelo heartbeat (`Worker.heartbeat` < 20s); sem
worker, a tela de Conexão mostra "Worker offline". Comandos painel→worker
(conectar/desconectar/remover) passam pelo campo `Sessao.comando`.
2026-07-27 — **Multi-número ("os dois").** `Sessao` deixou de ser singleton: vira
N linhas, uma por chip, cada uma com sua pasta de credenciais `.baileys/<id>`. Um
só worker segura N sockets (Map por sessão). A campanha escolhe **um número fixo**
(`Campanha.numeroId`) ou **rodízio** (numeroId null → o worker distribui entre os
chips conectados; claim atômico `fila→enviando` evita double-send). `Envio.sessaoId`
registra quem enviou. Pedido pelo usuário.
2026-07-27 — **Freios por número.** intervalo, rampa, rampaDegrau e breakerLimite
saíram do `Config` (global) e passaram pra `Sessao` — cada chip tem sua reputação,
sua rampa e seu teto. Janela horária e palavras de opt-out continuam globais no
`Config` (que também guarda os defaults copiados a cada chip novo). O heartbeat do
processo saiu da Sessao pro novo singleton `Worker`. Breaker agora é por chip:
falhas/queda de um número pausam só as campanhas fixas nele; rodízio segue nos
saudáveis. Pedido pelo usuário.
2026-07-27 — **Novas variáveis/condições na mensagem** (`lib/variacao.ts`
reescrito). Além do spintax `{a|b}`: `{{cidade}}`, `{{nicho}}`, `{{empresa}}`
(novos campos do contato, populados na importação — nicho/cidade como default de
lote, empresa = nome do negócio), `{{saudacao}}` (Bom dia/tarde/noite resolvido na
hora REAL do envio, no worker — não no enfileiramento), fallback `{{campo|padrão}}`
e condicional de presença `{{#se campo}}…{{/se}}` / `{{#sem campo}}…{{/sem}}`.
Precedência: condicional → variável → spintax (double-brace antes de single, pra
`{{a|b}}` não colidir com `{a|b}`). A mensagem-base do usuário é prospecção fria
B2B — contradiz o invariante "base própria com opt-in"; risco já assumido nas
decisões anteriores. `MODELO_INICIAL` já vem com variação embutida pra passar no
freio de variação (`combos >= 2`).
2026-07-27 — **Descanso em lote (freio anti-ban), por número.** A cada N disparos
(aleatório entre `loteMin`–`loteMax`, padrão 7–13) o chip pausa por um tempo longo
(aleatório entre `pausaMin`–`pausaMax` min, padrão 30–60). Rajada curta + descanso
imita humano; enviar sem parar é o que queima o número. Contado no RT do worker
(`enviadosNoLote`/`loteAlvo`), só conta disparo que tocou a rede (entregue ou falha
de envio — consulta de número inexistente não conta). Configurável por chip em
Configurações. Pedido pelo usuário.
2026-07-27 — **App desktop (Electron), não mais só navegador.** Pedido do usuário:
executável de PC, janela nativa, sem terminal. `electron/main.js` (CommonJS) sobe o
Next **in-process** (API programática, `dev:false`) amarrado em `127.0.0.1:41300` e
dá `fork` no worker automaticamente — fim do `npm run worker` à mão (rodar os dois =
conflito de sessão no mesmo chip, `code 440`). O worker é pré-empacotado em
`dist/worker.cjs` via esbuild (`--packages=external`, só o TS local é bundlado;
`baileys`/`@prisma/client` resolvem do `node_modules`) porque `tsx` é devDep e o
builder poda devDeps. Empacotado com **electron-builder → NSIS** (`Torre-Setup-*.exe`,
~270MB). **`asar: false`** de propósito: caminhos relativos do worker (`.baileys/<id>`),
o engine do Prisma e o `node_modules` cru funcionam sem unpack. Pasta de dados: em dev
= raiz do projeto; empacotado lê `electron/data-dir.txt` (baked no build, aponta pra
raiz do projeto) → **o `.exe` usa o MESMO `data/torre.db` + `.baileys` que o dev**,
sem migração e sem perder o chip pareado. `DATABASE_URL` setado explícito no `main.js`
(vence o `.env` que o Prisma auto-carrega). Scripts: `npm run app:dev` (Next dev na
janela), `npm run app` (prod na janela), `npm run dist` (gera o instalador).
2026-07-27 — **Prisma no empacotamento: `.prisma` via `extraResources`, não `files`.**
O builder poda a pasta *gerada* `node_modules/.prisma/client` (não é dep "real" no
package.json E é dot-folder, que o copiador de node_modules do builder ignora mesmo
com glob positivo em `files`). Sem ela o worker morre com `Cannot find module
'.prisma/client/default'` (o query engine `query_engine-windows.dll.node` mora ali).
Fix que funciona: `extraResources` copiando `node_modules/.prisma` →
`app/node_modules/.prisma` (com `asar:false` o app fica em `resources/app`, então o
`require` acha). O painel não sofre porque o Next traça/embute o client no `.next`.
2026-07-27 — **`next build` precisa ser LIMPO — nunca com `next dev` vivo na mesma
`.next`.** Rodar `build` e `dev` no mesmo `.next` corrompe os artefatos: a função `.u`
do `webpack-runtime.js` passa a devolver `611.js` sem o prefixo `chunks/`, e o `next
start` (e portanto o app empacotado) morre com `Cannot find module './611.js'`. Só
aparece em produção — `next dev` mascara. Fix: parar o dev, `rm -rf .next`, buildar
sozinho. `npm run app`/`dist` sempre partem de build limpo.
2026-07-27 — **`tsconfig` exclui `release` e `dist`.** O empacotamento copia o projeto
inteiro pra `release/win-unpacked/resources/app/`; sem excluir, o type-check do Next
varre a cópia aninhada e falha (ex.: `cell implicitly any` no import exceljs, que só
quebra na cópia porque a resolução de tipos difere lá). O source original compila.
2026-07-27 — **Ícone próprio + autostart.** Ícone em `assets/icon.svg` (finder pattern
do QR do pareamento em âmbar sobre grafite + fita: módulo em voo âmbar, entregue verde
— a assinatura do brief). `assets/make-icon.mjs` (sharp + png-to-ico) gera `icon.ico`
multi-res e `icon.png`; ligado no `BrowserWindow.icon` e no `build.win.icon`/`nsis`.
Autostart: `app.setLoginItemSettings({openAtLogin:true})` no `main.js`, ativado UMA vez
na primeira execução do app instalado (marcador `.torre-autostart` na pasta de dados) —
se o usuário desligar depois no Startup do Windows, respeita; não reativa à força. Só no
`app.isPackaged`, nunca em dev. Ajuda a manter a Torre viva no boot (pendência: chip cai
se o PC dorme/reinicia).
2026-07-27 — **Mensagem de abordagem trocada pra "isca do esboço"** (script de
prospecção MKM, ETAPA 1). Nova `MODELO_INICIAL` em `NovaCampanhaScreen.tsx`: elogio
específico + "acabei montando uma versão do site de vocês, tá pronta, posso mandar?".
`[detalhe específico]` do script (observação única por empresa) NÃO tem campo por
contato num disparo em massa — virou genérico plausível via `{{nicho}}`/`{{cidade}}`
("vi a {{empresa}} pesquisando {{nicho}} em {{cidade}}, trabalho muito bom"). 256 combos
(passa no freio de variação). **Custo operacional assumido:** a isca promete esboço
pronto — a regra #1 do script é entregar em 24h; mandar "tá pronta" em massa pra lista
raspada vira promessa a cumprir em escala.
2026-07-27 — **Versão bumpada 0.1.0 → 0.2.0** e instalador regerado. Marca o salto
desde o primeiro empacotável: multi-número, freios por número (rampa/breaker/descanso
em lote), novas variáveis/condições na mensagem, ícone próprio + autostart e a isca do
esboço. Artefato: `release/Torre-Setup-0.2.0.exe`. Pedido pelo usuário.
2026-07-27 — **Fixo agora é DESCARTADO na importação** (antes: importado e marcado,
fora da fila). `app/api/contatos/import/route.ts` dá `continue` no `tipo === 'fixo'`
depois de contar — não grava mais no banco. O contador `resumo.fixos` virou "fixos
descartados" na tela. Os 23 fixos que já estavam no banco de imports anteriores foram
apagados à mão (script `deleteMany({tipo:'fixo'})`, 0 envios afetados). Inválido segue
importado e marcado. Pedido pelo usuário.
2026-07-27 — **Exclusão de contato (hard), single e em lote.** `DELETE /api/contatos`
recebe `{ids:[]}` e faz `deleteMany` — cobre a lixeira por linha e a barra de seleção
em lote. Hard delete (LGPD art. 18 VI, eliminação real) — resolve a pendência que estava
em aberto. `Envio.contato` é `onDelete: Cascade`, então apagar contato apaga os disparos
ligados a ele, inclusive de campanhas já rodadas (somem do relatório) — avisado no modal
de confirmação. Validação de entrada na API (lista não vazia de strings). Pedido pelo
usuário.
2026-07-27 — **Auto-update profissional (electron-updater + GitHub Releases privado).**
Verifica no boot (`did-finish-load` → `checkForUpdates`), `autoDownload:false` (só baixa
no clique de "Atualizar agora"). Modal global `components/update/UpdateModal.tsx` montado
no layout: estados disponível → baixando (%, velocidade, MB/MB) → concluído ("será
reiniciado", `quitAndInstall` automático após ~2.6s) → erro (mensagem amigável +
"Tentar de novo"). "Já é a última versão" não abre janela. Ponte via `electron/preload.js`
(contextBridge `window.torreUpdate`) + IPC (`update:*`). `electron/updater.js` encapsula o
autoUpdater. **Token do repo privado NUNCA embutido**: lido de `GH_TOKEN` ou
`<pasta-dados>/update-token.txt` via `addAuthHeader`. Teste em dev: `TORRE_UPDATE_DEV=1`
+ `dev-app-update.yml` (provider generic apontando pra um `serve release/` local). Publicar:
`npm run dist:publish` com `GH_TOKEN`. **Pendência do usuário**: trocar `owner` em
`package.json > build.publish` (hoje `SEU-USUARIO-GITHUB`), criar o repo privado e gerar o
token. Escolha de hospedagem (GitHub privado) pedida pelo usuário.
2026-07-27 — **Token órfão `--color-danger` virou alias de `--color-error`** no globals.
Era usado em 3+ lugares (tipoTag fixo/inválido, `.acaoErro`, e agora exclusão) sem nunca
ter sido definido — caía no fallback (texto não ficava vermelho). Definido `--color-danger:
var(--color-error)` em `:root` (resolve nos dois temas). Conserta os pontos pré-existentes
de uma vez, alinhado ao brief (vermelho de sinal = falha/perigo).
2026-07-27 — **Versão bumpada 0.2.0 → 0.3.0** — baseline do auto-update. Junta o lote:
fixo descartado na importação, exclusão de contato (single + lote), auto-update
(electron-updater + GitHub privado `kauaaurelio/torre`) e o alias `--color-danger`.
Publicar via `npm run dist:publish` com `GH_TOKEN`. Base de contatos zerada a pedido do
usuário (27 → 0) antes do build. Artefato: `release/Torre-Setup-0.3.0.exe`.
2026-07-28 — **Bug do display da Fila: intervalo lia o Config global.** A Fila
(`app/api/fila/route.ts`) mostrava `cfg.intMin/intMax` (Config global, órfão em
78–324) em vez dos freios do chip que serve a campanha — os freios são POR NÚMERO
desde a decisão de multi-número. O ENVIO real sempre esteve certo (o worker lê
`sessao.intMin/intMax` fresco a cada ciclo); só o display enganava. Fix: a rota deriva
intMin/intMax/rampa/tetoHoje/enviadosHoje do(s) chip(s) que servem — fixo (`numeroId`)
→ o dele; rodízio (`numeroId null`) → span (menor mín, maior máx) e teto agregado.
O Config global agora é só template de chip novo + fallback. Versão 0.3.0 → **0.3.1**.
Artefato: `release/Torre-Setup-0.3.1.exe`.
2026-07-28 — **Rodízio vira round-robin de verdade (um manda, o outro manda).** Antes o
loop iterava as sessões e CADA chip, no seu próprio relógio, puxava da fila de rodízio —
os intervalos individuais faziam um chip esvaziar o teto enquanto o outro mal disparava,
e o descanso em lote de um deixava a impressão de "um até o limite, depois o outro". Agora
o worker separa: campanha **fixa** = loop por chip (inalterado); campanha em **rodízio** =
um único cadenciador (`loopRodizio`) que GIRA entre os chips elegíveis (`rodizioGiro`), um
disparo por vez, com **cadência compartilhada** (`rodizioProximoEm`) travada no dispatch —
A, B, A, B. Elegibilidade do rodízio ignora o intervalo curto individual (`proximoEnvioEm`);
só o descanso em lote tira o chip da rotação. Pra isso o descanso longo saiu de
`proximoEnvioEm` pra um campo próprio `descansoAte` (exclui o chip de fixo E de rodízio ao
mesmo tempo). `enviarUm`/`proximoEnvioDaSessao` viraram `despacha` + `proximoEnvioFixo` +
`proximoEnvioRodizio`. Pedido pelo usuário.
2026-07-28 — **Tetos da rampa agora são editáveis (números funcionais, não só visíveis).**
Em Configurações, os degraus da rampa (30/50/80/150) eram `<button>` só de exibição — dava
pra marcar o degrau do dia mas não mudar o teto. Viraram `<input type=number>` (aria-label
"Teto do dia N"), o card continua selecionando o degrau (agora `<div role=button>` com
Enter/Espaço; o input faz `stopPropagation`). O front já mandava `rampa` no PUT e
`/api/sessao` já persistia — faltava só a edição na UI. (Intervalo/breaker/lote/pausa já
eram funcionais.) Pedido pelo usuário.
2026-07-28 — **Auto-update: repo de releases passa a ser PÚBLICO.** O check falhava com
`HttpError: 404` em `github.com/kauaaurelio/torre/releases.atom` — repo privado sem token na
máquina (o `update-token.txt` nunca foi largado), então nunca baixava e parecia "sem
novidade". Decisão do usuário: repo público (`build.publish.private: false`). O instalador
não tem segredo (é o app compilado), e público dispensa token no lado do usuário final —
`electron-updater` baixa direto. Publicar ainda exige `GH_TOKEN` (criar a release), mas
RECEBER não. Mensagens do `updater.js` ajustadas. Versão **0.3.1 → 0.4.0**. **Pendência do
usuário:** tornar o repo `kauaaurelio/torre` público no GitHub e publicar a 0.4.0 via
`npm run dist:publish` (com `GH_TOKEN`) — só a partir de uma release > que a instalada o
auto-update dispara.

## Exceções a invariantes
2026-07-27 — Termos de uso do WhatsApp — a rota QR os viola; risco de banimento
do número aceito pelo usuário. Mitigação obrigatória: chip dedicado, nunca o
número principal da agência.
2026-07-27 — **Invariante #6 (mobile-first) removido** — projeto é desktop-first.
Motivo: ferramenta de operação densa, rodando localmente num PC; não existe
contexto de uso móvel. Pedido pelo usuário. Ressalva mantida: `.fita` e relatório
seguem legíveis em largura estreita, para consulta pelo celular com campanha
rodando. Custo aceito: retrofitar responsividade completa depois é mais caro que
ter feito agora.
2026-07-27 — **Invariante #4 (HTTPS em produção) suspenso** — não se aplica em
`127.0.0.1`. Volta a valer integralmente se o app sair da máquina.

## Freios obrigatórios (não são feature, são o que mantém o chip vivo)
| Freio | Regra |
|---|---|
| Intervalo | Aleatório 40–110s. Fixo é assinatura de bot. |
| Rampa | Teto diário crescente: 30 → 50 → 80 → 150. Sem pular degrau. |
| Janela | 08h–20h. Madrugada é o gesto mais denunciável que existe. |
| Variação | Cada contato recebe combinação diferente do texto. |
| Opt-out | "sair" / "parar" / "descadastrar" → permanente, cross-campanha. |
| Circuit breaker | Falha acima do limite ou desconexão → pausa a fila e avisa. |
| Descanso em lote | A cada N disparos (aleatório 7–13) o número pausa 30–60 min. Rajada curta + descanso imita humano. Por número, configurável. |
| Prova de opt-in | Campo obrigatório por contato: data, origem, quem cadastrou. |

## Pendências
- Backup do `data/torre.db` (era `pg_dump`; agora é copiar o arquivo SQLite) +
  destino (disco externo ou nuvem) antes da primeira importação real. `.baileys/`
  (identidade do chip) entra no mesmo backup.
- Desativar suspensão automática da máquina durante campanha
- Rampa: o degrau é manual (Configurações). Auto-avanço por dia (30→50→80→150)
  ainda não existe — o operador sobe o degrau à mão.
- ~~Exclusão de contato~~ **feita** (hard, single + lote). Edição manual de opt-in
  ainda não tem UI.
- ~~DECISÃO: exclusão soft ou hard?~~ **hard** (LGPD art. 18 VI — eliminação real).
- Auto-update: **tornar o repo `kauaaurelio/torre` PÚBLICO** no GitHub e publicar a
  release 0.4.0 via `npm run dist:publish` (com `GH_TOKEN` pra criar a release). Só a
  partir de uma release publicada > que a instalada o auto-update dispara. (Owner já
  trocado; `private: false` já no `package.json`.)
- DECISÃO: retenção de transcrição de conversa — prazo?
- Criptografia da sessão do Baileys em repouso — definir onde fica a chave
- Verificar limites de mídia (tamanho, formato) antes de prometer anexo
