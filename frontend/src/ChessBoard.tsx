import { useState, useEffect, useRef, useCallback } from 'react';
import './ChessBoard.css';


type Board = { [sq: string]: string };
type GameStatus = 'activ' | 'SAH_MAT' | 'PAT' | 'STEAG';
type GameState = { status: GameStatus; inCheck: string | null; winner?: string };
type Promotion = { sq: string; color: string };


const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ROWS = [8, 7, 6, 5, 4, 3, 2, 1];

const PIECES: Record<string, string> = {
    wP: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
    wR: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    wN: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    wB: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    wQ: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    wK: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    bP: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    bR: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    bN: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    bB: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    bQ: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    bK: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
};

const START: Board = {
    a8: 'bR', b8: 'bN', c8: 'bB', d8: 'bQ', e8: 'bK', f8: 'bB', g8: 'bN', h8: 'bR',
    a7: 'bP', b7: 'bP', c7: 'bP', d7: 'bP', e7: 'bP', f7: 'bP', g7: 'bP', h7: 'bP',
    a2: 'wP', b2: 'wP', c2: 'wP', d2: 'wP', e2: 'wP', f2: 'wP', g2: 'wP', h2: 'wP',
    a1: 'wR', b1: 'wN', c1: 'wB', d1: 'wQ', e1: 'wK', f1: 'wB', g1: 'wN', h1: 'wR',
};

const TIME_OPTS = [
    { label: '1 min', v: 60 }, { label: '2 min', v: 120 }, { label: '3 min', v: 180 },
    { label: '5 min', v: 300 }, { label: '10 min', v: 600 }, { label: '15 min', v: 900 },
    { label: '30 min', v: 1800 }, { label: '60 min', v: 3600 },
];
const INC_OPTS = [0, 1, 2, 3, 5, 10, 30];

