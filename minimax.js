class Minimax{
    constructor(gameLogic, board){
        this.gameLogic = gameLogic;
        this.board = board;
    }
    
    // Avalia o estado do tabuleiro
    evalBoard(){
        const cPieces = this.board.piecesC;
        const hPieces = this.board.piecesH;

        // Se alguem ganhou retorna valor alto ou baixo
        if(cPieces.length === 0) return -1000; // IA perdeu
        if(hPieces.length === 0) return 1000;  // IA ganhou
        let score = 0;
        
        // Diferença de peças
        const difference = cPieces.length - hPieces.length;
        score += difference * 100;
        
        // Peças na linha adversaria
        const cInHLine = cPieces.filter(p => p.row === 3).length;
        const hInCLine = hPieces.filter(p => p.row === 0).length;
        score += (cInHLine - hInCLine) * 50;

        // Peças avançada, quanto melhor for a linha melhor, 1 < 2 < 3 < 4, sendo que na 4 tem o maior score
        cPieces.forEach(piece =>{
            score += piece.row * 10;
        });

        // Peças veteradas, ou pelas que ja entraram na linha adversaria
        const cVeteran = cPieces.filter(p => p.inRow4).length;
        const hVeteran = hPieces.filter(p => p.inRow1).length;
        score += (cVeteran - hVeteran) * 15;

        return score; // positivo = vantagem IA; negativo = vantaegem humano
    }

    // simulação do movimento
    simulateMove(piece, value, target){
        // deep copy das peças
        const cPieces = this.board.piecesC.map(p => ({...p}));
        const hPieces = this.board.piecesH.map(p => ({...p}));

        // copia do tabuleiro
        const copyBoard = [];
        for(let row = 0; row < 4; row++){
            copyBoard[row] = [];
            for(let col = 0; col < this.board.columns; col++){
                copyBoard[row][col] = this.board.board[row][col];
            }
        }

        let simPiece;
        if(piece.player === 'computer'){
            simPiece = cPieces.find(p => p.id === piece.id);
        } else {
            simPiece = hPieces.find(p => p.id === piece.id);
        }

        // remove a peça da posição original
        if (typeof piece.row === 'number' && typeof piece.col === 'number') {
            copyBoard[piece.row][piece.col] = null;
        }

        // Verifica se há uma peça adversária na posição de destino
        let captured = null;
        const targetPiece = copyBoard[target.row][target.col];
        if(targetPiece && targetPiece.player !== piece.player){
            captured = targetPiece;

            // remove a peça capturada do array
            if(targetPiece.player === 'computer'){
                const index = cPieces.findIndex(p => p.id === targetPiece.id);
                if(index !== -1) cPieces.splice(index, 1);
            } else {
                const index = hPieces.findIndex(p => p.id === targetPiece.id);
                if(index !== -1) hPieces.splice(index, 1);
            }
        } 
        
        // Move a peça para a nova posição
        simPiece.row = target.row;
        simPiece.col = target.col;
        simPiece.hasMoved = true;

        // Verifica se a peça entrou na linha adversária
        if(piece.player === 'computer' && simPiece.row === 3){ // AI entrou na linha 4
            simPiece.inRow4 = true;
        } else if(piece.player === 'human' && simPiece.row === 0){  // Humano entrou na linha 1
            simPiece.inRow1 = true;
        }

        copyBoard[target.row][target.col] = simPiece; // coloca a peça na nova posição
        return {
            board: copyBoard,
            cPieces: cPieces,
            hPieces: hPieces,
            captured: captured
        };
    }

    // Recolhe todas as jogadas possíveis para um jogador com um dado específico
    getAllMovesFor(player, diceValue) {
        const pieces = player === 'computer' ? this.board.piecesC : this.board.piecesH;
        const moves = [];
        for (const piece of pieces) {
            const pm = this.gameLogic.getPossibleMoves(piece, diceValue) || [];
            for (const move of pm) {
                moves.push({ piece, move });
            }
        }
        return moves;
    }

    // Escolhe a melhor jogada com minimax
    chooseBestMove(diceValue, depth = 2) {
        const allMoves = this.getAllMovesFor('computer', diceValue);
        if (allMoves.length === 0) return null;

        let best = null;
        let bestScore = -Infinity;

        for (const { piece, move } of allMoves) {
            const newState = this.simulateMove(piece, diceValue, move);

            // Aplica o estado deste filho para avaliar com o adversário a jogar (minimizing)
            const savedBoard = this.board.board;
            const savedCPieces = this.board.piecesC;
            const savedHPieces = this.board.piecesH;
            this.board.board = newState.board;
            this.board.piecesC = newState.cPieces;
            this.board.piecesH = newState.hPieces;

            const score = this.minimax(Math.max(0, depth - 1), false, -Infinity, Infinity, diceValue, null);

            // Restaura o board
            this.board.board = savedBoard;
            this.board.piecesC = savedCPieces;
            this.board.piecesH = savedHPieces;

            if (score > bestScore) {
                bestScore = score;
                best = { piece, move, score };
            }
        }

        return best;
    }

    // Escolhe uma jogada aleatória (fallback ou dificuldade baixa)
    chooseRandomMove(diceValue) {
        const allMoves = this.getAllMovesFor('computer', diceValue);
        if (allMoves.length === 0) return null;
        const idx = Math.floor(Math.random() * allMoves.length);
        return { ...allMoves[idx], score: 0 };
    }

    // API principal para obter a jogada da IA
    getAIMove(diceValue, { depth = 2, strategy = 'minimax' } = {}) {
        if (strategy === 'random' || depth <= 0) {
            return this.chooseRandomMove(diceValue);
        }
        return this.chooseBestMove(diceValue, depth);
    }

    minimax(depth, maximizing, alpha, beta, value, state = null){
        // Se foi passada um "state", aplicamos-no temporariamente ao board
        const savedBoard = this.board.board;
        const savedCPieces = this.board.piecesC;
        const savedHPieces = this.board.piecesH;
        if (state) {
            this.board.board = state.board;
            this.board.piecesC = state.cPieces;
            this.board.piecesH = state.hPieces;
        }

        // Condições de paragem / estados terminais
        if (depth === 0) {
            const score = this.evalBoard();
            if (state) {
                this.board.board = savedBoard;
                this.board.piecesC = savedCPieces;
                this.board.piecesH = savedHPieces;
            }
            return score;
        }

        if (this.board.piecesC.length === 0) {
            if (state) {
                this.board.board = savedBoard;
                this.board.piecesC = savedCPieces;
                this.board.piecesH = savedHPieces;
            }
            return -1000; // IA perdeu
        }
        if (this.board.piecesH.length === 0) {
            if (state) {
                this.board.board = savedBoard;
                this.board.piecesC = savedCPieces;
                this.board.piecesH = savedHPieces;
            }
            return 1000; // IA ganhou
        }

        // obter peças do jogador atual, usando o board atual
        const currPieces = maximizing ? this.board.piecesC : this.board.piecesH;

        const allMoves = [];
        for (let piece of currPieces) {
            const possibleMoves = this.gameLogic.getPossibleMoves(piece, value) || [];
            for (const move of possibleMoves) {
                allMoves.push({ piece, move });
            }
        }

        if (allMoves.length === 0) {
            const score = this.evalBoard();
            if (state) {
                this.board.board = savedBoard;
                this.board.piecesC = savedCPieces;
                this.board.piecesH = savedHPieces;
            }
            return score;
        }

        if (maximizing) {
            let maxEval = -Infinity;

            for (let { piece, move } of allMoves) {
                const newState = this.simulateMove(piece, value, move); // simulação do movimento
                const oldBoard = this.board.board; // guarda o tabuleiro do nível atual
                const oldCPieces = this.board.piecesC; // guarda as peças do nível atual (IA)
                const oldHPieces = this.board.piecesH; // guarda as peças do nível atual (Humano)
                this.board.board = newState.board;
                this.board.piecesC = newState.cPieces;
                this.board.piecesH = newState.hPieces;

                // Recursão analisa o próximo nível (jogador adversário)
                const eval1 = this.minimax(depth - 1, false, alpha, beta, value, null);

                // restaura o estado do nível atual
                this.board.board = oldBoard;
                this.board.piecesC = oldCPieces;
                this.board.piecesH = oldHPieces;

                // atualiza o valor máximo e alpha
                maxEval = Math.max(maxEval, eval1);
                alpha = Math.max(alpha, eval1);

                // poda alpha-beta
                if (beta <= alpha) break; // corta o ramo
            }

            if (state) {
                this.board.board = savedBoard;
                this.board.piecesC = savedCPieces;
                this.board.piecesH = savedHPieces;
            }
            return maxEval;

        } else {
            let minEval = Infinity;
            for (let { piece, move } of allMoves) {
                const newState = this.simulateMove(piece, value, move); // simulação do movimento
                const oldBoard = this.board.board; // guarda o tabuleiro do nível atual
                const oldCPieces = this.board.piecesC; // guarda as peças do nível atual (IA)
                const oldHPieces = this.board.piecesH; // guarda as peças do nível atual (Humano)
                this.board.board = newState.board;
                this.board.piecesC = newState.cPieces;
                this.board.piecesH = newState.hPieces;

                // Recursão analisa o próximo nível (IA)
                const eval2 = this.minimax(depth - 1, true, alpha, beta, value, null);

                // restaura o estado do nível atual
                this.board.board = oldBoard;
                this.board.piecesC = oldCPieces;
                this.board.piecesH = oldHPieces;

                // atualiza o valor mínimo e beta
                minEval = Math.min(minEval, eval2);
                beta = Math.min(beta, eval2);

                // poda alpha-beta
                if (beta <= alpha) break; // corta o ramo
            }

            if (state) {
                this.board.board = savedBoard;
                this.board.piecesC = savedCPieces;
                this.board.piecesH = savedHPieces;
            }
            return minEval;
        }
    }
}