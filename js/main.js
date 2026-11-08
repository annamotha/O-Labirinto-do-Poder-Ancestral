// =====================================================================
// main.js — junta tudo: cena 3D, estado do jogo, interação, áreas,
// inimigos, finais e o loop principal.
// =====================================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { AREAS, CORES, ESTRUTURAS, INIMIGOS, RELIQUIAS, PROLOGO, VIDAS_MAXIMAS, paraCadaCelula } from './mapa.js';
import {
  criarEstadoInicial, condicaoAtendida, estruturaBloqueia, celulaBloqueada, caractere,
  trocarLuz, oferecerAoGuardiao, clonarEstado,
} from './regras.js';
import { construirMundo, animarMundo, celulaParaMundo, mundoParaCelula } from './mundo.js';
import {
  construirCristais, pintarCristal, animarCristais, criarPoolDeLuzes, distribuirLuzes,
  construirEstruturas, animarEstruturas, criarFeixe, animarFeixes,
} from './cristais.js';
import { Assombracao, Guardiao } from './inimigos.js';
import { Jogador, RAIO_JOGADOR } from './jogador.js';
import { Lanterna } from './lanterna.js';
import { hud } from './hud.js';
import { iniciarAudio, atualizarAudio, som } from './audio.js';

// =====================================================================
// 1. CENA, CÂMERA, RENDERIZADOR E PÓS-PROCESSAMENTO (brilho/"bloom")
// =====================================================================
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x000000);
cena.fog = new THREE.Fog(0x000000, 8, 55);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 260);
camera.rotation.order = 'YXZ';
cena.add(camera);

const renderizador = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderizador.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderizador.setSize(innerWidth, innerHeight);
renderizador.toneMapping = THREE.ACESFilmicToneMapping;
renderizador.toneMappingExposure = 1.15;
renderizador.info.autoReset = false;   // contamos os desenhos de todos os passes do quadro
document.body.appendChild(renderizador.domElement);

