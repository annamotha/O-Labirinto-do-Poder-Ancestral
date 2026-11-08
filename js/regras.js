// =====================================================================
// regras.js — as REGRAS do jogo, sem nada de gráfico.
// Ficam separadas para poderem ser testadas sozinhas (veja testes/resolver.mjs).
// =====================================================================
import { MAPA, CRISTAIS, ESTRUTURAS, GUARDIAO_COR, ehCristal, ehEstrutura } from './mapa.js';

// Estado "lógico" do labirinto: o que cada cristal guarda, a luz da lanterna etc.
export function criarEstadoInicial() {
  const estado = {
    cristais: { ...CRISTAIS },   // letra -> cor ou null
    lanterna: null,              // cor carregada ou null
    guardiaoAdormecido: false,
    reveladas: [],               // paredes ilusórias já reveladas ("col,lin")
    estruturasAtivas: {},        // letra -> true/false (condição atendida)
  };
  for (const letra in ESTRUTURAS) {
    estado.estruturasAtivas[letra] = condicaoAtendida(letra, estado.cristais);
  }
  return estado;
}

// Uma estrutura está ativa quando TODOS os cristais exigidos têm a cor certa
export function condicaoAtendida(letra, cristais) {
  const { requer } = ESTRUTURAS[letra];
  return Object.entries(requer).every(([cristal, cor]) => cristais[cristal] === cor);
}

// Uma estrutura impede a passagem?
//   ponte ativa = dá pra pisar | barreira ativa = bloqueia | porta ativa = aberta
export function estruturaBloqueia(letra, ativa) {
  const tipo = ESTRUTURAS[letra].tipo;
  return tipo === 'barreira' ? ativa : !ativa;
}

export function caractere(col, lin) {
  if (lin < 0 || lin >= MAPA.length || col < 0 || col >= MAPA[lin].length) return '#';
  return MAPA[lin][col];
}

// A célula (col, lin) bloqueia o movimento?
export function celulaBloqueada(col, lin, estado) {
  const ch = caractere(col, lin);
  if (ch === '#' || ch === '~' || ch === 'O' || ch === '&') return true;   // & = braseiro
  if (ehCristal(ch)) return true;                       // pedestal sólido
  if (ch === '%') return !estado.reveladas.includes(`${col},${lin}`);
  if (ch === 'G') return !estado.guardiaoAdormecido;
  if (ehEstrutura(ch)) return estruturaBloqueia(ch, estado.estruturasAtivas[ch]);
  return false;
}

// A ação principal: TROCAR a luz da lanterna com a do cristal.
// Devolve o que aconteceu, para o jogo tocar o som e mostrar a mensagem certa.
export function trocarLuz(estado, letra) {
  const doCristal = estado.cristais[letra];
  const daLanterna = estado.lanterna;
  if (!doCristal && !daLanterna) return 'nada';
  estado.cristais[letra] = daLanterna;
  estado.lanterna = doCristal;
  if (doCristal && daLanterna) return 'trocou';
  return doCristal ? 'absorveu' : 'transferiu';
}

// Oferecer a luz ao Guardião
export function oferecerAoGuardiao(estado) {
  if (estado.guardiaoAdormecido) return 'nada';
  if (!estado.lanterna) return 'vazia';
  if (estado.lanterna !== GUARDIAO_COR) return 'recusou';
  estado.lanterna = null;
  estado.guardiaoAdormecido = true;
  return 'aceitou';
}

// Cópia independente do estado (usada nos checkpoints e no teste)
export function clonarEstado(estado) {
  return JSON.parse(JSON.stringify(estado));
}
