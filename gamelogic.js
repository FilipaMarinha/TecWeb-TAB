class GameLogic {
    constructor(board) {
        this.board = board;
    }

    // Converte posição linear para coordenadas(linha, coluna)
    coordenadas(pos, cols = 9) {
        if (pos < 0) return null;
        const row = Math.floor(pos / cols);
        if (row >= 4) return null;
        
        const posInRow = pos % cols;
        let col;
        
        if (row === 0 || row === 2) {
            col = cols - 1 - posInRow;
        } else {
            col = posInRow;
        }
        
        return { row, col };
    }

    // Converte coordenadas (row, col) para posição linear
    position(row, col, cols = 9) {
        if (row < 0 || row >= 4 || col < 0 || col >= cols) return -1;
        let pos;
        
        if (row === 0 || row === 2) {
            pos = row * cols + (cols - 1 - col);
        } else {
            pos = row * cols + col;
        }
        return pos;
    }

    // ve o tabuleiro de L4 (row 3) para L1 (row 0)
    positionHuman(row, col, cols = 9) {      
        if (row < 0 || row >= 4 || col < 0 || col >= cols) return -1;
        
        // Para humano: L4=0, L3=1, L2=2, L1=3 (invertido)
        const humanRow = 3 - row;
        let pos;
        
        if (humanRow % 2 === 1) {
            // Linhas ímpares do humano: direita para esquerda
            pos = humanRow * cols + (cols - 1 - col);
        } else {
            // Linhas pares do humano: esquerda para direita  
            pos = humanRow * cols + col;
        }
        return pos;
    }


    // mesmo método qeue o coordenadas, mas para a perspetiva do humano
    coordenadasHuman(pos, cols = 9) {
        if (pos < 0) return null;
        
        const humanRow = Math.floor(pos / cols);
        
        if (humanRow >= 4) {
            return null;
        }
        
        const posInRow = pos % cols;
        
        // Converter de volta para coordenadas reais do tabuleiro
        const realRow = 3 - humanRow;
        
        let col;
        
        if (humanRow % 2 === 1) {
            col = cols - 1 - posInRow;
        } else {
            col = posInRow;
        }
        
        return { row: realRow, col };
    }

    nextPos(piece, value) {
        let currentPos;
        
        if (piece.player === 'human') {
            currentPos = this.positionHuman(piece.row, piece.col, this.board.columns);
        } else {
            currentPos = this.position(piece.row, piece.col, this.board.columns);
        }
        
        if (currentPos === -1) return null;
        const newPos = currentPos + value;
        let result;
        
        if (piece.player === 'human') {
            result = this.coordenadasHuman(newPos, this.board.columns);
        } else {
            result = this.coordenadas(newPos, this.board.columns);
        }
        return result;
    }

    // Retorna todas as posições possíveis para uma peça (incluindo escolha de fila)
    getAllNextPos(piece, value) {
        const cols = this.board.columns;
        const positions = [];
                
        // Verificar se a peça está na linha que permite escolha
        const canChoose = (piece.player === 'human' && piece.row === 1) || (piece.player === 'computer' && piece.row === 2);
        
        if (!canChoose) {
            // Verificar se irá sair da linha atual
            const cols = this.board.columns;
            if (piece.row === 0) {
                // L1 (row 0) move (direita -> esquerda)
                const willLeave = (piece.col - value) < 0;
                if (!willLeave) {
                    const normalMove = this.nextPos(piece, value);
                    if (normalMove) positions.push(normalMove);
                    return positions;
                }
                // calcular casas após sair para L2 (row 1)
                const casasProx = value - (piece.col + 1);
                const colL2 = casasProx;
                if (colL2 >= 0 && colL2 < cols) {
                    positions.push({ row: 1, col: colL2 });
                }
                return positions;

            } else if (piece.row === 3) {
                // L4 (row 3) move (esquerda -> direita)
                const willLeave = (piece.col + value) >= cols;
                if (!willLeave) {
                    const normalMove = this.nextPos(piece, value);
                    if (normalMove) positions.push(normalMove);
                    return positions;
                }
                // calcular casas após sair para L3 (row 2)
                const casasProx = value - (cols - piece.col);
                const colL3 = cols - 1 - casasProx;
                if (colL3 >= 0 && colL3 < cols) {
                    positions.push({ row: 2, col: colL3 });
                }
                return positions;
            }

            // usar movimento padrão
            const normalMove = this.nextPos(piece, value);
            if (normalMove) positions.push(normalMove);
            return positions;
        }
        
        let leaveRow = false;
        
        if (piece.row === 1 || piece.row === 3) {
            // Move esquerda → direita: sai se col + value >= cols
            leaveRow = (piece.col + value >= cols);
        } else {
            // Move direita → esquerda: sai se col - value < 0
            leaveRow = (piece.col - value < 0);
        }
        
        if (!leaveRow) {
            // Não sai da linha, movimento normal
            const normalMove = this.nextPos(piece, value);
            if (normalMove) positions.push(normalMove);
            return positions;
        }
        
        // O movimento sai da linha calcular ambas as opções
        let casasProx;
        
        if (piece.row === 1) {
            casasProx = value - (cols - piece.col);
        } else {
            casasProx = value - (piece.col + 1);
        }
        
        if (piece.player === 'human') {
            // humano sai de L2 (row 1)
            // OPÇÃO 1: Ir para L1 (row 0) - move (direita para esquerda)
            const colL1 = cols - 1 - casasProx;
            if (colL1 >= 0 && colL1 < cols) {
                positions.push({ row: 0, col: colL1 });
            }
            // OPÇÃO 2: Ir para L3 (row 2) - move ← (direita para esquerda)
            const colL3 = cols - 1 - casasProx;
            if (colL3 >= 0 && colL3 < cols) {
                positions.push({ row: 2, col: colL3 });
            }
        } else {
            // COMPUTADOR sai de L3 (row 2)
            // OPÇÃO 1: Ir para L2 (row 1) - move → (esquerda para direita)
            const colL2 = casasProx;
            if (colL2 >= 0 && colL2 < cols) {
                positions.push({ row: 1, col: colL2 });
            }
            // OPÇÃO 2: Ir para L4 (row 3) - move → (esquerda para direita)
            const colL4 = casasProx;
            if (colL4 >= 0 && colL4 < cols) {
                positions.push({ row: 3, col: colL4 });
            }
        }
        
        return positions.filter(pos => pos !== null);
    }

    isValid(piece, value, targetPos = null) {
        if (!piece || !value) {
            return false;
        }
        // Peças que nunca se moveram só podem começar a mover com valor 1 (Tâb)
        if (piece.state === 'not-moved' && value !== 1) {
            return false;
        }
        
        const nextPos = targetPos || this.nextPos(piece, value);
        if (!nextPos) {
            return false;
        }
        
        //  Uma peça não pode voltar à sua fila inicial 
        if (piece.player === 'human' && nextPos.row === 3 && piece.row !== 3 && piece.hasMoved) {
            return false;
        } else if (piece.player === 'computer' && nextPos.row === 0 && piece.row !== 0 && piece.hasMoved) {
            return false;
        }
        
        const targetPiece = this.board.board[nextPos.row][nextPos.col];   // Verifica se a casa está ocupada por peça do mesmo jogador
        
        if (targetPiece && targetPiece.player === piece.player) {
            return false;
        }

        // Uma peça só pode entrar uma vez na linha inicial do adversário
        if (piece.player === 'human' && piece.row !== 0 && nextPos.row === 0) {
            if (piece.hasEnteredOpponentLine) {
                return false;
            }
        } else if (piece.player === 'computer' && piece.row !== 3 && nextPos.row === 3) {
            if (piece.hasEnteredOpponentLine) {
                return false;
            }
        }

        // Uma peça só se pode mover dentro da linha inicial do adversário se nao houver peças da sua cor na sua linha inicial
        if (piece.player === 'human' && piece.row === 0 && nextPos.row === 0) {
            // Peça humana está na L1 e quer continuar na L1
            const humanPiecesInInitialLine = this.board.piecesH.filter(p => p.row === 3);
            if (humanPiecesInInitialLine.length > 0) {
                return false;
            }
        } else if (piece.player === 'computer' && piece.row === 3 && nextPos.row === 3) {
            // Peça do computador está na L4 e quer continuar na L4
            const computerPiecesInInitialLine = this.board.piecesC.filter(p => p.row === 0);
            if (computerPiecesInInitialLine.length > 0) {
                return false;
            }
        }
        return true;
    }

    movePiece(piece, diceValue, targetPos = null) {
        const nextPos = targetPos || this.nextPos(piece, diceValue);   // Se targetPos não for fornecido, usa o movimento padrão
        
        if (!this.isValid(piece, diceValue, nextPos)) {
            return { success: false, error: "Movimento inválido!" };
        }
        
        this.board.board[piece.row][piece.col] = null;  // Remove peça da posição atual
        const target = this.board.board[nextPos.row][nextPos.col];

        if (target && target.player !== piece.player) {
            this.capPiece(target);
        }

        piece.moveTo(nextPos.row, nextPos.col);  // Move a peça
        this.board.board[nextPos.row][nextPos.col] = piece;
        this.board.renderAll();

        return { success: true, captured: !!target };
    }

    capPiece(piece) {
        const pieceArray = piece.player === 'human' ? this.board.piecesH : this.board.piecesC;
        const index = pieceArray.indexOf(piece);
        
        if (index > -1) {
            pieceArray.splice(index, 1);
        }
    }

    // Retorna todas as posições válidas para onde uma peça pode mover
    getPossibleMoves(piece, value) {
        if (!piece || !value) return [];
        // Uma peça que esteja na linha inicial do adversário não se pode mexer enquanto existirem peças da sua cor na sua própria linha inicial
        if (piece.player === 'human' && piece.row === 0) {
            const hasOwnInInitial = this.board.piecesH.some(p => p.row === 3);
            if (hasOwnInInitial) return [];
        } else if (piece.player === 'computer' && piece.row === 3) {
            const hasOwnInInitial = this.board.piecesC.some(p => p.row === 0);
            if (hasOwnInInitial) return [];
        }
        
        const allPositions = this.getAllNextPos(piece, value);
        // Filtra apenas as posições válidas
        return allPositions.filter(pos => this.isValid(piece, value, pos));
    }

    validPieces(player, value) {
        const pieces = player === 'human' ? this.board.piecesH : this.board.piecesC;
        return pieces.filter(piece => this.isValid(piece, value));
    }

    checkWin() {
        if (this.board.piecesH.length === 0) {
            return { gameEnded: true, winner: 'computer', message: 'Computador venceu!' };
        }
        if (this.board.piecesC.length === 0) {
            return { gameEnded: true, winner: 'human', message: 'Humano venceu!' };
        }
        return { gameEnded: false };
    }
}