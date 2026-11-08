// =====================================================================
// cristais.js — cristais (onde a luz fica guardada) e as estruturas que
// eles controlam: pontes, barreiras e portas.
// =====================================================================
import * as THREE from 'three';
import { CORES, ESTRUTURAS, paraCadaCelula, ehCristal } from './mapa.js';
import { T, ALTURA, celulaParaMundo, rotacaoPassagem } from './mundo.js';
import { texturaGradeLuz, texturaRunas } from './texturas.js';

const COR_VAZIO = new THREE.Color(0x4a5566);

// ---------------------------------------------------------------------
// CRISTAIS
// ---------------------------------------------------------------------
export function construirCristais(cena, estado) {
  // Cor de "dica" do anel: a cor que alguma estrutura exige deste cristal
  const dicas = {};
  for (const { requer } of Object.values(ESTRUTURAS)) {
    for (const [letra, cor] of Object.entries(requer)) dicas[letra] ??= cor;
  }

  const geoPedestal = new THREE.CylinderGeometry(0.55, 0.75, 1, 8);
  const matPedestal = new THREE.MeshStandardMaterial({ color: 0x4a423b, roughness: 0.9 });
  const geoAnel = new THREE.TorusGeometry(0.5, 0.06, 8, 24);
  geoAnel.rotateX(Math.PI / 2);
  const geoCristal = new THREE.OctahedronGeometry(0.38);
  geoCristal.scale(1, 1.7, 1);
  const geoAlvo = new THREE.CylinderGeometry(1, 1, 3.2, 8);
  const matInvisivel = new THREE.MeshBasicMaterial({ visible: false });

  const cristais = {};
  paraCadaCelula((ch, col, lin) => {
    if (!ehCristal(ch)) return;
    const { x, z } = celulaParaMundo(col, lin);
    const grupo = new THREE.Group();
    grupo.position.set(x, 0, z);

    const pedestal = new THREE.Mesh(geoPedestal, matPedestal);
    pedestal.position.y = 0.5;
    grupo.add(pedestal);

    const corDica = dicas[ch] ? CORES[dicas[ch]].hex : 0x6b6158;
    const anel = new THREE.Mesh(geoAnel, new THREE.MeshStandardMaterial({
      color: corDica, emissive: corDica, emissiveIntensity: dicas[ch] ? 0.9 : 0.05, roughness: 0.4,
    }));
    anel.position.y = 1.02;
    grupo.add(anel);

    const cristal = new THREE.Mesh(geoCristal, new THREE.MeshStandardMaterial({
      roughness: 0.15, metalness: 0.1, transparent: true,
    }));
    cristal.position.y = 1.75;
    grupo.add(cristal);

    const alvo = new THREE.Mesh(geoAlvo, matInvisivel);
    alvo.position.y = 1.4;
    alvo.userData.interativo = { tipo: 'cristal', letra: ch };
    grupo.add(alvo);

    cena.add(grupo);
    cristais[ch] = { letra: ch, col, lin, grupo, cristal, alvo, pulso: 0, fase: Math.random() * 6 };
    pintarCristal(cristais[ch], estado.cristais[ch]);
  });
  return cristais;
}

// Atualiza a aparência do cristal conforme a luz que ele guarda
export function pintarCristal(c, cor) {
  const mat = c.cristal.material;
  if (cor) {
    const hex = CORES[cor].hex;
    mat.color.setHex(hex);
    mat.emissive.setHex(hex);
    mat.emissiveIntensity = 1.25;
    mat.opacity = 0.95;
  } else {
    mat.color.copy(COR_VAZIO);
    mat.emissive.setHex(0x000000);
    mat.opacity = 0.45;
  }
  c.cor = cor;
  c.pulso = 1;   // "pulinho" de animação ao mudar
}

export function animarCristais(cristais, dt, tempo) {
  for (const c of Object.values(cristais)) {
    c.pulso = Math.max(0, c.pulso - dt * 2);
    const escala = 1 + c.pulso * 0.6;
    c.cristal.scale.setScalar(escala);
    c.cristal.rotation.y += dt * (c.cor ? 1.2 : 0.3);
    c.cristal.position.y = 1.75 + Math.sin(tempo * 1.6 + c.fase) * (c.cor ? 0.1 : 0.03);
  }
}

