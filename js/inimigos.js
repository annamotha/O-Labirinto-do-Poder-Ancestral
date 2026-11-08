// =====================================================================
// inimigos.js — Errante das Sombras, Espectro Instável e Guardião Adormecido
// =====================================================================
import * as THREE from 'three';
import { celulaParaMundo, mundoParaCelula, T } from './mundo.js';

// ---------------------------------------------------------------------
// Busca de caminho em largura (BFS) na grade do mapa.
// Devolve a lista de células do caminho (sem a de origem), ou [] se não houver.
// ---------------------------------------------------------------------
const VIZ = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function buscarCaminho([c0, l0], [c1, l1], podePassar) {
  const chave = (c, l) => `${c},${l}`;
  const veioDe = new Map([[chave(c0, l0), null]]);
  const fila = [[c0, l0]];
  while (fila.length) {
    const [c, l] = fila.shift();
    if (c === c1 && l === l1) break;
    for (const [dc, dl] of VIZ) {
      const nc = c + dc, nl = l + dl, k = chave(nc, nl);
      if (!veioDe.has(k) && podePassar(nc, nl)) { veioDe.set(k, [c, l]); fila.push([nc, nl]); }
    }
  }
  if (!veioDe.has(chave(c1, l1))) return [];
  const caminho = [];
  let atual = [c1, l1];
  while (atual && !(atual[0] === c0 && atual[1] === l0)) {
    caminho.unshift(atual);
    atual = veioDe.get(chave(...atual));
  }
  return caminho;
}

// ---------------------------------------------------------------------
// Assombração: base do Errante e do Espectro (mesma lógica, aparência diferente)
// ---------------------------------------------------------------------
const VELOCIDADE = { patrulha: 2.0, perseguicao: 4.3, investigacao: 2.8 };

export class Assombracao {
  constructor(cena, config, col, lin, { celulaLivre, bloqueiaVisao }) {
    this.config = config;
    this.ehEspectro = config.tipo === 'espectro';
    this.inicio = [col, lin];
    this.celulaLivre = celulaLivre;       // (c,l) => true se dá pra andar
    this.bloqueiaVisao = bloqueiaVisao;   // (c,l) => true se a célula tapa a visão
    this.grupo = this.criarModelo();
    cena.add(this.grupo);
    this.reiniciar();
  }

