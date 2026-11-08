// =====================================================================
// lanterna.js — a lanterna ancestral: feixe de luz, cor carregada
// e o cálculo da "revelação dourada".
// =====================================================================
import * as THREE from 'three';
import { CORES } from './mapa.js';

const ANGULO = Math.PI / 6;      // abertura do cone de luz
const ALCANCE = 30;

export class Lanterna {
  constructor(camera) {
    this.camera = camera;
    this.ligada = true;
    this.cor = null;
    this.tempo = 0;

    // Feixe de luz (SpotLight = cone)
    // a luz sai um pouco à frente e abaixo dos olhos, como se estivesse na mão
    this.luz = new THREE.SpotLight(0xfff1d6, 42, ALCANCE, ANGULO, 0.5, 1.15);
    this.luz.position.set(0.2, -0.15, -0.7);
    this.luz.target.position.set(0, 0, -6);
    camera.add(this.luz, this.luz.target);

    // Lanterna na mão (canto inferior direito): armação de latão, vidro e um núcleo
    // que brilha com a cor carregada. Uma luzinha interna ilumina só a armação.
    this.modelo = new THREE.Group();
    const latao = this.latao = new THREE.MeshStandardMaterial({ color: 0x6a5030, metalness: 0.6, roughness: 0.5, emissive: 0x2a1a08 });
    const add = (geo, x, y, z, mat = latao) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); this.modelo.add(m); return m; };
    add(new THREE.CylinderGeometry(0.05, 0.065, 0.025, 12), 0, -0.09, 0);   // base
    add(new THREE.CylinderGeometry(0.035, 0.06, 0.04, 12), 0, 0.085, 0);    // tampa
    add(new THREE.ConeGeometry(0.03, 0.04, 12), 0, 0.12, 0);
    const alca = add(new THREE.TorusGeometry(0.03, 0.005, 6, 16), 0, 0.16, 0);
    alca.rotation.y = Math.PI / 2;
    for (let i = 0; i < 4; i++) {                                           // hastes da armação
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 4), Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    }
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12, 1, true), 0, 0, 0,
      new THREE.MeshBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.25, depthWrite: false }));
    this.matNucleo = new THREE.MeshBasicMaterial({ color: 0xffe0b0 });
    this.nucleo = add(new THREE.OctahedronGeometry(0.022), 0, 0, 0, this.matNucleo);
    this.posBase = new THREE.Vector3(0.3, -0.3, -0.62);
    this.modelo.scale.setScalar(0.6);
    this.modelo.position.copy(this.posBase);
    this.modelo.rotation.set(0.1, -0.3, 0.05);
    camera.add(this.modelo);

    this._dir = new THREE.Vector3();
    this._para = new THREE.Vector3();
  }

  definirCor(cor) {
    this.cor = cor;
  }

  alternar() { this.ligada = !this.ligada; }

  // balanco: fase do passo (para a lanterna balançar ao andar); medo: 0..1 (inimigo por perto)
  atualizar(dt, balanco = 0, medo = 0) {
    this.tempo += dt;
    const hex = this.cor ? CORES[this.cor].hex : 0xfff1d6;
    this.luz.color.setHex(hex);
    // sem carga: luz branca e fraca; com carga: forte e colorida
    let intensidade = this.cor ? 60 : 42;
    // falha de vez em quando — e muito mais quando algo está por perto
    if (Math.random() < 0.008 + medo * 0.12) intensidade *= 0.15 + Math.random() * 0.3;
    this.luz.intensity = this.ligada ? intensidade : 0;

    // aparência da lanterna na mão
    this.matNucleo.color.setHex(this.ligada ? (this.cor ? hex : 0xffe0b0) : 0x332a20);
    this.latao.emissive.setHex(this.ligada ? 0x2a1a08 : 0x080502);
    this.nucleo.rotation.y += dt * 2;
    this.nucleo.scale.setScalar(this.cor ? 1.3 + Math.sin(this.tempo * 5) * 0.15 : 1);
    this.modelo.position.set(
      this.posBase.x + Math.cos(balanco * 0.5) * 0.008,
      this.posBase.y + Math.abs(Math.sin(balanco * 0.5)) * 0.01 + Math.sin(this.tempo * 1.5) * 0.003,
      this.posBase.z,
    );
  }

  // Quanto o ponto (x,y,z) está sob a luz DOURADA da lanterna: 0 (nada) a 1 (totalmente)
  fatorOuro(x, y, z) {
    if (!this.ligada || this.cor !== 'dourado') return 0;
    this.camera.getWorldDirection(this._dir);
    this._para.set(x, y, z).sub(this.camera.position);
    const dist = this._para.length();
    if (dist > 16 || dist < 0.01) return dist < 0.01 ? 1 : 0;
    const angulo = this._dir.angleTo(this._para);
    const noCone = 1 - THREE.MathUtils.smoothstep(angulo, ANGULO * 0.7, ANGULO * 1.3);
    const pertoSuficiente = 1 - THREE.MathUtils.smoothstep(dist, 9, 16);
    return noCone * pertoSuficiente;
  }
}
