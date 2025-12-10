// CLASSE DICE 

class Dice {
    constructor() {
        this.sticks = document.querySelectorAll('.stick');
        this.diceArea = document.getElementById('dice-area');
        this.diceRes = document.getElementById('dice-res');
        this.diceNumber = document.getElementById('dice-number');
        this.diceRepeat = document.getElementById('dice-repeat');

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.diceArea.addEventListener('click', () => this.rollSticks(window.gameController));
    }

    // Função para lançar os dados
    rollSticks(gameController = null) {
        // Verificar se o jogo está em andamento
        if (gameController && gameController.gameState !== 'playing') {
            return;
        }
        // Verificar se já lançou os dados neste turno
        if (gameController && gameController.diceRolled) {
            return;
        }

        let total = 0;
        for (const stick of this.sticks) {

            /*NOTA: eu acho que estas 4 linhas seguintes depois podem desaparecer
              porque depois quando um jogador joga, isto tem de voltar ao estado inicial (com 2 faces divididas)*/

            const existingTotal = stick.querySelector('.stick-total');
            if (existingTotal) {
                existingTotal.remove();
            }

            stick.querySelector('.stick-face.dark').style.display = 'none';
            stick.querySelector('.stick-face.light').style.display = 'none';

            const totalDiv = document.createElement('div');
            totalDiv.classList.add('stick-total');

            const face = Math.random();
            if (face >= 0.5) {
                total++;
                totalDiv.classList.add('light');
            }
            else {
                totalDiv.classList.add('dark');
            }
            stick.appendChild(totalDiv);
        }

        const resultado = this.playInfo(total);
        if (gameController) {
            gameController.onDiceRolled(resultado);
        }

        this.diceRes.innerHTML = '<strong>Nome: </strong>' + resultado.nome;
        this.diceNumber.innerHTML = '<strong>Número de casas: </strong>' + resultado.valor;
        this.diceRepeat.innerHTML = '<strong>Repete: </strong>' + resultado.repete;

        return resultado;
    }

    // Função para definir estado da jogada
    playInfo(total) {
        let valor;
        let nome;
        let repete;
        switch (total) {
            case 0:
                valor = 6;
                nome = 'Sitteh';
                repete = "Sim";
                break;
            case 1:
                valor = 1;
                nome = 'Tâb';
                repete = "Sim";
                break;
            case 2:
                valor = 2;
                nome = 'Itneyn';
                repete = "Não";
                break;
            case 3:
                valor = 3;
                nome = 'Teláteh';
                repete = "Não";
                break;
            case 4:
                valor = 4;
                nome = "Arba'ah";
                repete = "Sim";
                break;
        }
        return { valor, nome, repete };
    }
}

// Classe Piece
class Piece {
    constructor(player, id) {
        this.player = player;
        this.id = id;
        this.state = 'not-moved';
        this.row = null;
        this.col = null;
        this.inRow4 = false; // Para computador
        this.inRow1 = false; // Para humano 
        this.hasEnteredOpponentLine = false;
        this.hasMoved = false;
    }

    updateState() {
        if (this.row == null && this.col == null) {
            this.state = 'not-moved';
        } else if ((this.player === 'computer' && this.inRow4) || (this.player === 'human' && this.inRow1)) {
            // Veterana: está na linha inicial do adversário
            this.state = 'veteran';
        } else if (this.hasMoved) {
            // Em jogo: já se moveu mas ainda não entrou na linha adversária
            this.state = 'in-play';
        } else {
            // Ainda na posição inicial
            this.state = 'not-moved';
        }
    }

    moveTo(row, col, isInitialPos = false) {
        this.row = row;
        this.col = col;

        if (!isInitialPos) {
            this.hasMoved = true;
        }

        // Atualiza flags de veterano baseado na posição atual
        if (this.player === 'computer') {
            this.inRow4 = (row === 3 && this.hasMoved);
        } else {
            this.inRow1 = (row === 0 && this.hasMoved);
        }

        // Rastrear entrada na linha do adversário
        if (this.player === 'human' && row === 0) {
            // Peça humana entrou na linha 1 (linha do computador)
            this.hasEnteredOpponentLine = true;
        } else if (this.player === 'computer' && row === 3) {
            // Peça do computador entrou na linha 4 (linha do humano)
            this.hasEnteredOpponentLine = true;
        }

        this.updateState();
    }
}
window.Piece = Piece;