  criarModelo() {
    const g = new THREE.Group();
    const rnd = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
    if (this.ehEspectro) {
      // Espectro: fantasma azul translúcido, invisível sem luz dourada
      this.matCorpo = new THREE.MeshBasicMaterial({
        color: 0x8fc8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.12, 1.1, 10), this.matCorpo);
      tronco.position.y = 1.9;
      const cauda = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 10), this.matCorpo);
      cauda.rotation.x = Math.PI;
      cauda.position.y = 0.75;
      const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), this.matCorpo);
      cabeca.position.y = 2.7;
      g.add(tronco, cauda, cabeca);
      this.bracos = [-1, 1].map((lado) => {
        const ombro = new THREE.Group();
        ombro.position.set(lado * 0.32, 2.35, 0);
        const braco = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.1, 6), this.matCorpo);
        braco.position.y = -0.55;
        ombro.add(braco);
        ombro.rotation.z = lado * 0.4;
        g.add(ombro);
        return ombro;
      });
    } else {
      // Errante: figura alta e magra, capuz, braços longos com garras e aura roxa
      const matManto = new THREE.MeshStandardMaterial({ color: 0x0d0814, roughness: 1, flatShading: true });
      const geoManto = new THREE.ConeGeometry(0.6, 2.3, 9, 4, true);
      const p = geoManto.attributes.position;
      for (let i = 0; i < p.count; i++) {           // barra rasgada: puxa os vértices de baixo
        if (p.getY(i) < -1.0) p.setY(i, p.getY(i) + rnd() * 0.5);
        p.setX(i, p.getX(i) * (0.9 + rnd() * 0.25));
      }
      geoManto.computeVertexNormals();
      const manto = new THREE.Mesh(geoManto, matManto);
      manto.position.y = 1.15;
      const peito = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, 0.9, 8), matManto);
      peito.position.y = 2.25;
      const capuz = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 8), matManto);
      capuz.position.y = 2.95;
      const rosto = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      rosto.position.set(0, 2.8, 0.08);
      g.add(manto, peito, capuz, rosto);
      const matGarra = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.6 });
      this.bracos = [-1, 1].map((lado) => {
        const ombro = new THREE.Group();
        ombro.position.set(lado * 0.32, 2.55, 0);
        const braco = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 1.7, 6), matManto);
        braco.position.y = -0.85;
        ombro.add(braco);
        for (let k = -1; k <= 1; k++) {
          const garra = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.35, 4), matGarra);
          garra.position.set(k * 0.05, -1.85, 0.03);
          garra.rotation.x = Math.PI;
          ombro.add(garra);
        }
        ombro.rotation.set(-0.25, 0, lado * 0.12);
        g.add(ombro);
        return ombro;
      });
      const aura = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), new THREE.MeshBasicMaterial({
        color: 0x6a2aff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      aura.position.y = 1.6;
      g.add(aura);
    }
    this.matOlhos = new THREE.MeshBasicMaterial({ color: this.ehEspectro ? 0xffffff : 0xd8c8ff, transparent: true });
    for (const lado of [-0.07, 0.07]) {
      const olho = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), this.matOlhos);
      olho.position.set(lado, this.ehEspectro ? 2.72 : 2.82, this.ehEspectro ? 0.19 : 0.24);
      g.add(olho);
    }
    return g;
  }

  reiniciar() {
    const { x, z } = celulaParaMundo(...this.inicio);
    this.pos = new THREE.Vector3(x, 0, z);
    this.grupo.position.copy(this.pos);
    this.modo = 'patrulha';
    this.indicePatrulha = 0;
    this.caminho = [];
    this.tempoSemVer = 0;
    this.tempoRecalculo = 0;
    this.espera = 0;
    this.ultimaVista = null;
    this.atordoado = 0;            // depois de acertar o jogador, recua por alguns segundos
    this.tempo = Math.random() * 10;
  }

  get celula() { return mundoParaCelula(this.pos.x, this.pos.z); }

  dentroDoTerritorio(c, l) {
    const t = this.config.territorio;
    return c >= t.col[0] && c <= t.col[1] && l >= t.lin[0] && l <= t.lin[1];
  }

  irPara(celulaDestino) {
    this.caminho = buscarCaminho(this.celula, celulaDestino,
      (c, l) => this.dentroDoTerritorio(c, l) && this.celulaLivre(c, l));
  }

  // Linha de visão: anda pelo segmento em passos de 0.5m procurando paredes
  enxerga(alvo) {
    const dx = alvo.x - this.pos.x, dz = alvo.z - this.pos.z;
    const passos = Math.ceil(Math.hypot(dx, dz) / 0.5);
    for (let i = 1; i < passos; i++) {
      const [c, l] = mundoParaCelula(this.pos.x + (dx * i) / passos, this.pos.z + (dz * i) / passos);
      if (this.bloqueiaVisao(c, l)) return false;
    }
    return true;
  }

  // Devolve eventos: { acertou, alertou }
  atualizar(dt, { jogador, iluminado, correndo, graca, fatorOuro }) {
    this.tempo += dt;
    this.atordoado = Math.max(0, this.atordoado - dt);
    graca = Math.max(graca, this.atordoado);       // atordoado = ignora o jogador
    const eventos = { acertou: false, alertou: false };
    const dist = Math.hypot(jogador.x - this.pos.x, jogador.z - this.pos.z);
    const [jc, jl] = mundoParaCelula(jogador.x, jogador.z);
    const jogadorNoTerritorio = this.dentroDoTerritorio(jc, jl);

    // ---------- Percepção (só o Errante persegue) ----------
    if (!this.ehEspectro && graca <= 0) {
      const alcance = iluminado ? 18 : (correndo ? 6 : 3);
      const viu = jogadorNoTerritorio && dist < alcance && this.enxerga(jogador);
      if (viu) {
        if (this.modo !== 'perseguicao') { eventos.alertou = true; this.alertas = (this.alertas || 0) + 1; }
        this.modo = 'perseguicao';
        this.tempoSemVer = 0;
        this.ultimaVista = [jc, jl];
      } else if (this.modo === 'perseguicao') {
        this.tempoSemVer += dt;
        if (this.tempoSemVer > 2.5 || !jogadorNoTerritorio) {
          this.modo = 'investigacao';
          this.irPara(this.ultimaVista ?? this.celula);
          this.espera = 2.5;
        }
      }
    }
    if (graca > 0 && this.modo !== 'patrulha') { this.modo = 'patrulha'; this.caminho = []; }

    // ---------- Decidir para onde ir ----------
    if (this.modo === 'perseguicao') {
      this.tempoRecalculo -= dt;
      if (this.tempoRecalculo <= 0) { this.irPara([jc, jl]); this.tempoRecalculo = 0.3; }
    } else if (this.modo === 'investigacao') {
      if (!this.caminho.length) {
        this.espera -= dt;
        this.grupo.rotation.y += dt * 2;   // olha em volta
        if (this.espera <= 0) { this.modo = 'patrulha'; this.caminho = []; }
      }
    } else if (!this.caminho.length) {
      const destino = this.config.patrulha[this.indicePatrulha];
      const [c, l] = this.celula;
      if (c === destino[0] && l === destino[1]) {
        this.indicePatrulha = (this.indicePatrulha + 1) % this.config.patrulha.length;
      }
      this.irPara(this.config.patrulha[this.indicePatrulha]);
    }

    // ---------- Andar pelo caminho ----------
    const velocidade = this.ehEspectro ? 2.3 : VELOCIDADE[this.modo];
    let alvoX, alvoZ;
    if (this.modo === 'perseguicao' && dist < T && this.enxerga(jogador)) {
      alvoX = jogador.x; alvoZ = jogador.z;            // perto: vai direto no jogador
    } else if (this.caminho.length) {
      ({ x: alvoX, z: alvoZ } = celulaParaMundo(...this.caminho[0]));
    }
    if (alvoX !== undefined) {
      const dx = alvoX - this.pos.x, dz = alvoZ - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15 && this.caminho.length) this.caminho.shift();
      else if (d > 0.01) {
        const passo = Math.min(d, velocidade * dt);
        this.pos.x += (dx / d) * passo;
        this.pos.z += (dz / d) * passo;
        // vira suavemente para a direção do movimento
        const angulo = Math.atan2(dx, dz);
        let diff = angulo - this.grupo.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.grupo.rotation.y += diff * Math.min(1, dt * 8);
      }
    }

    // ---------- Visual ----------
    this.grupo.position.set(this.pos.x, Math.sin(this.tempo * 2) * 0.1 + 0.1, this.pos.z);
    if (this.ehEspectro) {
      const f = fatorOuro(this.grupo.position.x, 1.6, this.grupo.position.z);
      this.matCorpo.opacity = 0.55 * f;
      this.matOlhos.opacity = f;
    } else {
      this.matOlhos.color.setHex(this.modo === 'perseguicao' ? 0xff3020 : (this.atordoado > 0 ? 0x403050 : 0xd8c8ff));
    }

    // braços balançando
    if (this.bracos) {
      const ritmo = this.modo === 'perseguicao' ? 9 : 3;
      this.bracos.forEach((o, i) => { o.rotation.x = (this.ehEspectro ? 0 : -0.25) + Math.sin(this.tempo * ritmo + i * Math.PI) * (this.modo === 'perseguicao' ? 0.6 : 0.2); });
    }

    // encostou no jogador: dano! Depois recua e volta a patrulhar
    if (graca <= 0 && dist < 1.2) {
      eventos.acertou = true;
      this.atordoado = this.ehEspectro ? 2.5 : 4;
      this.modo = 'patrulha';
      this.caminho = [];
    }
    return eventos;
  }
}

