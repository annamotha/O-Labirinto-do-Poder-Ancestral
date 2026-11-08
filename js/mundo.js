// =====================================================================
// mundo.js — constrói a parte FIXA do labirinto: paredes, colunas, piso,
// teto, abismos, cenário (braseiros, estandartes, ossos, escombros),
// paredes ilusórias, inscrições, coletáveis e o Núcleo.
// =====================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  MAPA, ESTRUTURAS, INSCRICOES, CORES, AREAS, CEU_ABERTO, RELIQUIAS,
  paraCadaCelula, ehInscricao, areaDaCelula,
} from './mapa.js';
import { caractere } from './regras.js';
import {
  texturaParede, texturaPiso, texturaTeto, texturaPlaca, texturaRachaduras,
  texturaEstandarte, texturaEstandarteRuna, texturaPoeira, texturaCirculoRunas,
} from './texturas.js';

export const T = 4;            // tamanho de uma célula (metros)
export const ALTURA = 5;       // altura das paredes
const PROFUNDIDADE_ABISMO = 14;

export const celulaParaMundo = (col, lin) => ({ x: col * T, z: lin * T });
export const mundoParaCelula = (x, z) => [Math.round(x / T), Math.round(z / T)];

const ehParedeFixa = (col, lin) => caractere(col, lin) === '#';
const ehAbismo = (ch) => ch === '~' || (ESTRUTURAS[ch] && ESTRUTURAS[ch].tipo === 'ponte');

// Uma passagem (porta, barreira) atravessa o corredor.
// Devolve a rotação: 0 = objeto deitado no eixo X, PI/2 = no eixo Z.
export function rotacaoPassagem(col, lin) {
  return ehParedeFixa(col - 1, lin) && ehParedeFixa(col + 1, lin) ? 0 : Math.PI / 2;
}

// Gerador aleatório previsível (o cenário sai igual toda vez)
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// As 4 direções: [dc, dl] e a rotação de um plano para "olhar" para dentro da célula
const DIRECOES = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const paredeVizinha = (col, lin) => DIRECOES.find(([dc, dl]) => ehParedeFixa(col + dc, lin + dl));

// Coloca um objeto "pendurado" na parede vizinha, virado para dentro da célula
function prenderNaParede(obj, col, lin, dir, altura, afastamento = 0.05) {
  const { x, z } = celulaParaMundo(col, lin);
  obj.position.set(x + dir[0] * (T / 2 - afastamento), altura, z + dir[1] * (T / 2 - afastamento));
  obj.rotation.y = Math.atan2(-dir[0], -dir[1]);
}

