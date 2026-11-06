# Placar Brasileirão

Extensão do Chrome que mostra o placar ao vivo do Brasileirão Série A no ícone da barra e avisa os gols dos seus times favoritos.

## Instalar

1. Baixe o `.zip` da [versão mais recente](https://github.com/aliansantos/placar-brasileirao/releases/latest) e extraia numa pasta que vai continuar existindo (o Chrome carrega a extensão dela).
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha a pasta extraída (a que tem o `manifest.json`).
4. Fixe o ícone: clique no quebra-cabeça 🧩 e no alfinete ao lado de "Placar Brasileirão".
5. Clique no ícone → aba **Times** → marque seus times com a estrela.

Para atualizar: baixe o `.zip` novo, substitua os arquivos na mesma pasta e clique no ↻ da extensão em `chrome://extensions`. O que mudou em cada versão está nas [Releases](https://github.com/aliansantos/placar-brasileirao/releases).

## Como funciona

- **Fonte dos dados:** a API pública da ESPN (`site.api.espn.com`, liga `bra.1`). Não precisa de conta nem chave. O placar do Google não pode ser lido por extensões.
- **Ícone:** vira o escudo do time em foco, e o selo mostra:
  - **ao vivo:** placar em verde (`1-0`), `GOL` em amarelo por 60 s depois de um gol, laranja no intervalo;
  - **fim de jogo:** placar em cinza por 3 h (ajustável);
  - **sem jogo:** o próximo jogo. Se for hoje, mostra a hora (`21h`). Se for nos próximos 6 dias, o dia da semana (`QUA`). Mais longe que isso, os dias que faltam (`14d`);
  - **`!` vermelho:** a atualização está falhando há mais de 2 min.

  Passe o mouse no ícone para ver o texto completo (ex.: "Grêmio 1 x 0 Bahia · 1º tempo · 34'").
- **Qual time vai para o ícone:** o 1º favorito (na ordem da aba Times) que estiver jogando. Se nenhum estiver, vale o jogo que terminou há pouco e, depois, o próximo jogo mais cedo entre os favoritos.
- **Notificações do Windows:** gol (do seu time e do adversário), início, intervalo (desligado por padrão) e fim de jogo. Clicar abre a partida na ESPN.
- **Frequência:** a cada 30 s com jogo de favorito ao vivo ou começando, e a cada 15 min sem jogo. Com o popup aberto, a cada 30 s.

## Popup

- **Jogos:** card do seu time (placar, minuto, gols e cartões, ou o próximo jogo com o último resultado), outros favoritos e todos os jogos do dia. Clique em qualquer jogo para abrir na ESPN.
- **Times:** busca, favoritos com estrela e setas para mudar a prioridade.
- **Config:** liga e desliga cada notificação, o placar no ícone, por quanto tempo manter o placar final, e um botão para testar a notificação.

## Privacidade

Tudo fica em `chrome.storage.local`. A extensão só acessa `site.api.espn.com` (placares) e `a.espncdn.com` (escudos), e não lê nenhuma página que você visita. Detalhes em [PRIVACY.md](PRIVACY.md).

## Erros e ideias

Abra uma [issue](https://github.com/aliansantos/placar-brasileirao/issues). Nos erros, diga a versão da extensão (aparece em `chrome://extensions`) e a do Chrome.

## Aviso

Projeto pessoal, sem ligação com a ESPN, a CBF ou os clubes. Os placares vêm de uma API pública da ESPN que não é documentada oficialmente e pode mudar ou parar de funcionar sem aviso. Os escudos e nomes dos clubes pertencem aos respectivos clubes.

## Licença

Este repositório não tem licença de código aberto: o código está visível, mas todos os direitos são reservados ao autor. Você pode instalar e usar a extensão. Para copiar, modificar ou redistribuir o código, peça permissão.
