const { useState, useEffect, useRef } = React;
const { generateTournamentBracket, advanceMatch, getMatchStatus } = window.BracketLogic;

// --- DRAFT WHEEL COMPONENT ---
const DraftWheel = ({ teams, onFinished, onRandomizeAll }) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const spinSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3'));
  const winSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'));

  const spin = () => {
    if (spinning || teams.length === 0) return;
    setSpinning(true);

    spinSound.current.currentTime = 0;
    spinSound.current.loop = true;
    spinSound.current.play().catch(() => { });

    const extraSpins = 5 + Math.random() * 5;
    const newRotation = rotation + (extraSpins * 360);
    setRotation(newRotation);

    setTimeout(() => {
      setSpinning(false);
      spinSound.current.pause();
      winSound.current.currentTime = 0;
      winSound.current.play().catch(() => { });

      const randomIndex = Math.floor(Math.random() * teams.length);
      onFinished(teams[randomIndex]);
    }, 3000);
  };

  const instantAdd = () => {
    if (spinning || teams.length === 0) return;
    const randomIndex = Math.floor(Math.random() * teams.length);
    onFinished(teams[randomIndex]);
  };

  return (
    <div className="flex flex-col items-center gap-6 mb-10">
      <div className="relative w-48 h-48">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 text-emerald-500 text-2xl animate-bounce">▼</div>
        <div
          className="w-full h-full rounded-full border-4 border-zinc-800 relative overflow-hidden transition-transform duration-[3s] cubic-bezier(0.15, 0, 0.15, 1)"
          style={{
            transform: `rotate(${rotation}deg)`,
            background: `conic-gradient(from 0deg, #10b981, #064e3b, #10b981, #064e3b, #10b981)`
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-black font-black text-2xl bg-white/10 rounded-full m-8">
            {spinning ? "🥁" : "GO"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        <button
          onClick={spin}
          disabled={spinning || teams.length === 0}
          className="w-full py-3 rounded-full font-black text-sm bg-white text-black hover:scale-105 disabled:opacity-20 transition-all shadow-lg"
        >
          {spinning ? "SPINNING..." : "SPIN WHEEL"}
        </button>

        <div className="flex gap-2">
          <button
            onClick={instantAdd}
            disabled={spinning || teams.length === 0}
            className="flex-1 py-2 rounded-xl font-bold text-[10px] bg-zinc-800 text-zinc-300 hover:text-white transition-all uppercase"
          >
            Instant
          </button>
          <button
            onClick={onRandomizeAll}
            disabled={spinning || teams.length === 0}
            className="flex-1 py-2 rounded-xl font-bold text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all uppercase"
          >
            Randomize All
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
function App() {
  const [participantCount, setParticipantCount] = useState(() => {
    const saved = localStorage.getItem('bt_participant_count');
    return saved ? Number(saved) : 11;
  });

  const [eliminationType, setEliminationType] = useState(() => {
    return localStorage.getItem('bt_elimination_type') || 'double';
  });

  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem('bt_teams');

    if (saved) {
      return JSON.parse(saved);
    }

    return Array(11).fill().map((_, i) => `Team ${i + 1}`);
  });

  useEffect(() => {
    setParticipants((current) => {
      const next = [...current];

      if (participantCount > next.length) {
        for (let i = next.length; i < participantCount; i++) {
          next.push(`Team ${i + 1}`);
        }
      }

      if (participantCount < next.length) {
        next.length = participantCount;
      }

      return next;
    });
  }, [participantCount]);

  const [bracketState, setBracketState] = useState(() => {
    const saved = localStorage.getItem('bt_state');
    return saved ? JSON.parse(saved) : null;
  });

  const [bracketHistory, setBracketHistory] = useState(() => {
    const saved = localStorage.getItem('bt_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [stage, setStage] = useState(bracketState ? 'bracket' : 'register');
  const [draftPool, setDraftPool] = useState([]);
  const [draftedSeeds, setDraftedSeeds] = useState(() => Array(participantCount).fill(""));
  const [zoom, setZoom] = useState(0.85);

  const [activeBracketTab, setActiveBracketTab] = useState("winners");
  const [showResetToast, setShowResetToast] = useState(false);
  const [meta] = useState({ title: 'Ml Tournament' });

  useEffect(() => {
    localStorage.setItem('bt_teams', JSON.stringify(participants));
    localStorage.setItem('bt_participant_count', String(participantCount));
    localStorage.setItem('bt_elimination_type', eliminationType);
    localStorage.setItem('bt_history', JSON.stringify(bracketHistory));

    if (bracketState) {
      localStorage.setItem('bt_state', JSON.stringify(bracketState));
    }
  }, [participants, participantCount, eliminationType, bracketState, bracketHistory]);

  useEffect(() => {
    if (bracketState?.champion && typeof confetti === 'function') {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#fbbf24', '#fff'] });
    }
  }, [bracketState?.champion]);

  // --- ACTIONS ---
  const startDraftStage = () => {
    const cleanParticipants = participants
      .map(team => team.trim())
      .filter(Boolean);

    if (cleanParticipants.length < 2) {
      alert('At least 2 teams are required.');
      return;
    }

    setDraftPool([...cleanParticipants]);
    setDraftedSeeds(Array(cleanParticipants.length).fill(""));
    setStage('draft');
  };

  // RESTORED: This function was missing, causing the "Proceed" button to fail silently
  const handleDraftSelect = (selectedTeam) => {
    const nextIdx = draftedSeeds.findIndex(t => t === "");
    if (nextIdx !== -1) {
      const newSeeds = [...draftedSeeds];
      newSeeds[nextIdx] = selectedTeam;
      setDraftedSeeds(newSeeds);
      setDraftPool(prev => prev.filter(t => t !== selectedTeam));
    }
  };

  const handleRandomizeAll = () => {
    let currentPool = [...draftPool];
    let newSeeds = [...draftedSeeds];

    // Shuffle the current pool
    for (let i = currentPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentPool[i], currentPool[j]] = [currentPool[j], currentPool[i]];
    }

    // Fill remaining empty slots
    let poolIdx = 0;
    for (let i = 0; i < newSeeds.length; i++) {
      if (newSeeds[i] === "" && poolIdx < currentPool.length) {
        newSeeds[i] = currentPool[poolIdx];
        poolIdx++;
      }
    }

    setDraftedSeeds(newSeeds);
    setDraftPool([]);
  };

  const handleUpdateResult = (matchId, winnerName) => {
    if (!winnerName) return alert("Please select a winner first.");

    setBracketState((prev) => {
      if (!prev) return prev;

      setBracketHistory((history) => [...history, prev]);

      return advanceMatch(prev, matchId, winnerName, null, null);
    });
  };

  const undoLastResult = () => {
    setBracketHistory((history) => {
      if (history.length === 0) return history;

      const previousBracketState = history[history.length - 1];
      const nextHistory = history.slice(0, -1);

      setBracketState(previousBracketState);

      return nextHistory;
    });
  };

  const finalizeBracket = () => {
    const state = generateTournamentBracket(draftedSeeds, eliminationType);
    setBracketState(state);
    setStage('bracket');
  };

  const fullReset = () => {
    setShowResetToast(true);
  };

  const confirmResetTournament = () => {
    localStorage.removeItem('bt_state');
    localStorage.removeItem('bt_history');
    localStorage.removeItem('bt_teams');
    localStorage.removeItem('bt_participant_count');
    localStorage.removeItem('bt_elimination_type');

    window.location.reload();
  };

  const MatchCard = ({ match }) => {
    const [selectedWinner, setSelectedWinner] = useState("");

    useEffect(() => {
      setSelectedWinner("");
    }, [match.id, match.winner]);

    const isReady =
      match.p1 &&
      match.p2 &&
      match.p1Done &&
      match.p2Done &&
      !match.winner;

    const isAutoBye =
      match.autoAdvanced &&
      match.completed &&
      match.winner &&
      (!match.p1 || !match.p2);

    const getSlotLabel = (player) => {
      if (player) return player;
      if (isAutoBye) return "BYE";
      return "TBD";
    };

    const isHighlighted = (player) => {
      if (!player) return false;

      return match.winner === player || selectedWinner === player;
    };

    return (
      <div className="match-container">
        <div
          className={`match-card w-48 ${match.winner && !isAutoBye
            ? "winner-glow"
            : isReady
              ? "border-emerald-500/50 shadow-lg"
              : "opacity-60"
            }`}
        >
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
              {match.label}
            </span>

            {isAutoBye && (
              <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 rounded font-bold">
                BYE
              </span>
            )}

            {match.winner && !isAutoBye && (
              <span className="text-[9px] bg-emerald-500 text-black px-1.5 rounded font-bold">
                FINAL
              </span>
            )}
          </div>

          <div className="space-y-1">
            {isAutoBye ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500 text-black font-bold">
                <span className="text-xs truncate w-32">
                  {match.winner}
                </span>
                <span className="text-[9px] font-black uppercase">
                  Advanced
                </span>
              </div>
            ) : (
              [match.p1, match.p2].map((player, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (isReady && player) {
                      setSelectedWinner(player);
                    }
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg transition-all ${isReady && player ? "cursor-pointer" : "cursor-default"
                    } ${isHighlighted(player)
                      ? "bg-emerald-500 text-black font-bold"
                      : player
                        ? "bg-zinc-800/50 text-zinc-300"
                        : "bg-zinc-900/70 text-zinc-600"
                    }`}
                >
                  <span className="text-xs truncate w-32">
                    {player || "TBD"}
                  </span>
                </div>
              ))
            )}
          </div>

          {isReady && (
            <button
              onClick={() => handleUpdateResult(match.id, selectedWinner)}
              className={`w-full mt-2 py-1.5 text-[10px] font-black rounded uppercase transition-all ${selectedWinner
                ? "bg-emerald-500 text-black"
                : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                }`}
            >
              Submit Result
            </button>
          )}
        </div>
      </div>
    );
  };

  const PositionedBracketBoard = ({ rounds, type }) => {
    const CARD_WIDTH = 180;
    const CARD_HEIGHT = 112;
    const COLUMN_GAP = 82;
    const BASE_ROW_HEIGHT = 136;
    const BOARD_PADDING_X = 32;
    const BOARD_PADDING_Y = 28;
    const CONNECTOR_GAP = 10;

    const hasPlayInRound =
      type === "winners" &&
      rounds.length > 1 &&
      rounds[0].length < rounds[1].length;

    const getMainRoundStartIndex = () => {
      return hasPlayInRound ? 1 : 0;
    };

    const getMatchX = (roundIndex) => {
      return BOARD_PADDING_X + roundIndex * (CARD_WIDTH + COLUMN_GAP);
    };

    const getRawMatchY = (roundIndex, matchIndex) => {
      if (type === "winners") {
        if (hasPlayInRound && roundIndex === 0) {
          const mainRound = rounds[1];
          const playInRound = rounds[0];
          const targetMainStartIndex = mainRound.length - playInRound.length;

          return BOARD_PADDING_Y + (targetMainStartIndex + matchIndex) * BASE_ROW_HEIGHT;
        }

        const logicalRoundIndex = Math.max(0, roundIndex - getMainRoundStartIndex());
        const span = Math.pow(2, logicalRoundIndex);

        return BOARD_PADDING_Y + ((matchIndex + 0.5) * span - 0.5) * BASE_ROW_HEIGHT;
      }

      if (type === "losers") {
        const span = Math.pow(2, Math.floor(roundIndex / 2));
        return BOARD_PADDING_Y + ((matchIndex + 0.5) * span - 0.5) * BASE_ROW_HEIGHT;
      }

      return BOARD_PADDING_Y + matchIndex * BASE_ROW_HEIGHT;
    };

    const rawMatches = rounds.flatMap((round, roundIndex) =>
      round.map((match, matchIndex) => ({
        match,
        roundIndex,
        matchIndex,
        x: getMatchX(roundIndex),
        rawY: getRawMatchY(roundIndex, matchIndex)
      }))
    );

    const minY = Math.min(...rawMatches.map((item) => item.rawY), BOARD_PADDING_Y);

    const positionedMatches = rawMatches.map((item) => ({
      ...item,
      y: item.rawY - minY + BOARD_PADDING_Y
    }));

    const positionById = positionedMatches.reduce((map, item) => {
      map[item.match.id] = item;
      return map;
    }, {});

    const boardWidth =
      BOARD_PADDING_X * 2 +
      rounds.length * CARD_WIDTH +
      Math.max(0, rounds.length - 1) * COLUMN_GAP +
      80;

    const boardHeight = Math.max(
      ...positionedMatches.map((item) => item.y + CARD_HEIGHT + BOARD_PADDING_Y),
      BASE_ROW_HEIGHT
    );

    const connectorLines = positionedMatches
      .filter(({ match }) => {
        if (!match.winnerNextMatchId) return false;

        const target = positionById[match.winnerNextMatchId];
        if (!target) return false;

        if (type === "winners") {
          return match.bracketType === "winners";
        }

        if (type === "losers") {
          return match.bracketType === "losers";
        }

        return false;
      })
      .map(({ match, x, y }) => {
        const target = positionById[match.winnerNextMatchId];

        const startX = x + CARD_WIDTH + CONNECTOR_GAP;
        const startY = y + CARD_HEIGHT / 2;

        const endX = target.x - CONNECTOR_GAP;
        const endY = target.y + CARD_HEIGHT / 2;

        const midX = startX + Math.max(28, (endX - startX) / 2);

        return {
          id: `${match.id}-${match.winnerNextMatchId}`,
          path: `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
        };
      });

    return (
      <div className="bracket-scroll">
        <div
          className="positioned-bracket-board"
          style={{
            position: "relative",
            width: `${boardWidth}px`,
            height: `${boardHeight}px`,
            minWidth: `${boardWidth}px`,
            margin: "0 auto"
          }}
        >
          <svg
            className="bracket-lines"
            width={boardWidth}
            height={boardHeight}
            viewBox={`0 0 ${boardWidth} ${boardHeight}`}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 1
            }}
          >
            <defs>
              <marker
                id={`arrow-${type}`}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
              </marker>
            </defs>

            {connectorLines.map((line) => (
              <path
                key={line.id}
                d={line.path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={`url(#arrow-${type})`}
              />
            ))}
          </svg>

          {positionedMatches.map(({ match, x, y }) => (
            <div
              key={match.id}
              className="positioned-match-wrapper"
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                width: `${CARD_WIDTH}px`,
                minHeight: `${CARD_HEIGHT}px`,
                zIndex: 2
              }}
            >
              <MatchCard match={match} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ChampionshipPanel = () => {
    const grandFinal = bracketState.grandFinals?.[0] || null;
    const resetFinal = bracketState.grandFinals?.find(match => match.id === "gf-reset") || null;

    const winnersChampion = grandFinal?.p1 || "TBD";
    const losersChampion = grandFinal?.p2 || "TBD";

    return (
      <div className="max-w-7xl mx-auto bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-8 items-center">
          <div className="bg-zinc-950 border border-emerald-500/20 rounded-2xl p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-3">
              Winners Bracket Champion
            </p>
            <h3 className="text-2xl font-black text-white uppercase">
              {winnersChampion}
            </h3>
          </div>

          <div className="bg-black border border-fuchsia-500/30 rounded-[2rem] p-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-500 mb-4">
              Grand Championship
            </p>

            {grandFinal ? (
              <div className="max-w-sm mx-auto">
                <MatchCard match={grandFinal} />
              </div>
            ) : (
              <div className="text-zinc-500 font-bold">
                Grand Final not generated yet.
              </div>
            )}

            {resetFinal && (
              <div className="max-w-sm mx-auto mt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-3">
                  Reset Match
                </p>
                <MatchCard match={resetFinal} />
              </div>
            )}
          </div>

          <div className="bg-zinc-950 border border-amber-500/20 rounded-2xl p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-3">
              Losers Bracket Champion
            </p>
            <h3 className="text-2xl font-black text-white uppercase">
              {losersChampion}
            </h3>
          </div>
        </div>

        {bracketState.champion && (
          <div className="mt-8 text-center bg-emerald-500 text-black rounded-[2rem] p-8 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] mb-2">
              Champion
            </p>
            <h2 className="text-4xl font-black uppercase italic">
              {bracketState.champion}
            </h2>
          </div>
        )}
      </div>
    );
  };

  const BracketTabs = () => {
    const tabs = [
      {
        id: "winners",
        label: "Winners Bracket",
        color: "emerald",
        visible: true
      },
      {
        id: "losers",
        label: "Losers Bracket",
        color: "amber",
        visible: bracketState?.mode === "double"
      },
      {
        id: "championship",
        label: "Championship",
        color: "fuchsia",
        visible: true
      }
    ].filter(tab => tab.visible);

    return (
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-wrap gap-2 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-2">
          {tabs.map((tab) => {
            const isActive = activeBracketTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveBracketTab(tab.id)}
                className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isActive
                  ? tab.color === "emerald"
                    ? "bg-emerald-500 text-black"
                    : tab.color === "amber"
                      ? "bg-amber-500 text-black"
                      : "bg-fuchsia-500 text-black"
                  : "bg-zinc-950 text-zinc-500 hover:text-white hover:bg-zinc-800"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (stage === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] shadow-2xl">

          {/* --- LOGO SECTION (CIRCULAR) --- */}
          <div className="flex justify-center mb-6">
            <img
              src="asset/logo.jpg"
              alt="Tournament Logo"
              /* h-32: Sets a fixed height
                 w-32: Sets a fixed width (making it a perfect square)
                 rounded-full: Makes the square a circle
                 object-cover: IMPORTANT! Keeps image from stretching while filling the circle
                 border-4: Optional border to make it look nicer
                 border-zinc-800: Border color to match the design
              */
              className="h-32 w-32 rounded-full object-cover border-4 border-zinc-800 shadow-xl"
              onError={function (e) {
                e.target.src = "https://via.placeholder.com/150";
              }}
            />
          </div>

          <h1 className="text-4xl font-black text-white italic tracking-tighter text-center mb-8 uppercase">
            Abo-Abo Ml Tournament
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Number of Teams
              </label>
              <input
                type="number"
                min="2"
                max="64"
                value={participantCount}
                onChange={(event) => {
                  const value = Math.max(2, Math.min(64, Number(event.target.value)));
                  setParticipantCount(value);
                }}
                className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Elimination Type
              </label>

              <div className="grid grid-cols-2 gap-2 bg-black/40 border border-zinc-800 rounded-xl p-1">
                {[
                  {
                    value: "single",
                    title: "Single",
                    subtitle: "1 loss out",
                  },
                  {
                    value: "double",
                    title: "Double",
                    subtitle: "2 losses out",
                  },
                ].map((option) => {
                  const isActive = eliminationType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEliminationType(option.value)}
                      className={`rounded-lg px-4 py-3 text-left transition-all ${isActive
                        ? "bg-emerald-500 text-black shadow-lg"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                    >
                      <span className="block text-sm font-black uppercase leading-none">
                        {option.title}
                      </span>
                      <span
                        className={`mt-1 block text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-black/70" : "text-zinc-600"
                          }`}
                      >
                        {option.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {participants.map((p, i) => (
              <div key={i} className="flex items-center bg-black/40 border border-zinc-800 p-1 rounded-xl">
                <span className="w-8 text-center text-xs font-bold text-zinc-600">{i + 1}</span>
                <input
                  value={p}
                  onChange={e => {
                    const n = [...participants]; n[i] = e.target.value; setParticipants(n);
                  }}
                  className="bg-transparent border-none outline-none text-sm w-full py-2 text-white font-medium"
                />
              </div>
            ))}
          </div>
          <button onClick={startDraftStage} className="w-full py-4 bg-emerald-500 text-black rounded-2xl font-black shadow-lg">
            PROCEED TO RANDOM DRAFT
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'draft') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
        <div className="max-w-4xl w-full bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <DraftWheel
              teams={draftPool}
              onFinished={handleDraftSelect}
              onRandomizeAll={handleRandomizeAll}
            />
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {draftedSeeds.map((team, i) => (
                <div key={i} className={`flex items-center p-3 rounded-xl border transition-all ${team ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-black/40 border-zinc-800'}`}>
                  <span className="w-8 text-xs font-bold text-zinc-600">#{i + 1}</span>
                  <span className="text-sm font-bold">{team || "---"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 flex gap-4">
            <button onClick={() => setStage('register')} className="px-6 py-4 bg-zinc-800 rounded-2xl font-bold text-zinc-400">Back</button>
            <button
              onClick={finalizeBracket}
              disabled={draftedSeeds.some(t => !t)}
              className="flex-1 py-4 bg-emerald-500 text-black rounded-2xl font-black disabled:opacity-20 transition-all"
            >
              FINALIZE BRACKET
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-zinc-950 text-white">
      {showResetToast && (
        <div className="fixed top-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-rose-500/20 bg-zinc-950 shadow-2xl">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                !
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">
                  Reset Tournament?
                </h3>

                <p className="mt-2 text-xs font-medium leading-relaxed text-zinc-400">
                  This will wipe all tournament data, bracket progress, teams, and undo history.
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetToast(false)}
                    className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={confirmResetTournament}
                    className="flex-1 rounded-xl bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-black hover:bg-rose-400"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <header className="flex justify-between items-center mb-12 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 max-w-7xl mx-auto">
        <h2 className="text-2xl font-black tracking-tight uppercase italic">{meta.title}</h2>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="p-2 bg-zinc-800 rounded-lg text-xs font-bold"
          >
            -
          </button>

          <button
            onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
            className="p-2 bg-zinc-800 rounded-lg text-xs font-bold"
          >
            +
          </button>

          <button
            onClick={undoLastResult}
            disabled={bracketHistory.length === 0}
            className="px-5 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Undo
          </button>

          <button
            onClick={fullReset}
            className="px-6 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl font-bold text-xs"
          >
            Reset
          </button>
        </div>
      </header>

      <main>
        <BracketTabs />

        <div className="max-w-[96vw] mx-auto bg-zinc-950/80 border border-zinc-900 rounded-[2rem] p-4 md:p-6 overflow-visible">

          {activeBracketTab === "winners" && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-emerald-500 text-[10px] font-black tracking-[0.3em] uppercase">
                  Winners Bracket
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  Winner advances to Championship
                </span>
              </div>

              <div
                className="bracket-zoom-layer"
                style={{
                  width: `${100 / zoom}%`,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left"
                }}
              >
                <PositionedBracketBoard
                  rounds={bracketState.winnersRounds}
                  type="winners"
                />
              </div>
            </section>
          )}

          {activeBracketTab === "losers" && bracketState.mode === "double" && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-amber-500 text-[10px] font-black tracking-[0.3em] uppercase">
                  Losers Bracket
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  Loser is eliminated
                </span>
              </div>

              <div
                className="bracket-zoom-layer"
                style={{
                  width: `${100 / zoom}%`,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left"
                }}
              >
                <PositionedBracketBoard
                  rounds={bracketState.losersRounds}
                  type="losers"
                />
              </div>
            </section>
          )}

          {activeBracketTab === "championship" && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-fuchsia-500 text-[10px] font-black tracking-[0.3em] uppercase">
                  Championship
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  Winners Champion vs Losers Champion
                </span>
              </div>

              <ChampionshipPanel />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);