// O "composer" desenha a cena e depois aplica o efeito de brilho nas partes muito claras
const composer = new EffectComposer(renderizador);
composer.addPass(new RenderPass(cena, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.4, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const luzAmbiente = new THREE.AmbientLight(0x5a6a90, 0.24);
cena.add(luzAmbiente);

// =====================================================================
// 2. ESTADO E CONSTRUÇÃO DO MUNDO
// =====================================================================
const estado = criarEstadoInicial();               // regras (ver regras.js)
const mundo = construirMundo(cena);
const cristais = construirCristais(cena, estado);
const estruturas = construirEstruturas(cena, estado);
const luzesCristais = criarPoolDeLuzes(cena, 6);

// Poeira flutuando no ar em volta do jogador (dá profundidade à escuridão)
const POEIRA = 260, CAIXA_POEIRA = 18;
const posPoeira = new Float32Array(POEIRA * 3).map(() => (Math.random() - 0.5) * CAIXA_POEIRA);
const geoPoeira = new THREE.BufferGeometry();
geoPoeira.setAttribute('position', new THREE.BufferAttribute(posPoeira, 3));
const texPonto = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const matPoeiraAr = new THREE.PointsMaterial({
  color: 0xb8c8ff, size: 0.05, map: texPonto, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false,
});
const poeira = new THREE.Points(geoPoeira, matPoeiraAr);
poeira.frustumCulled = false;
cena.add(poeira);

// Células ocupadas por cada estrutura (para saber se o jogador está em cima dela)
const celulasEstrutura = {};
paraCadaCelula((ch, col, lin) => { if (ESTRUTURAS[ch]) (celulasEstrutura[ch] ??= []).push([col, lin]); });

// Bloqueia a visão dos inimigos: paredes, portas fechadas, paredes ilusórias
const bloqueiaVisao = (c, l) => {
  const ch = caractere(c, l);
  if (ch === '#') return true;
  if (ch === '%') return !estado.reveladas.includes(`${c},${l}`);
  if (ESTRUTURAS[ch]?.tipo === 'porta') return !estado.estruturasAtivas[ch];
  return false;
};
const celulaLivre = (c, l) => !celulaBloqueada(c, l, estado);

let guardiao = null;
const inimigos = [];
paraCadaCelula((ch, col, lin) => {
  if (ch === 'G') guardiao = new Guardiao(cena, col, lin, (c, l) => caractere(c, l) === '#');
  if (INIMIGOS[ch]) inimigos.push(new Assombracao(cena, INIMIGOS[ch], col, lin, { celulaLivre, bloqueiaVisao }));
});

// =====================================================================
// 3. JOGADOR, COLISÃO E LANTERNA
// =====================================================================
// As 4 "quinas" do jogador (ele é um quadradinho de lado 2*RAIO)
function celulasDoJogador(x, z) {
  const r = RAIO_JOGADOR;
  return [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]].map(([a, b]) => mundoParaCelula(a, b));
}
const colide = (x, z) => celulasDoJogador(x, z).some(([c, l]) => celulaBloqueada(c, l, estado));
const jogador = new Jogador(camera, colide);
const lanterna = new Lanterna(camera);

function jogadorOcupa(celulas) {
  const minhas = celulasDoJogador(jogador.pos.x, jogador.pos.z);
  return celulas.some(([c, l]) => minhas.some(([mc, ml]) => mc === c && ml === l));
}

// =====================================================================
// 4. ESTADO DO JOGO
// =====================================================================
// 'menu' | 'jogando' | 'pausado' | 'lendo' | 'capturado' | 'morto' | 'escolha' | 'final'
let modo = 'menu';
let areaAtual = -1;
let pontoDeControle = null;      // cópia do estado ao entrar na área (para o "R")
let tempoDeJogo = 0;
let graca = 0;                   // segundos em que os inimigos ignoram o jogador
let tempoSegurandoR = 0;
let esperandoSoltarR = false;
let alvoMira = null;
let sequenciaFinal = null;
let modoTeste = false;
let vidas = VIDAS_MAXIMAS;
let invulneravel = 0;            // segundos de proteção depois de levar dano
let reliquiasColetadas = 0;
const neblinaAlvo = new THREE.Color(0x05070d);
const ambienteAlvo = new THREE.Color(0x5a6a90);
const pendentes = new Set();     // estruturas esperando o jogador sair de cima para mudar
const dicasMostradas = new Set();

function dicaUnica(id, texto, duracao) {
  if (dicasMostradas.has(id)) return;
  dicasMostradas.add(id);
  hud.toast(texto, duracao);
}

function corNome(cor) { return CORES[cor].nome.toUpperCase(); }

// =====================================================================
// 5. ESTRUTURAS: aplicar mudanças quando os cristais mudam
// =====================================================================
function atualizarEstruturas(silencioso = false) {
  for (const letra in ESTRUTURAS) {
    const alvo = condicaoAtendida(letra, estado.cristais);
    if (alvo === estado.estruturasAtivas[letra]) { pendentes.delete(letra); continue; }
    // Se a mudança for BLOQUEAR e o jogador estiver em cima, espera ele sair
    if (estruturaBloqueia(letra, alvo) && jogadorOcupa(celulasEstrutura[letra])) { pendentes.add(letra); continue; }
    pendentes.delete(letra);
    estado.estruturasAtivas[letra] = alvo;
    if (!silencioso) anunciarEstrutura(letra, alvo);
  }
}

function anunciarEstrutura(letra, ativa) {
  const def = ESTRUTURAS[letra];
  if (def.tipo === 'ponte') {
    som.estruturaLuz(ativa);
    hud.toast(ativa ? 'Uma ponte de luz se formou sobre o abismo.' : 'A ponte de luz se desfez.');
  } else if (def.tipo === 'barreira') {
    som.estruturaLuz(ativa);
    hud.toast(ativa ? 'Uma barreira de luz se ergueu.' : 'A barreira de luz se dissipou.');
  } else if (def.final && ativa) {
    som.selo();
    jogador.tremer(1.2);
    hud.toast('O SELO DO NÚCLEO SE ABRIU.', 5000);
    hud.area(4, AREAS[3].nome, 'Entre na câmara do Núcleo.');
  } else {
    som.porta();
    jogador.tremer(0.6);
    hud.toast(ativa ? 'Uma porta de pedra se abriu.' : 'Uma porta de pedra se fechou.');
  }
}

// =====================================================================
// 6. ÁREAS, CHECKPOINTS E REINÍCIO
// =====================================================================
function irParaCheckpoint(indice) {
  const { checkpoint, olhar } = AREAS[indice];
  const { x, z } = celulaParaMundo(...checkpoint);
  jogador.teleportar(x, z, Math.atan2(-olhar[0], -olhar[1]));
}

function entrarArea(indice) {
  areaAtual = indice;
  pontoDeControle = clonarEstado(estado);
  const a = AREAS[indice];
  hud.tituloArea(indice + 1, a.nome);
  hud.area(indice + 1, a.nome, a.objetivo);
  neblinaAlvo.setHex(a.atmosfera.neblina);
  ambienteAlvo.setHex(a.atmosfera.ambiente);
  if (indice > 0) {
    som.checkpoint();
    const curou = vidas < VIDAS_MAXIMAS;
    vidas = VIDAS_MAXIMAS;
    hud.vidas(vidas, VIDAS_MAXIMAS);
    hud.toast(curou ? 'Ponto de controle alcançado. Seus corações foram restaurados.' : 'Ponto de controle alcançado.', 3000);
  }
}

function verificarCheckpoint() {
  const [c, l] = mundoParaCelula(jogador.pos.x, jogador.pos.z);
  for (let i = areaAtual + 1; i < AREAS.length; i++) {
    const [cc, cl] = AREAS[i].checkpoint;
    if (c === cc && l === cl) entrarArea(i);
  }
}

// Copia um estado salvo de volta e atualiza todos os visuais
function restaurar(salvo) {
  const copia = clonarEstado(salvo);
  Object.assign(estado, copia);
  pendentes.clear();
  for (const c of Object.values(cristais)) pintarCristal(c, estado.cristais[c.letra]);
  for (const e of Object.values(estruturas)) e.progresso = estado.estruturasAtivas[e.letra] ? 1 : 0;
  for (const il of mundo.ilusorias) {
    il.revelada = estado.reveladas.includes(`${il.col},${il.lin}`);
    il.tempoOuro = 0;
    il.animacao = il.revelada ? 1 : 0;
  }
  guardiao?.definirAdormecido(estado.guardiaoAdormecido);
  lanterna.definirCor(estado.lanterna);
  hud.lanterna(estado.lanterna, lanterna.ligada);
}

async function reiniciarArea() {
  modo = 'capturado';
  await hud.fade(1, 0.4);
  restaurar(pontoDeControle);
  irParaCheckpoint(areaAtual);
  inimigos.forEach((i) => i.reiniciar());
  graca = 2;
  hud.toast('A área voltou ao estado em que você chegou.');
  await hud.fade(0, 0.5);
  modo = 'jogando';
}

// Levar dano: perde 1 coração, é empurrado para longe de quem bateu
function levarDano(origemX, origemZ, motivo) {
  if (invulneravel > 0 || modo !== 'jogando') return;
  vidas -= 1;
  invulneravel = 1.6;
  som.dano();
  hud.flashDano();
  hud.vidas(vidas, VIDAS_MAXIMAS, true);
  jogador.tremer(1);
  jogador.empurrar(jogador.pos.x - origemX, jogador.pos.z - origemZ, 13);
  if (vidas <= 0) { morrer(); return; }
  hud.toast(`${motivo} Restam ${vidas} ${vidas === 1 ? 'coração' : 'corações'}.`, 3000);
  if (vidas === 1) dicaUnica('ultimavida', 'Último coração! Procure fragmentos de vida ou alcance o próximo ponto de controle.', 4500);
}

// Sem corações: a área volta ao início, com os corações cheios
async function morrer() {
  modo = 'morto';
  som.morte();
  hud.morte(true);
  hud.vinheta(0);
  await new Promise((ok) => setTimeout(ok, 2600));
  await hud.fade(1, 0.6);
  hud.morte(false);
  restaurar(pontoDeControle);
  irParaCheckpoint(areaAtual);
  inimigos.forEach((i) => i.reiniciar());
  vidas = VIDAS_MAXIMAS;
  hud.vidas(vidas, VIDAS_MAXIMAS);
  graca = 3;
  await hud.fade(0, 0.8);
  modo = 'jogando';
  hud.toast('A área voltou ao estado em que você chegou.');
  if (!modoTeste && !controles.isLocked) pausar();
}

// Fragmentos de vida: pega ao passar perto (só se estiver ferido)
function verificarColetaveis() {
  for (const c of mundo.coracoes) {
    if (c.coletado) continue;
    if (Math.hypot(jogador.pos.x - c.x, jogador.pos.z - c.z) > 1.8) continue;
    if (vidas >= VIDAS_MAXIMAS) { dicaUnica('vidacheia', 'Um fragmento de vida. Volte aqui se estiver ferido.', 3500); continue; }
    c.coletado = true;
    c.grupo.visible = false;
    vidas += 1;
    som.coracao();
    hud.vidas(vidas, VIDAS_MAXIMAS);
    hud.toast('Fragmento de vida: +1 coração.');
  }
}

function coletarReliquia(r) {
  r.coletada = true;
  r.grupo.visible = false;
  r.alvo.userData.interativo = null;
  reliquiasColetadas += 1;
  som.reliquia();
  hud.reliquias(reliquiasColetadas, RELIQUIAS.length);
  modo = 'lendo';
  hud.leitura(r.texto, `Relíquia ${reliquiasColetadas}/${RELIQUIAS.length}: ${r.nome}`);
  hud.prompt('');
}

// =====================================================================
// 7. MIRA E INTERAÇÃO (Raycaster = "raio invisível" saindo do centro da tela)
// =====================================================================
const raycaster = new THREE.Raycaster();
raycaster.far = 6;
const CENTRO = new THREE.Vector2(0, 0);
const alvosInterativos = [
  ...Object.values(cristais).map((c) => c.alvo),
  ...mundo.placas.map((p) => p.alvo),
  ...(guardiao ? [guardiao.alvo] : []),
  ...mundo.reliquias.map((r) => r.alvo),
];
const obstaculosMira = [
  ...mundo.oclusores,
  ...Object.values(estruturas).filter((e) => e.tipo !== 'ponte').flatMap((e) => e.partes),
];
const listaMira = [...alvosInterativos, ...obstaculosMira];

function visivelDeVerdade(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function atualizarMira() {
  raycaster.setFromCamera(CENTRO, camera);
  alvoMira = null;
  for (const hit of raycaster.intersectObjects(listaMira, false)) {
    const obj = hit.object;
    if (!visivelDeVerdade(obj)) continue;
    const ilusoria = mundo.ilusorias.find((il) => il.malha === obj);
    if (ilusoria?.revelada) continue;
    const info = obj.userData.interativo;
    if (!info) break;                                     // algo sólido na frente
    if (info.tipo === 'placa' && info.placa.visibilidade < 0.5) continue;
    alvoMira = info;
    break;
  }
  hud.prompt(textoDoAlvo(alvoMira));
}

function textoDoAlvo(alvo) {
  if (!alvo) return '';
  const l = estado.lanterna;
  if (alvo.tipo === 'cristal') {
    const c = estado.cristais[alvo.letra];
    if (c && l) return `E — trocar: pegar ${CORES[c].nome}, deixar ${CORES[l].nome}`;
    if (c) return `E — absorver luz ${CORES[c].nome}`;
    if (l) return `E — transferir luz ${CORES[l].nome}`;
    return 'Cristal vazio';
  }
  if (alvo.tipo === 'placa') return 'E — ler inscrição';
  if (alvo.tipo === 'reliquia') return `E — examinar relíquia`;
  if (alvo.tipo === 'guardiao') return l ? `E — oferecer luz ${CORES[l].nome} ao Guardião` : 'O Guardião dorme. Ele espera uma luz.';
  return '';
}

const _origem = new THREE.Vector3();
function interagir() {
  if (!alvoMira) return;
  if (alvoMira.tipo === 'cristal') usarCristal(alvoMira.letra);
  else if (alvoMira.tipo === 'placa') abrirLeitura(alvoMira.placa);
  else if (alvoMira.tipo === 'guardiao') oferecerGuardiao();
  else if (alvoMira.tipo === 'reliquia') coletarReliquia(alvoMira.reliquia);
}

function usarCristal(letra) {
  const c = cristais[letra];
  const corAntesLanterna = estado.lanterna;
  const corAntesCristal = estado.cristais[letra];
  const resultado = trocarLuz(estado, letra);
  if (resultado === 'nada') { som.nada(); return; }

  pintarCristal(c, estado.cristais[letra]);
  lanterna.definirCor(estado.lanterna);
  hud.lanterna(estado.lanterna, lanterna.ligada);

  // efeito visual: feixe entre a lanterna e o cristal
  lanterna.modelo.getWorldPosition(_origem);
  const posCristal = c.cristal.getWorldPosition(new THREE.Vector3());
  if (corAntesCristal) { criarFeixe(cena, posCristal, _origem, corAntesCristal); som.absorver(corAntesCristal); }
  if (corAntesLanterna) { criarFeixe(cena, _origem, posCristal, corAntesLanterna); som.transferir(corAntesLanterna); }

  if (resultado === 'absorveu' || resultado === 'trocou') {
    const cor = estado.lanterna;
    dicaUnica('absorver', `Você carrega luz ${corNome(cor)} (${CORES[cor].poder}). Mire em outro cristal e aperte E para entregá-la.`, 5500);
    if (cor === 'dourado') dicaUnica('ouro', 'A luz DOURADA revela o que está oculto. Aponte a lanterna para as paredes.', 5500);
  }
  if (resultado === 'trocou') dicaUnica('trocar', 'As luzes trocaram de lugar: a lanterna guarda uma luz por vez.');
  atualizarEstruturas();
  atualizarObjetivo();
}

function oferecerGuardiao() {
  const corOferecida = estado.lanterna;
  const r = oferecerAoGuardiao(estado);
  if (r === 'vazia') { hud.toast('O Guardião permanece imóvel. Ele espera uma luz.'); return; }
  guardiao.reagir(r);
  if (r === 'recusou') {
    som.rugido();
    levarDano(guardiao.grupo.position.x, guardiao.grupo.position.z, `O Guardião desperta furioso e rejeita a luz ${corNome(corOferecida)}!`);
  } else if (r === 'aceitou') {
    som.guardiaoAceita();
    jogador.tremer(0.5);
    lanterna.definirCor(null);
    hud.lanterna(null, lanterna.ligada);
    hud.toast('O Guardião aceita a luz VERMELHA e se recolhe para dentro da pedra.', 5000);
  }
}

function abrirLeitura(placa) {
  som.ler();
  modo = 'lendo';
  hud.leitura(placa.texto);
  hud.prompt('');
}
function fecharLeitura() {
  hud.leitura(null);
  modo = 'jogando';
}

function atualizarObjetivo() {
  if (areaAtual !== 3 || estado.estruturasAtivas.N) return;
  const req = ESTRUTURAS.N.requer;
  const prontos = Object.entries(req).filter(([c, cor]) => estado.cristais[c] === cor).length;
  hud.area(4, AREAS[3].nome, `${AREAS[3].objetivo} (${prontos}/3)`);
}

// =====================================================================
// 8. REVELAÇÃO DOURADA (paredes ilusórias e inscrições ocultas)
// =====================================================================
function atualizarRevelacao(dt) {
  for (const il of mundo.ilusorias) {
    const { x, z } = celulaParaMundo(il.col, il.lin);
    if (!il.revelada) {
      const f = lanterna.fatorOuro(x, 1.6, z);
      il.malha.material.emissiveIntensity = f * 0.35;          // "brilha" quando iluminada
      il.bordas.material.opacity = f * 0.8;
      il.tempoOuro = f > 0.5 ? il.tempoOuro + dt : Math.max(0, il.tempoOuro - dt);
      if (il.tempoOuro > 0.4) {
        il.revelada = true;
        estado.reveladas.push(`${il.col},${il.lin}`);
        som.revelar();
        hud.toast('A parede era uma ilusão! Uma passagem se revela.');
      }
    } else if (il.animacao < 1) {
      il.animacao = Math.min(1, il.animacao + dt * 0.8);
    }
    if (il.revelada) {
      il.malha.material.opacity = 1 - il.animacao * 0.85;
      il.malha.material.emissiveIntensity = 0.4;
      il.malha.material.depthWrite = il.animacao < 0.5;
      il.bordas.material.opacity = 0.9;
    }
  }
  for (const p of mundo.placas) {
    if (!p.oculta) continue;
    const pos = p.grupo.position;
    const alvo = lanterna.fatorOuro(pos.x, pos.y, pos.z);
    p.visibilidade += (alvo - p.visibilidade) * Math.min(1, dt * 6);
    p.moldura.material.opacity = p.visibilidade;
    p.glifos.material.opacity = p.visibilidade;
    p.glifos.material.emissiveIntensity = p.visibilidade * 1.2;
    if (p.visibilidade > 0.6) dicaUnica(`placa${p.numero}`, 'Uma inscrição oculta surge sob a luz dourada.');
  }
}

// =====================================================================
// 9. INIMIGOS E PERIGO
// =====================================================================
// O Errante enxerga quem está iluminado: lanterna acesa, ou perto de cristal aceso ou braseiro
function jogadorIluminado() {
  if (lanterna.ligada) return true;
  const perto = (x, z, r) => Math.hypot(jogador.pos.x - x, jogador.pos.z - z) < r;
  return Object.values(cristais).some((c) => c.cor && perto(c.grupo.position.x, c.grupo.position.z, 5))
    || mundo.braseiros.some((b) => perto(b.x, b.z, 6));
}

let vinhetaAtual = -1;
let medo = 0;
function atualizarInimigos(dt) {
  const contexto = {
    jogador: jogador.pos,
    iluminado: jogadorIluminado(),
    correndo: jogador.correndo,
    graca,
    fatorOuro: (x, y, z) => lanterna.fatorOuro(x, y, z),
  };
  let perigo = 0, sussurro = 0;
  medo = 0;
  for (const ini of inimigos) {
    const ev = ini.atualizar(dt, contexto);
    const dist = ini.pos.distanceTo(new THREE.Vector3(jogador.pos.x, 0, jogador.pos.z));
    if (ini.ehEspectro) {
      sussurro = Math.max(sussurro, 1 - dist / 14);
    } else {
      if (ini.modo === 'perseguicao') perigo = 1;
      else if (dist < 12) perigo = Math.max(perigo, 0.25);
      if (ev.alertou) {
        som.alerta();
        dicaUnica('errante', 'O Errante te viu! Corra (Shift), apague a lanterna (F) e se esconda atrás de uma coluna.', 5000);
      }
    }
    if (!ini.ehEspectro || sussurro > 0.5) medo = Math.max(medo, Math.max(0, 1 - dist / 10));
    if (ev.acertou && modo === 'jogando') {
      levarDano(ini.pos.x, ini.pos.z, ini.ehEspectro ? 'Um toque gelado e invisível te atravessa!' : 'O Errante te alcançou!');
      if (modo !== 'jogando') return;
    }
  }
  sussurro = Math.max(0, sussurro);
  if (sussurro > 0.3) dicaUnica('espectro', 'Um sussurro gelado... há algo invisível aqui. Talvez o ouro o revele.', 5000);
  const fogo = mundo.braseiros.reduce((m, b) => Math.max(m, 1 - Math.hypot(jogador.pos.x - b.x, jogador.pos.z - b.z) / 10), 0);
  atualizarAudio(dt, { nivelPerigo: perigo, nivelSussurro: sussurro, nivelFogo: fogo });
  const v = perigo >= 1 ? 0.55 + Math.sin(performance.now() / 150) * 0.15 : sussurro * 0.6;
  if (Math.abs(v - vinhetaAtual) > 0.02) {
    vinhetaAtual = v;
    hud.vinheta(v, perigo >= 1 ? '160, 0, 0' : '90, 150, 255');
  }
}

// =====================================================================
// 10. O NÚCLEO E OS DOIS FINAIS
// =====================================================================
function verificarNucleo() {
  const n = mundo.nucleo;
  if (!n || !estado.estruturasAtivas.N) return;
  if (Math.hypot(jogador.pos.x - n.x, jogador.pos.z - n.z) < 5) {
    modo = 'escolha';
    hud.prompt('');
    hud.mostrar(false);
    controles.unlock();
    hud.escolha(true);
  }
}

const FINAIS = {
  poder: {
    titulo: 'O Poder Tomado',
    texto: 'Você toma o Núcleo. As três luzes se apagam de uma só vez e, por um instante, o mundo inteiro obedece à sua vontade. As paredes se abrem para a superfície... e algo imenso se ergue das profundezas atrás de você, finalmente livre. Na sua mão, a lanterna pulsa — satisfeita. Você escapou. Ele também. Ou será que ele sempre esteve na sua mão?',
  },
  selo: {
    titulo: 'O Selo Preservado',
    texto: 'Você recua. A lanterna devolve sua última luz ao Núcleo, e o selo se fortalece como não fazia há milênios. Uma passagem estreita se abre entre as raízes da pedra e leva você de volta à superfície. Na saída, a lanterna se apaga e se desfaz em pó. Ninguém jamais saberá o que você recusou — e é por isso que o mundo continua inteiro.',
  },
};

function escolherFinal(tipo) {
  hud.escolha(false);
  modo = 'final';
  sequenciaFinal = { tipo, t: 0, terminou: false };
  const n = mundo.nucleo;
  n.modo = tipo;
  camera.lookAt(n.x, 2, n.z);
  tipo === 'poder' ? som.finalPoder() : som.finalSelo();
}

async function animarFinal(dt) {
  const s = sequenciaFinal;
  const n = mundo.nucleo;
  s.t += dt;
  if (s.tipo === 'poder') {
    n.core.material.emissive.setHex(CORES.vermelho.hex);
    n.casca.material.color.setHex(CORES.vermelho.hex);
    n.luz.color.setHex(CORES.vermelho.hex);
    n.luz.intensity = 25 + s.t * 30;
    n.core.scale.setScalar(1 + s.t * 0.25);
    jogador.tremer(Math.min(1.5, s.t * 0.4));
    hud.vinheta(0.4 + Math.sin(s.t * 8) * 0.3, '160, 0, 0');
  } else {
    n.core.material.emissive.lerp(new THREE.Color(0xcfe6ff), dt);
    n.casca.material.color.lerp(new THREE.Color(0xcfe6ff), dt);
    n.luz.color.lerp(new THREE.Color(0xcfe6ff), dt);
    n.luz.intensity = Math.max(4, 25 - s.t * 5);
    n.core.scale.setScalar(Math.max(0.4, 1 - s.t * 0.12));
  }
  jogador.aplicarCamera();
  if (s.t > 4.5 && !s.terminou) {
    s.terminou = true;
    await hud.fade(1, 1.6, s.tipo === 'poder' ? '#000' : '#fff');
    hud.vinheta(0);
    const f = FINAIS[s.tipo];
    hud.final(f.titulo, f.texto, tempoDeJogo, reliquiasColetadas, RELIQUIAS.length);
  }
}

// =====================================================================
// 11. CONTROLES E MENUS
// =====================================================================
const controles = new PointerLockControls(camera, document.body);
let jaComecou = false;

function comecar() {
  modo = 'jogando';
  hud.menu(false);
  hud.mostrar(true);
  if (!jaComecou) {
    jaComecou = true;
    irParaCheckpoint(0);
    entrarArea(0);
    hud.lanterna(null, true);
    hud.vidas(vidas, VIDAS_MAXIMAS);
    hud.reliquias(0, RELIQUIAS.length);
  }
}

function pausar() {
  if (modo === 'lendo') hud.leitura(null);
  modo = 'pausado';
  hud.menu(true, true);
}

document.getElementById('botao-jogar').addEventListener('click', () => {
  iniciarAudio();
  controles.lock();
});
controles.addEventListener('lock', () => { if (modo === 'menu' || modo === 'pausado') comecar(); });
controles.addEventListener('unlock', () => { if (modo === 'jogando' || modo === 'lendo') pausar(); });

document.getElementById('botao-tomar').addEventListener('click', () => escolherFinal('poder'));
document.getElementById('botao-preservar').addEventListener('click', () => escolherFinal('selo'));
document.getElementById('botao-recomecar').addEventListener('click', () => location.reload());

const teclas = {};
addEventListener('keydown', (e) => {
  teclas[e.code] = true;
  if (e.repeat) return;
  if (modo === 'lendo' && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) { fecharLeitura(); return; }
  if (modo !== 'jogando') return;
  if (e.code === 'KeyE') interagir();
  if (e.code === 'KeyF') { lanterna.alternar(); hud.lanterna(estado.lanterna, lanterna.ligada); }
  if (e.code === 'KeyB') {   // computador lento? desliga o efeito de brilho
    bloom.enabled = !bloom.enabled;
    hud.toast(bloom.enabled ? 'Efeito de brilho ligado.' : 'Efeito de brilho desligado (mais leve).', 2000);
  }
});
addEventListener('keyup', (e) => {
  teclas[e.code] = false;
  if (e.code === 'KeyR') esperandoSoltarR = false;
});
addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (modo === 'lendo') fecharLeitura();
  else if (modo === 'jogando' && (controles.isLocked || modoTeste)) interagir();
});
addEventListener('blur', () => { for (const k in teclas) teclas[k] = false; });

