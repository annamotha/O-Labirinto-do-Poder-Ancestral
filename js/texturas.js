// =====================================================================
// texturas.js — texturas desenhadas por código (canvas), sem arquivos de imagem.
// Vantagem: nada para baixar, nenhum problema de direitos autorais.
// =====================================================================
import * as THREE from 'three';

// Gerador de números "aleatórios" previsível (mesma semente = mesmo desenho)
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function criarCanvas(largura, altura) {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  return [canvas, canvas.getContext('2d')];
}

function paraTextura(canvas, cor = true) {
  const tex = new THREE.CanvasTexture(canvas);
  if (cor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Pontinhos claros/escuros para dar aspecto de pedra
function granulado(ctx, w, h, rnd, quantidade, alfa) {
  for (let i = 0; i < quantidade; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${rnd() * alfa})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

// Desenha um "símbolo ancestral" feito de traços retos e um círculo
export function desenharRuna(ctx, x, y, tam, rnd) {
  ctx.beginPath();
  const tracos = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < tracos; i++) {
    const ax = x + (rnd() - 0.5) * tam, ay = y + (rnd() - 0.5) * tam;
    const bx = x + (rnd() - 0.5) * tam, by = y + (rnd() - 0.5) * tam;
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  if (rnd() < 0.5) {
    ctx.moveTo(x + tam * 0.25, y);
    ctx.arc(x, y, tam * 0.25, 0, Math.PI * 2);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------
// Parede de blocos de pedra
// ---------------------------------------------------------------------
export function texturaParede() {
  const W = 512, H = 512;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(7);
  ctx.fillStyle = '#1c1916';            // argamassa
  ctx.fillRect(0, 0, W, H);

  const alturaBloco = 64;
  for (let y = 0; y < H; y += alturaBloco) {
    let x = (y / alturaBloco) % 2 ? -60 : 0;
    while (x < W) {
      const largura = 90 + rnd() * 80;
      const tom = 58 + rnd() * 22;
      ctx.fillStyle = `rgb(${tom + 6},${tom + 2},${tom - 4})`;
      ctx.fillRect(x + 3, y + 3, largura - 6, alturaBloco - 6);
      // sombra embaixo de cada bloco
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 3, y + alturaBloco - 10, largura - 6, 7);
      // runas gravadas em alguns blocos
      if (rnd() < 0.12) {
        ctx.strokeStyle = 'rgba(20,16,12,0.7)';
        ctx.lineWidth = 3;
        desenharRuna(ctx, x + largura / 2, y + alturaBloco / 2, 34, rnd);
      }
      x += largura;
    }
  }
  granulado(ctx, W, H, rnd, 9000, 0.18);
  return paraTextura(canvas);
}

// ---------------------------------------------------------------------
// Piso de lajes
// ---------------------------------------------------------------------
export function texturaPiso() {
  const W = 512, H = 512;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(21);
  ctx.fillStyle = '#121010';
  ctx.fillRect(0, 0, W, H);
  const n = 4, t = W / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const tom = 38 + rnd() * 16;
      ctx.fillStyle = `rgb(${tom + 4},${tom + 1},${tom - 2})`;
      ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
      // rachaduras
      if (rnd() < 0.35) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let x = i * t + rnd() * t, y = j * t + rnd() * t;
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
  }
  granulado(ctx, W, H, rnd, 7000, 0.2);
  return paraTextura(canvas);
}

// ---------------------------------------------------------------------
// Teto rústico
// ---------------------------------------------------------------------
export function texturaTeto() {
  const W = 256, H = 256;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(3);
  ctx.fillStyle = '#1a1714';
  ctx.fillRect(0, 0, W, H);
  granulado(ctx, W, H, rnd, 6000, 0.3);
  return paraTextura(canvas);
}

// ---------------------------------------------------------------------
// Grade luminosa (pontes e barreiras de luz)
// ---------------------------------------------------------------------
export function texturaGradeLuz() {
  const W = 256, H = 256;
  const [canvas, ctx] = criarCanvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  // padrão de losangos
  for (let i = -W; i < W * 2; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke();
  }
  return paraTextura(canvas, false);
}

// ---------------------------------------------------------------------
// Runas brilhantes (portas): fundo preto, símbolos brancos -> usado como emissiveMap
// ---------------------------------------------------------------------
export function texturaRunas(semente = 5) {
  const W = 256, H = 256;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(semente);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  // moldura e uma coluna de runas no centro
  ctx.strokeRect(14, 14, W - 28, H - 28);
  for (let y = 50; y < H - 30; y += 52) desenharRuna(ctx, W / 2, y, 40, rnd);
  return paraTextura(canvas, false);
}

// ---------------------------------------------------------------------
// Placa de inscrição (símbolos que "parecem" escrita antiga)
// ---------------------------------------------------------------------
export function texturaPlaca(semente, corTraco) {
  const W = 256, H = 192;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(semente);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = corTraco;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.strokeRect(8, 8, W - 16, H - 16);
  for (let y = 36; y < H - 20; y += 34) {
    for (let x = 34; x < W - 20; x += 30) desenharRuna(ctx, x, y, 18, rnd);
  }
  return paraTextura(canvas, false);
}

// ---------------------------------------------------------------------
// Rachaduras brilhantes (emissiveMap): o selo enfraquecendo nas áreas mais fundas
// ---------------------------------------------------------------------
export function texturaRachaduras(semente, quantidade) {
  const W = 512, H = 512;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(semente);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  for (let i = 0; i < quantidade; i++) {
    let x = rnd() * W, y = rnd() * H;
    let ang = rnd() * Math.PI * 2;
    ctx.lineWidth = 1 + rnd() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const passos = 6 + Math.floor(rnd() * 10);
    for (let k = 0; k < passos; k++) {
      ang += (rnd() - 0.5) * 1.2;
      x += Math.cos(ang) * (10 + rnd() * 18);
      y += Math.sin(ang) * (10 + rnd() * 18);
      ctx.lineTo(x, y);
      if (rnd() < 0.2) {                 // ramificação
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40);
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  return paraTextura(canvas, false);
}

// ---------------------------------------------------------------------
// Estandarte roxo com borda dourada e ponta rasgada
// ---------------------------------------------------------------------
export function texturaEstandarte(semente) {
  const W = 128, H = 320;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(semente);
  // tecido com ponta em "V" e rasgos (o resto fica transparente)
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H - 50);
  for (let x = W; x >= 0; x -= 8) ctx.lineTo(x, H - 50 + (1 - Math.abs(x - W / 2) / (W / 2)) * 40 + rnd() * 14);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#1e0c33'); grad.addColorStop(0.5, '#3d1a66'); grad.addColorStop(1, '#1e0c33');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.save();
  ctx.clip();
  granulado(ctx, W, H, rnd, 1500, 0.25);
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 5;
  ctx.strokeRect(8, -10, W - 16, H - 40);
  ctx.restore();
  return paraTextura(canvas);
}
export function texturaEstandarteRuna(semente) {
  const W = 128, H = 320;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(semente);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(W / 2, 110, 30, 0, Math.PI * 2);
  ctx.stroke();
  desenharRuna(ctx, W / 2, 110, 40, rnd);
  desenharRuna(ctx, W / 2, 190, 30, rnd);
  return paraTextura(canvas, false);
}

// ---------------------------------------------------------------------
// Poeira dourada no chão (pista da parede ilusória)
// ---------------------------------------------------------------------
export function texturaPoeira(semente) {
  const W = 256, H = 256;
  const [canvas, ctx] = criarCanvas(W, H);
  const rnd = aleatorio(semente);
  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W, y = rnd() * H;
    ctx.fillStyle = `rgba(255, ${190 + rnd() * 50}, 80, ${rnd() * 0.9})`;
    ctx.fillRect(x, y, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
  }
  ctx.strokeStyle = 'rgba(255,200,90,0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {        // ranhuras de algo arrastado em direção à parede
    const y = 30 + rnd() * (H - 60);
    ctx.beginPath(); ctx.moveTo(W, y); ctx.lineTo(rnd() * 60, y + (rnd() - 0.5) * 20); ctx.stroke();
  }
  return paraTextura(canvas);
}

// Círculo de runas (chão em volta do Núcleo)
export function texturaCirculoRunas() {
  const W = 512;
  const [canvas, ctx] = criarCanvas(W, W);
  const rnd = aleatorio(99);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.46, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.36, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    desenharRuna(ctx, W / 2 + Math.cos(a) * W * 0.41, W / 2 + Math.sin(a) * W * 0.41, 30, rnd);
  }
  return paraTextura(canvas, false);
}
