// =====================================================================
// hud.js — tudo que é interface em HTML por cima do 3D
// =====================================================================
import { CORES } from './mapa.js';

const $ = (id) => document.getElementById(id);

export const hud = {
  mostrar(sim) { $('hud').classList.toggle('escondido', !sim); },

  area(numero, nome, objetivo) {
    $('hud-area-nome').textContent = `Área ${numero} · ${nome}`;
    $('hud-objetivo').textContent = objetivo;
  },

  tituloArea(numero, nome) {
    const el = $('titulo-area');
    el.querySelector('small').textContent = `ÁREA ${numero}`;
    el.querySelector('span').textContent = nome;
    el.style.opacity = 1;
    clearTimeout(this._tituloTimer);
    this._tituloTimer = setTimeout(() => (el.style.opacity = 0), 3200);
  },

  lanterna(cor, ligada) {
    const gema = $('hud-lanterna-gema');
    if (cor) {
      const hex = '#' + CORES[cor].hex.toString(16).padStart(6, '0');
      gema.style.background = hex;
      gema.style.borderColor = hex;
      gema.style.boxShadow = `0 0 14px ${hex}`;
      $('hud-lanterna-cor').textContent = `Luz ${CORES[cor].nome}`;
      $('hud-lanterna-cor').style.color = hex;
      $('hud-lanterna-poder').textContent = CORES[cor].poder + (ligada ? '' : ' · lanterna apagada');
    } else {
      gema.style.background = 'transparent';
      gema.style.borderColor = '#8a7a66';
      gema.style.boxShadow = 'none';
      $('hud-lanterna-cor').textContent = 'Lanterna vazia';
      $('hud-lanterna-cor').style.color = '';
      $('hud-lanterna-poder').textContent = ligada ? 'luz fraca' : 'lanterna apagada';
    }
  },

  prompt(texto) {
    $('hud-prompt').textContent = texto || '';
    $('mira').classList.toggle('ativa', !!texto);
  },

  toast(texto, duracao = 3800) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = texto;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => (el.style.opacity = 0), duracao);
    setTimeout(() => el.remove(), duracao + 700);
  },

  reinicio(progresso) {
    $('hud-reinicio').style.opacity = progresso > 0 ? 1 : 0;
    $('hud-reinicio-barra').style.width = `${Math.min(1, progresso) * 100}%`;
  },

  // Vinheta nas bordas: vermelha (perigo) ou azul-gelo (espectro por perto)
  vinheta(intensidade, cor = '160, 0, 0') {
    const el = $('vinheta');
    el.style.background = `radial-gradient(ellipse at center, transparent 45%, rgba(${cor}, 0.75) 100%)`;
    el.style.opacity = Math.min(1, intensidade);
  },

  // Escurece/clareia a tela inteira
  fade(opacidade, segundos = 0.6, cor = '#000') {
    const el = $('fade');
    el.style.background = cor;
    el.style.transition = `opacity ${segundos}s`;
    el.style.opacity = opacidade;
    return new Promise((ok) => setTimeout(ok, segundos * 1000));
  },

  leitura(texto, titulo = 'Inscrição') {
    $('leitura-titulo').textContent = titulo;
    $('leitura-texto').textContent = texto;
    $('leitura').classList.toggle('escondido', texto === null);
  },

  // Corações: cheios, vazios e um "quebrando" quando leva dano
  vidas(atual, maximo, levouDano = false) {
    const el = $('hud-vidas');
    el.innerHTML = '';
    for (let i = 0; i < maximo; i++) {
      const c = document.createElement('span');
      c.className = 'coracao' + (i < atual ? '' : ' vazio') + (levouDano && i === atual ? ' quebrando' : '');
      c.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.1 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.6 4.2 7.1C19.5 16.4 12 21 12 21z"/></svg>';
      el.appendChild(c);
    }
    if (levouDano) { el.classList.remove('tremendo'); void el.offsetWidth; el.classList.add('tremendo'); }
  },

  reliquias(n, total) { $('hud-reliquias').textContent = `Relíquias ${n}/${total}`; },

  morte(visivel) { $('morte').classList.toggle('escondido', !visivel); },

  // Flash vermelho rápido ao levar dano
  flashDano() {
    const el = $('flash-dano');
    el.style.transition = 'none';
    el.style.opacity = 0.6;
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.6s'; el.style.opacity = 0; });
  },

  menu(visivel, pausado = false) {
    $('menu').classList.toggle('escondido', !visivel);
    $('menu-historia').classList.toggle('escondido', pausado);
    $('menu-pausa').classList.toggle('escondido', !pausado);
    $('botao-jogar').textContent = pausado ? 'Continuar' : 'Entrar no labirinto';
  },

  escolha(visivel) { $('escolha').classList.toggle('escondido', !visivel); },

  final(titulo, texto, tempo, reliquias, totalReliquias) {
    $('final-titulo').textContent = titulo;
    $('final-texto').textContent = texto;
    const min = Math.floor(tempo / 60), seg = String(Math.floor(tempo % 60)).padStart(2, '0');
    $('final-tempo').textContent = `Tempo no labirinto: ${min}:${seg} · Relíquias encontradas: ${reliquias}/${totalReliquias}`;
    $('final').classList.remove('escondido');
  },
};
