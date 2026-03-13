const { useState, useEffect, useRef } = React;
const { generate11TeamBracket, advanceMatch, getMatchStatus } = window.BracketLogic;

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
  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem('bt_teams');
    return saved ? JSON.parse(saved) : Array(11).fill().map((_, i) => `Team ${i + 1}`);
  });

  const [bracketState, setBracketState] = useState(() => {
    const saved = localStorage.getItem('bt_state');
    return saved ? JSON.parse(saved) : null;
  });

  const [stage, setStage] = useState(bracketState ? 'bracket' : 'register');
  const [draftPool, setDraftPool] = useState([]);
  const [draftedSeeds, setDraftedSeeds] = useState(Array(11).fill(""));
  const [zoom, setZoom] = useState(1);
  const [meta] = useState({ title: 'Ml Tournament' });

  useEffect(() => {
    localStorage.setItem('bt_teams', JSON.stringify(participants));
    if (bracketState) localStorage.setItem('bt_state', JSON.stringify(bracketState));
  }, [participants, bracketState]);

  useEffect(() => {
    if (bracketState?.champion && typeof confetti === 'function') {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#fbbf24', '#fff'] });
    }
  }, [bracketState?.champion]);

  // --- ACTIONS ---
  const startDraftStage = () => {
    setDraftPool([...participants]);
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
    setBracketState(prev => advanceMatch(prev, matchId, winnerName, null, null));
  };

  const finalizeBracket = () => {
    const state = generate11TeamBracket(draftedSeeds);
    setBracketState(state);
    setStage('bracket');
  };

  const fullReset = () => {
    if (confirm("Wipe all tournament data?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const MatchCard = ({ match }) => {
    const [selectedWinner, setSelectedWinner] = useState(null);
    const isReady = match.p1 && match.p2 && !match.winner;

    return (
      <div className="match-container">
        <div className={`match-card w-48 ${match.winner ? 'winner-glow' : isReady ? 'border-emerald-500/50 shadow-lg' : 'opacity-40'}`}>
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{match.label}</span>
            {match.winner && <span className="text-[9px] bg-emerald-500 text-black px-1.5 rounded font-bold">FINAL</span>}
          </div>
          <div className="space-y-1">
            {[match.p1, match.p2].map((p, idx) => (
              <div
                key={idx}
                onClick={() => isReady && setSelectedWinner(p)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${(match.winner === p || selectedWinner === p)
                  ? 'bg-emerald-500 text-black font-bold'
                  : 'bg-zinc-800/50 text-zinc-300'
                  }`}
              >
                <span className="text-xs truncate w-32">{p || 'TBD'}</span>
              </div>
            ))}
          </div>
          {isReady && (
            <button
              onClick={() => handleUpdateResult(match.id, selectedWinner)}
              className={`w-full mt-2 py-1.5 text-[10px] font-black rounded uppercase transition-all ${selectedWinner ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                }`}
            >
              Submit Result
            </button>
          )}
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
              onError={function(e) {
                e.target.src = "https://via.placeholder.com/150";
              }}
            />
          </div>

          <h1 className="text-4xl font-black text-white italic tracking-tighter text-center mb-8 
          uppercase">Abo-Abo Ml Tournament</h1>
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
      <header className="flex justify-between items-center mb-12 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 max-w-7xl mx-auto">
        <h2 className="text-2xl font-black tracking-tight uppercase italic">{meta.title}</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 bg-zinc-800 rounded-lg text-xs font-bold">-</button>
          <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="p-2 bg-zinc-800 rounded-lg text-xs font-bold">+</button>
          <button onClick={fullReset} className="px-6 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl font-bold text-xs">Reset</button>
        </div>
      </header>

      <main className="space-y-24 overflow-x-auto">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          <section className="mb-20">
            <h3 className="text-emerald-500 text-[10px] font-black tracking-[0.3em] mb-8 text-center uppercase">Winners Bracket</h3>
            <div className="flex justify-center gap-16">
              {bracketState.winnersRounds.map((round, ri) => (
                <div key={ri} className="bracket-column flex flex-col">
                  {round.map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              ))}
            </div>
          </section>

          <section className="mb-20">
            <h3 className="text-amber-500 text-[10px] font-black tracking-[0.3em] mb-8 text-center uppercase">Losers Bracket</h3>
            <div className="flex justify-center gap-16">
              {bracketState.losersRounds.map((round, ri) => (
                <div key={ri} className="flex flex-col gap-8">
                  {round.map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);