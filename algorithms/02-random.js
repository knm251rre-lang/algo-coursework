'use strict';

const CONFIG = require('../config');
const { random } = require('../lib/random');
const { candidates, rankScores } = require('../lib/ranking');

const defaults = {
  mode: 'uniform',
};

function uniformSample(arr, k) {
  const a = [...arr];
  const n = Math.min(k, a.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function scoreAll(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  const scores = new Map();
  for (const item of candidates(user, ctx)) {
    const u = random();
    if (o.mode === 'weighted') {
      const w = 1 + item.likes;
      scores.set(item.id, Math.pow(u, 1 / w));
    } else {
      scores.set(item.id, u);
    }
  }
  return scores;
}

function recommend(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  if (o.mode === 'uniform') {
    return uniformSample(candidates(user, ctx), CONFIG.K).map(item => item.id);
  }
  return rankScores(scoreAll(user, ctx, o));
}

module.exports = {
  key: 'random',
  name: 'Випадковий',
  difficulty: 1,
  personalized: false,
  defaults,
  scoreAll,
  recommend,
};