export function construirMundo(cena) {
  const mundo = {
    materiaisArea: [],  // material de parede de cada área (as rachaduras pulsam)
    ilusorias: [],      // { col, lin, malha, bordas, revelada, tempoOuro, animacao }
    placas: [],         // { numero, oculta, texto, grupo, moldura, glifos, alvo, visibilidade }
    braseiros: [],      // { x, z, chamas, fase }
    estandartes: [],
    reliquias: [],      // { area, nome, texto, grupo, alvo, coletada }
    coracoes: [],       // { x, z, grupo, coletado }
    nucleo: null,
    oclusores: [],      // objetos que bloqueiam a mira (raycast)
  };
  const matriz = new THREE.Matrix4();
  const rnd = aleatorio(1234);

  // =================================================================
  // MATERIAIS POR ÁREA: cada área tem uma cor de pedra, e as mais fundas
  // têm rachaduras brilhantes (o selo enfraquecendo).
  // =================================================================
  const texParede = texturaParede();
  const tintas = [0xb4b2ae, 0x9eaac4, 0xb49c94, 0x9e94b8];
  AREAS.forEach((area, i) => {
    const mat = new THREE.MeshStandardMaterial({ map: texParede, roughness: 0.95, color: tintas[i] });
    mat.bumpMap = texParede;
    mat.bumpScale = 0.04;
    if (area.atmosfera.rachaduras) {
      mat.emissive = new THREE.Color(area.atmosfera.rachaduras);
      mat.emissiveMap = texturaRachaduras(40 + i, 2 + i * 3);
      mat.userData.brilhoBase = [0, 0.18, 0.3, 0.42][i];
      mat.emissiveIntensity = mat.userData.brilhoBase;
    }
    mundo.materiaisArea.push(mat);
  });

  // =================================================================
  // PAREDES E COLUNAS
  // InstancedMesh = desenhar centenas de cópias do mesmo objeto numa única chamada
  // =================================================================
  const paredesPorArea = AREAS.map(() => []);
  const colunasPorArea = AREAS.map(() => []);
  const celulasPiso = [], celulasAbismo = [];
  paraCadaCelula((ch, col, lin) => {
    const area = areaDaCelula(col, lin);
    if (ch === '#') {
      // parede sem nenhuma outra parede em volta = coluna no meio da sala
      const isolada = DIRECOES.every(([dc, dl]) => !ehParedeFixa(col + dc, lin + dl));
      (isolada ? colunasPorArea : paredesPorArea)[area].push([col, lin]);
    } else if (ehAbismo(ch)) celulasAbismo.push([col, lin]);
    else celulasPiso.push([col, lin]);
  });

  const geoParede = new THREE.BoxGeometry(T, ALTURA, T);
  paredesPorArea.forEach((celulas, area) => {
    if (!celulas.length) return;
    const malha = new THREE.InstancedMesh(geoParede, mundo.materiaisArea[area], celulas.length);
    celulas.forEach(([col, lin], i) => {
      const { x, z } = celulaParaMundo(col, lin);
      matriz.makeTranslation(x, ALTURA / 2, z);
      malha.setMatrixAt(i, matriz);
    });
    cena.add(malha);
    mundo.oclusores.push(malha);
  });

  // Coluna: fuste cilíndrico + base e capitel quadrados
  const geoFuste = new THREE.CylinderGeometry(1.25, 1.4, ALTURA - 1.2, 14);
  const geoBloco = new THREE.BoxGeometry(3.2, 0.6, 3.2);
  colunasPorArea.forEach((celulas, area) => {
    if (!celulas.length) return;
    const mat = mundo.materiaisArea[area];
    const fuste = new THREE.InstancedMesh(geoFuste, mat, celulas.length);
    const blocos = new THREE.InstancedMesh(geoBloco, mat, celulas.length * 2);
    celulas.forEach(([col, lin], i) => {
      const { x, z } = celulaParaMundo(col, lin);
      matriz.makeTranslation(x, ALTURA / 2, z); fuste.setMatrixAt(i, matriz);
      matriz.makeTranslation(x, 0.3, z); blocos.setMatrixAt(i * 2, matriz);
      matriz.makeTranslation(x, ALTURA - 0.3, z); blocos.setMatrixAt(i * 2 + 1, matriz);
    });
    cena.add(fuste, blocos);
    mundo.oclusores.push(fuste);
  });

  // =================================================================
  // PISO (com a cor da área) E TETO (com aberturas sobre abismos e o Núcleo)
  // =================================================================
  const geoPiso = new THREE.PlaneGeometry(T, T);
  geoPiso.rotateX(-Math.PI / 2);
  const piso = new THREE.InstancedMesh(geoPiso,
    new THREE.MeshStandardMaterial({ map: texturaPiso(), roughness: 1 }), celulasPiso.length);
  const tintasPiso = [0x8a8890, 0x7a8498, 0x8c7c78, 0x80789a].map((h) => new THREE.Color(h));
  celulasPiso.forEach(([col, lin], i) => {
    const { x, z } = celulaParaMundo(col, lin);
    matriz.makeTranslation(x, 0, z);
    piso.setMatrixAt(i, matriz);
    piso.setColorAt(i, tintasPiso[areaDaCelula(col, lin)]);
  });
  cena.add(piso);

  const ceuAberto = (col, lin) => CEU_ABERTO.some((r) => col >= r.col[0] && col <= r.col[1] && lin >= r.lin[0] && lin <= r.lin[1]);
  const celulasTeto = celulasPiso.filter(([c, l]) => !ceuAberto(c, l));
  const geoTeto = new THREE.PlaneGeometry(T, T);
  geoTeto.rotateX(Math.PI / 2);
  const teto = new THREE.InstancedMesh(geoTeto,
    new THREE.MeshStandardMaterial({ map: texturaTeto(), roughness: 1, color: 0x8a8890 }), celulasTeto.length);
  celulasTeto.forEach(([col, lin], i) => {
    const { x, z } = celulaParaMundo(col, lin);
    matriz.makeTranslation(x, ALTURA, z);
    teto.setMatrixAt(i, matriz);
  });
  cena.add(teto);

  // =================================================================
  // ABISMOS: fundo com névoa azul e paredes descendo nas bordas
  // =================================================================
  const matAbismo = new THREE.MeshStandardMaterial({ map: texParede, color: 0x3a3a48, roughness: 1, emissive: 0x0a1a38, emissiveIntensity: 0.6 });
  const matNevoa = new THREE.MeshBasicMaterial({
    color: 0x3070c0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const geoLado = new THREE.PlaneGeometry(T, PROFUNDIDADE_ABISMO);
  const geoFundo = new THREE.PlaneGeometry(T, T);
  geoFundo.rotateX(-Math.PI / 2);
  const ladosVizinhos = [[0, -1, 0], [0, 1, Math.PI], [-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2]];
  // Juntamos todas as peças num único objeto ("merge"): muito menos trabalho para a placa de vídeo
  const pecasNevoa = [], pecasLados = [];
  const aux = new THREE.Object3D();
  for (const [col, lin] of celulasAbismo) {
    const { x, z } = celulaParaMundo(col, lin);
    // duas camadas de névoa em alturas diferentes dão sensação de profundidade
    pecasNevoa.push(geoFundo.clone().translate(x, -PROFUNDIDADE_ABISMO * 0.35, z));
    pecasNevoa.push(geoFundo.clone().translate(x, -PROFUNDIDADE_ABISMO * 0.9, z));
    for (const [dc, dl, rot] of ladosVizinhos) {
      if (ehAbismo(caractere(col + dc, lin + dl))) continue;
      aux.rotation.set(0, rot, 0);                 // olha para DENTRO do abismo
      aux.position.set(x + dc * T / 2, -PROFUNDIDADE_ABISMO / 2, z + dl * T / 2);
      aux.updateMatrix();
      pecasLados.push(geoLado.clone().applyMatrix4(aux.matrix));
    }
  }
  if (pecasNevoa.length) cena.add(new THREE.Mesh(mergeGeometries(pecasNevoa), matNevoa));
  if (pecasLados.length) cena.add(new THREE.Mesh(mergeGeometries(pecasLados), matAbismo));

  // =================================================================
  // PAREDES ILUSÓRIAS
  // =================================================================
  paraCadaCelula((ch, col, lin) => {
    if (ch !== '%') return;
    const { x, z } = celulaParaMundo(col, lin);
    const mat = mundo.materiaisArea[areaDaCelula(col, lin)].clone();
    mat.transparent = true;
    mat.emissive = new THREE.Color(CORES.dourado.hex);
    mat.emissiveMap = texturaRachaduras(7, 10);
    mat.emissiveIntensity = 0;
    const malha = new THREE.Mesh(geoParede, mat);
    malha.position.set(x, ALTURA / 2, z);
    const bordas = new THREE.LineSegments(new THREE.EdgesGeometry(geoParede),
      new THREE.LineBasicMaterial({ color: CORES.dourado.hex, transparent: true, opacity: 0 }));
    malha.add(bordas);
    cena.add(malha);
    mundo.oclusores.push(malha);
    mundo.ilusorias.push({ col, lin, malha, bordas, revelada: false, tempoOuro: 0, animacao: 0 });
  });

  // =================================================================
  // INSCRIÇÕES (placas na parede vizinha)
  // =================================================================
  paraCadaCelula((ch, col, lin) => {
    if (!ehInscricao(ch)) return;
    const dados = INSCRICOES[ch];
    const dir = paredeVizinha(col, lin);
    if (!dados || !dir) return;
    const oculta = !!dados.oculta;
    const grupo = new THREE.Group();
    prenderNaParede(grupo, col, lin, dir, 1.75);
    const moldura = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.35, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.8, transparent: oculta, opacity: oculta ? 0 : 1 }));
    const glifos = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshStandardMaterial({
      color: 0x111111, emissive: oculta ? CORES.dourado.hex : 0xc9b48a, emissiveMap: texturaPlaca(Number(ch) * 13, '#fff'),
      emissiveIntensity: oculta ? 0 : 0.6, transparent: true, opacity: oculta ? 0 : 1,
    }));
    glifos.position.z = 0.05;
    const alvo = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    grupo.add(moldura, glifos, alvo);
    cena.add(grupo);
    const placa = { numero: ch, oculta, texto: dados.texto, grupo, moldura, glifos, alvo, visibilidade: oculta ? 0 : 1 };
    alvo.userData.interativo = { tipo: 'placa', placa };
    mundo.placas.push(placa);
  });

  // =================================================================
  // BRASEIROS: tigela de pedra com fogo (o fogo é desenhado com cones
  // brilhantes que tremem; a luz vem do "pool" de luzes em cristais.js)
  // =================================================================
  const matPedraEscura = new THREE.MeshStandardMaterial({ color: 0x3b3530, roughness: 0.9 });
  const geoPe = new THREE.CylinderGeometry(0.25, 0.4, 1.1, 8);
  const geoTigela = new THREE.CylinderGeometry(0.75, 0.45, 0.45, 10);
  const geoBrasa = new THREE.CircleGeometry(0.62, 12);
  geoBrasa.rotateX(-Math.PI / 2);
  const matBrasa = new THREE.MeshBasicMaterial({ color: 0xff5a1a });
  const geoChama = new THREE.ConeGeometry(0.32, 1.3, 8, 1, true);
  geoChama.translate(0, 0.65, 0);
  const coresChama = [0xff6a1a, 0xffa030, 0xffd27a];
  paraCadaCelula((ch, col, lin) => {
    if (ch !== '&') return;
    const { x, z } = celulaParaMundo(col, lin);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pe = new THREE.Mesh(geoPe, matPedraEscura); pe.position.y = 0.55;
    const tigela = new THREE.Mesh(geoTigela, matPedraEscura); tigela.position.y = 1.3;
    const brasa = new THREE.Mesh(geoBrasa, matBrasa); brasa.position.y = 1.5;
    g.add(pe, tigela, brasa);
    const chamas = coresChama.map((cor, i) => {
      const m = new THREE.Mesh(geoChama, new THREE.MeshBasicMaterial({
        color: cor, transparent: true, opacity: 0.8 - i * 0.15, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.position.set((rnd() - 0.5) * 0.3, 1.45, (rnd() - 0.5) * 0.3);
      m.scale.setScalar(1 - i * 0.25);
      g.add(m);
      return m;
    });
    cena.add(g);
    mundo.braseiros.push({ x, z, chamas, fase: rnd() * 10 });
  });

  // Brasas subindo de todos os braseiros (um único sistema de partículas)
  const PORBRASEIRO = 14;
  const totalBrasas = mundo.braseiros.length * PORBRASEIRO;
  if (totalBrasas) {
    const pos = new Float32Array(totalBrasas * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const brasas = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xff8a3a, size: 0.09, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    cena.add(brasas);
    mundo.brasas = { pontos: brasas, pos, vidas: new Float32Array(totalBrasas).map(() => rnd()), porBraseiro: PORBRASEIRO };
  }

  // =================================================================
  // ESTANDARTES (pendurados na parede vizinha)
  // =================================================================
  const geoEstandarte = new THREE.PlaneGeometry(1.4, 3.4);
  geoEstandarte.translate(0, -1.7, 0);     // o ponto de giro fica no topo (balança como tecido)
  const geoHaste = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6);
  geoHaste.rotateZ(Math.PI / 2);
  const matHaste = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.6, roughness: 0.4 });
  paraCadaCelula((ch, col, lin) => {
    if (ch !== '=') return;
    const dir = paredeVizinha(col, lin);
    if (!dir) return;
    const grupo = new THREE.Group();
    prenderNaParede(grupo, col, lin, dir, ALTURA - 0.4, 0.15);
    const pano = new THREE.Mesh(geoEstandarte, new THREE.MeshStandardMaterial({
      map: texturaEstandarte(col * 7 + lin), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9,
      emissive: 0xc9a24a, emissiveMap: texturaEstandarteRuna(col + lin * 3), emissiveIntensity: 0.5,
    }));
    grupo.add(pano, new THREE.Mesh(geoHaste, matHaste));
    cena.add(grupo);
    mundo.estandartes.push({ pano, fase: rnd() * 6 });
  });

  // =================================================================
  // OSSOS E ESCOMBROS (";") + ESCOMBROS AUTOMÁTICOS (mais nas áreas fundas)
  // =================================================================
  const matOsso = new THREE.MeshStandardMaterial({ color: 0xcfc4a8, roughness: 0.8 });
  const geoCranio = new THREE.SphereGeometry(0.17, 10, 8);
  const geoOsso = new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5);
  const pedras = [];
  paraCadaCelula((ch, col, lin) => {
    const { x, z } = celulaParaMundo(col, lin);
    if (ch === ';') {
      const g = new THREE.Group();
      g.position.set(x + (rnd() - 0.5) * 1.5, 0, z + (rnd() - 0.5) * 1.5);
      g.rotation.y = rnd() * Math.PI * 2;
      const cranio = new THREE.Mesh(geoCranio, matOsso);
      cranio.scale.set(1, 0.9, 1.15);
      cranio.position.set(0, 0.15, 0);
      g.add(cranio);
      for (let i = 0; i < 6; i++) {
        const o = new THREE.Mesh(geoOsso, matOsso);
        o.position.set((rnd() - 0.5) * 1.4, 0.04, (rnd() - 0.5) * 1.4);
        o.rotation.set(Math.PI / 2, 0, rnd() * Math.PI);
        g.add(o);
      }
      cena.add(g);
      for (let i = 0; i < 5; i++) pedras.push([x + (rnd() - 0.5) * 2.5, z + (rnd() - 0.5) * 2.5, 0.15 + rnd() * 0.35]);
    }
    // escombros automáticos encostados nas paredes
    const area = areaDaCelula(col, lin);
    if (ch === '.' && rnd() < [0.03, 0.07, 0.12, 0.18][area]) {
      const dir = paredeVizinha(col, lin);
      if (dir) {
        for (let i = 0; i < 2 + rnd() * 3; i++) {
          pedras.push([x + dir[0] * 1.5 + (rnd() - 0.5) * 2, z + dir[1] * 1.5 + (rnd() - 0.5) * 2, 0.15 + rnd() * 0.4]);
        }
      }
    }
  });
  if (pedras.length) {
    const malha = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), matPedraEscura, pedras.length);
    const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    pedras.forEach(([x, z, r], i) => {
      q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
      matriz.compose(p.set(x, r * 0.5, z), q, s.set(r, r * 0.7, r));
      malha.setMatrixAt(i, matriz);
    });
    cena.add(malha);
  }

  // =================================================================
  // POEIRA DOURADA (":") — pista visual de que há algo errado com a parede ao lado
  // =================================================================
  const matPoeira = new THREE.MeshBasicMaterial({ map: texturaPoeira(3), transparent: true, depthWrite: false, opacity: 0.7 });
  paraCadaCelula((ch, col, lin) => {
    if (ch !== ':') return;
    const { x, z } = celulaParaMundo(col, lin);
    const m = new THREE.Mesh(geoPiso, matPoeira);
    m.position.set(x, 0.02, z);
    // a "direção" das ranhuras aponta para a parede ilusória vizinha (se houver)
    const ilusoria = DIRECOES.find(([dc, dl]) => caractere(col + dc, lin + dl) === '%');
    if (ilusoria) m.rotation.y = Math.atan2(ilusoria[1], -ilusoria[0]) + Math.PI;
    cena.add(m);
  });
  mundo.matPoeira = matPoeira;

  // =================================================================
  // COLETÁVEIS: relíquias ("?") e fragmentos de vida ("*")
  // =================================================================
  const formaCoracao = new THREE.Shape();
  formaCoracao.moveTo(0, -0.35);
  formaCoracao.bezierCurveTo(-0.05, -0.25, -0.4, -0.05, -0.4, 0.15);
  formaCoracao.bezierCurveTo(-0.4, 0.4, -0.05, 0.42, 0, 0.2);
  formaCoracao.bezierCurveTo(0.05, 0.42, 0.4, 0.4, 0.4, 0.15);
  formaCoracao.bezierCurveTo(0.4, -0.05, 0.05, -0.25, 0, -0.35);
  const geoCoracao = new THREE.ExtrudeGeometry(formaCoracao, { depth: 0.15, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  geoCoracao.center();
  const matCoracao = new THREE.MeshStandardMaterial({ color: 0xff3048, emissive: 0xff2040, emissiveIntensity: 1.4, roughness: 0.3 });

  const geoRelicia = new THREE.TorusKnotGeometry(0.22, 0.07, 64, 8);
  const matRelicia = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.3 });
  const geoSuporte = new THREE.BoxGeometry(0.7, 0.9, 0.7);

  paraCadaCelula((ch, col, lin) => {
    const { x, z } = celulaParaMundo(col, lin);
    if (ch === '*') {
      const grupo = new THREE.Group();
      grupo.position.set(x, 1.1, z);
      grupo.add(new THREE.Mesh(geoCoracao, matCoracao));
      cena.add(grupo);
      mundo.coracoes.push({ x, z, grupo, coletado: false });
    } else if (ch === '?') {
      const area = areaDaCelula(col, lin);
      const dados = RELIQUIAS[area];
      const grupo = new THREE.Group();
      grupo.position.set(x, 0, z);
      const suporte = new THREE.Mesh(geoSuporte, matPedraEscura);
      suporte.position.y = 0.45;
      const objeto = new THREE.Mesh(geoRelicia, matRelicia);
      objeto.position.y = 1.3;
      const alvo = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
      alvo.position.y = 1;
      grupo.add(suporte, objeto, alvo);
      cena.add(grupo);
      const reliquia = { area, nome: dados.nome, texto: dados.texto, grupo, objeto, alvo, coletada: false };
      alvo.userData.interativo = { tipo: 'reliquia', reliquia };
      mundo.reliquias.push(reliquia);
    }
  });

  // =================================================================
  // NÚCLEO ANCESTRAL + FEIXE DE LUZ (visível de longe, por cima das paredes)
  // =================================================================
  paraCadaCelula((ch, col, lin) => {
    if (ch !== 'O') return;
    const { x, z } = celulaParaMundo(col, lin);
    const grupo = new THREE.Group();
    grupo.position.set(x, 0, z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a332d, roughness: 0.9 }));
    base.position.y = 0.3;
    const circulo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({
      map: texturaCirculoRunas(), color: 0x9a7aff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    circulo.rotation.x = -Math.PI / 2;
    circulo.position.y = 0.03;

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.2 }));
    core.scale.set(1, 1.8, 1);
    core.position.y = 2.4;
    const casca = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.3 }));
    casca.position.y = 2.4;

    // feixe: ignora a neblina (fog: false) para ser visto de longe, nas áreas sem teto
    const feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 120, 16, 1, true), new THREE.MeshBasicMaterial({
      color: 0x8a6aff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    feixe.position.y = 60;
    const aura = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 120, 16, 1, true), new THREE.MeshBasicMaterial({
      color: 0x5a3aff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    aura.position.y = 60;

    const luz = new THREE.PointLight(0xffffff, 30, 20, 1.6);
    luz.position.y = 2.4;
    grupo.add(base, circulo, core, casca, feixe, aura, luz);
    cena.add(grupo);
    mundo.nucleo = { grupo, core, casca, feixe, aura, circulo, luz, x, z, tempo: 0, modo: 'normal' };
  });

  return mundo;
}

