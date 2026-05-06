window.BracketLogic = (() => {
  const cloneState = (state) => JSON.parse(JSON.stringify(state));

  const normalizeParticipants = (participants) => {
    return participants
      .map((team) => String(team || '').trim())
      .filter(Boolean);
  };

  const nextPowerOfTwo = (value) => {
    let power = 1;

    while (power < value) {
      power *= 2;
    }

    return power;
  };

  const addLog = (state, text) => {
    state.logs.unshift({
      text,
      timestamp: new Date().toISOString()
    });
  };

  const pushEliminated = (state, player, reason = null) => {
    if (!player) return;

    const exists = state.eliminated.find((item) => item.name === player);
    if (exists) return;

    state.eliminated.push({
      name: player,
      reason
    });
  };

  const getMatchStatus = (match) => {
    if (match.winner) return 'finished';
    if (match.p1 && match.p2 && match.p1Done && match.p2Done) return 'ready';
    return 'waiting';
  };

  const createMatch = ({
    id,
    label,
    round,
    matchIndex,
    bracketType,
    p1 = null,
    p2 = null,
    p1Done = false,
    p2Done = false,
    winnerNextMatchId = null,
    winnerNextSlot = null,
    loserNextMatchId = null,
    loserNextSlot = null
  }) => ({
    id,
    label,
    round,
    matchIndex,
    bracketType,
    p1,
    p2,
    p1Done,
    p2Done,
    winner: null,
    loser: null,
    score1: null,
    score2: null,
    completed: false,
    winnerNextMatchId,
    winnerNextSlot,
    loserNextMatchId,
    loserNextSlot
  });

  const createPlayInStructure = (players) => {
    const teamCount = players.length;
    const bracketSize = nextPowerOfTwo(teamCount);
    const mainRoundSize = bracketSize / 2;
    const playInMatchCount = teamCount - mainRoundSize;

    const byeTeams = players.slice(0, mainRoundSize - playInMatchCount);
    const playInTeams = players.slice(mainRoundSize - playInMatchCount);

    const playInPairs = [];

    for (let index = 0; index < playInMatchCount; index++) {
      playInPairs.push([
        playInTeams[index],
        playInTeams[playInTeams.length - 1 - index]
      ]);
    }

    return {
      bracketSize,
      mainRoundSize,
      playInMatchCount,
      byeTeams,
      playInPairs
    };
  };
  const findMatch = (state, matchId) => {
    const sections = [
      ...state.winnersRounds,
      ...state.losersRounds,
      state.grandFinals
    ];

    for (const round of sections) {
      for (const match of round) {
        if (match.id === matchId) {
          return match;
        }
      }
    }

    return null;
  };

  const setMatchSlot = (match, slot, player) => {
    if (!match || !slot) return;

    if (slot === 'p1') {
      match.p1 = player || null;
      match.p1Done = true;
      return;
    }

    if (slot === 'p2') {
      match.p2 = player || null;
      match.p2Done = true;
    }
  };

  const handleGrandFinalResult = (state, match, winnerName, loserName) => {
    if (!winnerName) return;

    if (loserName) {
      state.losses[loserName] = (state.losses[loserName] || 0) + 1;
    }

    const loserLosses = loserName ? state.losses[loserName] || 0 : 0;

    const loserBracketWonGrandFinal =
      state.mode === 'double' &&
      match.id === 'gf-0' &&
      winnerName === match.p2;

    if (
      loserBracketWonGrandFinal &&
      loserLosses < 2 &&
      !state.grandFinals.find((item) => item.id === 'gf-reset')
    ) {
      state.grandFinals.push(
        createMatch({
          id: 'gf-reset',
          label: `Match ${state.nextMatchNumber++} - Grand Final Reset`,
          round: 1,
          matchIndex: 1,
          bracketType: 'grandFinal',
          p1: match.p1,
          p2: match.p2,
          p1Done: true,
          p2Done: true
        })
      );

      addLog(state, 'Grand final reset triggered.');
      return;
    }

    state.champion = winnerName;
    state.runnerUp = loserName || null;

    if (loserName) {
      pushEliminated(state, loserName, match.label);
    }

    addLog(state, `${winnerName} won the tournament.`);
  };

  const completeMatch = (
    state,
    match,
    winnerName,
    score1 = null,
    score2 = null,
    isAutoAdvance = false
  ) => {
    if (!match || match.completed) return;

    const loserName = winnerName
      ? match.p1 === winnerName
        ? match.p2
        : match.p1
      : null;

    match.winner = winnerName || null;
    match.loser = loserName || null;
    match.score1 = score1;
    match.score2 = score2;
    match.completed = true;
    match.autoAdvanced = isAutoAdvance;

    if (winnerName && loserName && !isAutoAdvance) {
      if (match.bracketType !== 'grandFinal') {
        state.losses[loserName] = (state.losses[loserName] || 0) + 1;
      }

      if (state.mode === 'single') {
        pushEliminated(state, loserName, match.label);
      }

      if (state.mode === 'double' && match.bracketType === 'losers') {
        pushEliminated(state, loserName, match.label);
      }

      addLog(state, `${match.label}: ${winnerName} defeated ${loserName}`);
    }

    if (winnerName && !loserName && isAutoAdvance) {
      addLog(state, `${match.label}: ${winnerName} advanced by bye`);
    }

    if (match.bracketType === 'grandFinal') {
      handleGrandFinalResult(state, match, winnerName, loserName);
      return;
    }

    if (match.winnerNextMatchId) {
      const nextWinnerMatch = findMatch(state, match.winnerNextMatchId);
      setMatchSlot(nextWinnerMatch, match.winnerNextSlot, winnerName);
    } else if (state.mode === 'single' && winnerName) {
      state.champion = winnerName;
      state.runnerUp = loserName || null;
      addLog(state, `${winnerName} won the tournament.`);
    }

    if (match.loserNextMatchId) {
      const nextLoserMatch = findMatch(state, match.loserNextMatchId);
      setMatchSlot(nextLoserMatch, match.loserNextSlot, loserName);
    }
  };

  const autoAdvanceResolvedMatches = (state) => {
    let changed = true;

    while (changed) {
      changed = false;

      const rounds = [
        ...state.winnersRounds,
        ...state.losersRounds
      ];

      for (const round of rounds) {
        for (const match of round) {
          if (match.completed) continue;

          const sourcesResolved = match.p1Done && match.p2Done;
          if (!sourcesResolved) continue;

          const hasP1 = Boolean(match.p1);
          const hasP2 = Boolean(match.p2);

          if (hasP1 && !hasP2) {
            completeMatch(state, match, match.p1, null, null, true);
            changed = true;
            continue;
          }

          if (!hasP1 && hasP2) {
            completeMatch(state, match, match.p2, null, null, true);
            changed = true;
            continue;
          }

          if (!hasP1 && !hasP2) {
            completeMatch(state, match, null, null, null, true);
            changed = true;
          }
        }
      }
    }
  };

  const createBaseState = (mode, players, bracketSize) => {
    const state = {
      mode,
      bracketSize,
      winnersRounds: [],
      losersRounds: [],
      grandFinals: [],
      eliminated: [],
      champion: null,
      runnerUp: null,
      logs: [],
      losses: {},
      nextMatchNumber: 1
    };

    players.forEach((player) => {
      state.losses[player] = 0;
    });

    return state;
  };

  const generateSingleEliminationBracket = (participants) => {
    const players = normalizeParticipants(participants);

    if (players.length < 2) {
      throw new Error('At least 2 teams are required.');
    }

    const {
      bracketSize,
      mainRoundSize,
      playInMatchCount,
      byeTeams,
      playInPairs
    } = createPlayInStructure(players);

    const totalMainRounds = Math.log2(mainRoundSize);
    const hasPlayInRound = playInMatchCount > 0;
    const state = createBaseState('single', players, bracketSize);

    if (hasPlayInRound) {
      const playInRound = [];

      for (let matchIndex = 0; matchIndex < playInMatchCount; matchIndex++) {
        const targetMainMatchIndex = mainRoundSize / 2 - playInMatchCount + matchIndex;

        playInRound.push(
          createMatch({
            id: `w-0-${matchIndex}`,
            label: `Match ${state.nextMatchNumber++}`,
            round: 0,
            matchIndex,
            bracketType: 'winners',
            p1: playInPairs[matchIndex][0],
            p2: playInPairs[matchIndex][1],
            p1Done: true,
            p2Done: true,
            winnerNextMatchId: `w-1-${targetMainMatchIndex}`,
            winnerNextSlot: 'p2'
          })
        );
      }

      state.winnersRounds.push(playInRound);
    }

    for (let mainRoundIndex = 0; mainRoundIndex < totalMainRounds; mainRoundIndex++) {
      const actualRoundIndex = hasPlayInRound ? mainRoundIndex + 1 : mainRoundIndex;
      const matchesInRound = mainRoundSize / Math.pow(2, mainRoundIndex + 1);
      const isFinalRound = mainRoundIndex === totalMainRounds - 1;
      const round = [];

      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
        const winnerNextMatchId = isFinalRound
          ? null
          : `w-${actualRoundIndex + 1}-${Math.floor(matchIndex / 2)}`;

        const winnerNextSlot = isFinalRound
          ? null
          : matchIndex % 2 === 0
            ? 'p1'
            : 'p2';

        let p1 = null;
        let p2 = null;
        let p1Done = false;
        let p2Done = false;

        if (mainRoundIndex === 0) {
          p1 = byeTeams[matchIndex] || null;
          p2 = null;

          p1Done = Boolean(p1);
          p2Done = matchIndex < matchesInRound - playInMatchCount;
        }

        round.push(
          createMatch({
            id: `w-${actualRoundIndex}-${matchIndex}`,
            label: `Match ${state.nextMatchNumber++}`,
            round: actualRoundIndex,
            matchIndex,
            bracketType: 'winners',
            p1,
            p2,
            p1Done,
            p2Done,
            winnerNextMatchId,
            winnerNextSlot
          })
        );
      }

      state.winnersRounds.push(round);
    }

    autoAdvanceResolvedMatches(state);

    return state;
  };

  const getLoserRoundSize = (bracketSize, loserRoundIndex) => {
    const pairGroup = Math.floor(loserRoundIndex / 2);
    return bracketSize / Math.pow(2, pairGroup + 2);
  };

  const generateDoubleEliminationBracket = (participants) => {
    const players = normalizeParticipants(participants);

    if (players.length < 2) {
      throw new Error('At least 2 teams are required.');
    }

    const {
      bracketSize,
      mainRoundSize,
      playInMatchCount,
      byeTeams,
      playInPairs
    } = createPlayInStructure(players);

    const totalMainWinnerRounds = Math.log2(mainRoundSize);
    const hasPlayInRound = playInMatchCount > 0;
    const state = createBaseState('double', players, bracketSize);

    const mainWinnerRounds = [];

    /**
     * Winners Bracket - Play-in Round
     */
    if (hasPlayInRound) {
      const playInRound = [];

      for (let matchIndex = 0; matchIndex < playInMatchCount; matchIndex++) {
        const targetMainMatchIndex =
          mainRoundSize / 2 - playInMatchCount + matchIndex;

        playInRound.push(
          createMatch({
            id: `w-0-${matchIndex}`,
            label: `Match ${state.nextMatchNumber++}`,
            round: 0,
            matchIndex,
            bracketType: 'winners',
            p1: playInPairs[matchIndex][0],
            p2: playInPairs[matchIndex][1],
            p1Done: true,
            p2Done: true,
            winnerNextMatchId: `w-1-${targetMainMatchIndex}`,
            winnerNextSlot: 'p2'
          })
        );
      }

      state.winnersRounds.push(playInRound);
    }

    /**
     * Winners Bracket - Main Rounds
     */
    for (let mainRoundIndex = 0; mainRoundIndex < totalMainWinnerRounds; mainRoundIndex++) {
      const actualRoundIndex = hasPlayInRound
        ? mainRoundIndex + 1
        : mainRoundIndex;

      const matchesInRound =
        mainRoundSize / Math.pow(2, mainRoundIndex + 1);

      const isWinnersFinal =
        mainRoundIndex === totalMainWinnerRounds - 1;

      const round = [];

      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
        const winnerNextMatchId = isWinnersFinal
          ? 'gf-0'
          : `w-${actualRoundIndex + 1}-${Math.floor(matchIndex / 2)}`;

        const winnerNextSlot = isWinnersFinal
          ? 'p1'
          : matchIndex % 2 === 0
            ? 'p1'
            : 'p2';

        let p1 = null;
        let p2 = null;
        let p1Done = false;
        let p2Done = false;

        if (mainRoundIndex === 0) {
          p1 = byeTeams[matchIndex] || null;
          p2 = null;

          p1Done = Boolean(p1);
          p2Done = matchIndex < matchesInRound - playInMatchCount;
        }

        round.push(
          createMatch({
            id: `w-${actualRoundIndex}-${matchIndex}`,
            label: `Match ${state.nextMatchNumber++}`,
            round: actualRoundIndex,
            matchIndex,
            bracketType: 'winners',
            p1,
            p2,
            p1Done,
            p2Done,
            winnerNextMatchId,
            winnerNextSlot
          })
        );
      }

      state.winnersRounds.push(round);

      mainWinnerRounds.push({
        actualRoundIndex,
        matchesInRound,
        isWinnersFinal
      });
    }

    /**
     * Grand Final
     */
    state.grandFinals.push(
      createMatch({
        id: 'gf-0',
        label: `Match ${state.nextMatchNumber++} - Grand Final`,
        round: 0,
        matchIndex: 0,
        bracketType: 'grandFinal',
        p1: null,
        p2: null,
        p1Done: false,
        p2Done: false
      })
    );

    /**
     * Helper: connect a source into a Losers Bracket slot.
     */
    const connectSourceToLoserSlot = (source, loserMatchId, slot) => {
      if (source.type === 'playInLoser') {
        const sourceMatch = findMatch(state, `w-0-${source.matchIndex}`);

        if (sourceMatch) {
          sourceMatch.loserNextMatchId = loserMatchId;
          sourceMatch.loserNextSlot = slot;
        }

        return;
      }

      if (source.type === 'winnerBracketLoser') {
        const sourceMatch = findMatch(
          state,
          `w-${source.roundIndex}-${source.matchIndex}`
        );

        if (sourceMatch) {
          sourceMatch.loserNextMatchId = loserMatchId;
          sourceMatch.loserNextSlot = slot;
        }

        return;
      }

      if (source.type === 'loserBracketWinner') {
        const sourceMatch = findMatch(
          state,
          `l-${source.roundIndex}-${source.matchIndex}`
        );

        if (sourceMatch) {
          sourceMatch.winnerNextMatchId = loserMatchId;
          sourceMatch.winnerNextSlot = slot;
        }
      }
    };

    /**
     * Helper: create one Losers Bracket round from incoming sources.
     * Sources may be:
     * - losers from play-in matches
     * - losers from Winners Bracket matches
     * - winners from previous Losers Bracket matches
     */
    const buildLoserRound = (sources) => {
      if (!sources.length) {
        return [];
      }

      const loserRoundIndex = state.losersRounds.length;
      const matchesInRound = Math.ceil(sources.length / 2);
      const round = [];

      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
        round.push(
          createMatch({
            id: `l-${loserRoundIndex}-${matchIndex}`,
            label: `Match ${state.nextMatchNumber++}`,
            round: loserRoundIndex,
            matchIndex,
            bracketType: 'losers',
            p1: null,
            p2: null,
            p1Done: false,
            p2Done: false
          })
        );
      }

      const slotUsed = round.map(() => ({
        p1: false,
        p2: false
      }));

      sources.forEach((source, sourceIndex) => {
        const matchIndex = Math.floor(sourceIndex / 2);
        const slot = sourceIndex % 2 === 0 ? 'p1' : 'p2';
        const match = round[matchIndex];

        slotUsed[matchIndex][slot] = true;

        connectSourceToLoserSlot(source, match.id, slot);
      });

      /**
       * Mark empty bye slots as resolved.
       * This allows a single entrant to auto-advance when their source arrives.
       */
      round.forEach((match, matchIndex) => {
        if (!slotUsed[matchIndex].p1) {
          match.p1Done = true;
        }

        if (!slotUsed[matchIndex].p2) {
          match.p2Done = true;
        }
      });

      state.losersRounds.push(round);

      return round.map((_, matchIndex) => ({
        type: 'loserBracketWinner',
        roundIndex: loserRoundIndex,
        matchIndex
      }));
    };

    const getWinnerBracketLoserSources = (winnerRound) => {
      return Array.from({ length: winnerRound.matchesInRound }, (_, matchIndex) => ({
        type: 'winnerBracketLoser',
        roundIndex: winnerRound.actualRoundIndex,
        matchIndex
      }));
    };

    /**
     * Losers Bracket flow:
     *
     * If there is a play-in:
     *   L0 receives play-in losers.
     *   L1 receives L0 winners + losers from first main Winners round.
     *
     * If there is no play-in:
     *   L0 receives losers from first Winners round.
     *
     * Then it alternates:
     *   - combine with Winners Bracket drop-down losers
     *   - reduce Losers Bracket winners
     */
    let loserSources = [];
    let nextWinnerDropRoundIndex = 0;

    if (hasPlayInRound) {
      const playInLoserSources = Array.from(
        { length: playInMatchCount },
        (_, matchIndex) => ({
          type: 'playInLoser',
          matchIndex
        })
      );

      loserSources = buildLoserRound(playInLoserSources);
      nextWinnerDropRoundIndex = 0;
    } else {
      loserSources = buildLoserRound(
        getWinnerBracketLoserSources(mainWinnerRounds[0])
      );

      nextWinnerDropRoundIndex = 1;
    }

    while (nextWinnerDropRoundIndex < mainWinnerRounds.length) {
      const winnerDropSources = getWinnerBracketLoserSources(
        mainWinnerRounds[nextWinnerDropRoundIndex]
      );

      loserSources = buildLoserRound([
        ...loserSources,
        ...winnerDropSources
      ]);

      nextWinnerDropRoundIndex++;

      /**
       * Reduce the Losers Bracket before the next Winners Bracket drop,
       * except after the final Winners drop.
       */
      if (
        nextWinnerDropRoundIndex < mainWinnerRounds.length &&
        loserSources.length > 1
      ) {
        loserSources = buildLoserRound(loserSources);
      }
    }

    /**
     * Last Losers Bracket winner goes to Grand Final p2.
     */
    if (loserSources.length === 1) {
      const finalLoserSource = loserSources[0];
      const finalLoserMatch = findMatch(
        state,
        `l-${finalLoserSource.roundIndex}-${finalLoserSource.matchIndex}`
      );

      if (finalLoserMatch) {
        finalLoserMatch.winnerNextMatchId = 'gf-0';
        finalLoserMatch.winnerNextSlot = 'p2';
      }
    }

    autoAdvanceResolvedMatches(state);

    return state;
  };

  const generateTournamentBracket = (participants, eliminationType = 'single') => {
    if (eliminationType === 'double') {
      return generateDoubleEliminationBracket(participants);
    }

    return generateSingleEliminationBracket(participants);
  };

  const advanceMatch = (state, matchId, winnerName, score1 = null, score2 = null) => {
    const newState = cloneState(state);
    const match = findMatch(newState, matchId);

    if (!match) return newState;
    if (match.completed) return newState;
    if (!match.p1 || !match.p2) return newState;
    if (!match.p1Done || !match.p2Done) return newState;
    if (![match.p1, match.p2].includes(winnerName)) return newState;

    completeMatch(newState, match, winnerName, score1, score2, false);
    autoAdvanceResolvedMatches(newState);

    return newState;
  };

  return {
    cloneState,
    pushEliminated,
    getMatchStatus,
    generateTournamentBracket,
    advanceMatch
  };
})();