// ---------------------------------------------------------------------
// "POOL" DE LUZES: em vez de uma luz por cristal (pesado!), usamos 6 luzes
// e, a cada quadro, colocamos elas nos cristais acesos mais próximos.
// ---------------------------------------------------------------------
export function criarPoolDeLuzes(cena, quantidade = 6) {
  const luzes = [];
  for (let i = 0; i < quantidade; i++) {
    const luz = new THREE.PointLight(0xffffff, 0, 14, 1.8);
    cena.add(luz);
    luzes.push(luz);
  }
  return luzes;
}

// Fontes de luz: cristais acesos (cor da luz) e braseiros (fogo laranja que treme)
export function distribuirLuzes(luzes, cristais, braseiros, posicaoJogador, tempo) {
  const fontes = [];
  for (const c of Object.values(cristais)) {
    if (!c.cor) continue;
    const p = c.grupo.position;
    fontes.push({ x: p.x, y: 1.8, z: p.z, cor: CORES[c.cor].hex, intensidade: 7 + c.pulso * 12 });
  }
  for (const b of braseiros) {
    const tremor = Math.sin(tempo * 9 + b.fase) * 1.5 + Math.sin(tempo * 23 + b.fase * 2) * 1;
    fontes.push({ x: b.x, y: 2.4, z: b.z, cor: 0xff8a3a, intensidade: 12 + tremor });
  }
  for (const f of fontes) f.d = (f.x - posicaoJogador.x) ** 2 + (f.z - posicaoJogador.z) ** 2;
  fontes.sort((a, b) => a.d - b.d);
  luzes.forEach((luz, i) => {
    const f = fontes[i];
    if (!f) { luz.intensity = 0; return; }
    luz.position.set(f.x, f.y, f.z);
    luz.color.setHex(f.cor);
    luz.intensity = f.intensidade;
  });
}

// ---------------------------------------------------------------------
// ESTRUTURAS (ponte, barreira, porta)
// ---------------------------------------------------------------------
export function construirEstruturas(cena, estado) {
  const texGrade = texturaGradeLuz();
  const estruturas = {};

  paraCadaCelula((ch, col, lin) => {
    const def = ESTRUTURAS[ch];
    if (!def) return;
    const e = estruturas[ch] ??= { letra: ch, tipo: def.tipo, def, partes: [], progresso: 0, encaixes: [] };
    const { x, z } = celulaParaMundo(col, lin);
    let malha;

    if (def.tipo === 'ponte') {
      malha = new THREE.Mesh(new THREE.BoxGeometry(T, 0.25, T), new THREE.MeshStandardMaterial({
        color: 0x0c2440, emissive: CORES.azul.hex, emissiveMap: texGrade, emissiveIntensity: 1.3,
        transparent: true, roughness: 0.3,
      }));
      malha.position.set(x, -0.125, z);
    } else if (def.tipo === 'barreira') {
      malha = new THREE.Mesh(new THREE.BoxGeometry(T, ALTURA, 0.25), new THREE.MeshBasicMaterial({
        color: CORES.azul.hex, map: texGrade, transparent: true, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,   // visível de longe (marco visual)
      }));
      malha.position.set(x, ALTURA / 2, z);
      malha.rotation.y = rotacaoPassagem(col, lin);
    } else { // porta
      const corRunas = def.final ? 0xfff0c0 : CORES.vermelho.hex;
      malha = new THREE.Mesh(new THREE.BoxGeometry(T, ALTURA, 0.7), new THREE.MeshStandardMaterial({
        map: null, color: 0x5d544c, roughness: 0.85,
        emissive: corRunas, emissiveMap: texturaRunas(ch.charCodeAt(0)), emissiveIntensity: 0.6,
      }));
      malha.position.set(x, ALTURA / 2, z);
      malha.rotation.y = rotacaoPassagem(col, lin);
      // um encaixe (pedra preciosa) por cristal exigido, nas duas faces da porta
      const reqs = Object.entries(def.requer);
      reqs.forEach(([letra, cor], i) => {
        const deslocX = (i - (reqs.length - 1) / 2) * 0.8;
        for (const lado of [1, -1]) {
          const gema = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), new THREE.MeshStandardMaterial({
            color: CORES[cor].hex, emissive: CORES[cor].hex, emissiveIntensity: 0.1,
          }));
          gema.position.set(deslocX, 1.0, lado * 0.38);
          malha.add(gema);
          e.encaixes.push({ letra, cor, gema });
        }
      });
    }
    malha.userData.estrutura = ch;
    cena.add(malha);
    e.partes.push(malha);
  });

  // estado inicial sem animação
  for (const e of Object.values(estruturas)) {
    e.progresso = estado.estruturasAtivas[e.letra] ? 1 : 0;
    aplicarVisualEstrutura(e, 0);
  }
  return estruturas;
}