// =====================================================================
// Animações do cenário (chamado todo quadro)
// =====================================================================
const _cor = new THREE.Color();
const PALETA = [CORES.azul.hex, CORES.vermelho.hex, CORES.dourado.hex].map((h) => new THREE.Color(h));

export function animarMundo(mundo, dt, tempo) {
  // fogo dos braseiros
  for (const b of mundo.braseiros) {
    b.chamas.forEach((c, i) => {
      const t = tempo * (6 + i * 2) + b.fase;
      c.scale.y = (1 - i * 0.25) * (0.85 + Math.sin(t) * 0.12 + Math.sin(t * 2.7) * 0.08);
      c.rotation.y = t * 0.3;
    });
  }
  // brasas subindo
  if (mundo.brasas) {
    const { pos, vidas, porBraseiro, pontos } = mundo.brasas;
    for (let i = 0; i < vidas.length; i++) {
      vidas[i] += dt * 0.6;
      if (vidas[i] > 1) vidas[i] -= 1;
      const b = mundo.braseiros[Math.floor(i / porBraseiro)];
      const v = vidas[i], semente = i * 12.9898;
      pos[i * 3] = b.x + Math.sin(semente + v * 4) * 0.35 * (0.3 + v);
      pos[i * 3 + 1] = 1.6 + v * 2.6;
      pos[i * 3 + 2] = b.z + Math.cos(semente * 1.3 + v * 3) * 0.35 * (0.3 + v);
    }
    pontos.geometry.attributes.position.needsUpdate = true;
  }
  // estandartes balançando
  for (const e of mundo.estandartes) e.pano.rotation.x = Math.sin(tempo * 0.8 + e.fase) * 0.05;
  // rachaduras pulsando (como um coração fraco)
  for (const m of mundo.materiaisArea) {
    if (m.userData.brilhoBase) m.emissiveIntensity = m.userData.brilhoBase * (0.65 + Math.sin(tempo * 1.4) * 0.35);
  }
  // poeira dourada cintilando
  if (mundo.matPoeira) mundo.matPoeira.opacity = 0.35 + Math.sin(tempo * 2.2) * 0.15;
  // coletáveis girando
  for (const c of mundo.coracoes) {
    if (c.coletado) continue;
    c.grupo.rotation.y += dt * 1.8;
    c.grupo.position.y = 1.1 + Math.sin(tempo * 2 + c.x) * 0.12;
  }
  for (const r of mundo.reliquias) {
    if (r.coletada) continue;
    r.objeto.rotation.y += dt;
    r.objeto.rotation.x += dt * 0.4;
    r.objeto.position.y = 1.3 + Math.sin(tempo * 1.5) * 0.08;
  }
  animarNucleo(mundo.nucleo, dt);
}

function animarNucleo(nucleo, dt) {
  if (!nucleo) return;
  nucleo.tempo += dt;
  const t = nucleo.tempo;
  nucleo.core.rotation.y += dt * 0.8;
  nucleo.casca.rotation.y -= dt * 0.25;
  nucleo.casca.rotation.x += dt * 0.1;
  nucleo.circulo.rotation.z += dt * 0.1;
  nucleo.core.position.y = nucleo.casca.position.y = 2.4 + Math.sin(t * 1.3) * 0.15;
  nucleo.feixe.material.opacity = 0.7 + Math.sin(t * 3) * 0.15;
  if (nucleo.modo === 'normal') {
    const fase = (t * 0.3) % 3;
    const i = Math.floor(fase);
    _cor.copy(PALETA[i]).lerp(PALETA[(i + 1) % 3], fase - i);
    nucleo.core.material.emissive.copy(_cor);
    nucleo.casca.material.color.copy(_cor);
    nucleo.luz.color.copy(_cor);
  }
}