// CLASSE BOARD 
class Board {
    constructor() {
        this.rows = 4;
        this.columns = 9;
        this.board = [];
        this.piecesH = [];
        this.piecesC = [];
    }

    // inicia a matriz do tabuleiro vazia
    initializeBoard() {
        this.board = [];
        for (let row = 0; row < this.rows; row++) {
            this.board[row] = [];
            for (let col = 0; col < this.columns; col++) {
                this.board[row][col] = null;
            }

        }
    }
    // Cria as peças iniciais tendo em conta o número de colunas escolhidas
    createPieces() {
        this.piecesH = [];
        this.piecesC = [];

        for (let i = 0; i < this.columns; i++) {
            const piece = new Piece('human', `human_${i}`);
            piece.moveTo(3, i, true);
            this.piecesH.push(piece);
            this.board[3][i] = piece;
        }

        for (let i = 0; i < this.columns; i++) {
            const piece = new Piece('computer', `computer_${i}`);
            piece.moveTo(0, i, true);
            this.piecesC.push(piece);
            this.board[0][i] = piece;
        }
    }

    // Renderiza uma peça 
    renderPiece(piece) {
        const cell = document.querySelector(`[data-row="${piece.row}"][data-col="${piece.col}"]`);

        if (cell) {
            const elementp = document.createElement('div');
            elementp.className = `piece ${piece.player} ${piece.state}`;
            elementp.dataset.pieceId = piece.id;
            cell.appendChild(elementp);
        }
    }

    // Renderiza todas as peças no tabuleiro
    renderAll() {
        // Limpar todas as peças existentes do tabuleiro
        this.clearAllPieces();

        // Peças jogador
        this.piecesH.forEach(piece => {
            if (piece.row != null && piece.col != null) {
                this.renderPiece(piece);
            }
        });
        // Peças computador
        this.piecesC.forEach(piece => {
            if (piece.row != null && piece.col != null) {
                this.renderPiece(piece);
            }
        });
    }

    // Limpa todas as peças do tabuleiro DOM
    clearAllPieces() {
        const existingPieces = document.querySelectorAll('.piece');
        existingPieces.forEach(piece => piece.remove());
    }
    // Função para gerar o tabuleiro dinamicamente baseado no número de colunas
    generateBoard(columns) {
        this.columns = columns;
        this.initializeBoard();
        this.createPieces();

        const boardGrid = document.getElementById('board-grid');
        if (!boardGrid) {
            return;
        }

        boardGrid.innerHTML = '';
        const cols = columns;
        // Configurar o layout do grid baseado no número de colunas
        boardGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        boardGrid.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'board-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                boardGrid.appendChild(cell);
            }
        }

        this.applySeparators(cols);
        this.renderAll();
    }

    // Função para aplicar separadores nas coordenadas específicas
    applySeparators(columns) {
        const cells = document.querySelectorAll('.board-cell');

        cells.forEach((cell) => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            const lastColumn = columns - 1;

            if ((row === 3 && col === lastColumn) ||
                (row === 2 && col === 0) ||
                (row === 2 && col === lastColumn) ||
                (row === 1 && col === lastColumn) ||
                (row === 1 && col === 0)) {

                cell.classList.add('separator');
            }
            // Criar e adicionar círculo dentro de cada célula
            const circle = document.createElement('div');
            circle.className = 'circle';
            cell.appendChild(circle);
        });
    }
}

// CLASSE GameController
class GameController {
    constructor() {
        this.board = new Board();
        this.dice = new Dice();
        this.gameLogic = new GameLogic(this.board);
        this.minimax = null; // Instância da IA
        this.currentPlayer = null;
        this.firstP = null;
        this.aiLvl = null;
        this.diceRolled = false;
        this.diceResult = null;
        this.repeatTurn = false;
        this.selectedPiece = null;
        this.possibleMoves = []; // Movimentos possíveis para a peça selecionada
        this.isProcessingAI = false; // Evita chamadas duplicadas
        this.setupEventListeners();
        this.initializeGame();
        this.gameState = 'waiting';
    }

