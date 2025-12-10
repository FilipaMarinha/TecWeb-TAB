// onlineAdapter.js
// Integrador do modo online com o jogo local já existente (main.js).
// Usa Network (network.js) e manipula window.gameController.
// Comportamento:
//  - startOnline({group,nick,password,size})
//  - stopOnline()
//  - monkeypatch do dice.rollSticks, onPieceClick, onCellClick para enviar pedidos ao servidor
//  - recebe updates SSE e reconstrói o board local a partir de data.pieces
// Atenção sobre mapeamento de índices:
//  - por defeito usa a conversão fornecida pelo GameLogic do repositório (coordenadas / coordenadasHuman / position / positionHuman).
//  - se o servidor tiver outra convenção (posição 0 = bottom-right) podes ajustar mappingMode = 'server' nas opções abaixo.
//  - Testa com dois browsers e alterna mappingMode se necessário.
(function (global) {
  if (!global.Network) {
    console.warn("Network não encontrado. Carrega network.js antes de onlineAdapter.js");
  }
  const Network = global.Network;

  const adapter = {
    isOnline: false,
    myNick: null,
    myPassword: null,
    group: null,
    gameId: null,
    mappingMode: 'gamelogic', // 'gamelogic' (default) ou 'server' (alternativa se servidor usar convenção diferente)
    saved: {}, // guarda funções originais para restaurar
    serverState: null
  };

  // Helpers de mapeamento entre índice linear do server e row/col do board
  function indexToCoordsByGamelogic(index, cols, initialIsMe) {
    // Usa as funções de gamelogic já presentes no projecto
    const gl = window.gameController && window.gameController.gameLogic;
    if (!gl) return null;
    if (initialIsMe) {
      // Se a initial do servidor é o nosso nick, usa a perspectiva "human" do gamelogic
      return gl.coordenadasHuman(index, cols);
    } else {
      // Caso contrário, assume que o índice está orientado para o adversário => usa coordenadas padrão
      return gl.coordenadas(index, cols);
    }
  }

  function coordsToIndexByGamelogic(row, col, cols, initialIsMe) {
    const gl = window.gameController && window.gameController.gameLogic;
    if (!gl) return -1;
    if (initialIsMe) {
      return gl.positionHuman(row, col, cols);
    } else {
      return gl.position(row, col, cols);
    }
  }

  // Versão alternativa se o servidor usar a convenção "posição 0 = canto inferior-direito do jogador inicial".
  // Implementação: percorre as 4 filas (da perspetiva do jogador inicial) e gera índice linear.
  function indexToCoordsByServer(index, cols, initialIsMe) {
    // Se initialIsMe === true, a variação é directamente do ponto de vista humano
    // Na convenção do enunciado: pos0 é bottom-right (col = cols-1) e vai varrendo a tabuleiro em serpentina.
    // Vamos construir array de coordenadas do tabuleiro segundo essa ordem e indexar.
    const coordsList = [];
    // Construir a ordem das fileiras da perspetiva do jogador inicial: bottom (row 3), row2, row1, top (row0)
    const humanRows = [3, 2, 1, 0];
    for (let hr = 0; hr < 4; hr++) {
      const r = humanRows[hr];
      // Define direção: para a ornamentação do enunciado, assumimos bottom-row varre direita->esquerda (canto inferior-direito é primeiro)
      // Para manter consistência com a ideia "pos0=bottom-right", varremos bottom row right->left, next row left->right, e assim sucessivamente (serpentina)
      const rowIndex = hr; // 0..3 como "linha do jogador inicial"
      const goRightToLeft = (rowIndex % 2 === 0); // 0 -> true (r -> l), 1 -> false, etc.
      if (goRightToLeft) {
        for (let c = cols - 1; c >= 0; c--) coordsList.push({ row: r, col: c });
      } else {
        for (let c = 0; c < cols; c++) coordsList.push({ row: r, col: c });
      }
    }
    if (index < 0 || index >= coordsList.length) return null;
    // coordsList gives as visto pelo jogador inicial; se initialIsMe true então sao as coordenadas reais; se false, o jogador inicial é o adversário;
    // mas as coordsList já estão dadas em coordenadas reais do tabuleiro (rows 0..3), porque escolhemos rows reais acima.
    return coordsList[index];
  }

  function coordsToIndexByServer(row, col, cols, initialIsMe) {
    // Inverte indexToCoordsByServer: gerar coordsList e procurar índice
    const coordsList = [];
    const humanRows = [3, 2, 1, 0];
    for (let hr = 0; hr < 4; hr++) {
      const r = humanRows[hr];
      const goRightToLeft = (hr % 2 === 0);
      if (goRightToLeft) {
        for (let c = cols - 1; c >= 0; c--) coordsList.push({ row: r, col: c });
      } else {
        for (let c = 0; c < cols; c++) coordsList.push({ row: r, col: c });
      }
    }
    for (let i = 0; i < coordsList.length; i++) {
      if (coordsList[i].row === row && coordsList[i].col === col) return i;
    }
    return -1;
  }

  function indexToCoords(index, cols, initialIsMe) {
    if (adapter.mappingMode === 'gamelogic') return indexToCoordsByGamelogic(index, cols, initialIsMe);
    return indexToCoordsByServer(index, cols, initialIsMe);
  }

  function coordsToIndex(row, col, cols, initialIsMe) {
    if (adapter.mappingMode === 'gamelogic') return coordsToIndexByGamelogic(row, col, cols, initialIsMe);
    return coordsToIndexByServer(row, col, cols, initialIsMe);
  }

  // Reconstruir o board local a partir do update do servidor (data)
  function syncFromServer(data) {
    const gc = window.gameController;
    if (!gc || !gc.board) {
      console.warn("GameController não encontrado", gc);
      return;
    }

    adapter.serverState = data;

    const size = (data.pieces && data.pieces.length) / 4 || gc.board.columns;
    const cols = size;
    // Atualizar o tamanho do tabuleiro local se necessário
    if (gc.board.columns !== cols || gc.board.rows !== 4) {
      gc.board.generateBoard(cols);
    } else {
      // inicializa estrutura vazia
      gc.board.initializeBoard();
      gc.board.piecesH = [];
      gc.board.piecesC = [];
    }

    // Identificar cores dos jogadores (players: { nick1: "Blue", nick2: "Red" })
    // Identificar cores dos jogadores (players: { nick1: "Blue", nick2: "Red" })
    const playersMap = data.players || {};
    const myColor = playersMap[adapter.myNick]; // undefined if not present yet

    // Safety check: Don't wipe board if pieces data is missing
    if (!data.pieces || !Array.isArray(data.pieces)) {
      console.warn("Update sem 'pieces' válido. Ignorando sync do tabuleiro.");
    } else {
      // Map each piece from server.pieces into local Piece instances
      (data.pieces || []).forEach((cellObj, idx) => {
        if (!cellObj) return;
        const coords = indexToCoords(idx, cols, data.initial === adapter.myNick);
        // DEBUG: Log se falhar conversão
        if (!coords) {
          // console.warn(`Idx ${idx} -> coords null (cols=${cols}, initial=${data.initial}, me=${adapter.myNick})`);
          return;
        }
        const { row, col } = coords;
        // Determine if this belongs to me (our 'human') or opponent (our 'computer')
        // If server provides players mapping, color identifies owner
        const ownerColor = cellObj.color;
        let ownerIsMe = false;
        if (myColor) {
          ownerIsMe = (ownerColor === myColor);
        } else {
          // fallback: heuristic pela posição inicial: indices 0..size-1 pertencem ao jogador initial
          if (idx >= 0 && idx < cols) {
            ownerIsMe = (data.initial === adapter.myNick);
          } else if (idx >= 3 * cols && idx < 4 * cols) {
            ownerIsMe = (data.initial !== adapter.myNick);
          } else {
            // Unknown, guess by color: Blue -> computer? fallback to human=false
            ownerIsMe = false;
          }
        }

        const pid = ownerIsMe ? `human_srv_${idx}` : `computer_srv_${idx}`;
        const piece = new window.Piece(ownerIsMe ? 'human' : 'computer', pid);
        // Apply flags based on server object fields (inMotion, reachedLastRow)
        // Note: server uses boolean names according to spec: inMotion, reachedLastRow
        piece.hasMoved = !!cellObj.inMotion;
        piece.hasEnteredOpponentLine = !!cellObj.reachedLastRow;
        // Update inRow flags using position
        piece.row = row;
        piece.col = col;
        piece.updateState(); // define state/inRow flags

        // Put piece on board
        gc.board.board[row][col] = piece;
        if (ownerIsMe) gc.board.piecesH.push(piece);
        else gc.board.piecesC.push(piece);
      });

      // Re-render board
      gc.board.clearAllPieces();
      gc.board.renderAll();
    } // end else

    // Atualizar estado do controlador (turn/dice/mustPass/step/selected/winner)
    if (data.turn) {
      gc.currentPlayer = (data.turn === adapter.myNick) ? 'human' : 'computer';
    }
    // Dice: se data.dice === null então ainda não lançado; senão contém value, stickValues, keepPlaying
    if (data.dice) {
      // Representação simples compatível com gameController.diceResult
      gc.diceRolled = true;
      gc.diceResult = { valor: data.dice.value, nome: '', repete: data.dice.keepPlaying ? "Sim" : "Não", stickValues: data.dice.stickValues };
      gc.repeatTurn = !!data.dice.keepPlaying;
      // Mostrar no painel do dado
      try {
        const diceRes = document.getElementById('dice-res');
        const diceNumber = document.getElementById('dice-number');
        const diceRepeat = document.getElementById('dice-repeat');
        if (diceRes) diceRes.innerHTML = `<strong>Nome: </strong>${gc.diceResult.nome || '-'}`;
        if (diceNumber) diceNumber.innerHTML = `<strong>Número de casas: </strong>${gc.diceResult.valor || '-'}`;
        if (diceRepeat) diceRepeat.innerHTML = `<strong>Repete: </strong>${gc.diceResult.repete || '-'}`;
      } catch (e) { /* ignore */ }
    } else {
      gc.diceRolled = false;
      gc.diceResult = null;
      gc.repeatTurn = false;
      // limpar UI do dado
      try {
        document.getElementById('dice-res').innerHTML = '<strong>Nome: </strong>-';
        document.getElementById('dice-number').innerHTML = '<strong>Número de casas: </strong>-';
        document.getElementById('dice-repeat').innerHTML = '<strong>Repete: </strong>-';
      } catch (e) { }
    }

    // mustPass
    gc.mustPass = !!data.mustPass;
    // Auto-Pass Logic
    if (gc.mustPass && data.turn === adapter.myNick) {
      // Pequeno delay para o utilizador ver o resultado do dado
      setTimeout(() => {
        // Verificar se ainda é preciso passar (pode ter mudado entretanto)
        if (adapter.isOnline) {
          Network.passTurn({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId })
            .catch(err => console.error("Auto-pass error:", err));
        }
      }, 2000);
    }

    // selected: destacar casas
    // Limpar destaques antigos
    document.querySelectorAll('.board-cell.selected').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.board-cell.possible').forEach(c => c.classList.remove('possible'));
    if (Array.isArray(data.selected)) {
      data.selected.forEach(idx => {
        const coords = indexToCoords(idx, cols, data.initial === adapter.myNick);
        if (!coords) return;
        const cell = document.querySelector(`[data-row="${coords.row}"][data-col="${coords.col}"]`);
        if (cell) cell.classList.add(data.step === 'from' ? 'selected' : 'possible');
      });
    }

    // MESSAGING LOGIC IMPROVED
    console.log(`[Turn Debug] Me="${adapter.myNick}" Turn="${data.turn}" Equal?=${data.turn === adapter.myNick}`); // DEBUG
    let turnMsg = "";
    if (data.turn === adapter.myNick) {
      turnMsg = "SUA VEZ! ";
    } else {
      turnMsg = `Vez de ${data.turn}: `;
    }

    let actionMsg = "";
    if (gc.mustPass && data.turn === adapter.myNick) {
      actionMsg = "Sem jogadas. A passar a vez automaticamente...";
    } else if (data.step) {
      if (data.step === 'from') actionMsg = "Escolha peça a mover";
      else if (data.step === 'to') actionMsg = "Escolha destino";
      else if (data.step === 'take') actionMsg = "Escolha peça a capturar";
      else actionMsg = data.step;
    } else {
      // Se não há step explícito, inferir pelo dice
      if (!data.dice) actionMsg = "Lance os dados";
      else actionMsg = "Faça a jogada";
    }

    gc.updateMessage(`${turnMsg}${actionMsg}`);

    // winner: se definido, terminar
    if (data.winner) {
      // Mostrar mensagem de vencedor
      const winnerNick = data.winner;
      const msg = (winnerNick === adapter.myNick) ? "Venceu!" : (`Venceu: ${winnerNick}`);
      gc.updateMessage(msg);
      gc.gameState = 'finished';
      gc.updateButtons && gc.updateButtons();
      // Fechar SSE
      Network.stopUpdateListener();
      adapter.isOnline = false;
      // Restaurar comportamentos locais
      restorePatchedFunctions();
    }
  }

  function restorePatchedFunctions() {
    const gc = window.gameController;
    if (!gc) return;
    // restaurar dice
    try {
      if (adapter.saved.diceRoll) gc.dice.rollSticks = adapter.saved.diceRoll;
    } catch (e) { }
    // restaurar clicks
    try {
      if (adapter.saved.onPieceClick) gc.onPieceClick = adapter.saved.onPieceClick;
      if (adapter.saved.onCellClick) gc.onCellClick = adapter.saved.onCellClick;
    } catch (e) { }
  }

  function patchFunctions() {
    const gc = window.gameController;
    if (!gc) return;
    // Guardar originais
    adapter.saved.diceRoll = gc.dice.rollSticks.bind(gc.dice);
    adapter.saved.onPieceClick = gc.onPieceClick.bind(gc);
    adapter.saved.onCellClick = gc.onCellClick.bind(gc);

    // Substituir dice.rollSticks
    gc.dice.rollSticks = function () {
      // Só pedimos roll ao servidor quando for o nosso turno e estiver em modo online
      if (!adapter.isOnline) return adapter.saved.diceRoll();
      const serverState = adapter.serverState;
      if (!serverState) {
        gc.updateMessage && gc.updateMessage("Aguardando ligação ao servidor...");
        return;
      }
      if (serverState.turn !== adapter.myNick) {
        gc.updateMessage && gc.updateMessage("Não é a sua vez (online).");
        return;
      }
      // Se já existiu dice no server, não pode rolar novamente localmente
      if (serverState.dice) {
        gc.updateMessage && gc.updateMessage("Já foi lançado este turno (servidor).");
        return;
      }
      // Enviar pedido roll ao servidor
      Network.roll({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId })
        .catch(err => {
          console.error("Roll erro:", err);
          gc.updateMessage && gc.updateMessage("Erro ao pedir roll: " + (err.message || err));
        });
      // Não altera estado local: aguardar update SSE
    };

    // Substituir onPieceClick e onCellClick para enviar 'notify' em vez de mover localmente
    gc.onPieceClick = function (element) {
      if (!adapter.isOnline) return adapter.saved.onPieceClick(element);
      // Em modo online, ao clicar numa peça devemos enviar notify com step 'from' (o servidor espera cell e step na sequência)
      const cell = element.parentElement;
      if (!cell) return;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const cols = gc.board.columns;
      const initialIsMe = (adapter.serverState && adapter.serverState.initial === adapter.myNick);
      const idx = coordsToIndex(row, col, cols, initialIsMe);
      if (idx < 0) {
        gc.updateMessage("Não foi possível converter posição para servidor.");
        return;
      }
      Network.notify({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId, move: idx })
        .catch(err => {
          console.error("Notify erro:", err);
          gc.updateMessage && gc.updateMessage("Jogada rejeitada: " + (err.message || err));
        });
      // aguardar update SSE para ver resultado/seleção
    };

    gc.onCellClick = function (cell) {
      if (!adapter.isOnline) return adapter.saved.onCellClick(cell);
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const cols = gc.board.columns;
      const initialIsMe = (adapter.serverState && adapter.serverState.initial === adapter.myNick);
      const idx = coordsToIndex(row, col, cols, initialIsMe);
      if (idx < 0) {
        gc.updateMessage("Não foi possível converter posição para servidor.");
        return;
      }
      // Envia notify com cell index; servidor decide validade e envia update
      Network.notify({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId, move: idx })
        .catch(err => {
          console.error("Notify erro:", err);
          gc.updateMessage && gc.updateMessage("Jogada rejeitada: " + (err.message || err));
        });
    };

    // Setup Pass Button Listener
    const passBtn = document.getElementById('pass-turn-btn');
    if (passBtn) {
      // Remover listeners antigos (clone hack ou variavel de controlo, aqui clone hack é simples)
      const newBtn = passBtn.cloneNode(true);
      passBtn.parentNode.replaceChild(newBtn, passBtn);
      newBtn.addEventListener('click', () => {
        if (!adapter.isOnline) return;
        Network.passTurn({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId })
          .catch(err => console.error("Pass Error", err));
      });
    }
  }

  // API pública:
  function startOnline({ group, nick, password, size }, onStarted) {
    const gc = window.gameController;
    if (!gc) {
      return Promise.reject(new Error("gameController não encontrado. Certifica-te que main.js foi carregado."));
    }
    adapter.isOnline = true;
    adapter.myNick = nick;
    adapter.myPassword = password;
    adapter.group = group;

    // 1) Fazer join
    return Network.join({ group, nick, password, size })
      .then(resp => {
        adapter.gameId = resp.game || resp.gameId || resp.game || resp;
        // 2) Patchar funções locais para comportamento online
        patchFunctions();
        // 3) Iniciar EventSource /update
        Network.startUpdateListener({ game: adapter.gameId, nick: adapter.myNick }, function (data) {
          try {
            syncFromServer(data);
            onStarted && onStarted(null, data);
          } catch (e) {
            console.error("Erro a processar update SSE:", e);
          }
        }, function (err) {
          console.warn("SSE erro:", err);
        });
        return resp;
      })
      .catch(err => {
        // Reverter isOnline se falha
        adapter.isOnline = false;
        throw err;
      });
  }

  function stopOnline() {
    adapter.isOnline = false;
    adapter.serverState = null;
    // fechar listener
    Network.stopUpdateListener();
    // restaurar funcoes
    restorePatchedFunctions();
  }

  // Expor
  adapter.startOnline = startOnline;
  adapter.stopOnline = stopOnline;

  global.OnlineAdapter = adapter;
})(window);