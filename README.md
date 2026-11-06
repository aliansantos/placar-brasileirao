<p align="center">
  <img src="icons/icon128.png" width="88" alt="">
</p>

<h1 align="center">Placar Brasileirão</h1>

<p align="center">
  O placar do Brasileirão ao vivo no ícone do Chrome,<br>
  com aviso de gol dos seus times.
</p>

<p align="center">
  <a href="https://github.com/aliansantos/placar-brasileirao/releases/latest"><img src="https://img.shields.io/github/v/release/aliansantos/placar-brasileirao?label=vers%C3%A3o&color=16a34a" alt="Versão"></a>
  <img src="https://img.shields.io/badge/Chrome-120%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome 120 ou mais novo">
  <img src="https://img.shields.io/badge/Manifest-V3-52525b" alt="Manifest V3">
  <img src="https://img.shields.io/badge/S%C3%A9rie%20A-ao%20vivo-ef4444" alt="Série A ao vivo">
</p>

<p align="center">
  <a href="https://github.com/aliansantos/placar-brasileirao/releases/latest"><img src="https://img.shields.io/badge/Baixar-vers%C3%A3o%20mais%20recente-16a34a?style=for-the-badge" alt="Baixar a versão mais recente"></a>
</p>

<p align="center">
  <img src="docs/icone.png" width="560" alt="Barra do Chrome com o escudo do Grêmio e o selo verde 1-1; a dica mostra Grêmio 1 x 1 Internacional, 2º tempo, 78 minutos">
</p>

---

<table>
  <tr>
    <td width="330" valign="top">
      <img src="docs/popup.png" width="320" alt="Popup da extensão: card ao vivo do Grenal, Grêmio 1 x 1 Internacional, com os gols de Vitinho e Wallace, outros favoritos e os jogos do dia">
    </td>
    <td valign="top">
      <h3>O que ela faz</h3>
      <p>⚽ <b>Placar no ícone</b><br>O escudo do seu time e o placar em tempo real na barra do Chrome.</p>
      <p>🔔 <b>Aviso de gol</b><br>Notificação do Windows a cada gol, no início, no intervalo e no fim do jogo.</p>
      <p>⭐ <b>Vários times</b><br>Marque quantos quiser. O ícone mostra o primeiro que estiver jogando.</p>
      <p>📅 <b>Próximo jogo</b><br>Sem jogo, o ícone mostra quando é o próximo: hora, dia ou dias que faltam.</p>
      <p>📋 <b>Rodada inteira</b><br>No popup: lances do seu jogo, outros favoritos e todos os jogos do dia.</p>
      <p>🔒 <b>Sem cadastro</b><br>Sem conta e sem login. Nada sai do seu navegador.</p>
    </td>
  </tr>
</table>

## Instalar

> Ainda não está na Chrome Web Store. A instalação é manual e leva um minuto.

1. Baixe o `.zip` da **[versão mais recente](https://github.com/aliansantos/placar-brasileirao/releases/latest)** e extraia numa pasta que vai continuar existindo. O Chrome carrega a extensão dessa pasta.
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**, no canto superior direito.
3. Clique em **Carregar sem compactação** e escolha a pasta extraída (a que tem o `manifest.json`).
4. Fixe o ícone: clique no quebra-cabeça 🧩 e no alfinete ao lado de **Placar Brasileirão**.
5. Clique no ícone, vá na aba **Times** e marque seus times com a estrela.

## O que o selo do ícone mostra

| Selo | Quando aparece |
|:---:|---|
| ![1-0](https://img.shields.io/badge/1--0-16a34a?style=flat-square) | Seu time está jogando (placar mandante–visitante) |
| ![GOL](https://img.shields.io/badge/GOL-facc15?style=flat-square) | Por 60 segundos depois de um gol |
| ![1-0](https://img.shields.io/badge/1--0-ea580c?style=flat-square) | Intervalo |
| ![3-1](https://img.shields.io/badge/3--1-52525b?style=flat-square) | Fim de jogo. O placar fica por 3 horas (dá para mudar em **Config**) |
| ![21h](https://img.shields.io/badge/21h-2563eb?style=flat-square) | Tem jogo hoje, no horário mostrado |
| ![QUA](https://img.shields.io/badge/QUA-2563eb?style=flat-square) | Próximo jogo nesta semana |
| ![14d](https://img.shields.io/badge/14d-2563eb?style=flat-square) | Faltam 14 dias para o próximo jogo |
| ![!](https://img.shields.io/badge/!-dc2626?style=flat-square) | Sem conexão há mais de 2 minutos |

Passe o mouse no ícone para ver o texto completo, como *"Grêmio 1 x 1 Internacional · 2º tempo · 78'"*.

## Perguntas frequentes

<details>
<summary><b>De onde vêm os placares? Com que frequência atualiza?</b></summary>
<br>
Da API pública da ESPN. Durante o jogo do seu time, a extensão atualiza a cada 30 segundos. Sem jogo, a cada 15 minutos. Com o popup aberto, a cada 30 segundos.
</details>

<details>
<summary><b>Qual time aparece no ícone se eu tiver vários?</b></summary>
<br>
O primeiro da sua lista (aba <b>Times</b>) que estiver jogando. Se nenhum estiver em campo, aparece o jogo que acabou de terminar e, depois, o próximo jogo mais cedo entre os seus times. As setas na aba <b>Times</b> mudam a ordem.
</details>

<details>
<summary><b>Como atualizo para uma versão nova?</b></summary>
<br>
Baixe o <code>.zip</code> novo, substitua os arquivos na mesma pasta e clique no ↻ da extensão em <code>chrome://extensions</code>. Seus times e configurações continuam salvos. O que mudou em cada versão está nas <a href="https://github.com/aliansantos/placar-brasileirao/releases">Releases</a>.
</details>

<details>
<summary><b>Funciona em Edge, Brave ou Opera?</b></summary>
<br>
Esses navegadores também aceitam <b>Carregar sem compactação</b>, então a instalação deve funcionar. Por enquanto, a extensão só foi testada no Chrome.
</details>

<details>
<summary><b>Tem Série B ou Copa do Brasil?</b></summary>
<br>
Por enquanto, só a Série A.
</details>

<details>
<summary><b>Quais dados a extensão usa?</b></summary>
<br>
Seus times e configurações ficam só no seu navegador. A extensão acessa apenas <code>site.api.espn.com</code> (placares) e <code>a.espncdn.com</code> (escudos), e não lê as páginas que você visita. Detalhes na <a href="PRIVACY.md">política de privacidade</a>.
</details>

## Erros e ideias

Abra uma **[issue](https://github.com/aliansantos/placar-brasileirao/issues)**. Se for um erro, diga a versão da extensão (aparece em `chrome://extensions`) e a do Chrome.

---

<sub>Projeto pessoal, sem ligação com a ESPN, a CBF ou os clubes. Os placares vêm de uma API pública da ESPN que não é documentada oficialmente e pode mudar sem aviso. Escudos e nomes pertencem aos respectivos clubes.<br>
<b>Licença:</b> o código está visível, mas todos os direitos são reservados ao autor. Você pode instalar e usar a extensão. Para copiar, modificar ou redistribuir o código, peça permissão.</sub>