const fmt = (s: number): string => {
    s = Math.max(0, Math.ceil(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const onBoard = (c: number, r: number): boolean => c >= 0 && c < 8 && r >= 0 && r < 8;



function pseudoLegal(sq: string, board: Board): string[] {
    const piece = board[sq]; if (!piece) return [];
    const moves: string[] = [], type = piece[1], color = piece[0];
    const ci = COLS.indexOf(sq[0]), ri = ROWS.indexOf(+sq[1]);

    function try_(c: number, r: number): 'empty' | 'cap' | 'blocked' {
        const id = `${COLS[c]}${ROWS[r]}`;
        if (!board[id]) { moves.push(id); return 'empty'; }
        if (board[id][0] !== color) { moves.push(id); return 'cap'; }
        return 'blocked';
    }

    if (type === 'P') {
        const d = color === 'w' ? -1 : 1;
        const fwd = `${COLS[ci]}${ROWS[ri + d]}`;
        if (onBoard(ci, ri + d) && !board[fwd]) {
            moves.push(fwd);
            const init = color === 'w' ? ri === 6 : ri === 1;
            const dbl = `${COLS[ci]}${ROWS[ri + 2 * d]}`;
            if (init && !board[dbl]) moves.push(dbl);
        }
        [-1, 1].forEach(o => {
            if (!onBoard(ci + o, ri + d)) return;
            const diag = `${COLS[ci + o]}${ROWS[ri + d]}`;
            if (board[diag] && board[diag][0] !== color) moves.push(diag);
        });
    }
    else if (type === 'N') {
        ([[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]] as [number, number][])
            .forEach(([dc, dr]) => onBoard(ci + dc, ri + dr) && try_(ci + dc, ri + dr));
    }
    else if ('RBQ'.includes(type)) {
        const dirs: [number, number][] = [];
        if (type !== 'B') dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
        if (type !== 'R') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        dirs.forEach(([dc, dr]) => {
            let c = ci + dc, r = ri + dr;
            while (onBoard(c, r)) { if (try_(c, r) !== 'empty') break; c += dc; r += dr; }
        });
    }
    else if (type === 'K') {
        for (let dc = -1; dc <= 1; dc++)
            for (let dr = -1; dr <= 1; dr++)
                if ((dc || dr) && onBoard(ci + dc, ri + dr)) try_(ci + dc, ri + dr);
    }
    return moves;
}

function inCheck(color: string, board: Board): boolean {
    const king = Object.keys(board).find(p => board[p] === color + 'K');
    if (!king) return false;
    const opp = color === 'w' ? 'b' : 'w';
    return Object.keys(board).some(p => board[p][0] === opp && pseudoLegal(p, board).includes(king));
}

function legalMoves(sq: string, board: Board): string[] {
    const piece = board[sq];
    return pseudoLegal(sq, board).filter(dest => {
        const tmp = { ...board, [dest]: piece };
        delete tmp[sq];
        return !inCheck(piece[0], tmp);
    });
}

function availableForPromo(color: string, board: Board): string[] {
    const stock: Record<string, number> = { Q: 1, R: 2, B: 2, N: 2 };
    const onB: Record<string, number> = { Q: 0, R: 0, B: 0, N: 0 };
    Object.values(board).forEach(p => { if (p[0] === color && onB[p[1]] !== undefined) onB[p[1]]++; });
    return ['Q', 'R', 'B', 'N'].filter(t => onB[t] < stock[t]);
}



type ClockProps = {
    color: 'w' | 'b'; time: number; moves: number;
    active: boolean; started: boolean; ended: boolean;
};

function Clock({ color, time, moves, active, started, ended }: ClockProps) {
    const danger = (time <= 0 && ended) || (time <= 15 && time > 0 && started && active);
    const s: React.CSSProperties = {
        flex: 1, borderRadius: 12, padding: '16px 12px', textAlign: 'center',
        border: '2px solid', transition: 'border-color .15s,background .15s', userSelect: 'none',
        borderColor: danger ? '#E24B4A' : active && started ? '#378ADD' : 'rgba(0,0,0,.12)',
        backgroundColor: danger ? '#FCEBEB' : active && started ? '#E6F1FB' : '#f8f5f0',
    };
    const tc = danger ? '#791F1F' : active && started ? '#0C447C' : '#4a3728';
    const lc = danger ? '#A32D2D' : active && started ? '#185FA5' : '#7a6252';
    return (
        <div style={s}>
            <div style={{ fontSize: 13, color: lc, fontWeight: 500, marginBottom: 6, fontFamily: 'Georgia,serif' }}>
                {color === 'w' ? 'Alb' : 'Negru'}
            </div>
            <div style={{ fontSize: 40, fontWeight: 600, color: tc, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: -1, fontFamily: 'Georgia,serif' }}>
                {fmt(time)}
            </div>
            <div style={{ fontSize: 12, color: '#9a8272', marginTop: 6 }}>{moves} mutări</div>
        </div>
    );
}


export default function ChessBoard() {
    const [board, setBoard] = useState<Board>({ ...START });
    const [selected, setSelected] = useState<string | null>(null);
    const [whiteTurn, setWhiteTurn] = useState(true);
    const [hints, setHints] = useState<string[]>([]);
    const [gameState, setGameState] = useState<GameState>({ status: 'activ', inCheck: null });
    const [promotion, setPromotion] = useState<Promotion | null>(null);
    const [captured, setCaptured] = useState<string | null>(null);
    const [justMoved, setJustMoved] = useState<string | null>(null);
    const lastMove = useRef<string | null>(null);

    const [cfg, setCfg] = useState({ init: 180, inc: 2 });
    const [wTime, setWTime] = useState(180);
    const [bTime, setBTime] = useState(180);
    const [wMoves, setWMoves] = useState(0);
    const [bMoves, setBMoves] = useState(0);
    const [started, setStarted] = useState(false);
    const [paused, setPaused] = useState(false);
    const [selTime, setSelTime] = useState(180);
    const [selInc, setSelInc] = useState(2);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);


    useEffect(() => {
        if (!started || paused || gameState.status !== 'activ') { clearInterval(timer.current!); return; }
        timer.current = setInterval(() => {
            const set = whiteTurn ? setWTime : setBTime;
            const winner = whiteTurn ? 'b' : 'w';
            set(t => {
                if (t <= 0.1) { clearInterval(timer.current!); setGameState({ status: 'STEAG', inCheck: null, winner }); return 0; }
                return +(t - 0.1).toFixed(1);
            });
        }, 100);
        return () => clearInterval(timer.current!);
    }, [started, paused, whiteTurn, gameState.status]);

    const addInc = useCallback((color: string) => {
        if (cfg.inc <= 0) return;
        (color === 'w' ? setWTime : setBTime)(t => +(t + cfg.inc).toFixed(1));
    }, [cfg.inc]);

 
    useEffect(() => {
        if (gameState.status === 'STEAG') return;
        const color = whiteTurn ? 'w' : 'b';
        const check = inCheck(color, board);
        const hasMoves = Object.keys(board).some(p => board[p][0] === color && legalMoves(p, board).length > 0);
        if (!hasMoves) {
            setGameState({ status: check ? 'SAH_MAT' : 'PAT', inCheck: check ? color : null });
        } else {
            setGameState(prev => prev.status === 'STEAG' ? prev : { status: 'activ', inCheck: check ? color : null });
        }
    }, [board, whiteTurn]);

    const doMove = useCallback((from: string, to: string, piece: string, isCapture: boolean) => {
        const color = piece[0];
        const exec = () => {
            lastMove.current = to; setJustMoved(to);
            if (!started) setStarted(true);
            addInc(color);
            color === 'w' ? setWMoves(m => m + 1) : setBMoves(m => m + 1);
            setBoard(b => { const n = { ...b, [to]: piece }; delete n[from]; return n; });
            if (piece[1] === 'P' && (to[1] === '8' || to[1] === '1')) {
                setPromotion({ sq: to, color });
            } else {
                setWhiteTurn(w => !w);
            }
            setSelected(null); setHints([]);
            setTimeout(() => { lastMove.current = null; setJustMoved(null); }, 50);
        };
        if (isCapture) { setCaptured(to); setTimeout(() => { exec(); setCaptured(null); }, 220); }
        else exec();
    }, [started, addInc]);

    function handleClick(sq: string) {
        if (gameState.status !== 'activ') return;
        const color = whiteTurn ? 'w' : 'b';
        if (!selected) {
            if (board[sq]?.startsWith(color)) { setSelected(sq); setHints(legalMoves(sq, board)); }
        } else if (hints.includes(sq)) {
            doMove(selected, sq, board[selected], !!board[sq]);
        } else {
            if (board[sq]?.startsWith(color)) { setSelected(sq); setHints(legalMoves(sq, board)); }
            else { setSelected(null); setHints([]); }
        }
    }

    function handleChat(cmd: string) {
        const coords = cmd.toLowerCase().match(/[a-h][1-8]/g);
        if (!coords || coords.length < 2) { alert("Comandă invalidă. Ex: 'e2 e4'"); return; }
        const [from, to] = coords;
        const piece = board[from], color = whiteTurn ? 'w' : 'b';
        if (!piece || !piece.startsWith(color)) { console.log('Nu e rândul tău.'); return; }
        if (!legalMoves(from, board).includes(to)) { alert(`Mutare ilegală: ${from}→${to}`); return; }
        doMove(from, to, piece, !!board[to]);
    }

    function handlePromo(type: string) {
        if (!promotion) return;
        setBoard(b => ({ ...b, [promotion.sq]: promotion.color + type }));
        setWhiteTurn(w => !w);
        setPromotion(null);
    }

    function reset() {
        clearInterval(timer.current!);
        setBoard({ ...START }); setSelected(null); setWhiteTurn(true); setHints([]);
        setGameState({ status: 'activ', inCheck: null }); setJustMoved(null); setCaptured(null); setPromotion(null);
        setWTime(cfg.init); setBTime(cfg.init); setWMoves(0); setBMoves(0);
        setStarted(false); setPaused(false);
    }

    function applyConfig() {
        clearInterval(timer.current!);
        setCfg({ init: selTime, inc: selInc });
        setWTime(selTime); setBTime(selTime); setWMoves(0); setBMoves(0);
        setStarted(false); setPaused(false);
    }

    const ended = gameState.status !== 'activ';
    const btn = (active = false): React.CSSProperties => ({
        padding: '7px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
        border: '1.5px solid #b58863', fontFamily: 'Georgia,serif',
        background: active ? '#b58863' : 'transparent', color: active ? '#fff' : '#4a3728',
    });

    return (
        <div className="game-container">

      
            <div style={{ background: '#f0d9b5', border: '2px solid #b58863', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                {!started && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, color: '#7a6252', fontFamily: 'Georgia,serif' }}>Timp inițial</label>
                            <select value={selTime} onChange={e => setSelTime(+e.target.value)}
                                style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #b58863', background: '#fff', color: '#4a3728', cursor: 'pointer' }}>
                                {TIME_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, color: '#7a6252', fontFamily: 'Georgia,serif' }}>Increment / mutare</label>
                            <select value={selInc} onChange={e => setSelInc(+e.target.value)}
                                style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #b58863', background: '#fff', color: '#4a3728', cursor: 'pointer' }}>
                                {INC_OPTS.map(v => <option key={v} value={v}>{v ? `+${v} sec` : 'Fără'}</option>)}
                            </select>
                        </div>
                        <button onClick={applyConfig} style={{ ...btn(true), padding: '6px 14px' }}>Aplică</button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <Clock color="b" time={bTime} moves={bMoves} active={!whiteTurn} started={started} ended={ended} />
                    <Clock color="w" time={wTime} moves={wMoves} active={whiteTurn} started={started} ended={ended} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => setPaused(p => !p)} disabled={!started || ended}
                        style={{ ...btn(paused), opacity: (!started || ended) ? .4 : 1, cursor: (!started || ended) ? 'default' : 'pointer' }}>
                        {paused ? '▶ Continuă' : '⏸ Pauză'}
                    </button>
                    <button onClick={reset} style={btn()}>↺ Reset</button>
                </div>

                {paused && started && !ended && (
                    <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: '#7a6252', fontFamily: 'Georgia,serif' }}>
                        Joc în pauză
                    </div>
                )}
            </div>

          
            <div className="chat-ai-area" style={{ marginBottom: 15 }}>
                <input type="text" placeholder="Comandă (ex: e2 e4)" className="chat-input"
                    style={{ padding: '10px 15px', borderRadius: 20, border: '2px solid #b58863', width: 250, outline: 'none' }}
                    onKeyDown={e => { if (e.key === 'Enter') { handleChat(e.currentTarget.value); e.currentTarget.value = ''; } }}
                />
            </div>

      
            <div className="status-bar">
                {gameState.status === 'SAH_MAT' ? <h2 className="mate-text">ȘAH MAT! Câștigă {whiteTurn ? 'Negrul' : 'Albul'}</h2>
                    : gameState.status === 'PAT' ? <h2 className="stalemate-text">REMIZĂ PRIN PAT!</h2>
                        : gameState.status === 'STEAG' ? <h2 className="mate-text">STEAG! Câștigă {gameState.winner === 'w' ? 'Albul' : 'Negrul'}</h2>
                            : <h2>Rândul: <span className={whiteTurn ? 'w-text' : 'b-text'}>{whiteTurn ? 'Albului' : 'Negrului'}</span>
                                {gameState.inCheck && <span className="check-text"> — EȘTI ÎN ȘAH!</span>}
                            </h2>}
            </div>

          
            <div className="chess-outer">
                <div className="coord-col">{ROWS.map(r => <div key={r} className="coord-label">{r}</div>)}</div>
                <div>
                    <div className="coord-row">{COLS.map(c => <div key={c} className="coord-label">{c}</div>)}</div>
                    <div className="chess-board">
                        {ROWS.map((row, rIdx) => COLS.map((col, cIdx) => {
                            const sq = `${col}${row}`;
                            const light = (rIdx + cIdx) % 2 === 0;
                            const isSel = selected === sq;
                            const canMove = hints.includes(sq);
                            const canCap = canMove && !!board[sq];
                            const kingCheck = gameState.inCheck != null && board[sq] === gameState.inCheck + 'K';
                            const isCap = captured === sq;
                            const isMoved = justMoved === sq && lastMove.current === sq;
                            let pc = 'piece';
                            if (isSel) pc += ' piece-selected';
                            if (isMoved) pc += ' piece-dropped';
                            if (kingCheck) pc += ' piece-in-check';
                            if (isCap) pc += ' piece-captured';
                            return (
                                <div key={sq}
                                    className={`square ${light ? 'square-light' : 'square-dark'} ${isSel ? 'square-selected' : ''} ${kingCheck ? 'square-check' : ''}`}
                                    onClick={() => handleClick(sq)}>
                                    {canMove && !canCap && <div className="move-dot" />}
                                    {canCap && <div className="capture-ring" />}
                                    {board[sq] && <img src={PIECES[board[sq]]} className={pc} alt={board[sq]} draggable={false} />}
                                </div>
                            );
                        }))}
                    </div>
                    <div className="coord-row">{COLS.map(c => <div key={c} className="coord-label">{c}</div>)}</div>
                </div>
                <div className="coord-col">{ROWS.map(r => <div key={r} className="coord-label">{r}</div>)}</div>
            </div>

            {ended && <button className="reset-btn" onClick={reset}>Reîncepe Jocul</button>}

        
            {promotion && (() => {
                const avail = availableForPromo(promotion.color, board);
                const names: Record<string, string> = { Q: 'Regină', R: 'Turn', B: 'Nebun', N: 'Cal' };
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ background: '#f0d9b5', border: '3px solid #b58863', borderRadius: 12, padding: 24, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
                            <h3 style={{ marginBottom: 16, color: '#4a3728', fontFamily: 'Georgia,serif' }}>
                                {avail.length ? 'Alege piesa pentru promovare!' : 'Nu ai piese pierdute!'}
                            </h3>
                            {avail.length ? (
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                    {avail.map(t => (
                                        <div key={t} onClick={() => handlePromo(t)}
                                            style={{ cursor: 'pointer', padding: 10, borderRadius: 8, border: '2px solid #b58863', background: '#fff', width: 72 }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#ffe0a0')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                                            <img src={PIECES[promotion.color + t]} alt={names[t]} style={{ width: 48, height: 48 }} draggable={false} />
                                            <div style={{ fontSize: 12, color: '#4a3728', marginTop: 4 }}>{names[t]}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div>
                                    <p style={{ color: '#4a3728', marginBottom: 16, fontFamily: 'Georgia,serif', fontSize: 14 }}>
                                        Toate piesele sunt pe tablă. Pionul rămâne pion.
                                    </p>
                                    <button onClick={() => { setPromotion(null); setWhiteTurn(w => !w); }}
                                        style={{ padding: '8px 20px', borderRadius: 8, border: '2px solid #b58863', background: '#b58863', color: '#fff', cursor: 'pointer', fontFamily: 'Georgia,serif', fontSize: 14 }}>
                                        OK
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}