// ---------------------------------------------------------------------
// Guardião Adormecido: estátua que bloqueia uma passagem
// ---------------------------------------------------------------------
export class Guardiao {
  constructor(cena, col, lin, ehParede) {
    const { x, z } = celulaParaMundo(col, lin);
    this.col = col; this.lin = lin;
    this.grupo = new THREE.Group();
    this.grupo.position.set(x, 0, z);
    // vira para o lado aberto (sul, se possível)
    this.grupo.rotation.y = ehParede(col, lin + 1) ? Math.PI : 0;

    // Golem de pedra com um núcleo azul no peito (fica vermelho ao aceitar a luz)
    const pedra = new THREE.MeshStandardMaterial({ color: 0x45403c, roughness: 0.95, flatShading: true });
    const peca = (geo, px, py, pz, mat = pedra, rot = null) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      if (rot) m.rotation.set(...rot);
      this.grupo.add(m);
      return m;
    };
    const caixa = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const rocha = (r) => new THREE.DodecahedronGeometry(r, 0);
    peca(caixa(2.6, 0.4, 1.6), 0, 0.2, 0);                     // base
    peca(caixa(0.75, 1.4, 0.75), -0.55, 1.1, 0);               // pernas
    peca(caixa(0.75, 1.4, 0.75), 0.55, 1.1, 0);
    peca(caixa(2.0, 1.6, 1.1), 0, 2.6, 0, pedra, [0.08, 0, 0]); // tronco
    peca(rocha(0.6), -1.25, 3.35, 0);                          // ombros
    peca(rocha(0.6), 1.25, 3.35, 0);
    peca(caixa(0.55, 1.6, 0.55), -1.35, 2.3, 0.15, pedra, [0, 0, 0.1]); // braços
    peca(caixa(0.55, 1.6, 0.55), 1.35, 2.3, 0.15, pedra, [0, 0, -0.1]);
    peca(rocha(0.5), -1.45, 1.35, 0.2);                        // punhos
    peca(rocha(0.5), 1.45, 1.35, 0.2);
    peca(caixa(0.8, 0.7, 0.75), 0, 3.75, 0.1);                 // cabeça
    this.matRunas = new THREE.MeshStandardMaterial({ color: 0x0a1a30, emissive: 0x3fa9ff, emissiveIntensity: 1.2 });
    peca(new THREE.OctahedronGeometry(0.28), 0, 2.7, 0.6, this.matRunas);   // núcleo no peito
    peca(caixa(1.4, 0.06, 0.05), 0, 2.2, 0.57, this.matRunas);              // fendas brilhantes
    peca(caixa(0.06, 0.9, 0.05), -0.5, 2.7, 0.57, this.matRunas);
    peca(caixa(0.06, 0.9, 0.05), 0.5, 2.7, 0.57, this.matRunas);
    this.matOlhos = new THREE.MeshBasicMaterial({ color: 0x1a3050 });
    for (const lado of [-0.18, 0.18]) peca(new THREE.SphereGeometry(0.07, 8, 6), lado, 3.8, 0.48, this.matOlhos);