// =====================================================================
// 12. LOOP PRINCIPAL
// =====================================================================
const relogio = new THREE.Clock();
let tempo = 0;
let quadros = 0;

function loop() {
  requestAnimationFrame(loop);
  quadros++;
  const dt = Math.min(relogio.getDelta(), 0.1);
  tempo += dt;

  if (modo === 'jogando') {
    tempoDeJogo += dt;
    graca = Math.max(0, graca - dt);
    invulneravel = Math.max(0, invulneravel - dt);
    if (jogador.atualizar(dt, teclas, true)) som.passo(jogador.correndo);
    if (pendentes.size) atualizarEstruturas();
    verificarCheckpoint();
    verificarColetaveis();
    atualizarMira();
    atualizarRevelacao(dt);
    atualizarInimigos(dt);
    verificarNucleo();

    // segurar R para reiniciar a área
    if (teclas.KeyR && !esperandoSoltarR) {
      tempoSegurandoR += dt;
      if (tempoSegurandoR > 1.2) { esperandoSoltarR = true; tempoSegurandoR = 0; reiniciarArea(); }
    } else tempoSegurandoR = 0;
    hud.reinicio(tempoSegurandoR / 1.2);
  } else if (modo === 'lendo' || modo === 'capturado' || modo === 'morto') {
    jogador.atualizar(dt, teclas, false);
  } else if (modo === 'final' && sequenciaFinal) {
    animarFinal(dt);
  }

  lanterna.atualizar(dt, jogador.faseDoPasso, medo);
  animarCristais(cristais, dt, tempo);
  animarEstruturas(estruturas, estado, dt, tempo);
  animarFeixes(cena, dt);
  animarMundo(mundo, dt, tempo);
  atualizarAtmosfera(dt);
  guardiao?.atualizar(dt, tempo);
  distribuirLuzes(luzesCristais, cristais, mundo.braseiros, jogador.pos, tempo);

  renderizador.info.reset();
  composer.render();
}

