// =====================================================================
// mapa.js — TODO o conteúdo do jogo fica aqui (só dados, sem Three.js).
// Para criar ou mudar enigmas, cenário e textos, edite este arquivo.
// Depois rode "node testes/resolver.mjs" para conferir se tudo tem solução.
// =====================================================================

// ---------------------------------------------------------------------
// LEGENDA DO MAPA (cada caractere = uma célula de 4x4 metros)
//
//   #   parede (sozinha no meio de uma sala vira uma COLUNA)
//   .   chão              P  início do jogo        @  checkpoint
//   ~   abismo            %  parede ilusória (some sob luz dourada)
//   1-9 inscrição na parede vizinha (textos em INSCRICOES)
//   a-z (minúscula)  CRISTAL — guarda uma luz (ou fica vazio)
//   A-Z (maiúscula)  ESTRUTURA controlada por cristais (ver ESTRUTURAS)
//   G   Guardião Adormecido   X  Errante das Sombras
//   S   Espectro Instável     O  Núcleo Ancestral
//
//   Cenário e coletáveis:
//   &   braseiro (fogo — ilumina, e quem está perto fica visível ao Errante)
//   =   estandarte na parede vizinha
//   ;   ossos e escombros (restos de exploradores)
//   :   poeira dourada no chão (pista de parede ilusória)
//   *   fragmento de vida (recupera 1 coração)
//   ?   relíquia (uma por área, conta parte da história)
//
// Convenção: o cristal "a" controla a estrutura "A", o "b" controla "B"...
// ---------------------------------------------------------------------
export const MAPA = [
  // Área 4 (esquerda)          |  Área 3 (direita)
  '#########################################', // 0
  '#.....&......#6..y##j....#:......4..=..e#', // 1
  '#.....O......#....##.....%:.............#', // 2
  '#.....&......#....##?.;..#:.............#', // 3
  '###########.##....############.##########', // 4
  '###########N###W##############G##########', // 5
  '#r~..#....&.&...w.###......7&...&......f#', // 6
  '#.~.q#............###........;.;........#', // 7
  '#.~..#...k...m....###...#.......#.......#', // 8
  '#.~..#............###u..................#', // 9
  '#.Q...........l....@H.......#.......#..v#', // 10
  '#.~..#.S..........###h..................#', // 11
  '#.~..#............###...#...X...#.......#', // 12
  '#.~..#............###...................#', // 13
  '#*~;.#?;...5..=...###.......#.......#...#', // 14
  '#####################....=..*.........3.#', // 15
  '#####################################@###', // 16
  '#####################################.###', // 17
  '#####?;##...&...####?;2..~~..=...~~.&.&.#', // 18
  '#####.###.......####.....~~......~~.....#', // 19
  '#P.1....=...a...A.##.....~~......~~.....#', // 20
  '#########.......#.##.....~~......DD.....#', // 21
  '#########...&...#.##.....~~.....d~~.....#', // 22
  '#################.##.....~~......~~.....#', // 23
  '#################.##.....CC......~~.....#', // 24
  '#;.............b..##.....~~c.....~~.....#', // 25
  '#.................##.....~~......~~.....#', // 26
  '#~~~~~~~B~~~~~~~~~##.&...~~......~~.....#', // 27
  '#~~~~~~~B~~~~~~~~~##.....~~......~~.....#', // 28
  '#.................##.....~~......~~.....#', // 29
  '#*..;..............@.....~~......~~.....#', // 30
  '#.................##....;~~......~~....*#', // 31
  '#########################################', // 32
  // linhas 0-16: Área 4 | Área 3     linhas 17-32: Área 1 | Área 2
];

// As três cores e o que cada uma significa
export const CORES = {
  azul:     { hex: 0x3fa9ff, nome: 'Azul',     poder: 'existência' },
  vermelho: { hex: 0xff3b2f, nome: 'Vermelho', poder: 'força' },
  dourado:  { hex: 0xffc23a, nome: 'Dourado',  poder: 'revelação' },
};

