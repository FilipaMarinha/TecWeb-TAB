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
    serverState: null,
    lastTurnOwner: null
  };

  // Helpers de mapeamento entre índice linear do server e row/col do board
  function indexToCoordsByGamelogic(index, cols, initialIsMe) {
    const gl = window.gameController && window.gameController.gameLogic;
    if (!gl) return null;
    if (initialIsMe) {
      return gl.coordenadasHuman(index, cols);
    } else {
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

  function indexToCoordsByServer(index, cols, initialIsMe) {
    const coordsList = [];
    const humanRows = [3, 2, 1, 0];
    for (let hr = 0; hr < 4; hr++) {
      const r = humanRows[hr];
      const rowIndex = hr;
      const goRightToLeft = (rowIndex % 2 === 0);
      if (goRightToLeft) {
        for (let c = cols - 1; c >= 0; c--) coordsList.push({ row: r, col: c });
      } else {
        for (let c = 0; c < cols; c++) coordsList.push({ row: r, col: c });
      }
    }
    if (index < 0 || index >= coordsList.length) return null;
    return coordsList[index];
  }

  function coordsToIndexByServer(row, col, cols, initialIsMe) {
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

    adapter.serverState = Object.assign({}, adapter.serverState || {}, data);

    const size = (data.pieces && data.pieces.length) / 4 || gc.board.columns;
    const cols = size;
    if (gc.board.columns !== cols || gc.board.rows !== 4) {
      gc.board.generateBoard(cols);
    } else {
      // inicializa estrutura vazia
      gc.board.initializeBoard();
      gc.board.piecesH = [];
      gc.board.piecesC = [];
    }

    const playersMap = data.players || {};
    const myColor = playersMap[adapter.myNick];

    if (!data.pieces || !Array.isArray(data.pieces)) {
      console.warn("Update sem 'pieces' válido. Ignorando sync do tabuleiro.");
    } else {
      // Map each piece from server.pieces into local Piece instances
      (data.pieces || []).forEach((cellObj, idx) => {
        if (!cellObj) return;
        const coords = indexToCoords(idx, cols, adapter.serverState.initial === adapter.myNick);
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
            ownerIsMe = (adapter.serverState.initial === adapter.myNick);
          } else if (idx >= 3 * cols && idx < 4 * cols) {
            ownerIsMe = (adapter.serverState.initial !== adapter.myNick);
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
    if (adapter.serverState.turn) {
      const oldTurn = gc.currentPlayer === 'human' ? adapter.myNick : (gc.currentPlayer === 'computer' ? 'opponent' : null);
      // Determine new turn
      gc.currentPlayer = (adapter.serverState.turn === adapter.myNick) ? 'human' : 'computer';

      if (data.turn && data.turn !== oldTurn && data.turn !== (oldTurn === 'opponent' ? 'computer' : oldTurn)) {
        if (data.mustPass === undefined) {
          adapter.serverState.mustPass = false;
          gc.mustPass = false;
        }
      }
    }
    // Dice: se data.dice === null então ainda não lançado; senão contém value, stickValues, keepPlaying
    if (data.dice) {
      // Representação simples compatível com gameController.diceResult
      gc.diceRolled = true;
      gc.diceResult = { valor: data.dice.value, nome: '', repete: data.dice.keepPlaying ? "Sim" : "Não", stickValues: data.dice.stickValues };
      gc.repeatTurn = !!data.dice.keepPlaying;

      // CORREÇÃO Re-roll: Se tem repeatTurn mas não tem movimentos válidos, permitir rolar de novo.
      if (gc.repeatTurn && !gc.hasValidMoves()) {
        gc.diceRolled = false;
      }

      // Mostrar no painel do dado
      try {
        const diceRes = document.getElementById('dice-res');
        const diceNumber = document.getElementById('dice-number');
        const diceRepeat = document.getElementById('dice-repeat');
        if (diceRes) diceRes.innerHTML = `<strong>Nome: </strong>${gc.diceResult.nome || '-'}`;
        if (diceNumber) diceNumber.innerHTML = `<strong>Número de casas: </strong>${gc.diceResult.valor || '-'}`;
        if (diceRepeat) diceRepeat.innerHTML = `<strong>Repete: </strong>${gc.diceResult.repete || '-'}`;
      } catch (e) { }
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
    if (data.mustPass !== undefined) gc.mustPass = !!data.mustPass;
    else gc.mustPass = !!adapter.serverState.mustPass;

    // Auto-Pass Logic
    if (gc.mustPass && adapter.serverState.turn === adapter.myNick) {
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

    // Highlight Logic: Keep origin selected if step is 'to'
    if (adapter.selectedIdx !== null && adapter.serverState.step === 'to') {
      const coords = indexToCoords(adapter.selectedIdx, cols, adapter.serverState.initial === adapter.myNick);
      if (coords) {
        const cell = document.querySelector(`[data-row="${coords.row}"][data-col="${coords.col}"]`);
        if (cell) cell.classList.add('selected');
      }
    } else if (adapter.serverState.step !== 'to') {
      adapter.selectedIdx = null; // Reset selection if phase changed (e.g. back to start or capture)
    }

    if (Array.isArray(data.selected)) {
      // VISUAL FIX: Apenas mostrar highlights se estivermos na fase de escolher destino ou capturar.
      // Se estivermos em 'from', não queremos o tabuleiro todo aceso (estilo local).
      if (data.step !== 'from') {
        data.selected.forEach(idx => {
          const coords = indexToCoords(idx, cols, adapter.serverState.initial === adapter.myNick);
          if (!coords) return;
          const cell = document.querySelector(`[data-row="${coords.row}"][data-col="${coords.col}"]`);
          if (cell) cell.classList.add('possible'); // Usar 'possible' (Amarelo) para destinos/capturas
        });
      }
    }

    // MESSAGING LOGIC IMPROVED
    let turnMsg = "";
    let actionMsg = "";

    // Use serverState to ensure stability against partial updates
    const currentTurn = adapter.serverState.turn;
    const currentStep = adapter.serverState.step;
    const isMyTurn = (currentTurn === adapter.myNick);
    // Verificar se é continuação do turno (re-roll)
    // Se a vez anterior já era minha e continua a ser, então é um re-roll.
    const isContinuation = (adapter.lastTurnOwner === adapter.myNick && currentTurn === adapter.myNick);

    if (isMyTurn) {
      if (gc.mustPass) {
        actionMsg = "Sem jogadas. A passar a vez automaticamente...";
      } else if (currentStep === 'to') {
        actionMsg = "SUA VEZ! Escolha o destino";
      } else if (currentStep === 'take') {
        actionMsg = "SUA VEZ! Escolha peça a capturar";
      } else {
        // step is 'from' or undefined
        if (!gc.diceRolled) {
          // Se repeatTurn estiver true (bloqueado com 4/6), forçamos msg de re-roll
          // OU se for continuação de turno (ex: correu 1 e agora joga de novo)
          if ((gc.diceResult && gc.repeatTurn) || isContinuation) {
            actionMsg = "Lance novamente!";
          } else {
            actionMsg = "SUA VEZ! Lance os dados";
          }
        } else {
          actionMsg = "SUA VEZ! Escolha uma peça para mover";
        }
      }
      gc.updateMessage(actionMsg);
    } else {
      gc.updateMessage(`Vez de ${currentTurn}!`);
    }

    // Atualizar lastTurnOwner para a próxima execução
    if (adapter.serverState.turn) {
      adapter.lastTurnOwner = adapter.serverState.turn;
    }

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
      // Se o controlador diz que já há dado rolado, não rolar de novo.
      // Usar gc.diceRolled é mais seguro que serverState.dice porque serverState pode ter lixo de merges anteriores.
      if (gc.diceRolled) {
        gc.updateMessage && gc.updateMessage("Já existe um resultado de dado ativo.");
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

      if (idx < 0 || idx === undefined || idx === null) {
        gc.updateMessage("Não foi possível converter posição para servidor.");
        return;
      }

      // Store selection locally
      adapter.selectedIdx = idx;

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