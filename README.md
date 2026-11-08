# O Labirinto do Poder Ancestral

Jogo 3D de exploração e enigmas em primeira pessoa, feito com **JavaScript + [Three.js](https://threejs.org/)** e executado no navegador.

Você é um explorador preso num labirinto ancestral. Sua única ferramenta é uma lanterna que **não cria luz: ela a carrega**. Tire a luz de um cristal, leve-a pelo labirinto e entregue-a a outro cristal para erguer pontes, abrir portas, revelar passagens e acalmar guardiões até chegar ao Núcleo.

### A história em 3 pilares
- **O passado:** os Veladores aprisionaram o *Sem-Luz*, algo que devora a própria realidade, usando três luzes. O labirinto é a cela dele.
- **O presente:** você veio atrás do poder do Núcleo e ficou preso lá dentro. Para sair, precisa chegar ao centro.
- **O mistério:** de que é feita a lanterna? Por que o Errante a deseja? As inscrições e relíquias deixam pistas, mas não dão a resposta.

## Como rodar

O jogo usa módulos JavaScript, por isso **não abre com duplo clique no `index.html`**.

- **VS Code:** instale a extensão *Live Server*, clique com o botão direito em `index.html` e escolha *Open with Live Server*.

O Three.js já está incluído na pasta `lib/`, então o jogo funciona **sem internet**. Sem internet, apenas as fontes do Google não carregam, e a página usa Georgia no lugar.

## Controles

| Tecla | Ação |
|---|---|
| W A S D / setas | Andar |
| Mouse | Olhar |
| Shift | Correr |
| **E** ou clique | **Trocar luz** com o cristal, ler inscrição, oferecer luz ao Guardião |
| F | Liga/desliga a lanterna (o Errante enxerga quem está iluminado) |
| Segurar R | Reiniciar a área atual (volta ao estado de quando você chegou) |
| B | Liga/desliga o efeito de brilho (use se o PC estiver lento) |
| Esc | Pausar |

**Vida:** você tem **4 corações**. O Errante, o Espectro e o Guardião (quando recebe a cor errada) tiram 1 coração e empurram você para trás. Os **fragmentos de vida** espalhados pelo mapa recuperam 1 coração, e cada ponto de controle enche todos. Se os corações acabarem, a área volta ao estado em que você chegou.

## Mecânicas

**Trocar luz (E):** a lanterna guarda **uma luz por vez**.
- Lanterna vazia + cristal aceso → você **absorve** a luz.
- Lanterna cheia + cristal vazio → você **transfere** a luz.
- Os dois cheios → as luzes **trocam de lugar**.

| Cor | Poder | Efeito no jogo |
|---|---|---|
| 🔵 Azul | existência | Pontes sobre abismos e barreiras de luz existem enquanto o cristal que as controla tem azul |
| 🔴 Vermelho | força | Abre portas de pedra e acalma o Guardião |
| 🟡 Dourado | revelação | Com a lanterna dourada, aparecem paredes ilusórias, inscrições ocultas e o Espectro |

O **anel colorido** na base de um cristal indica a cor que ele espera. As **gemas nas portas** acendem quando o cristal certo recebe a cor certa.

**Inimigos:**
- **Errante das Sombras:** patrulha o salão da Área 3. Ele vê quem está iluminado (lanterna acesa ou perto de um cristal aceso) e persegue. Corra ou apague a lanterna para fugir.
- **Guardião Adormecido:** bloqueia uma passagem. Ele aceita a luz vermelha e empurra você para trás se receber qualquer outra cor.
- **Espectro Instável:** só aparece sob luz dourada. Você ouve o sussurro dele quando está por perto.

As **colunas** do salão da Área 3 bloqueiam a visão do Errante: espere atrás de uma, com a lanterna apagada, até ele passar. Os **braseiros** iluminam você mesmo com a lanterna apagada.

**Coletáveis:** uma **relíquia** escondida em cada área conta parte da história (o total aparece na tela final), e os **fragmentos de vida** ficam em desvios do caminho principal.

## As 4 áreas

1. **O Despertar:** um corredor reto leva ao altar do primeiro cristal, emoldurado por braseiros. A barreira fica logo atrás dele, na mesma linha de visão: você pega a luz e vê a barreira sumir. Um desvio guarda a primeira relíquia.
2. **Os Caminhos Perdidos:** um grande abismo sem teto. Lá no alto se vê o **feixe de luz do Núcleo**, para onde você está indo. É aqui que a ponte se desfaz quando você leva a luz dela.
3. **Os Guardiões:** um salão com colunas para se esconder do Errante. Braseiros emolduram o Guardião, e há ossos de quem falhou. A **poeira dourada** no chão termina exatamente na parede ilusória.
4. **O Núcleo Ancestral:** as paredes rachadas brilham em roxo, porque o selo está enfraquecendo. Leve as três cores aos pedestais, uma de cada vez, enquanto o Espectro invisível ronda. No Núcleo, uma escolha decide entre **dois finais**.
