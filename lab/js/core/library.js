/* Opponent Lab: starter library.
   DEFINITIONS ONLY: stat definitions and coding templates a club can use, rename, edit or delete.
   Nothing here is data about any team or match. */
(function (Lab) {
  'use strict';

  /* ---------- ground zones (relative to the team in possession, attacking up the page) ---------- */
  const BANDS = ['Forward 50', 'Attacking midfield', 'Defensive midfield', 'Defensive 50'];
  const LANES = ['Left', 'Corridor', 'Right'];
  const ZONES = [];
  BANDS.forEach(b => LANES.forEach(l => ZONES.push(b + ' · ' + l)));

  const SCORE = ['Goal', 'Behind', 'No score', 'Opp goal', 'Opp behind'];
  const YN = ['Yes', 'No'];
  const SIDE = ['Team', 'Opposition'];
  const LR = ['Left', 'Corridor', 'Right'];

  /* f(key, label, type, extra) */
  const f = (key, label, type, extra) => Object.assign({ key, label, type: type || 'choice' }, extra || {});
  const ch = (key, label, options, extra) => f(key, label, 'choice', Object.assign({ options }, extra || {}));
  const pl = (key, label, side, extra) => f(key, label, 'player', Object.assign({ side: side || 'for' }, extra || {}));
  const notes = () => f('notes', 'Notes', 'text', { long: true });

  /* Each template = one kind of event. Every event also records match, team, quarter, clock, tags and video time.
     "Team" in a choice means the team the event is coded for; "Opposition" means the side they played. */
  const TEMPLATES = [
    {
      id: 'tpl-cba', phase: 'Stoppages', name: 'Centre bounces', unit: 'centre bounce',
      description: 'One event per centre bounce, from the point of view of the team coded. Spots: Anchor holds at the contest; Spear runs through; Rucks left/right start beside the ruck.',
      fields: [
        ch('reason', 'Ball-up reason', ['Quarter start', 'After goal for', 'After goal against'], { required: true }),
        f('margin', 'Margin before (team)', 'margin'),
        pl('ruck', 'Team ruck', 'for', { sticky: true }), pl('oppRuck', 'Opp ruck', 'against', { sticky: true }),
        pl('mid1', 'Mid 1', 'for', { sticky: true }), ch('mid1Spot', 'Mid 1 spot', ['Anchor', 'Spear', 'Rucks left', 'Rucks right'], { sticky: true }),
        pl('mid2', 'Mid 2', 'for', { sticky: true }), ch('mid2Spot', 'Mid 2 spot', ['Anchor', 'Spear', 'Rucks left', 'Rucks right'], { sticky: true }),
        pl('mid3', 'Mid 3', 'for', { sticky: true }), ch('mid3Spot', 'Mid 3 spot', ['Anchor', 'Spear', 'Rucks left', 'Rucks right'], { sticky: true }),
        ch('wings', 'Wing set-up', ['Both wings up', 'One wing dropped back', 'Both wings dropped back', 'Neutral'], { sticky: true }),
        ch('ruckContest', 'Ruck contest', ['Both jumped', 'One jumped', 'Wrestle / no jump', 'Free kick']),
        ch('hitout', 'Hitout won by', ['Team', 'Opposition', 'No winner']),
        ch('tap', 'Tap direction (team view)', ['Targeted', 'Forward', 'No result', 'Opp ruck']),
        ch('firstPoss', 'First possession', SIDE),
        ch('clearance', 'Centre clearance', ['Team', 'Opposition', 'No clearance']),
        ch('i50', 'Inside 50 in chain (team)', YN),
        ch('i50Fast', 'Inside 50 within 15s', YN),
        ch('result', 'Score from chain', SCORE),
        notes()
      ]
    },
    {
      id: 'tpl-stoppage', phase: 'Stoppages', name: 'Ball-ups & throw-ins', unit: 'stoppage',
      description: 'Around-the-ground ball-ups and boundary throw-ins.',
      fields: [
        ch('type', 'Stoppage type', ['Ball-up', 'Boundary throw-in']),
        f('zone', 'Zone', 'zone'),
        pl('ruck', 'Team ruck', 'for', { sticky: true }), pl('oppRuck', 'Opp ruck', 'against', { sticky: true }),
        ch('hitout', 'Hitout won by', ['Team', 'Opposition', 'No winner']),
        ch('firstPoss', 'First possession', SIDE),
        ch('clearance', 'Clearance', ['Team', 'Opposition', 'No clearance']),
        pl('clearedBy', 'Cleared by', 'any'),
        ch('i50', 'Inside 50 in chain (team)', YN),
        ch('result', 'Score from chain', SCORE),
        notes()
      ]
    },
    {
      id: 'tpl-kickin', phase: 'Restarts & exits', name: 'Kick-ins & defensive-50 exits', unit: 'kick-in',
      description: 'Each kick-in after an opposition behind, coded for the team kicking in.',
      fields: [
        pl('kicker', 'Kicker', 'for', { sticky: true }),
        ch('playOn', 'Played on', YN),
        ch('direction', 'Direction', LR),
        ch('length', 'Length', ['Short (inside 30m)', 'Mid', 'Long']),
        f('target', 'Target zone', 'zone'),
        ch('oppSetup', 'Opposition setup', ['Zone', 'Man on man', 'High press', 'Unclear']),
        pl('receiver', 'First receiver', 'for'),
        ch('firstContest', 'First contest', ['Team', 'Opposition', 'Uncontested']),
        ch('exit', 'Exited defensive 50', YN),
        ch('i50', 'Inside 50 in chain (team)', YN),
        ch('result', 'Score from chain', SCORE),
        notes()
      ]
    },
    {
      id: 'tpl-chain', phase: 'General play', name: 'Possession chains', unit: 'chain',
      description: 'One event per possession chain: where it started, how it moved and how it ended.',
      fields: [
        ch('origin', 'Chain origin', ['Centre bounce', 'Stoppage', 'Kick-in', 'Turnover: defensive half', 'Turnover: attacking half', 'Mark / free']),
        f('startZone', 'Start zone', 'zone'),
        ch('route', 'Route', ['Corridor', 'Boundary', 'Switch', 'Direct long']),
        ch('tempo', 'Tempo', ['Fast / play on', 'Controlled / held up']),
        ch('reachedF50', 'Reached forward 50', YN),
        ch('result', 'Chain result', ['Goal', 'Behind', 'No score', 'Turnover', 'Stoppage', 'Out of bounds']),
        notes()
      ]
    },
    {
      id: 'tpl-sequence', phase: 'Ball movement', name: 'Ball movement (action by action)', unit: 'action',
      description: 'One event per action inside a chain. Give each chain a number so the Lab can draw its path. Zones are relative to the team in possession.',
      fields: [
        f('chain', 'Chain number', 'chain', { sticky: true, required: true }),
        ch('action', 'Action', ['Kick', 'Handball', 'Mark', 'Ground ball get', 'Contest', 'Run / bounce', 'Free kick', 'Shot']),
        pl('player', 'Player', 'for'),
        f('zone', 'Zone', 'zone', { required: true }),
        ch('outcome', 'Outcome', ['Retained', 'Turnover', 'Stoppage', 'Out of bounds', 'Score']),
        notes()
      ]
    },
    {
      id: 'tpl-rebound', phase: 'Transition & rebound', name: 'Rebound 50s & defensive transition', unit: 'rebound',
      description: 'The team coded wins the ball in its defensive 50 and tries to exit.',
      fields: [
        ch('trigger', 'How the ball was won', ['Intercept mark', 'Ground ball', 'Spoil / stoppage won', 'Opposition error']),
        pl('player', 'Won by', 'for'),
        ch('method', 'Exit method', ['Kick long', 'Kick short', 'Handball chain', 'Run & carry']),
        ch('side', 'Exit side', LR),
        ch('exited', 'Exited defensive 50', YN),
        ch('reachedF50', 'Reached forward 50', YN),
        ch('result', 'Chain result', ['Goal', 'Behind', 'No score', 'Turnover', 'Stoppage']),
        notes()
      ]
    },
    {
      id: 'tpl-f50', phase: 'Forward half', name: 'Forward-50 entries', unit: 'inside 50',
      description: 'Each inside 50 by the team coded.',
      fields: [
        ch('origin', 'Chain origin', ['Centre bounce', 'Stoppage', 'Turnover', 'Kick-in', 'Rebound', 'Mark / free']),
        ch('method', 'Entry method', ['Kick', 'Handball', 'Run / carry']),
        ch('entryType', 'Entry type', ['Long to contest', 'Lead hit-up', 'Kick to space', 'Switch / inboard', 'Shot from outside 50']),
        ch('side', 'Side', LR),
        pl('player', 'Entry by', 'for'),
        pl('target', 'Target', 'for'),
        ch('outcome', 'Entry outcome', ['Mark', 'Contest won', 'Contest lost', 'Ground ball won', 'Ground ball lost', 'Out of bounds', 'Direct shot']),
        ch('retained', 'Retained inside 50', YN),
        ch('result', 'Score from entry', ['Goal', 'Behind', 'No score']),
        notes()
      ]
    },
    {
      id: 'tpl-contest', phase: 'Contest', name: 'Contests (aerial & ground)', unit: 'contest',
      description: 'One-on-one and pack contests. Coded for the team whose player is named first.',
      fields: [
        ch('type', 'Contest type', ['Aerial one-on-one', 'Aerial pack', 'Ground ball', 'Ruck (around ground)']),
        f('zone', 'Zone', 'zone'),
        pl('player', 'Player', 'for'),
        pl('oppPlayer', 'Opponent', 'against'),
        ch('outcome', 'Outcome', ['Won', 'Lost', 'Neutral / spilled']),
        ch('mark', 'Mark taken', YN),
        notes()
      ]
    },
    {
      id: 'tpl-turnover', phase: 'Pressure & turnovers', name: 'Turnovers & pressure', unit: 'turnover',
      description: 'The team coded loses the ball. "Forced by" is the opposition player applying pressure, if any.',
      fields: [
        ch('type', 'Turnover type', ['Kick', 'Handball', 'Ground ball', 'Tackle / holding', 'Intercepted']),
        f('zone', 'Zone', 'zone'),
        pl('player', 'Turned over by', 'for'),
        ch('pressure', 'Pressure', ['None (unforced)', 'Pressured', 'Tackled']),
        pl('forcedBy', 'Forced by', 'against'),
        ch('result', 'What followed', ['Opp goal', 'Opp behind', 'Opp inside 50', 'Regained', 'Stoppage']),
        notes()
      ]
    },
    {
      id: 'tpl-shot', phase: 'Scoring', name: 'Shots at goal', unit: 'shot',
      description: 'Every shot at goal by the team coded.',
      fields: [
        pl('player', 'Shooter', 'for'),
        ch('type', 'Shot type', ['Set shot', 'Snap', 'Running', 'Checkside', 'Soccer / crumb']),
        ch('source', 'From', ['Mark', 'Free kick', 'General play']),
        ch('location', 'Shot location', ['Goal square', 'Left pocket', 'Right pocket', 'Centre 15–30m', 'Centre 30–50m', 'Outside 50']),
        ch('origin', 'Chain origin', ['Centre bounce', 'Stoppage', 'Turnover', 'Kick-in', 'Rebound']),
        ch('result', 'Result', ['Goal', 'Behind', 'Out on the full', 'Short / no score', 'Rushed / touched']),
        notes()
      ]
    },
    {
      id: 'tpl-structure', phase: 'Structures & roles', name: 'Structures, roles & rotations', unit: 'observation',
      description: 'Log structural observations as they happen: behind-ball numbers, forward set-ups, rotations, matchups.',
      fields: [
        ch('theme', 'Theme', ['Behind the ball', 'Forward structure', 'Defensive zone / press', 'Rotation', 'Matchup', 'Ruck setup', 'Other']),
        f('count', 'Number of players (if counting)', 'number'),
        pl('player', 'Player', 'for'),
        pl('oppPlayer', 'Matched up on', 'against'),
        notes()
      ]
    }
  ];

  /* Stat definitions. kind: value (entered), sum (weighted sum of other metrics), ratio (sum num / sum den).
     level: team, player or both. unit: count, %, m. */
  const m = (id, name, group, level, extra) => Object.assign({ id, name, group, level, kind: 'value', unit: 'count', starter: true }, extra || {});
  const METRICS = [
    m('m-goals', 'Goals', 'Scoring', 'both'),
    m('m-behinds', 'Behinds', 'Scoring', 'both'),
    m('m-score', 'Score (points)', 'Scoring', 'team', { kind: 'sum', parts: [{ id: 'm-goals', w: 6 }, { id: 'm-behinds', w: 1 }] }),
    m('m-shots', 'Scoring shots', 'Scoring', 'both', { kind: 'sum', parts: [{ id: 'm-goals', w: 1 }, { id: 'm-behinds', w: 1 }] }),
    m('m-accuracy', 'Goal accuracy', 'Scoring', 'both', { kind: 'ratio', num: 'm-goals', den: 'm-shots', unit: '%' }),
    m('m-shotsPerI50', 'Scoring shots per inside 50', 'Scoring', 'team', { kind: 'ratio', num: 'm-shots', den: 'm-i50', unit: '%' }),
    m('m-ptsTurnover', 'Points from turnovers', 'Scoring', 'team'),
    m('m-ptsStoppage', 'Points from stoppages', 'Scoring', 'team'),
    m('m-disposals', 'Disposals', 'Possession', 'both'),
    m('m-kicks', 'Kicks', 'Possession', 'both'),
    m('m-handballs', 'Handballs', 'Possession', 'both'),
    m('m-cp', 'Contested possessions', 'Possession', 'both'),
    m('m-up', 'Uncontested possessions', 'Possession', 'both'),
    m('m-de', 'Disposal efficiency', 'Possession', 'both', { unit: '%' }),
    m('m-marks', 'Marks', 'Possession', 'both'),
    m('m-clearances', 'Clearances', 'Contest & stoppage', 'both'),
    m('m-cclear', 'Centre clearances', 'Contest & stoppage', 'both'),
    m('m-sclear', 'Stoppage clearances', 'Contest & stoppage', 'both'),
    m('m-hitouts', 'Hitouts', 'Contest & stoppage', 'both'),
    m('m-cba', 'Centre bounce attendances', 'Contest & stoppage', 'player'),
    m('m-gbg', 'Ground ball gets', 'Contest & stoppage', 'both'),
    m('m-cm', 'Contested marks', 'Contest & stoppage', 'both'),
    m('m-i50', 'Inside 50s', 'Territory', 'both'),
    m('m-r50', 'Rebound 50s', 'Territory', 'both'),
    m('m-mi50', 'Marks inside 50', 'Territory', 'both'),
    m('m-mgained', 'Metres gained', 'Territory', 'both', { unit: 'm' }),
    m('m-tackles', 'Tackles', 'Pressure & turnovers', 'both'),
    m('m-ti50', 'Tackles inside 50', 'Pressure & turnovers', 'both'),
    m('m-pressure', 'Pressure acts', 'Pressure & turnovers', 'both'),
    m('m-intercepts', 'Intercept possessions', 'Pressure & turnovers', 'both'),
    m('m-turnovers', 'Turnovers', 'Pressure & turnovers', 'both'),
    m('m-clangers', 'Clangers', 'Pressure & turnovers', 'both'),
    m('m-ff', 'Free kicks for', 'Pressure & turnovers', 'both'),
    m('m-fa', 'Free kicks against', 'Pressure & turnovers', 'both'),
    m('m-kickins', 'Kick-ins', 'Restarts', 'team'),
    m('m-kickinsPlayOn', 'Kick-ins played on', 'Restarts', 'team'),
    m('m-scoreInv', 'Score involvements', 'Player', 'player'),
    m('m-tog', 'Time on ground', 'Player', 'player', { unit: '%' })
  ];

  const COMPETITIONS = ['AFL', 'AFLW', 'VFL', 'VFLW', 'SANFL', 'WAFL', 'NEAFL / state league', 'Talent League', 'Community', 'Other'];

  Lab.Library = {
    ZONES, BANDS, LANES, COMPETITIONS,
    templates: () => JSON.parse(JSON.stringify(TEMPLATES)),
    metrics: () => JSON.parse(JSON.stringify(METRICS))
  };
})(window.Lab);
