window.BracketLogic = (() => {
  const cloneState = (state) => JSON.parse(JSON.stringify(state));

  const setSlot = (match, player) => {
    if (!match || !player) return;

    if (!match.p1) {
      match.p1 = player;
      return;
    }

    if (!match.p2 && match.p1 !== player) {
      match.p2 = player;
    }
  };

  const pushEliminated = (state, player, reason = null) => {
    if (!player) return;

    const exists = state.eliminated.find((e) => e.name === player);
    if (exists) return;

    state.eliminated.push({
      name: player,
      reason
    });
  };

  const getMatchStatus = (match) => {
    if (match.winner) return 'finished';
    if (match.p1 && match.p2) return 'ready';
    return 'waiting';
  };

  const generate11TeamBracket = (participants) => {
    const p = participants.map((t) => (t || '').trim()).filter(Boolean);

    if (p.length !== 11) {
      throw new Error('Exactly 11 teams are required.');
    }

    return {
      winnersRounds: [
  [
    // We reverse/reorder these so Match 3 is physically aligned with Match 4, etc.
    { id: 'w0-2', label: 'Match 3', round: 0, matchIndex: 0, p1: p[7], p2: p[8], winner: null },
    { id: 'w0-1', label: 'Match 2', round: 0, matchIndex: 1, p1: p[6], p2: p[9], winner: null },
    { id: 'w0-0', label: 'Match 1', round: 0, matchIndex: 2, p1: p[5], p2: p[10], winner: null }
  ],
  [
    { id: 'w1-0', label: 'Match 4', round: 1, matchIndex: 0, p1: p[0], p2: null, winner: null },
    { id: 'w1-1', label: 'Match 5', round: 1, matchIndex: 1, p1: p[3], p2: p[4], winner: null },
    { id: 'w1-2', label: 'Match 6', round: 1, matchIndex: 2, p1: p[1], p2: null, winner: null },
    { id: 'w1-3', label: 'Match 7', round: 1, matchIndex: 3, p1: p[2], p2: null, winner: null }
  ],
  // ... rest of code

        [
          { id: 'w2-0', label: 'Match 13', round: 2, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false },
          { id: 'w2-1', label: 'Match 14', round: 2, matchIndex: 1, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
        ],
        [
          { id: 'w3-0', label: 'Match 17', round: 3, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
        ]
      ],

      losersRounds: [
        [
          { id: 'l0-0', label: 'Match 8', round: 0, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false },
          { id: 'l0-1', label: 'Match 9', round: 0, matchIndex: 1, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false },
          { id: 'l0-2', label: 'Match 10', round: 0, matchIndex: 2, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
        ],
        [
          { id: 'l1-0', label: 'Match 11', round: 1, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false },
          { id: 'l1-1', label: 'Match 12', round: 1, matchIndex: 1, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
        ],
        [
          { id: 'l2-0', label: 'Match 15', round: 2, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false },
          { id: 'l2-1', label: 'Match 16', round: 2, matchIndex: 1, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
        ],
        [
          { id: 'l3-0', label: 'Match 18', round: 3, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
        ],
        [
          { id: 'l4-0', label: 'Match 19', round: 4, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
        ]
      ],

      grandFinals: [
        { id: 'gf-0', label: 'Match 20', round: 0, matchIndex: 0, p1: null, p2: null, winner: null, score1: null, score2: null, completed: false }
      ],

      eliminated: [],
      champion: null,
      runnerUp: null,
      logs: []
    };
  };

  const addLog = (state, text) => {
    state.logs.unshift({
      text,
      timestamp: new Date().toISOString()
    });
  };

  const advanceMatch = (state, matchId, winnerName, score1 = 1, score2 = 0) => {
    const newState = cloneState(state);
    let loser = null;
    let bracketType = null;
    let found = false;

    const updateMatchInRounds = (rounds, type) => {
      for (let r = 0; r < rounds.length; r++) {
        for (let m = 0; m < rounds[r].length; m++) {
          const match = rounds[r][m];
          if (match.id === matchId) {
            if (!match.p1 || !match.p2 || match.winner) return true;

            const isP1Winner = match.p1 === winnerName;
            loser = isP1Winner ? match.p2 : match.p1;

            match.winner = winnerName;
            match.score1 = score1;
            match.score2 = score2;
            match.completed = true;

            bracketType = type;
            found = true;

            addLog(
              newState,
              `${match.label}: ${winnerName} defeated ${loser} (${score1}-${score2})`
            );

            return true;
          }
        }
      }
      return false;
    };

    const updateGrandFinal = () => {
      for (let i = 0; i < newState.grandFinals.length; i++) {
        const match = newState.grandFinals[i];
        if (match.id === matchId) {
          if (!match.p1 || !match.p2 || match.winner) return true;

          const isP1Winner = match.p1 === winnerName;
          loser = isP1Winner ? match.p2 : match.p1;

          match.winner = winnerName;
          match.score1 = score1;
          match.score2 = score2;
          match.completed = true;

          addLog(
            newState,
            `${match.label}: ${winnerName} defeated ${loser} (${score1}-${score2})`
          );

          if (match.id === 'gf-0') {
            if (winnerName === match.p1) {
              newState.champion = winnerName;
              newState.runnerUp = loser;
              pushEliminated(newState, loser, `${match.label}`);
              addLog(newState, `${winnerName} won the tournament.`);
            } else {
              if (!newState.grandFinals.find((g) => g.id === 'gf-1')) {
                newState.grandFinals.push({
                  id: 'gf-1',
                  label: 'Match 21',
                  round: 1,
                  matchIndex: 1,
                  p1: match.p1,
                  p2: match.p2,
                  winner: null,
                  score1: null,
                  score2: null,
                  completed: false
                });
                addLog(newState, `Bracket reset triggered. Match 21 created.`);
              }
            }
          } else if (match.id === 'gf-1') {
            newState.champion = winnerName;
            newState.runnerUp = loser;
            pushEliminated(newState, loser, `${match.label}`);
            addLog(newState, `${winnerName} won the tournament.`);
          }

          found = true;
          return true;
        }
      }
      return false;
    };

    if (matchId.startsWith('gf-')) {
      updateGrandFinal();
      return newState;
    }

    updateMatchInRounds(newState.winnersRounds, 'winners') ||
      updateMatchInRounds(newState.losersRounds, 'losers');

    if (!found) return newState;

    if (bracketType === 'winners') {
      switch (matchId) {
        case 'w0-0':
          setSlot(newState.winnersRounds[1][3], winnerName);
          setSlot(newState.losersRounds[0][2], loser);
          break;

        case 'w0-1':
          setSlot(newState.winnersRounds[1][2], winnerName);
          setSlot(newState.losersRounds[0][0], loser);
          break;

        case 'w0-2':
          setSlot(newState.winnersRounds[1][0], winnerName);
          setSlot(newState.losersRounds[0][1], loser);
          break;

        case 'w1-0':
          setSlot(newState.winnersRounds[2][0], winnerName);
          setSlot(newState.losersRounds[0][0], loser);
          break;

        case 'w1-1':
          setSlot(newState.winnersRounds[2][0], winnerName);
          setSlot(newState.losersRounds[0][1], loser);
          break;

        case 'w1-2':
          setSlot(newState.winnersRounds[2][1], winnerName);
          setSlot(newState.losersRounds[1][1], loser);
          break;

        case 'w1-3':
          setSlot(newState.winnersRounds[2][1], winnerName);
          setSlot(newState.losersRounds[0][2], loser);
          break;

        case 'w2-0':
          setSlot(newState.winnersRounds[3][0], winnerName);
          setSlot(newState.losersRounds[2][0], loser);
          break;

        case 'w2-1':
          setSlot(newState.winnersRounds[3][0], winnerName);
          setSlot(newState.losersRounds[2][1], loser);
          break;

        case 'w3-0':
          setSlot(newState.grandFinals[0], winnerName);
          setSlot(newState.losersRounds[4][0], loser);
          break;
      }
    }

    if (bracketType === 'losers') {
      pushEliminated(newState, loser, newState.logs[0]?.text || 'Eliminated');

      switch (matchId) {
        case 'l0-0':
          setSlot(newState.losersRounds[1][0], winnerName);
          break;

        case 'l0-1':
          setSlot(newState.losersRounds[1][0], winnerName);
          break;

        case 'l0-2':
          setSlot(newState.losersRounds[1][1], winnerName);
          break;

        case 'l1-0':
          setSlot(newState.losersRounds[2][1], winnerName);
          break;

        case 'l1-1':
          setSlot(newState.losersRounds[2][0], winnerName);
          break;

        case 'l2-0':
          setSlot(newState.losersRounds[3][0], winnerName);
          break;

        case 'l2-1':
          setSlot(newState.losersRounds[3][0], winnerName);
          break;

        case 'l3-0':
          setSlot(newState.losersRounds[4][0], winnerName);
          break;

        case 'l4-0':
          setSlot(newState.grandFinals[0], winnerName);
          break;
      }
    }

    return newState;
  };

  return {
    cloneState,
    setSlot,
    pushEliminated,
    getMatchStatus,
    generate11TeamBracket,
    advanceMatch
  };
})();