    setupEventListeners() {
        // Event listener para mudança no tamanho do tabuleiro
        document.getElementById('board-size').addEventListener('change', (e) => {
            if (this.gameState === 'playing') {
                this.updateMessage("Não pode mudar o tamanho do tabuleiro durante o jogo!");
                return;
            }
            const selectedColumns = parseInt(e.target.value);
            this.board.generateBoard(selectedColumns);
        });

        // Event listeners para os ccntrolos
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetGame();
        });
        document.getElementById('forfeit-btn').addEventListener('click', () => {
            this.forfeitGame();
        });
        // Event listeners para as regras
        document.getElementById('inst-btn').addEventListener('click', () => {
            this.showRules();
        });
        document.getElementById('close-rules').addEventListener('click', () => {
            this.hideRules();
        });
        // Event listeners para cliques nas peças
        this.setupPieceClickHandlers();
    }

    initializeGame() {
        // Inicia o tabuleiro com o valor padrão (9 colunas)
        const defaultColumns = 9;
        this.board.generateBoard(defaultColumns);
        this.updateMessage("Configure o jogo e clique em Iniciar Jogo para começar.");
        this.updateButtons();
    }

    getGameConfig() {
        this.gameMode = document.getElementById('game-mode').value;
        this.firstP = document.getElementById('first-player').value;
        this.aiLvl = document.getElementById('ai-level').value;
    }
    // funções para controlar os comando do jogo
    startGame() {
        if (this.gameState === 'playing') {
            this.updateMessage("O jogo já está em andamento!");
            return;
        }

        this.getGameConfig();

        // --- MODO ONLINE ---
        if (this.gameMode === 'vs-player') {
            // Verificar Login
            if (!window.Auth || !window.Auth.isLoggedIn()) {
                alert("Para jogar online tens de fazer login primeiro!");
                window.Auth.showAuthModal();
                return;
            }

            // Preparar dados
            const creds = window.Auth.getCredentials();
            const group = parseInt(creds.group);
            const size = parseInt(document.getElementById('board-size').value);

            if (!group) {
                alert("Erro: Grupo inválido.");
                return;
            }

            // UI de espera
            this.updateMessage("A contactar servidor... (Aguarde)");
            document.getElementById('start-btn').disabled = true;

            // Iniciar Adapter Online
            if (!window.OnlineAdapter) {
                alert("Erro: OnlineAdapter não carregado.");
                return;
            }

            window.OnlineAdapter.startOnline({
                group: group,
                nick: creds.nick,
                password: creds.password,
                size: size
            }, (err, data) => {
                // Callback chamada quando recebemos o primeiro update do servidor
                if (this.gameState !== 'playing') {
                    // O jogo começou agora
                    this.gameState = 'playing';
                    this.updateButtons();
                    // this.updateMessage("Adversário encontrado! Jogo Iniciado."); // Deixar o adapter gerir a mensagem
                }
                // Nota: O resto (tabuleiro, turno, peças) é gerido pelo syncFromServer do adapter
            }).then(() => {
                // O join foi feito com sucesso, agora estamos à espera do Update (matchmaking)
                this.updateMessage("Na sala de espera... À espera de adversário.");
            }).catch(err => {
                this.gameState = 'waiting';
                this.updateButtons();
                this.updateMessage("Erro ao entrar no jogo: " + (err.message || err));
                console.error(err);
            });

            return; // IMPORTANTE: Não executar a lógica local abaixo
        }


        // --- MODO LOCAL (Vs Computador) ---
        this.currentPlayer = this.firstP;
        this.diceRolled = false;
        this.repeatTurn = false;
        this.gameState = 'playing';

        this.updateButtons();
        this.updateTurnMessage();

        // Instanciar IA após o jogo iniciar (garante board/logic prontos)
        this.minimax = new Minimax(this.gameLogic, this.board);

        // Se o computador começa, desencadear o turno da IA
        if (this.currentPlayer === 'computer') {
            setTimeout(() => this.runAITurn(), 500);
        }
    }

    resetGame() {
        this.gameState = 'waiting';
        // Dar reset ao tabuleiro
        const columns = parseInt(document.getElementById('board-size').value);
        this.board.generateBoard(columns);

        this.updateButtons();
        this.updateMessage("Jogo reiniciado. Configure o jogo e clique em Iniciar Jogo.");
    }

    forfeitGame() {
        if (this.gameState !== 'playing') {
            this.updateMessage("Não há jogo em andamento!");
            return;
        }

        // Se estiver ONLINE, enviar pedido de leave
        if (window.OnlineAdapter && window.OnlineAdapter.isOnline) {
            const creds = window.Auth.getCredentials();
            // Chamar leave
            window.Network.leave({
                nick: creds.nick,
                password: creds.password,
                game: window.OnlineAdapter.gameId
            }).then(() => {
                this.updateMessage("Desististe do jogo online.");
                window.OnlineAdapter.stopOnline();
            }).catch(err => {
                console.error("Leave error", err);
                // Força saída local mesmo com erro
                window.OnlineAdapter.stopOnline();
            });
        }

        this.gameState = 'finished';
        this.updateButtons();
        this.updateMessage("Jogo terminado. Clique em Reiniciar para jogar novamente.");

        // Contabiliza desistência do humano (admin) como derrota na leaderboard local (vs IA)
        try {
            if (this.gameMode === 'vs-computador') {
                const lvl = (this.aiLvl || '').toLowerCase();
                let xpLose = -10; // padrão: médio
                switch (lvl) {
                    case 'easy':
                    case 'fácil':
                    case 'facil':
                        xpLose = -5; break;
                    case 'medium':
                    case 'médio':
                    case 'medio':
                        xpLose = -10; break;
                    case 'hard':
                    case 'difícil':
                    case 'dificil':
                        xpLose = -15; break;
                }
                saveLocalResult({ vitorias: 0, derrotas: 1, xp: xpLose });
                renderLocalLeaderboard();
            }
        } catch (e) {
            // Falha silenciosa ao registar derrota por desistência
        }
    }


    // funções para atualizar a interface 
    updateButtons() {
        const startBtn = document.getElementById('start-btn');
        const resetBtn = document.getElementById('reset-btn');
        const fftBtn = document.getElementById('forfeit-btn');

        switch (this.gameState) {
            case 'waiting':
                startBtn.disabled = false;
                resetBtn.disabled = true;
                fftBtn.disabled = true;
                break;
            case 'playing':
                startBtn.disabled = true;
                resetBtn.disabled = false;
                fftBtn.disabled = false;
                break;
            case 'finished':
                startBtn.disabled = true;
                resetBtn.disabled = false;
                fftBtn.disabled = true;
                break;
        }
    }

    updateMessage(msg) {
        const msgElem = document.getElementById('message');
        if (msgElem) {
            msgElem.textContent = msg;
        }
    }

    updateTurn() {
        let pName = this.currentPlayer === 'human' ? 'Humano' : 'Computador';
        let act = this.diceRolled ? 'escolha uma peça para mover' : 'lance os dados';
        this.updateMessage(`Vez do ${pName}: ${act}`);
    }
    // Função para mostrar ou esconder as regras
    showRules() {
        const rulesPanel = document.getElementById('rules-acc');
        if (rulesPanel) {
            rulesPanel.style.display = 'block';
            // Forçar um reflow para que a transição funcione
            rulesPanel.offsetHeight;
            rulesPanel.classList.remove('hide');
            rulesPanel.classList.add('show');
        }
    }

    hideRules() {
        const rulesPanel = document.getElementById('rules-acc');
        if (rulesPanel) {
            rulesPanel.classList.remove('show');
            rulesPanel.classList.add('hide');
            // Esconder completamente após a animação
            setTimeout(() => {
                if (rulesPanel.classList.contains('hide')) {
                    rulesPanel.style.display = 'none';
                }
            }, 300);
        }
    }
    // Event listeners para cliques nas peças e casas
    setupPieceClickHandlers() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('piece')) {
                this.onPieceClick(e.target);
            } else if (e.target.classList.contains('board-cell') || e.target.classList.contains('circle')) {
                // Clique numa casa (ou no círculo dentro dela)
                const cell = e.target.classList.contains('board-cell') ? e.target : e.target.parentElement;
                this.onCellClick(cell);
            }
        });
    }
    // Processa clique numa peça
    onPieceClick(pieceElement) {
        if (this.gameState !== 'playing') return;
        if (!this.diceRolled) {
            this.updateMessage("Lance os dados primeiro!");
            return;
        }
        // Se há peça selecionada, verificar se clicou numa casa possível
        if (this.selectedPiece) {
            const cell = pieceElement.parentElement;
            if (cell && cell.classList.contains('board-cell')) {
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                // Verifica se a casa está nos movimentos possíveis
                const targetMove = this.possibleMoves.find(move => move.row === row && move.col === col);

                if (targetMove) {
                    const diceValue = this.diceResult.valor;
                    const moveResult = this.gameLogic.movePiece(this.selectedPiece, diceValue, targetMove);

                    if (moveResult.success) {
                        this.clearSelection();
                        this.updateMessage(`Peça movida ${diceValue} casas!`);
                        this.onMoveCompleted(moveResult);
                    } else {
                        this.updateMessage(moveResult.error);
                    }
                    return;
                }
            }
        }

        const pieceId = pieceElement.dataset.pieceId;
        const piece = this.findPieceById(pieceId);

        if (!piece) return;
        // Se já existe uma peça selecionada e o utilizador clicou noutra peça do mesmo jogador, muda a seleção para a nova peça
        if (this.selectedPiece && this.selectedPiece.id !== piece.id && piece.player === this.currentPlayer) {
            const diceValueTmp = this.diceResult.valor;
            const possibleMovesTmp = this.gameLogic.getPossibleMoves(piece, diceValueTmp);
            if (possibleMovesTmp.length > 0) {
                this.selectPiece(piece, possibleMovesTmp);
                return;
            }
        }
        // Verificar se é turno do jogador correto
        if (piece.player !== this.currentPlayer) {
            this.updateMessage("Não é o seu turno!");
            return;
        }
        // Verificar se a peça pode mover
        const diceValue = this.diceResult.valor;
        const possibleMoves = this.gameLogic.getPossibleMoves(piece, diceValue);

        if (possibleMoves.length === 0) {
            this.updateMessage("Esta peça não pode mover com este valor!");
            return;
        }
        this.selectPiece(piece, possibleMoves);
    }

    // Processa clique numa casa do tabuleiro
    onCellClick(cell) {
        if (this.gameState !== 'playing') return;
        if (!this.selectedPiece) return; // Só processa se há peça selecionada

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        // Verifica se a casa clicada está nos movimentos possíveis
        const targetMove = this.possibleMoves.find(move => move.row === row && move.col === col);

        if (!targetMove) {
            this.updateMessage("Movimento inválido! Escolha uma das casas destacadas.");
            return;
        }

        // Executar o movimento
        const diceValue = this.diceResult.valor;
        const moveResult = this.gameLogic.movePiece(this.selectedPiece, diceValue, targetMove);

        if (moveResult.success) {
            this.clearSelection();
            this.updateMessage(`Peça movida ${diceValue} casas!`);
            this.onMoveCompleted(moveResult);
        } else {
            this.updateMessage(moveResult.error);
        }
    }

    // Seleciona uma peça e destaca os movimentos possíveis
    selectPiece(piece, possibleMoves) {
        this.clearSelection();

        this.selectedPiece = piece;
        this.possibleMoves = possibleMoves;

        // Destacar a peça selecionada
        const pieceElement = document.querySelector(`[data-piece-id="${piece.id}"]`);
        if (pieceElement && pieceElement.parentElement) {
            pieceElement.parentElement.classList.add('selected');
        }

        // Destacar as casas possíveis
        possibleMoves.forEach(move => {
            const cell = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
            if (cell) {
                cell.classList.add('possible');
            }
        });

        this.updateMessage("Escolha a casa de destino para mover a peça.");
    }

    // Limpa a seleção atual
    clearSelection() {
        // Remove destaque das peças
        document.querySelectorAll('.board-cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });

        // Remove destaque das casas possíveis
        document.querySelectorAll('.board-cell.possible').forEach(cell => {
            cell.classList.remove('possible');
        });

        this.selectedPiece = null;
        this.possibleMoves = [];
    }

    // Encontra peça pelo ID
    findPieceById(pieceId) {
        const allPieces = [...this.board.piecesH, ...this.board.piecesC];
        return allPieces.find(piece => piece.id === pieceId);
    }
    // Processa fim de movimento
    onMoveCompleted(moveResult) {
        // Verificar condições de vitória
        const winCheck = this.gameLogic.checkWin();
        if (winCheck.gameEnded) {
            this.updateMessage(winCheck.message);
            this.gameState = 'finished';
            this.updateButtons();

            // Atualizar leaderboard local apenas para jogos vs IA
            try {
                if (this.gameMode === 'vs-computador') {
                    const humanWon = winCheck.winner === 'human';
                    // Mapear XP por dificuldade
                    const lvl = (this.aiLvl || '').toLowerCase();
                    let xpWin = 0, xpLose = 0;
                    switch (lvl) {
                        case 'easy':
                        case 'fácil':
                        case 'facil':
                            xpWin = 10; xpLose = -5; break;
                        case 'medium':
                        case 'médio':
                        case 'medio':
                            xpWin = 20; xpLose = -10; break;
                        case 'hard':
                        case 'difícil':
                        case 'dificil':
                            xpWin = 30; xpLose = -15; break;
                        default:
                            xpWin = 20; xpLose = -10; // padrão: médio
                    }

                    // Guardar resultado para o jogador local "admin"
                    const delta = humanWon ? { vitorias: 1, derrotas: 0, xp: xpWin }
                        : { vitorias: 0, derrotas: 1, xp: xpLose };
                    saveLocalResult(delta);
                    renderLocalLeaderboard();
                }
            } catch (e) {
                // Falha silenciosa ao atualizar leaderboard local
            }
            return;
        }
        // Se não repete turno, alternar jogador
        if (!this.repeatTurn) {
            this.switchTurn();
        } else {
            this.diceRolled = false;
            this.updateTurnMessage();
            // Se for o computador e pode repetir, desencadear novo turno automático
            if (this.currentPlayer === 'computer') {
                setTimeout(() => this.runAITurn(), 600);
            }
        }
    }
    // Alterna turnos
    switchTurn() {
        this.currentPlayer = this.currentPlayer === 'human' ? 'computer' : 'human';
        this.diceRolled = false;
        this.repeatTurn = false;
        this.diceResult = null;

        this.updateTurnMessage();

        // Se for o turno do computador, rolar e jogar automaticamente
        if (this.gameState === 'playing' && this.currentPlayer === 'computer') {
            setTimeout(() => this.runAITurn(), 600);
        }
    }
    // Atualiza mensagem do turno
    updateTurnMessage() {
        const playerName = this.currentPlayer === 'human' ? 'Humano' : 'Computador';
        const action = this.diceRolled ? 'escolha uma peça para mover' : 'lance os dados';

        this.updateMessage(`Turno do ${playerName}: ${action}`);
    }
    // Verifica se jogador tem movimentos válidos
    hasValidMoves() {
        if (!this.diceResult) return false;

        const validPieces = this.gameLogic.validPieces(this.currentPlayer, this.diceResult.valor);
        return validPieces.length > 0;
    }
    // Processa resultado dos dados
    onDiceRolled(diceResult) {
        this.diceRolled = true;
        this.diceResult = diceResult;
        this.repeatTurn = (diceResult.repete === "Sim");

        this.updateTurnMessage();
        // Verificar se tem movimentos válidos
        if (!this.hasValidMoves()) {
            // Se não tiver movimentos válidos e o dado NÃO repete, passa o turno
            if (!this.repeatTurn) {
                this.updateMessage(`${this.currentPlayer === 'human' ? 'Humano' : 'Computador'} não tem movimentos válidos. Passando turno...`);
                setTimeout(() => this.switchTurn(), 1500);
                return;
            } else {
                // Se não tiver movimentos válidos mas o dado repete, mantém o turno e permite lançar novamente
                this.updateMessage(`${this.currentPlayer === 'human' ? 'Humano' : 'Computador'} não tem movimentos válidos. Pode lançar os dados novamente!`);
                this.diceRolled = false;
                this.diceResult = null;
                this.updateTurnMessage();
                // Se for o computador, lança os dados novamente automaticamente
                if (this.currentPlayer === 'computer') {
                    setTimeout(() => this.dice.rollSticks(this), 1500);
                }
                return;
            }
        }

        // Se for o computador, após rolar os dados, escolher e executar a jogada
        if (this.currentPlayer === 'computer') {
            setTimeout(() => this.takeAIMove(), 600);
        }
    }

    // Dispara o turno da IA: se ainda não rolou, rola; o resto segue em onDiceRolled -> takeAIMove
    runAITurn() {
        if (this.gameState !== 'playing') return;
        if (this.currentPlayer !== 'computer') return;
        if (this.isProcessingAI) return;

        if (!this.diceRolled) {
            this.dice.rollSticks(this); // onDiceRolled fará o resto
        } else {
            this.takeAIMove();
        }
    }

    // Mapeia nível de dificuldade para profundidade/estratégia
    getAIStrategy() {
        const lvl = (this.aiLvl || '').toLowerCase();
        // Aceita rótulos em PT/EN
        switch (lvl) {
            case 'fácil':
            case 'facil':
            case 'easy':
                return { strategy: 'random', depth: 0 };
            case 'médio':
            case 'medio':
            case 'medium':
                return { strategy: 'minimax', depth: 2 };
            case 'difícil':
            case 'dificil':
            case 'hard':
                return { strategy: 'minimax', depth: 3 };
            default:
                return { strategy: 'minimax', depth: 2 };
        }
    }

    // A IA escolhe e executa a jogada atual
    takeAIMove() {
        if (this.gameState !== 'playing') return;
        if (this.currentPlayer !== 'computer') return;
        if (!this.diceRolled || !this.diceResult) return;
        if (!this.minimax) this.minimax = new Minimax(this.gameLogic, this.board);
        if (this.isProcessingAI) return;
        this.isProcessingAI = true;

        const { strategy, depth } = this.getAIStrategy();
        const diceValue = this.diceResult.valor;

        // Adicionar delay antes de calcular e executar o movimento (simula "pensar")
        // Delay aleatório entre 1000ms e 2000ms para parecer mais humano
        const thinkingDelay = 1000 + Math.random() * 1000;

        setTimeout(() => {
            const choice = this.minimax.getAIMove(diceValue, { strategy, depth });

            if (!choice) {
                // Sem jogadas válidas — passar turno
                this.isProcessingAI = false;
                this.updateMessage('Computador não tem movimentos válidos. Passando turno...');
                setTimeout(() => this.switchTurn(), 800);
                return;
            }

            const moveResult = this.gameLogic.movePiece(choice.piece, diceValue, choice.move);
            this.isProcessingAI = false;
            if (moveResult.success) {
                this.updateMessage(`Computador moveu ${diceValue} casas.`);
                this.onMoveCompleted(moveResult);
            } else {
                // Falha inesperada — tentar evitar loop
                this.updateMessage('Computador não conseguiu executar a jogada. Passando turno...');
                setTimeout(() => this.switchTurn(), 800);
            }
        }, thinkingDelay);
    }
}