// Luz inicial de cada cristal (null = vazio)
export const CRISTAIS = {
  a: 'azul', b: null,                       // Área 1
  c: 'azul', d: null,                       // Área 2
  f: 'vermelho', v: 'azul', e: 'dourado',   // Área 3
  j: 'vermelho', h: null, u: null,
  q: 'azul', r: 'vermelho', y: 'dourado',   // Área 4
  w: null, k: null, l: null, m: null,
};

// Estruturas: tipo + quais cristais precisam estar com quais cores.
//   ponte    -> existe (dá pra pisar) quando a condição é verdadeira
//   barreira -> parede mágica que existe quando a condição é verdadeira
//   porta    -> abre quando a condição é verdadeira
export const ESTRUTURAS = {
  A: { tipo: 'barreira', requer: { a: 'azul' } },
  B: { tipo: 'ponte',    requer: { b: 'azul' } },
  C: { tipo: 'ponte',    requer: { c: 'azul' } },
  D: { tipo: 'ponte',    requer: { d: 'azul' } },
  H: { tipo: 'porta',    requer: { h: 'vermelho', u: 'dourado' } },
  Q: { tipo: 'ponte',    requer: { q: 'azul' } },
  W: { tipo: 'porta',    requer: { w: 'vermelho' } },
  N: { tipo: 'porta',    requer: { k: 'azul', l: 'vermelho', m: 'dourado' }, final: true },
};

// Áreas: nome, checkpoint, para onde o jogador olha ao chegar ([x, z]),
// retângulo que a área ocupa, objetivo e ATMOSFERA (cada área mais "doente":
// a neblina muda de cor e as rachaduras nas paredes brilham mais).
export const AREAS = [
  { nome: 'O Despertar', checkpoint: [1, 20], olhar: [1, 0], regiao: { col: [0, 18], lin: [17, 32] },
    objetivo: 'Siga até o altar. Mire no cristal azul e aperte E para absorver sua luz.',
    atmosfera: { neblina: 0x05070d, ambiente: 0x5a6a90, rachaduras: null } },
  { nome: 'Os Caminhos Perdidos', checkpoint: [19, 30], olhar: [1, -0.4], regiao: { col: [19, 40], lin: [17, 32] },
    objetivo: 'Atravesse os dois abismos. Toda luz pode ser levada — até a que sustenta seus passos.',
    atmosfera: { neblina: 0x030914, ambiente: 0x4a6aa8, rachaduras: 0x2d6fb8 } },
  { nome: 'Os Guardiões', checkpoint: [37, 16], olhar: [0, -1], regiao: { col: [19, 40], lin: [0, 16] },
    objetivo: 'Abra a porta selada a oeste. Ela exige força (vermelho) e verdade (dourado).',
    atmosfera: { neblina: 0x100405, ambiente: 0x8a5050, rachaduras: 0xff3b2f } },
  { nome: 'O Núcleo Ancestral', checkpoint: [19, 10], olhar: [-1, 0], regiao: { col: [0, 18], lin: [0, 16] },
    objetivo: 'Leve azul, vermelho e dourado aos três pedestais diante do selo.',
    atmosfera: { neblina: 0x0a0414, ambiente: 0x6a50a0, rachaduras: 0xa050ff } },
];

// Células sem teto (além dos abismos): a câmara do Núcleo, de onde sobe o feixe de luz
export const CEU_ABERTO = [{ col: [1, 12], lin: [1, 3] }];

// ---------------------------------------------------------------------
// HISTÓRIA
//   Passado:   os Veladores aprisionaram o Sem-Luz, algo que devora a realidade,
//              usando três luzes. O labirinto é a cela.
//   Presente:  você veio atrás do poder do Núcleo e ficou preso lá dentro.
//   Mistério:  de que é feita a lanterna? E por que o Errante a deseja?
// ---------------------------------------------------------------------
export const PROLOGO = 'Há milênios, os Veladores aprisionaram no coração deste labirinto algo que devora a própria realidade, e o selaram com três luzes. Você seguiu os registros até a entrada em busca desse poder. A pedra se fechou às suas costas. Restou apenas a lanterna que encontrou nas ruínas: ela não cria luz. Ela a carrega.';

