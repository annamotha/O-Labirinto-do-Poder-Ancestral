// =====================================================================
// jogador.js — movimento em primeira pessoa, colisão, balanço da cabeça,
// tremor de câmera e empurrões.
// =====================================================================
import * as THREE from 'three';

const ALTURA_OLHOS = 1.6;
const VELOCIDADE_ANDANDO = 3.5;
const VELOCIDADE_CORRENDO = 6;
export const RAIO_JOGADOR = 0.4;

export class Jogador {
  // colide(x, z) -> true se o jogador NÃO pode ficar nessa posição
  constructor(camera, colide) {
    this.camera = camera;
    this.colide = colide;
    this.pos = new THREE.Vector3();
    this.faseDoPasso = 0;
    this.tremor = 0;
    this.empurrao = new THREE.Vector2();
    this.correndo = false;
    this._frente = new THREE.Vector3();
    this._direita = new THREE.Vector3();
    this._mov = new THREE.Vector3();
  }

  teleportar(x, z, anguloY = null) {
    this.pos.set(x, ALTURA_OLHOS, z);
    this.empurrao.set(0, 0);
    if (anguloY !== null) this.camera.rotation.set(0, anguloY, 0, 'YXZ');
    this.aplicarCamera();
  }

  tremer(intensidade) { this.tremor = Math.max(this.tremor, intensidade); }
  empurrar(dx, dz, forca) { this.empurrao.set(dx, dz).normalize().multiplyScalar(forca); }

  // Tenta mover; testa X e Z separados para "deslizar" nas paredes
  mover(dx, dz) {
    if (!this.colide(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    if (!this.colide(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
  }

  // Devolve true quando um passo "toca o chão" (para tocar o som)
  atualizar(dt, teclas, podeAndar) {
    let passo = false;
    let eixoFrente = 0, eixoLado = 0;
    if (podeAndar) {
      if (teclas.KeyW || teclas.ArrowUp) eixoFrente += 1;
      if (teclas.KeyS || teclas.ArrowDown) eixoFrente -= 1;
      if (teclas.KeyD || teclas.ArrowRight) eixoLado += 1;
      if (teclas.KeyA || teclas.ArrowLeft) eixoLado -= 1;
    }
    const andando = eixoFrente !== 0 || eixoLado !== 0;
    this.correndo = andando && (teclas.ShiftLeft || teclas.ShiftRight);

    if (andando) {
      this.camera.getWorldDirection(this._frente);
      this._frente.y = 0;
      this._frente.normalize();
      this._direita.crossVectors(this._frente, this.camera.up).normalize();
      const v = this.correndo ? VELOCIDADE_CORRENDO : VELOCIDADE_ANDANDO;
      this._mov.set(0, 0, 0)
        .addScaledVector(this._frente, eixoFrente)
        .addScaledVector(this._direita, eixoLado)
        .normalize()
        .multiplyScalar(v * dt);
      this.mover(this._mov.x, this._mov.z);

      const antes = Math.sin(this.faseDoPasso);
      this.faseDoPasso += dt * v * 2.4;
      const depois = Math.sin(this.faseDoPasso);
      if (antes > 0 && depois <= 0) passo = true;   // cruzou o ponto mais baixo
      if (antes < 0 && depois >= 0) passo = true;
    }

    // empurrão (ex.: o Guardião rugindo)
    if (this.empurrao.lengthSq() > 0.0001) {
      this.mover(this.empurrao.x * dt, this.empurrao.y * dt);
      this.empurrao.multiplyScalar(Math.max(0, 1 - dt * 6));
    }

    this.tremor = Math.max(0, this.tremor - dt * 1.5);
    this.aplicarCamera(andando);
    return passo;
  }

  aplicarCamera(andando = false) {
    const balanco = andando ? Math.sin(this.faseDoPasso) * 0.06 : 0;
    const t = this.tremor * 0.15;
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * t,
      this.pos.y + balanco + (Math.random() - 0.5) * t,
      this.pos.z + (Math.random() - 0.5) * t,
    );
  }
}
