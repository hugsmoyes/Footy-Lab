/* Opponent Lab: season data. Per-game season averages for every team (for and against),
   a league average row, team ratings, and player list profiles (bio, season games and goals,
   career and last-20 averages). Kept separate from per-match stats so nothing is ever
   back-filled into individual matches. Read in this browser only; nothing is uploaded.
   Missing values stay missing. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;

  /* ---------- column map: source column -> Lab stat definition ----------
     id starting m- = an existing starter stat. s- = a stat added for season data.
     better: 'high' | 'low' | '' (style or volume stat: ranked, but not called good or bad).
     basis: 'game' (per-game average, default) or 'season' (season total or season-level value).
     model: true = an output of the data provider's own model; definition comes from them.
     confirm: unit or meaning inferred from the values; check against the provider's glossary. */
  const S = (col, id, name, group, unit, better, extra) => Object.assign({ col, id, name, group, unit: unit || 'count', better: better || '' }, extra || {});
  const MODEL = { model: true };
  const CONF = { confirm: true };
  const COLUMNS = [
    // Scoring
    S('Goals', 'm-goals', 'Goals', 'Scoring', 'count', 'high'),
    S('Behinds', 'm-behinds', 'Behinds', 'Scoring', 'count', ''),
    S('ShotsAtGoal', 's-shotsAtGoal', 'Shots at goal', 'Scoring', 'count', 'high'),
    S('RushedBehinds', 's-rushed', 'Rushed behinds', 'Scoring', 'count', '', CONF),
    S('GoalAssists', 's-goalAssists', 'Goal assists', 'Scoring', 'count', 'high'),
    S('GoalAccuracy', 's-goalAcc', 'Goal accuracy', 'Scoring', '%', 'high'),
    S('GoalsPerInside50', 's-goalsPerI50', 'Goals per inside 50', 'Scoring', '%', 'high'),
    S('ScoringShotsPerInside50', 's-ssPerI50', 'Scoring shots per inside 50', 'Scoring', '%', 'high'),
    S('ShotsPerInside50', 's-shotsPerI50', 'Shots per inside 50', 'Scoring', '%', 'high'),
    S('GoalScorers', 's-goalKickers', 'Goal kickers per game', 'Scoring', 'count', 'high'),
    S('GoalScorers_Total', 's-goalKickersSeason', 'Different goal kickers (season)', 'Scoring', 'count', '', { basis: 'season' }),
    S('MarksInside50', 'm-mi50', 'Marks inside 50', 'Scoring', 'count', 'high'),
    S('MarksInside50PerInside50', 's-mi50Rate', 'Marks inside 50 per inside 50', 'Scoring', '%', 'high'),
    // Score sources
    S('PointsFromTurnover', 'm-ptsTurnover', 'Points from turnovers', 'Score sources', 'pts', 'high'),
    S('PointsFromStoppage', 'm-ptsStoppage', 'Points from stoppages', 'Score sources', 'pts', 'high'),
    S('PointsFromCentreBounce', 's-ptsCentre', 'Points from centre bounces', 'Score sources', 'pts', 'high'),
    S('PointsFromKickIn', 's-ptsKickIn', 'Points from kick-ins', 'Score sources', 'pts', 'high'),
    S('PointsFromDefensiveHalf', 's-ptsDefHalf', 'Points from defensive-half chains', 'Score sources', 'pts', 'high'),
    S('PointsFromForwardHalf', 's-ptsFwdHalf', 'Points from forward-half chains', 'Score sources', 'pts', 'high'),
    // Expected score (provider model)
    S('xScore', 's-xScore', 'Expected score', 'Expected score', 'pts', 'high', MODEL),
    S('xScoreRating', 's-xScoreRating', 'Score above expected', 'Expected score', 'pts', 'high', Object.assign({ confirm: true }, MODEL)),
    S('xScorePerShot', 's-xsPerShot', 'Expected score per shot', 'Expected score', 'pts', 'high', MODEL),
    S('xScoreRatingPerShot', 's-xsrPerShot', 'Score above expected per shot', 'Expected score', 'pts', 'high', MODEL),
    S('xScorePerShot_Set', 's-xsPerShotSet', 'Expected score per set shot', 'Expected score', 'pts', 'high', MODEL),
    S('xScoreRatingPerShot_Set', 's-xsrPerShotSet', 'Score above expected per set shot', 'Expected score', 'pts', 'high', MODEL),
    S('xScorePerShot_General', 's-xsPerShotGen', 'Expected score per general-play shot', 'Expected score', 'pts', 'high', MODEL),
    S('xScoreRatingPerShot_General', 's-xsrPerShotGen', 'Score above expected per general-play shot', 'Expected score', 'pts', 'high', MODEL),
    S('xChainScore', 's-xChain', 'Expected score from chains', 'Expected score', 'pts', 'high', MODEL),
    S('xChainScoreFromStoppage', 's-xChainStop', 'Expected score from stoppage chains', 'Expected score', 'pts', 'high', MODEL),
    S('xChainScoreFromTurnover', 's-xChainTO', 'Expected score from turnover chains', 'Expected score', 'pts', 'high', MODEL),
    // Possession and ball use
    S('Disposals', 'm-disposals', 'Disposals', 'Possession & ball use', 'count', 'high'),
    S('Kicks', 'm-kicks', 'Kicks', 'Possession & ball use', 'count', ''),
    S('Handballs', 'm-handballs', 'Handballs', 'Possession & ball use', 'count', ''),
    S('KickPercentage', 's-kickPct', 'Kick share of disposals', 'Possession & ball use', '%', ''),
    S('DisposalEfficiency', 'm-de', 'Disposal efficiency', 'Possession & ball use', '%', 'high'),
    S('KickingEfficiency', 's-kickEff', 'Kicking efficiency', 'Possession & ball use', '%', 'high'),
    S('HandballEfficiency', 's-hbEff', 'Handball efficiency', 'Possession & ball use', '%', 'high'),
    S('ContestedPossessions', 'm-cp', 'Contested possessions', 'Possession & ball use', 'count', 'high'),
    S('UncontestedPossessions', 'm-up', 'Uncontested possessions', 'Possession & ball use', 'count', ''),
    S('TotalPossessions', 's-totalPoss', 'Total possessions', 'Possession & ball use', 'count', 'high'),
    S('ContestedPossessionRate', 's-cpRate', 'Contested possession rate', 'Possession & ball use', '%', ''),
    S('HandballReceives', 's-hbReceives', 'Handball receives', 'Possession & ball use', 'count', ''),
    S('Marks', 'm-marks', 'Marks', 'Possession & ball use', 'count', ''),
    S('ContestedMarks', 'm-cm', 'Contested marks', 'Possession & ball use', 'count', 'high'),
    S('InterceptMarks', 's-interceptMarks', 'Intercept marks', 'Possession & ball use', 'count', 'high'),
    S('MarksOnLead', 's-marksOnLead', 'Marks on lead', 'Possession & ball use', 'count', 'high'),
    S('DisposalRetentionPercentage', 's-retentionPct', 'Disposal retention', 'Possession & ball use', '%', 'high'),
    S('Clangers', 'm-clangers', 'Clangers', 'Possession & ball use', 'count', 'low'),
    S('DisposalsPerClanger', 's-dispPerClanger', 'Disposals per clanger', 'Possession & ball use', 'rate', 'high'),
    S('Turnovers', 'm-turnovers', 'Turnovers', 'Possession & ball use', 'count', 'low'),
    S('DisposalsPerTurnover', 's-dispPerTurnover', 'Disposals per turnover', 'Possession & ball use', 'rate', 'high'),
    S('TimeInPossession', 's-tip', 'Time in possession', 'Possession & ball use', '%', '', CONF),
    // Territory and ball movement
    S('Inside50s', 'm-i50', 'Inside 50s', 'Territory & ball movement', 'count', 'high'),
    S('Rebound50s', 'm-r50', 'Rebound 50s', 'Territory & ball movement', 'count', ''),
    S('Rebound50sPerOppositionInside50s', 's-r50Rate', 'Rebound 50s per opposition inside 50', 'Territory & ball movement', '%', 'high', { againstCol: 'OppositionRebound50sPerInside50s' }),
    S('ForwardHalf', 's-fwdHalf', 'Time with ball in forward half', 'Territory & ball movement', '%', 'high', Object.assign({ forOnly: true }, CONF)),
    S('MetresGained', 'm-mgained', 'Metres gained', 'Territory & ball movement', 'm', 'high'),
    S('MetresGainedPerDisposal', 's-mgPerDisp', 'Metres gained per disposal', 'Territory & ball movement', 'm', 'high'),
    S('KickMetresGained', 's-kickMG', 'Kick metres gained', 'Territory & ball movement', 'm', 'high'),
    S('KickMetresGainedPerKick', 's-kickMGPerKick', 'Kick metres gained per kick', 'Territory & ball movement', 'm', 'high'),
    S('HandballMetresGained', 's-hbMG', 'Handball metres gained', 'Territory & ball movement', 'm', ''),
    S('HandballMetresGainedPerHandball', 's-hbMGPer', 'Handball metres gained per handball', 'Territory & ball movement', 'm', ''),
    S('KickIntoF50RetentionPercentage', 's-f50Retention', 'Kicks into F50 retained', 'Territory & ball movement', '%', 'high'),
    // Chains and transition
    S('ChainToScore', 's-chainToScore', 'Chains ending in a score', 'Chains & transition', '%', 'high', CONF),
    S('D50ToF50', 's-d50ToF50', 'D50 chains reaching F50', 'Chains & transition', '%', 'high', CONF),
    S('D50ToScore', 's-d50ToScore', 'D50 chains ending in a score', 'Chains & transition', '%', 'high', CONF),
    S('DefHalfToF50', 's-dhToF50', 'Defensive-half chains reaching F50', 'Chains & transition', '%', 'high', CONF),
    S('DefHalfToScore', 's-dhToScore', 'Defensive-half chains ending in a score', 'Chains & transition', '%', 'high', CONF),
    // Equity and threat (provider model)
    S('Equity_PreClearance', 's-eqPreClr', 'Equity: pre-clearance', 'Equity & threat', 'index', 'high', MODEL),
    S('Equity_PostClearance', 's-eqPostClr', 'Equity: post-clearance', 'Equity & threat', 'index', 'high', MODEL),
    S('Equity_Possession', 's-eqPoss', 'Equity: possession', 'Equity & threat', 'index', 'high', MODEL),
    S('Equity_BallUse', 's-eqBallUse', 'Equity: ball use', 'Equity & threat', 'index', 'high', MODEL),
    S('xThreatPerKick', 's-xThreatKick', 'Expected threat per kick', 'Equity & threat', 'index', 'high', MODEL),
    S('ThreatRating', 's-threatRating', 'Threat rating', 'Equity & threat', 'index', 'high', MODEL),
    S('xRetainPerKick', 's-xRetainKick', 'Expected retention per kick', 'Equity & threat', 'index', 'high', MODEL),
    S('RetentionRating', 's-retentionRating', 'Retention rating', 'Equity & threat', 'index', 'high', MODEL),
    // Contest and stoppage
    S('TotalClearances', 'm-clearances', 'Clearances', 'Contest & stoppage', 'count', 'high'),
    S('CentreClearances', 'm-cclear', 'Centre clearances', 'Contest & stoppage', 'count', 'high'),
    S('StoppageClearances', 'm-sclear', 'Stoppage clearances', 'Contest & stoppage', 'count', 'high'),
    S('FirstPossessions', 's-firstPoss', 'First possessions', 'Contest & stoppage', 'count', 'high'),
    S('FirstPossessionToClearance', 's-fpToClr', 'First possession to clearance', 'Contest & stoppage', 'index', 'high', CONF),
    S('GroundBallGets', 'm-gbg', 'Ground ball gets', 'Contest & stoppage', 'count', 'high'),
    S('GroundBallGetsForward50', 's-gbgF50', 'Ground ball gets in F50', 'Contest & stoppage', 'count', 'high', { diffNote: "The provider's diff compares this with the opposition's D50 ground ball gets (same end of the ground)." }),
    S('GroundBallGetsDefensive50', 's-gbgD50', 'Ground ball gets in D50', 'Contest & stoppage', 'count', '', { diffNote: "The provider's diff compares this with the opposition's F50 ground ball gets (same end of the ground)." }),
    S('HardBallGets', 's-hardBall', 'Hard ball gets', 'Contest & stoppage', 'count', 'high'),
    S('LooseBallGets', 's-looseBall', 'Loose ball gets', 'Contest & stoppage', 'count', 'high'),
    S('PostClearanceContestedPossessions', 's-pcCP', 'Post-clearance contested possessions', 'Contest & stoppage', 'count', 'high'),
    S('PostClearanceGroundBallGets', 's-pcGBG', 'Post-clearance ground ball gets', 'Contest & stoppage', 'count', 'high'),
    S('GathersFromHitout', 's-gathersHO', 'Gathers from hitout', 'Contest & stoppage', 'count', 'high'),
    S('CrumbingPossessions', 's-crumbs', 'Crumbing possessions', 'Contest & stoppage', 'count', 'high'),
    S('ContestOffensiveOneOnOnes', 's-offContests', 'Offensive one-on-one contests', 'Contest & stoppage', 'count', '', { forOnly: true }),
    S('ContestOffensiveWinPercentage', 's-offContestWin', 'Offensive one-on-one win rate', 'Contest & stoppage', '%', 'high', { forOnly: true }),
    S('ContestDefensiveOneOnOnes', 's-defContests', 'Defensive one-on-one contests', 'Contest & stoppage', 'count', '', { forOnly: true }),
    S('ContestDefensiveLossPercentage', 's-defContestLoss', 'Defensive one-on-one loss rate', 'Contest & stoppage', '%', 'low', { forOnly: true }),
    // Ruck
    S('RuckContests', 's-ruckContests', 'Ruck contests', 'Ruck', 'count', '', { forOnly: true }),
    S('Hitouts', 'm-hitouts', 'Hitouts', 'Ruck', 'count', 'high'),
    S('HitoutsWinPercentage', 's-hoWin', 'Hitout win rate', 'Ruck', '%', 'high'),
    S('HitoutsToAdvantage', 's-hoAdv', 'Hitouts to advantage', 'Ruck', 'count', 'high'),
    S('HitoutsToAdvantagePercentage', 's-hoAdvPct', 'Hitouts to advantage rate', 'Ruck', '%', 'high'),
    S('RuckHardBallGets', 's-ruckHBG', 'Ruck hard ball gets', 'Ruck', 'count', 'high'),
    S('HitoutToFirstPossession', 's-hoToFP', 'Hitout to first possession', 'Ruck', 'index', 'high', CONF),
    S('HitoutToClearance', 's-hoToClr', 'Hitout to clearance', 'Ruck', 'index', 'high', CONF),
    // Pressure and defence
    S('Tackles', 'm-tackles', 'Tackles', 'Pressure & defence', 'count', 'high'),
    S('TacklesInside50', 'm-ti50', 'Tackles inside 50', 'Pressure & defence', 'count', 'high'),
    S('PressureActs', 'm-pressure', 'Pressure acts', 'Pressure & defence', 'count', 'high'),
    S('PressureActsDefensiveHalf', 's-pressureDH', 'Pressure acts in defensive half', 'Pressure & defence', 'count', ''),
    S('DisposalsPerOppositionTackle', 's-dispPerOppTackle', 'Disposals per opposition tackle', 'Pressure & defence', 'rate', 'high', { againstCol: 'OppositionDisposalsPerTackle' }),
    S('Intercepts', 'm-intercepts', 'Intercept possessions', 'Pressure & defence', 'count', 'high'),
    S('Spoils', 's-spoils', 'Spoils', 'Pressure & defence', 'count', ''),
    S('OnePercenters', 's-onePct', 'One percenters', 'Pressure & defence', 'count', ''),
    // Free kicks
    S('FreesFor', 'm-ff', 'Free kicks for', 'Free kicks', 'count', 'high', { againstCol: 'FreesAgainst' }),
    // Restarts and other
    S('KickIns', 'm-kickins', 'Kick-ins', 'Restarts & other', 'count', ''),
    S('KickInsPlayOnPercentage', 's-kickInPlayOn', 'Kick-ins played on', 'Restarts & other', '%', ''),
    S('Bounces', 's-bounces', 'Bounces', 'Restarts & other', 'count', ''),
    S('InterchangeCount', 's-interchange', 'Interchanges', 'Restarts & other', 'count', ''),
    // Player ratings and votes, summed for the team (provider)
    S('RatingPoints', 's-ratingPts', 'Player rating points (team total)', 'Player ratings', 'index', 'high', MODEL),
    S('Supercoach', 's-supercoach', 'SuperCoach (team total)', 'Player ratings', 'index', 'high'),
    S('DreamTeamPoints', 's-dreamTeam', 'AFL Fantasy (team total)', 'Player ratings', 'index', 'high'),
    S('CoachesVotes', 's-coachesVotes', 'Coaches votes (team total)', 'Player ratings', 'count', 'high'),
    // List and results (season level)
    S('Players', 's-playersUsed', 'Players used', 'List & results', 'count', '', { basis: 'season', forOnly: true }),
    S('Age', 's-avgAge', 'Average age', 'List & results', 'yrs', '', { basis: 'season', forOnly: true, confirm: true }),
    S('Experience', 's-avgExp', 'Average games experience', 'List & results', 'count', '', { basis: 'season', forOnly: true, confirm: true }),
    S('xWins', 's-xWins', 'Expected wins', 'List & results', 'count', 'high', Object.assign({ basis: 'season', forOnly: true }, MODEL)),
    S('WinsAboveXWins', 's-winsAboveX', 'Wins above expected', 'List & results', 'count', '', Object.assign({ basis: 'season', forOnly: true }, MODEL))
  ];
  /* Columns read but not stored as their own stat: checked against what the Lab works out itself. */
  const DERIVED = {
    TotalPoints: 'Checked: equals goals × 6 + behinds. The Lab works out score from goals and behinds.',
    FreesAgainst: 'Stored as the "against" side of Free kicks for.',
    FreesDiff: 'Checked: equals free kicks for minus against.',
    OppositionDisposalsPerTackle: 'Stored as the "against" side of Disposals per opposition tackle.',
    OppositionRebound50sPerInside50s: 'Stored as the "against" side of Rebound 50s per opposition inside 50.'
  };
  const ID_COLS = ['Team', 'Abbreviation', 'Matches'];

  const byCol = new Map(COLUMNS.map(c => [c.col, c]));
  const byId = new Map(COLUMNS.map(c => [c.id, c]));

  /* Make sure every stat in the map exists as a Lab stat definition, and carries its direction. */
  function ensureMetrics() {
    let added = 0;
    COLUMNS.forEach(c => {
      let mt = M.metric(c.id);
      if (!mt) {
        mt = { id: c.id, name: c.name, group: c.group, level: 'team', kind: 'value', unit: c.unit === '%' ? '%' : c.unit === 'm' ? 'm' : 'count', seasonUnit: c.unit, description: describe(c) };
        M.state.metrics.push(mt); added++;
      }
      mt.better = c.better; mt.sourceColumn = c.col;
      if (c.model) mt.model = true;
    });
    return added;
  }
  function describe(c) {
    const bits = [`From the "${c.col}" column of the season file.`];
    if (c.basis === 'season') bits.push('Season-level value, not a per-game average.');
    if (c.model) bits.push("Output of the data provider's own model; use their definition.");
    if (c.confirm) bits.push('Unit or meaning inferred from the values; confirm with the provider.');
    if (c.diffNote) bits.push(c.diffNote);
    return bits.join(' ');
  }

  /* ---------- detection ---------- */
  function headerOf(text) { const p = Lab.Importer.parse(text); return { rows: p.rows, header: (p.rows[0] || []).map(h => String(h).trim()) }; }
  function detect(text) {
    const { header } = headerOf(text);
    const has = c => header.includes(c);
    if (has('Team') && has('Matches') && has('Goals') && header.some(h => h.endsWith('_Opposition'))) return 'teamseason';
    if (has('Player') && has('Team') && (has('Matches_Career') || has('Matches_Current'))) return 'playerlist';
    if (has('Team') && (has('CurrentRating') || has('SeasonRating'))) return 'ratings';
    return '';
  }
  const num = v => { const t = String(v == null ? '' : v).trim().replace('%', ''); if (t === '') return null; const n = parseFloat(t); return isNaN(n) ? null : n; };
  const rowsAsObjects = text => { const { rows, header } = headerOf(text); return { header, list: rows.slice(1).filter(r => r.some(c => String(c).trim())).map(r => { const o = {}; header.forEach((h, i) => { o[h] = r[i] == null ? '' : String(r[i]).trim(); }); return o; }) }; };
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol == null ? 0.02 : tol);

  /* ---------- team season stats ---------- */
  function readTeamSeason(text, opts) {
    const { header, list } = rowsAsObjects(text);
    const checks = [];
    const ok = (label, pass, detail) => checks.push({ label, pass: !!pass, detail: detail || '' });
    const leagueRow = list.find(r => /^average$/i.test(r.Team) || /^afl$/i.test(r.Abbreviation) && /aver/i.test(r.Team));
    const teamRows = list.filter(r => r !== leagueRow && r.Team);
    const known = new Set(ID_COLS.concat(Object.keys(DERIVED)));
    COLUMNS.forEach(c => { known.add(c.col); if (c.againstCol) known.add(c.againstCol); });
    const unmapped = header.filter(h => h && !known.has(h) && !h.endsWith('_Opposition') && !h.endsWith('_Diff'));
    const oppUnmapped = header.filter(h => h.endsWith('_Opposition') && !byCol.has(h.slice(0, -11)) && !known.has(h.slice(0, -11)));

    const side = (r, c, which) => {
      if (which === 'for') return num(r[c.col]);
      if (c.againstCol) return num(r[c.againstCol]);
      if (c.forOnly) return null;
      return num(r[c.col + '_Opposition']);
    };
    const pack = r => {
      const o = { abbr: r.Abbreviation || '', games: num(r.Matches), for: {}, against: {} };
      COLUMNS.forEach(c => { const f = side(r, c, 'for'), a = side(r, c, 'against'); if (f != null) o.for[c.id] = f; if (a != null) o.against[c.id] = a; });
      return o;
    };
    const teams = {}; teamRows.forEach(r => { teams[r.Team] = pack(r); });
    const league = leagueRow ? pack(leagueRow) : null;
    if (league) league.games = num(leagueRow.Matches);

    // Checks against the file itself
    ok(`${teamRows.length} teams read`, teamRows.length >= 2, teamRows.map(r => r.Team).join(', '));
    ok('League average row found', !!leagueRow, leagueRow ? `"${leagueRow.Team}" row used as the league average (${leagueRow.Matches} matches).` : 'No "Average" row. League averages will be worked out from the teams, weighted by games.');
    const missingCols = COLUMNS.filter(c => !header.includes(c.col)).map(c => c.col);
    ok('Expected columns present', !missingCols.length, missingCols.length ? 'Missing: ' + missingCols.join(', ') : `${COLUMNS.length} stat columns mapped.`);
    ok('Every column accounted for', !unmapped.length && !oppUnmapped.length, unmapped.concat(oppUnmapped).length ? 'Not mapped (kept out): ' + unmapped.concat(oppUnmapped).join(', ') : 'Each column is mapped to a stat, used as the other side of one, or checked and dropped as derivable.');
    const bad = [];
    list.forEach(r => {
      const g = c => num(r[c]);
      if (!near(g('TotalPoints'), 6 * g('Goals') + g('Behinds'))) bad.push(`${r.Team}: points ≠ goals × 6 + behinds`);
      if (r.TotalPoints_Opposition !== undefined && !near(g('TotalPoints_Opposition'), 6 * g('Goals_Opposition') + g('Behinds_Opposition'))) bad.push(`${r.Team}: points against ≠ goals × 6 + behinds`);
      if (!near(g('Disposals'), g('Kicks') + g('Handballs'))) bad.push(`${r.Team}: disposals ≠ kicks + handballs`);
      if (!near(g('TotalClearances'), g('CentreClearances') + g('StoppageClearances'))) bad.push(`${r.Team}: clearances ≠ centre + stoppage`);
      if (r.FreesDiff !== undefined && !near(g('FreesDiff'), g('FreesFor') - g('FreesAgainst'))) bad.push(`${r.Team}: free kick diff ≠ for − against`);
    });
    ok('Totals add up (points, disposals, clearances, free kicks)', !bad.length, bad.length ? bad.slice(0, 8).join('; ') : 'All rows, for and against.');
    // Provider diff columns vs for − against
    let diffN = 0; const diffBad = [];
    header.filter(h => h.endsWith('_Diff')).forEach(h => {
      const b = h.slice(0, -5), c = byCol.get(b);
      if (!c || c.forOnly || c.againstCol || c.diffNote) return;
      list.forEach(r => { const d = num(r[h]), f = num(r[b]), a = num(r[b + '_Opposition']); if (d == null || f == null || a == null) return; diffN++; if (!near(d, f - a)) diffBad.push(`${r.Team} ${h}`); });
    });
    ok("Provider's diff columns equal for minus against", !diffBad.length, diffBad.length ? diffBad.slice(0, 8).join('; ') : `${diffN} values checked. The Lab works out diffs itself, so these columns aren't stored.`);
    if (leagueRow) {
      const G = teamRows.reduce((a, r) => a + (num(r.Matches) || 0), 0);
      const lg = num(leagueRow.Matches);
      ok('League matches = team games ÷ 2', near(lg, G / 2, 0.01), `${G} team games, ${lg} matches.`);
      const off = [];
      ['Goals', 'Inside50s', 'Tackles', 'Disposals', 'ContestedPossessions', 'TotalClearances', 'MetresGained'].forEach(col => {
        if (!header.includes(col)) return;
        const w = teamRows.reduce((a, r) => a + num(r[col]) * num(r.Matches), 0) / G;
        if (!near(w, num(leagueRow[col]), Math.max(0.05, Math.abs(w) * 0.002))) off.push(`${col}: row ${leagueRow[col]}, teams ${U.round(w, 3)}`);
      });
      ok('League row matches the teams (games-weighted)', !off.length, off.length ? off.join('; ') : 'Checked on goals, inside 50s, tackles, disposals, contested possessions, clearances and metres gained.');
    }
    const blanks = [];
    list.forEach(r => COLUMNS.forEach(c => { if (header.includes(c.col) && String(r[c.col]).trim() === '') blanks.push(`${r.Team} ${c.col}`); }));
    ok('Blank cells', true, blanks.length ? `${blanks.length} left as missing (not zero): ${blanks.join(', ')}` : 'None.');
    // Wins can be recovered exactly: xWins + WinsAboveXWins
    teamRows.forEach(r => { const x = num(r.xWins), d = num(r.WinsAboveXWins); if (x != null && d != null) teams[r.Team].wins = Math.round(x + d); });
    const winSum = Object.values(teams).reduce((a, t) => a + (t.wins || 0), 0);
    if (leagueRow) { const lm = num(leagueRow.Matches), gap = lm - winSum; ok('Wins fit the matches played', gap >= 0, `Wins (expected wins + wins above expected) total ${winSum} across ${lm} matches${gap > 0 ? `, so ${gap} match${gap === 1 ? '' : 'es'} had no winner. Most likely draws; the file doesn't say, so losses aren't worked out.` : '.'}`); }

    return {
      kind: 'teamseason', teams, league, checks, columns: header.length,
      meta: { competition: opts.competition, season: opts.season, source: opts.source, basis: 'Per-game averages over the season (finals included if the provider included them).', file: opts.file }
    };
  }

  /* ---------- ratings ---------- */
  function readRatings(text, opts) {
    const { list } = rowsAsObjects(text);
    const checks = []; const ok = (label, pass, detail) => checks.push({ label, pass: !!pass, detail: detail || '' });
    const out = {};
    const keys = ['CurrentRank', 'CurrentRating', 'CurrentChange', 'CurrentAttack', 'CurrentAttackRank', 'CurrentDefence', 'CurrentDefenceRank', 'SeasonRating', 'SeasonRank', 'SeasonAttack', 'SeasonAttackRank', 'SeasonDefence', 'SeasonDefenceRank'];
    const sumBad = [];
    list.forEach(r => {
      if (!r.Team) return;
      const o = {}; keys.forEach(k => { const v = num(r[k]); if (v != null) o[k] = v; });
      out[r.Team] = o;
      [['Current', 0.15], ['Season', 0.15]].forEach(([p, tol]) => { if (o[p + 'Rating'] != null && o[p + 'Attack'] != null && o[p + 'Defence'] != null && !near(o[p + 'Rating'], o[p + 'Attack'] + o[p + 'Defence'], tol)) sumBad.push(`${r.Team} ${p.toLowerCase()}`); });
    });
    ok(`${Object.keys(out).length} teams read`, Object.keys(out).length >= 2);
    ok('Rating = attack + defence (to rounding)', !sumBad.length, sumBad.length ? sumBad.join(', ') : 'Every row, current and season.');
    const rankBad = [];
    [['CurrentAttack', 'CurrentAttackRank'], ['CurrentDefence', 'CurrentDefenceRank'], ['SeasonRating', 'SeasonRank'], ['SeasonAttack', 'SeasonAttackRank'], ['SeasonDefence', 'SeasonDefenceRank']].forEach(([v, rk]) => {
      const arr = Object.entries(out).filter(([, o]) => o[v] != null);
      arr.forEach(([t, o]) => {
        if (o[rk] == null) return;
        const above = arr.filter(x => x[1][v] > o[v]).length, level = arr.filter(x => x[1][v] === o[v]).length;
        if (o[rk] < above + 1 || o[rk] > above + level) rankBad.push(`${t} ${rk}`);
      });
    });
    ok('Ranks match the values', !rankBad.length, rankBad.length ? rankBad.join(', ') : 'Attack, defence and season ranks all agree with the numbers.');
    return { kind: 'ratings', ratings: out, checks, meta: { source: opts.source, file: opts.file, note: opts.note || '' } };
  }

  /* ---------- player lists ---------- */
  const PL = {
    career: { RatingPoints: 'RatingPoints_Career', Supercoach: 'Supercoach_Career', Disposals: 'Disposals_Career', ContestedPossessions: 'ContestedPossessions_Career', Goals: 'Goals_Career' },
    last20: { RatingPoints: 'RatingPoints_Recent', Supercoach: 'Supercoach_Recent', Disposals: 'Disposals_Recent', ContestedPossessions: 'ContestedPossessions_Recent', Goals: 'Goals_Recent' }
  };
  function readPlayerList(text, opts) {
    const { list } = rowsAsObjects(text);
    const checks = []; const ok = (label, pass, detail) => checks.push({ label, pass: !!pass, detail: detail || '' });
    const players = list.filter(r => r.Player && r.Team).map(r => {
      const b = { age: num(r.Age), ageDecimal: num(r.Age_Decimal), height: num(r.Height), debutYear: num(r.DebutYear), careerGames: num(r.Matches_Career), careerGoals: num(r.Goals_Total_Career), finalsGames: num(r.Matches_Finals), finalsGoals: num(r.Goals_Total_Finals) };
      const seasonLine = { games: num(r.Matches_Current), goals: num(r.Goals_Total_Current) };
      if (seasonLine.games === 0 && seasonLine.goals == null) seasonLine.goals = 0; // no games: no goals, known
      const form = {}; Object.entries(PL).forEach(([k, map]) => { const o = {}; Object.entries(map).forEach(([s, col]) => { const v = num(r[col]); if (v != null) o[s] = v; }); if (Object.keys(o).length) form[k] = o; });
      return { name: r.Player, team: r.Team, number: r.JumperNumber || '', position: r.Position || '', bio: b, season: seasonLine, form };
    });
    const teams = U.groupBy(players, p => p.team);
    ok(`${players.length} players across ${teams.size} clubs`, players.length > 0, [...teams.entries()].map(([t, l]) => `${t} ${l.length}`).join(', '));
    const dupN = []; teams.forEach((l, t) => { const s = new Set(); l.forEach(p => { if (p.number && s.has(p.number)) dupN.push(`${t} #${p.number}`); s.add(p.number); }); });
    ok('Jumper numbers unique within each club', !dupN.length, dupN.join(', ') || '');
    const never = players.filter(p => p.bio.careerGames === 0).length;
    ok('Players yet to debut', true, `${never} listed with no senior games. Their averages are blank, not zero.`);
    // Last-20 window: every average × 20 should be a whole number for players with 20+ games
    const elig = players.filter(p => (p.bio.careerGames || 0) >= 20 && p.form.last20);
    const fits = elig.filter(p => ['Disposals', 'ContestedPossessions', 'Goals'].every(k => p.form.last20[k] == null || Math.abs(p.form.last20[k] * 20 - Math.round(p.form.last20[k] * 20)) < 0.02)).length;
    ok('"Recent" columns are last-20-game averages', fits === elig.length, `${fits} of ${elig.length} players with 20+ games fit a 20-game window exactly. These can span more than one season.`);
    return { kind: 'playerlist', players, checks, meta: { season: opts.season, source: opts.source, file: opts.file } };
  }

  /* Cross-file checks once both team stats and player lists are in. */
  function crossCheck(seasonObj) {
    const out = [];
    if (!seasonObj || !seasonObj.teams) return out;
    const pl = M.state.players.filter(p => p.seasons && p.seasons[seasonObj.season]);
    if (!pl.length) return out;
    const by = U.groupBy(pl, p => p.team);
    const goalBad = [], gamesBad = [];
    Object.entries(seasonObj.teams).forEach(([t, o]) => {
      const list = by.get(t) || [];
      const g = list.reduce((a, p) => a + (p.seasons[seasonObj.season].goals || 0), 0);
      const want = o.for['m-goals'] != null && o.games ? Math.round(o.for['m-goals'] * o.games) : null;
      if (want != null && g !== want) goalBad.push(`${t}: players ${g}, team ${want}`);
      const over = list.filter(p => (p.seasons[seasonObj.season].games || 0) > (o.games || 0));
      over.forEach(p => gamesBad.push(`${p.name} (${t})`));
    });
    out.push({ label: 'Player goals add up to team goals', pass: !goalBad.length, detail: goalBad.length ? goalBad.join('; ') : `All ${Object.keys(seasonObj.teams).length} clubs: listed players' ${seasonObj.season} goals equal goals per game × games.` });
    out.push({ label: 'No player has more games than their club', pass: !gamesBad.length, detail: gamesBad.join(', ') || 'Checked every player.' });
    return out;
  }

  /* ---------- commit ---------- */
  function seasonKey(comp, season) { return `${comp || 'AFL'}|${season || ''}`; }
  function getSeason(comp, season) { return (M.state.seasons || []).find(s => s.key === seasonKey(comp, season)) || null; }
  function upsertSeason(comp, season) {
    M.state.seasons = M.state.seasons || [];
    let s = getSeason(comp, season);
    if (!s) { s = { key: seasonKey(comp, season), competition: comp, season: String(season), teams: null, league: null, ratings: null, sources: {}, checks: {}, importedAt: {} }; M.state.seasons.push(s); }
    return s;
  }
  function commit(res, opts) {
    const s = upsertSeason(opts.competition, opts.season);
    const now = new Date().toISOString();
    if (res.kind === 'teamseason') {
      const added = ensureMetrics();
      s.teams = res.teams; s.league = res.league; s.basis = res.meta.basis;
      s.sources.teamStats = { source: opts.source || '', file: opts.file || '' }; s.checks.teamStats = res.checks; s.importedAt.teamStats = now;
      s.checks.cross = crossCheck(s);
      M.emit('season'); return { teams: Object.keys(res.teams).length, metrics: added };
    }
    if (res.kind === 'ratings') {
      s.ratings = res.ratings; s.sources.ratings = { source: opts.source || '', file: opts.file || '', note: opts.note || '' }; s.checks.ratings = res.checks; s.importedAt.ratings = now;
      M.emit('season'); return { teams: Object.keys(res.ratings).length };
    }
    if (res.kind === 'playerlist') {
      let added = 0, updated = 0;
      res.players.forEach(p => {
        let id = M.findPlayer(p.team, p.name);
        // exact-name match only, to avoid joining two different players with similar names
        if (id && U.norm(M.player(id).name) !== U.norm(p.name)) id = null;
        let pl = id ? M.player(id) : null;
        if (!pl) { pl = M.addPlayer({ name: p.name, team: p.team, number: p.number, position: p.position }, true); added++; } else { updated++; if (p.number) pl.number = p.number; if (p.position) pl.position = p.position; }
        pl.bio = p.bio; pl.seasons = pl.seasons || {}; pl.seasons[s.season] = p.season; pl.form = p.form; pl.formAsOf = s.season;
      });
      s.sources.players = { source: opts.source || '', file: opts.file || '' }; s.checks.players = res.checks; s.importedAt.players = now;
      s.checks.cross = crossCheck(s);
      M.emit('players'); return { added, updated };
    }
  }

  /* ---------- queries ---------- */
  function seasons() { return (M.state.seasons || []).slice().sort((a, b) => String(b.season).localeCompare(String(a.season))); }
  function value(s, team, side, id) { const t = s && s.teams && s.teams[team]; if (!t) return null; const v = (t[side] || {})[id]; return v == null ? null : v; }
  function leagueValue(s, side, id) {
    if (s.league && s.league[side] && s.league[side][id] != null) return s.league[side][id];
    const ts = Object.values(s.teams || {}).filter(t => t[side][id] != null && t.games);
    if (!ts.length) return null;
    const G = ts.reduce((a, t) => a + t.games, 0);
    return ts.reduce((a, t) => a + t[side][id] * t.games, 0) / G;
  }
  /* Rank of a team among all teams for one side. "Good" = 1 when the stat has a direction;
     for the against side the direction flips (conceding less is better). Style stats rank highest = 1. */
  function rank(s, team, side, id) {
    const col = byId.get(id), dir = col ? col.better : '';
    const list = Object.entries(s.teams || {}).map(([t, o]) => [t, o[side][id]]).filter(x => x[1] != null);
    const mine = value(s, team, side, id);
    if (mine == null) return null;
    let highFirst = true;
    if (dir === 'low') highFirst = false;
    if (side === 'against' && dir) highFirst = !highFirst;
    const better = list.filter(x => highFirst ? x[1] > mine : x[1] < mine).length;
    return { rank: better + 1, of: list.length, directional: !!dir };
  }
  /* Standardised distance from the league for each directional stat, for the style fingerprint. */
  function fingerprint(s, team) {
    const out = [];
    COLUMNS.forEach(c => {
      if (c.basis === 'season' || c.group === 'Player ratings') return;
      ['for', 'against'].forEach(side => {
        if (side === 'against' && c.forOnly && !c.againstCol) return;
        const vals = Object.values(s.teams || {}).map(o => o[side][c.id]).filter(v => v != null);
        const v = value(s, team, side, c.id);
        if (v == null || vals.length < 6) return;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (vals.length - 1));
        if (!sd) return;
        const z = (v - mean) / sd;
        let good = null;
        if (c.better) { good = c.better === 'high' ? z > 0 : z < 0; if (side === 'against') good = !good; }
        out.push({ col: c, side, value: v, mean, z, good, r: rank(s, team, side, c.id), league: leagueValue(s, side, c.id) });
      });
    });
    return out;
  }
  function fmt(id, v) {
    if (v == null || isNaN(v)) return '–';
    const c = byId.get(id) || {};
    const u = c.unit;
    if (u === '%') return U.round(v, 1).toFixed(1) + '%';
    if (u === 'm') return Math.round(v).toLocaleString('en-AU');
    if (Math.abs(v) >= 100) return U.round(v, 0).toLocaleString('en-AU');
    if (Math.abs(v) >= 10) return U.round(v, 1).toFixed(1);
    return U.round(v, 2).toFixed(2);
  }

  Lab.Season = { COLUMNS, DERIVED, byCol, byId, detect, readTeamSeason, readRatings, readPlayerList, commit, crossCheck, ensureMetrics, seasons, getSeason, value, leagueValue, rank, fingerprint, fmt };
})(window.Lab);