// Inscrições: o número no mapa é a chave. "oculta" = só aparece sob luz dourada.
export const INSCRICOES = {
  1: { texto: 'Não fomos nós que criamos a luz. Apenas aprendemos a aprisioná-la.\n\nQuem segura o receptáculo carrega o destino destas ruínas. Tome a luz de um cristal e ela será tua. Entrega-a a outro, e a pedra obedecerá.' },
  2: { texto: 'Quando o Azul falhou, os abismos se abriram.\n\nSacrificamos as pontes para conter o que rastejava lá embaixo. Para avançar, é preciso destruir o caminho de volta.' },
  3: { texto: 'O Vermelho move o que é pesado e acalma o que guarda.\nO Dourado revela a verdade — mas a verdade atrai os olhos do Errante.\n\nEscolhe quando enxergar. No escuro (F), ele não te encontra. Atrás das colunas, ele não te vê.' },
  4: { texto: 'Nem toda parede é pedra.\n\nOnde a poeira dourada termina, a pedra mente.', oculta: true },
  5: { texto: 'Três luzes seguram o selo: o Azul que sustenta, o Vermelho que move, o Dourado que revela.\n\nTomar o poder é ser livre hoje — e libertar o amanhã.\n\nOs que tentaram antes de ti ainda vagam por esta sala. Só o ouro os mostra.' },
  6: { texto: 'Ninguém carrega a luz sem ser, em parte, escuridão.\n\nEsculpimos o receptáculo a partir daquilo que prendemos. Se a lanterna está em tuas mãos, pergunta-te: quem carrega quem?', oculta: true },
  7: { texto: 'O Guardião não dorme: ele espera.\n\nOferece-lhe a força, nunca outra cor, ou ele—\n\n(a inscrição termina num risco fundo na pedra)' },
};

// Relíquias: uma por área (a ordem segue AREAS)
export const RELIQUIAS = [
  { nome: 'Diário rasgado', texto: 'Dia 3. A entrada se fechou atrás de mim. A lanterna pulsa como se tivesse um coração.\n\nJuro que, no escuro, ouvi ela sussurrar o meu nome.' },
  { nome: 'Selo partido', texto: 'Um disco de pedra azul com a marca dos Veladores, rachado ao meio.\n\nAs bordas estão viradas para fora, como se algo tivesse forçado a passagem por dentro.' },
  { nome: 'Máscara do Sacerdote', texto: 'Uma máscara dourada, sem buracos para os olhos.\n\nNa parte de dentro, riscado às pressas: "Ele não vê a nós. Ele vê a luz que carregamos."' },
  { nome: 'Última página', texto: 'A tinta escorre pela folha:\n\n"Se o Núcleo for tomado, as três luzes se apagam de uma só vez, e Ele—"\n\nO resto da página foi arrancado.' },
];

// Inimigos: rota de patrulha (células [coluna, linha]) e território (de onde não saem)
export const INIMIGOS = {
  X: { tipo: 'errante',  patrulha: [[22, 7], [38, 7], [38, 13], [30, 11], [22, 13]], territorio: { col: [21, 39], lin: [6, 15] } },
  S: { tipo: 'espectro', patrulha: [[7, 11], [16, 11], [16, 13], [7, 13]],          territorio: { col: [6, 17],  lin: [6, 14] } },
};

// O Guardião só aceita esta cor
export const GUARDIAO_COR = 'vermelho';

// Vida do jogador
export const VIDAS_MAXIMAS = 4;

// ---------------------------------------------------------------------
// Funções auxiliares para ler o mapa
// ---------------------------------------------------------------------
export const ehCristal   = (ch) => ch >= 'a' && ch <= 'z';
export const ehEstrutura = (ch) => ESTRUTURAS[ch] !== undefined;
export const ehInscricao = (ch) => ch >= '1' && ch <= '9';

// Percorre o mapa chamando fn(caractere, coluna, linha)
export function paraCadaCelula(fn) {
  MAPA.forEach((linhaTxt, lin) => {
    [...linhaTxt].forEach((ch, col) => fn(ch, col, lin));
  });
}

// Em qual área (índice em AREAS) fica a célula
export function areaDaCelula(col, lin) {
  const i = AREAS.findIndex(({ regiao: r }) => col >= r.col[0] && col <= r.col[1] && lin >= r.lin[0] && lin <= r.lin[1]);
  return i < 0 ? 0 : i;
}
