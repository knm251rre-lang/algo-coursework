'use strict';

const CONFIG = require('../config');
const { candidates } = require('../lib/ranking');
const { minMaxNormalize, jaccard } = require('../lib/math');
const contentBased = require('./05-content-based');
const collaborative = require('./06-collaborative');
const popularity = require('./03-popularity');

const defaults = {
  weights: { content: 0.45, collaborative: 0.2, popularity: 0.2, freshness: 0.15 },
  halfLifeHours: 96,
  coldStartHistory: 5,
  mmrLambda: 0.85,
  useMMR: true,
};

function adaptWeights(user, o) {
  const w = { ...o.weights };
  const n = user.train.size;
  if (n < o.coldStartHistory) {
    const trust = n / o.coldStartHistory;
    const moved = (w.content + w.collaborative) * (1 - trust);
    w.content *= trust;
    w.collaborative *= trust;
    w.popularity += moved;
  }
  return w;
}

function scoreAll(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts, weights: { ...defaults.weights, ...(opts.weights || {}) } };
  const w = adaptWeights(user, o);

  const signals = {
    content: minMaxNormalize(contentBased.scoreAll(user, ctx)),
    collaborative: minMaxNormalize(collaborative.scoreAll(user, ctx)),
    popularity: minMaxNormalize(popularity.scoreAll(user, ctx, { mode: 'wilson' })),
  };

  const scores = new Map();
  for (const item of candidates(user, ctx)) {
    const freshness = Math.exp(-Math.LN2 * item.ageHours / o.halfLifeHours);
    scores.set(item.id,
      w.content * signals.content.get(item.id) +
      w.collaborative * signals.collaborative.get(item.id) +
      w.popularity * signals.popularity.get(item.id) +
      w.freshness * freshness);
  }
  return scores;
}

function mmrRerank(scores, ctx, lambda, k = CONFIG.K) {
  const pool = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, k * 5);

  const tags = new Map(pool.map(([id]) => [id, new Set(ctx.items[id].tags)]));

  const redundancy = new Map(pool.map(([id]) => [id, 0]));
  const selected = [];

  while (selected.length < k && pool.length) {
    let bestIdx = 0, bestValue = -Infinity;
    pool.forEach(([id, score], idx) => {
      const value = lambda * score - (1 - lambda) * redundancy.get(id);
      if (value > bestValue) { bestValue = value; bestIdx = idx; }
    });
    const [chosen] = pool.splice(bestIdx, 1)[0];
    selected.push(chosen);
    for (const [id] of pool) {
      const sim = jaccard(tags.get(id), tags.get(chosen));
      if (sim > redundancy.get(id)) redundancy.set(id, sim);
    }
  }
  return selected;
}

function recommend(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  const scores = scoreAll(user, ctx, opts);
  return mmrRerank(scores, ctx, o.useMMR ? o.mmrLambda : 1);
}

module.exports = {
  key: 'hybrid',
  name: 'Гібридна зважена',
  difficulty: 3,
  personalized: true,
  defaults,
  scoreAll,
  recommend,
  adaptWeights,
  mmrRerank,
};