// Funções para leaderboard local
function saveLocalResult(result) {
    // Força o nome a ser sempre 'admin'
    result.player = 'admin';
    let data = JSON.parse(localStorage.getItem('tab_leaderboard') || '[]');
    // Atualiza ou adiciona o registo do admin
    let found = data.find(r => r.player === 'admin');
    if (found) {
        found.vitorias += result.vitorias || 0;
        found.derrotas += result.derrotas || 0;
        found.xp += result.xp || 0;
    } else {
        data.push({ player: 'admin', vitorias: result.vitorias || 0, derrotas: result.derrotas || 0, xp: result.xp || 0 });
    }
    localStorage.setItem('tab_leaderboard', JSON.stringify(data));
}

function loadLocalLeaderboard() {
    return JSON.parse(localStorage.getItem('tab_leaderboard') || '[]');
}

function renderLocalLeaderboard() {
    const table = document.getElementById('leaderboard-table') || document.getElementById('local-leaderboard-table');
    if (!table) return;
    let tbody = table.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    }
    const data = loadLocalLeaderboard();
    tbody.innerHTML = '';
    // Ordena por XP desc
    data.sort((a, b) => b.xp - a.xp);
    data.forEach((row, idx) => {
        const total = (row.vitorias || 0) + (row.derrotas || 0);
        const empates = 0;
        const pct = total > 0 ? ((row.vitorias || 0) / total * 100).toFixed(0) + '%' : '0%';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${row.player}</td>
            <td>${row.vitorias || 0}</td>
            <td>${row.derrotas || 0}</td>
            <td>${empates}</td>
            <td>${total}</td>
            <td>${pct}</td>
            <td>${row.xp || 0}</td>
        `;
        tbody.appendChild(tr);
    });
}

// INICIALIZAÇÃO DO JOGO
document.addEventListener('DOMContentLoaded', () => {
    window.gameController = new GameController();
    // Renderiza leaderboard local ao carregar
    try { renderLocalLeaderboard(); } catch { }



    // Initialize Auth UI
    if (window.Auth && window.Auth.updateIdentificationUI) {
        window.Auth.updateIdentificationUI();
    }
});