// Anima a estrutura em direção ao estado "ativo" (1) ou "inativo" (0)
export function animarEstruturas(estruturas, estado, dt, tempo) {
  for (const e of Object.values(estruturas)) {
    const alvo = estado.estruturasAtivas[e.letra] ? 1 : 0;
    const velocidade = e.tipo === 'porta' ? 0.8 : 1.6;
    if (e.progresso < alvo) e.progresso = Math.min(alvo, e.progresso + dt * velocidade);
    if (e.progresso > alvo) e.progresso = Math.max(alvo, e.progresso - dt * velocidade);
    aplicarVisualEstrutura(e, tempo);
    // as gemas da porta acendem quando o cristal certo tem a cor certa
    for (const enc of e.encaixes) {
      enc.gema.material.emissiveIntensity = estado.cristais[enc.letra] === enc.cor ? 2.5 : 0.08;
    }
  }
}

function aplicarVisualEstrutura(e, tempo) {
  const p = e.progresso;
  for (const malha of e.partes) {
    if (e.tipo === 'ponte') {
      malha.visible = p > 0.01;
      malha.material.opacity = 0.85 * p;
      malha.scale.set(1, 1, 0.2 + 0.8 * p);
      malha.material.emissiveIntensity = 1.1 + Math.sin(tempo * 3) * 0.2;
    } else if (e.tipo === 'barreira') {
      malha.visible = p > 0.01;
      malha.material.opacity = (0.45 + Math.sin(tempo * 4) * 0.08) * p;
      malha.material.map.offset.y = tempo * 0.15;
    } else {
      malha.position.y = ALTURA / 2 - p * (ALTURA + 0.1);   // a porta afunda no chão
      malha.visible = p < 0.99;
    }
  }
}

// ---------------------------------------------------------------------
// FEIXE: efeito visual da luz indo do cristal para a lanterna (ou o contrário)
// ---------------------------------------------------------------------
const feixes = [];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _meio = new THREE.Vector3();
export function criarFeixe(cena, de, para, cor) {
  _a.copy(de); _b.copy(para);
  const comprimento = _a.distanceTo(_b);
  const malha = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, comprimento, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: CORES[cor].hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  _meio.addVectors(_a, _b).multiplyScalar(0.5);
  malha.position.copy(_meio);
  malha.lookAt(_b);
  malha.rotateX(Math.PI / 2);   // o cilindro nasce em pé; giramos para apontar
  cena.add(malha);
  feixes.push({ malha, vida: 0.45 });
}

export function animarFeixes(cena, dt) {
  for (let i = feixes.length - 1; i >= 0; i--) {
    const f = feixes[i];
    f.vida -= dt;
    f.malha.material.opacity = Math.max(0, f.vida / 0.45);
    f.malha.scale.x = f.malha.scale.z = 1 + (0.45 - f.vida) * 4;
    if (f.vida <= 0) {
      cena.remove(f.malha);
      f.malha.geometry.dispose();
      f.malha.material.dispose();
      feixes.splice(i, 1);
    }
  }
}