// A cor da neblina e da luz ambiente muda devagar ao entrar em outra área,
// e a poeira acompanha o jogador
function atualizarAtmosfera(dt) {
  const k = Math.min(1, dt * 0.8);
  cena.fog.color.lerp(neblinaAlvo, k);
  cena.background.copy(cena.fog.color);
  luzAmbiente.color.lerp(ambienteAlvo, k);
  matPoeiraAr.color.copy(luzAmbiente.color).lerp(new THREE.Color(0xffffff), 0.5);
  const c = camera.position, metade = CAIXA_POEIRA / 2;
  for (let i = 0; i < POEIRA; i++) {
    const ix = i * 3;
    posPoeira[ix] += Math.sin(tempo * 0.3 + i) * dt * 0.08;
    posPoeira[ix + 1] += dt * 0.05 * (i % 3 - 1);
    // mantém cada partícula dentro de uma caixa em volta da câmera
    for (let eixo = 0; eixo < 3; eixo++) {
      const centro = eixo === 0 ? c.x : eixo === 1 ? 2.5 : c.z;
      const meia = eixo === 1 ? 2.5 : metade;
      let v = posPoeira[ix + eixo];
      if (v < centro - meia) v += meia * 2;
      if (v > centro + meia) v -= meia * 2;
      posPoeira[ix + eixo] = v;
    }
    // nenhuma partícula colada no rosto (ficaria enorme na tela)
    const dx = posPoeira[ix] - c.x, dz = posPoeira[ix + 2] - c.z;
    if (dx * dx + dz * dz < 2) posPoeira[ix] += dx >= 0 ? 1.5 : -1.5;
  }
  geoPoeira.attributes.position.needsUpdate = true;
}

