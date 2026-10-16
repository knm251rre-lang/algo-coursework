'use strict';

const { scoreCandidates, rankScores } = require('../lib/ranking');

const defaults = {
  mode: 'hn',
  gravity: 1.8,
};

function hackerNewsScore(likes, ageHours, gravity) {
  return likes / Math.pow(ageHours + 2, gravity);
}

function redditHotScore(likes, ageHours) {
  const s = likes;
  const order = Math.log10(Math.max(Math.abs(s), 1));
  const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
  const ageSeconds = ageHours * 3600;
  return sign * order - ageSeconds / 45000;
}

function scoreAll(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  return scoreCandidates(user, ctx, item =>
    o.mode === 'reddit'
      ? redditHotScore(item.likes, item.ageHours)
      : hackerNewsScore(item.likes, item.ageHours, o.gravity));
}

function recommend(user, ctx, opts = {}) {
  return rankScores(scoreAll(user, ctx, opts));
}

module.exports = {
  key: 'timeDecay',
  name: 'Hacker News',
  difficulty: 2,
  personalized: false,
  defaults,
  scoreAll,
  recommend,
  hackerNewsScore,
  redditHotScore,
};