    // alvo invisível para a mira
    this.alvo = new THREE.Mesh(new THREE.BoxGeometry(3, 4.2, 1.8), new THREE.MeshBasicMaterial({ visible: false }));
    this.alvo.position.y = 2.1;
    this.alvo.userData.interativo = { tipo: 'guardiao' };
    this.grupo.add(this.alvo);
    cena.add(this.grupo);

    this.furia = 0;
    this.afundando = 0;
    this.adormecido = false;
  }

  // resultado: 'aceitou' | 'recusou'
  reagir(resultado) {
    if (resultado === 'recusou') this.furia = 1.2;
    if (resultado === 'aceitou') { this.adormecido = true; this.afundando = 0.001; }
  }

  definirAdormecido(valor) {   // usado ao reiniciar a área
    this.adormecido = valor;
    this.afundando = valor ? 1 : 0;
    this.alvo.userData.interativo = valor ? null : { tipo: 'guardiao' };
    this.grupo.visible = !valor;
    this.grupo.position.y = valor ? -5 : 0;
    this.matRunas.emissive.setHex(valor ? 0xff3b2f : 0x3fa9ff);
  }

  atualizar(dt, tempo) {
    if (this.furia > 0) {
      this.furia -= dt;
      this.matOlhos.color.setHex(0xff2010);
      this.grupo.position.x = this.col * T + Math.sin(tempo * 60) * 0.06;
    } else {
      this.matOlhos.color.setHex(this.adormecido ? 0xff3b2f : 0x1a3050);
      this.grupo.position.x = this.col * T;
    }
    if (this.adormecido && this.afundando < 1) {
      this.alvo.userData.interativo = null;
      this.afundando = Math.min(1, this.afundando + dt * 0.4);
      this.matRunas.emissive.setHex(0xff3b2f);
      this.matRunas.emissiveIntensity = 2;
      this.grupo.position.y = -this.afundando * 5;
      if (this.afundando >= 1) this.grupo.visible = false;
    }
  }
}