document.getElementById('menu-historia').textContent = PROLOGO;

// Posição inicial (atrás do menu, o labirinto já aparece ao fundo)
irParaCheckpoint(0);
hud.lanterna(null, true);
loop();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderizador.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// =====================================================================
// 13. GANCHOS PARA TESTES AUTOMÁTICOS (usados por testes/jogar.mjs)
// =====================================================================
window.__jogo = {
  iniciar() { modoTeste = true; comecar(); },
  teleportar(c, l) { const { x, z } = celulaParaMundo(c, l); jogador.teleportar(x, z); },
  olharPara(c, l, y = 1.6) { const { x, z } = celulaParaMundo(c, l); camera.lookAt(x, y, z); },
  olharPonto(x, y, z) { camera.lookAt(x, y, z); },
  info() {
    return {
      modo, area: areaAtual, lanterna: estado.lanterna, cristais: { ...estado.cristais },
      estruturas: { ...estado.estruturasAtivas }, guardiao: estado.guardiaoAdormecido,
      reveladas: [...estado.reveladas], celula: mundoParaCelula(jogador.pos.x, jogador.pos.z),
      alvo: alvoMira ? { ...alvoMira, placa: undefined } : null, pendentes: [...pendentes],
      inimigos: inimigos.map((i) => ({ tipo: i.config.tipo, modo: i.modo, celula: i.celula, alertas: i.alertas || 0 })),
      final: sequenciaFinal?.tipo ?? null, quadros, vidas, reliquias: reliquiasColetadas,
      desenhos: renderizador.info.render.calls, triangulos: renderizador.info.render.triangles,
    };
  },
  escolherFinal,
  definirGraca(s) { graca = s; },
  definirVidas(v) { vidas = v; hud.vidas(vidas, VIDAS_MAXIMAS); },
};
