// =====================================================================
// audio.js — todos os sons são SINTETIZADOS com a Web Audio API.
// Nenhum arquivo de som: osciladores (tons) + ruído filtrado (texturas).
// =====================================================================

let ctx = null;        // AudioContext (só pode ser criado depois de um clique)
let mestre = null;     // volume geral
let bufferRuido = null;

// Nós contínuos controlados a cada quadro
let ganhoSussurro = null;
let perigo = 0;
let tempoBatida = 0;

export function iniciarAudio() {
  if (ctx) { ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ctx = new Ctx();
  mestre = ctx.createGain();
  mestre.gain.value = 0.7;
  mestre.connect(ctx.destination);

  // 2 segundos de ruído branco, reaproveitado por vários sons
  bufferRuido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const dados = bufferRuido.getChannelData(0);
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;

  criarAmbiente();
  criarSussurro();
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function tom({ freq = 440, freqFinal = null, tipo = 'sine', dur = 0.3, vol = 0.2, ataque = 0.01, atraso = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + atraso;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  if (freqFinal) osc.frequency.exponentialRampToValueAtTime(freqFinal, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(mestre);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function ruido({ dur = 0.3, vol = 0.2, filtro = 'lowpass', freq = 800, freqFinal = null, q = 1, ataque = 0.005, atraso = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + atraso;
  const fonte = ctx.createBufferSource();
  fonte.buffer = bufferRuido;
  fonte.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filtro;
  f.frequency.setValueAtTime(freq, t);
  if (freqFinal) f.frequency.exponentialRampToValueAtTime(freqFinal, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fonte.connect(f).connect(g).connect(mestre);
  fonte.start(t, Math.random());
  fonte.stop(t + dur + 0.05);
}

// Frequência base de cada cor (para cada luz ter "sua nota")
const NOTA = { azul: 523, vermelho: 392, dourado: 659 };

// ---------------------------------------------------------------------
// Ambiente: zumbido grave + vento, sempre tocando bem baixinho
// ---------------------------------------------------------------------
function criarAmbiente() {
  const g = ctx.createGain();
  g.gain.value = 0.12;
  g.connect(mestre);
  [55, 55.6, 82.4].forEach((f) => {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start();
  });
  // vento: ruído com filtro que oscila lentamente
  const vento = ctx.createBufferSource();
  vento.buffer = bufferRuido;
  vento.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 300;
  f.Q.value = 0.7;
  const lfo = ctx.createOscillator();
  const lfoGanho = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGanho.gain.value = 180;
  lfo.connect(lfoGanho).connect(f.frequency);
  lfo.start();
  const gv = ctx.createGain();
  gv.gain.value = 0.05;
  vento.connect(f).connect(gv).connect(mestre);
  vento.start();
}

// Sussurro do Espectro: ruído agudo cujo volume depende da distância
function criarSussurro() {
  const fonte = ctx.createBufferSource();
  fonte.buffer = bufferRuido;
  fonte.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  f.Q.value = 8;
  const trem = ctx.createOscillator();       // "tremor" na voz
  const tremG = ctx.createGain();
  trem.frequency.value = 5;
  tremG.gain.value = 600;
  trem.connect(tremG).connect(f.frequency);
  trem.start();
  ganhoSussurro = ctx.createGain();
  ganhoSussurro.gain.value = 0;
  fonte.connect(f).connect(ganhoSussurro).connect(mestre);
  fonte.start();
}

// ---------------------------------------------------------------------
// Chamado todo quadro: batimento cardíaco quando há perigo, sussurro do espectro
// ---------------------------------------------------------------------
export function atualizarAudio(dt, { nivelPerigo = 0, nivelSussurro = 0, nivelFogo = 0 }) {
  if (!ctx) return;
  // estalos de fogo perto dos braseiros
  if (Math.random() < nivelFogo * dt * 14) {
    ruido({ dur: 0.03 + Math.random() * 0.05, vol: 0.03 + nivelFogo * 0.07, filtro: 'bandpass', freq: 1500 + Math.random() * 2500, q: 3 });
  }
  perigo = nivelPerigo;
  ganhoSussurro.gain.setTargetAtTime(nivelSussurro * 0.35, ctx.currentTime, 0.1);
  if (perigo > 0.05) {
    tempoBatida -= dt;
    if (tempoBatida <= 0) {
      tempoBatida = 1.0 - perigo * 0.55;
      tom({ freq: 60, freqFinal: 40, dur: 0.18, vol: 0.25 + perigo * 0.35 });
      tom({ freq: 55, freqFinal: 38, dur: 0.18, vol: 0.18 + perigo * 0.3, atraso: 0.22 });
    }
  }
}

// ---------------------------------------------------------------------
// Efeitos sonoros
// ---------------------------------------------------------------------
export const som = {
  passo(correndo) {
    ruido({ dur: 0.09, vol: correndo ? 0.09 : 0.06, freq: 500 + Math.random() * 200 });
  },
  absorver(cor) {
    const n = NOTA[cor] || 500;
    tom({ freq: n / 2, freqFinal: n, dur: 0.45, vol: 0.18, ataque: 0.05 });
    tom({ freq: n, freqFinal: n * 2, dur: 0.5, vol: 0.08, tipo: 'triangle', atraso: 0.05 });
  },
  transferir(cor) {
    const n = NOTA[cor] || 500;
    tom({ freq: n * 2, freqFinal: n, dur: 0.45, vol: 0.12, tipo: 'triangle' });
    tom({ freq: n, freqFinal: n / 2, dur: 0.5, vol: 0.16, atraso: 0.04 });
  },
  nada() {
    tom({ freq: 140, dur: 0.12, vol: 0.12, tipo: 'square' });
  },
  estruturaLuz(apareceu) {   // ponte/barreira de luz surgindo ou sumindo
    const base = apareceu ? [440, 554, 659] : [659, 554, 440];
    base.forEach((f, i) => tom({ freq: f, dur: 0.9, vol: 0.07, ataque: 0.15, atraso: i * 0.09 }));
  },
  porta() {
    ruido({ dur: 1.6, vol: 0.35, freq: 140, q: 2, ataque: 0.2 });
    tom({ freq: 45, dur: 1.4, vol: 0.2, tipo: 'sawtooth', ataque: 0.2 });
  },
  revelar() {
    [784, 988, 1175, 1568].forEach((f, i) => tom({ freq: f, dur: 1.2, vol: 0.06, atraso: i * 0.08 }));
  },
  ler() {
    ruido({ dur: 0.25, vol: 0.05, filtro: 'highpass', freq: 3000 });
  },
  rugido() {
    tom({ freq: 90, freqFinal: 50, dur: 1.2, vol: 0.4, tipo: 'sawtooth', ataque: 0.05 });
    ruido({ dur: 1.0, vol: 0.4, freq: 400, freqFinal: 120, q: 3 });
  },
  guardiaoAceita() {
    tom({ freq: 196, freqFinal: 98, dur: 2.0, vol: 0.2, ataque: 0.3 });
    ruido({ dur: 2.2, vol: 0.2, freq: 120, ataque: 0.3 });
  },
  alerta() {   // o Errante te viu
    tom({ freq: 220, freqFinal: 70, dur: 0.8, vol: 0.3, tipo: 'sawtooth' });
    ruido({ dur: 0.6, vol: 0.25, freq: 900, freqFinal: 200, q: 4 });
  },
  captura() {
    ruido({ dur: 1.2, vol: 0.5, freq: 3000, freqFinal: 100 });
    tom({ freq: 110, freqFinal: 30, dur: 1.4, vol: 0.4, tipo: 'sawtooth' });
  },
  checkpoint() {
    [392, 523, 784].forEach((f, i) => tom({ freq: f, dur: 1.5, vol: 0.06, ataque: 0.2, atraso: i * 0.15 }));
  },
  selo() {     // porta final
    [262, 330, 392, 523, 659].forEach((f, i) => tom({ freq: f, dur: 2.5, vol: 0.08, ataque: 0.3, atraso: i * 0.2 }));
    ruido({ dur: 2.5, vol: 0.3, freq: 100, ataque: 0.4 });
  },
  dano() {
    tom({ freq: 160, freqFinal: 50, dur: 0.5, vol: 0.45, tipo: 'sawtooth' });
    ruido({ dur: 0.35, vol: 0.4, freq: 1200, freqFinal: 200, q: 2 });
  },
  coracao() {
    [523, 659, 784, 1046].forEach((f, i) => tom({ freq: f, dur: 0.5, vol: 0.09, tipo: 'triangle', atraso: i * 0.07 }));
  },
  reliquia() {
    [294, 370, 440, 587].forEach((f, i) => tom({ freq: f, dur: 2.2, vol: 0.07, ataque: 0.2, atraso: i * 0.12 }));
    ruido({ dur: 1.5, vol: 0.05, filtro: 'highpass', freq: 5000, ataque: 0.3 });
  },
  morte() {
    tom({ freq: 110, freqFinal: 27, dur: 2.5, vol: 0.45, tipo: 'sawtooth', ataque: 0.05 });
    ruido({ dur: 2.5, vol: 0.4, freq: 600, freqFinal: 60 });
  },
  finalPoder() {
    tom({ freq: 40, dur: 5, vol: 0.4, tipo: 'sawtooth', ataque: 1 });
    ruido({ dur: 5, vol: 0.5, freq: 200, freqFinal: 60, ataque: 1 });
    [0.5, 1.5, 2.3, 3.0, 3.6].forEach((a) => ruido({ dur: 0.6, vol: 0.4, freq: 300, atraso: a }));
  },
  finalSelo() {
    [262, 330, 392, 494, 523].forEach((f, i) => tom({ freq: f, dur: 4.5, vol: 0.07, ataque: 1, atraso: i * 0.3 }));
  },
};
