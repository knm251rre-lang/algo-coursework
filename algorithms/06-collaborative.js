'use strict';

const { candidates, rankScores } = require('../lib/ranking');
const { jaccard } = require('../lib/math');

const defaults = {
  similarity: 'jaccard',
  neighbours: 15,
  minSimilarity: 0.01,
};

function inverseUserFrequency(ctx) {
  const iuf = new Map();
  const U = ctx.users.length;
  for (const item of ctx.items) iuf.set(item.id, Math.log(U / (item.likes + 1)));
  return iuf;
}

function cosineIUF(a, b, iuf) {
  let dot = 0, na = 0, nb = 0;
  for (const id of a) {
    const w = iuf.get(id) ** 2;
    na += w;
    if (b.has(id)) dot += w;
  }
  for (const id of b) nb += iuf.get(id) ** 2;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function findNeighbours(user, ctx, o) {
  const iuf = o.similarity === 'cosine' ? inverseUserFrequency(ctx) : null;
  return ctx.users
    .filter(v => v.id !== user.id)
    .map(v => ({
      user: v,
      sim: o.similarity === 'cosine'
        ? cosineIUF(user.train, v.train, iuf)
        : jaccard(user.train, v.train),
    }))
    .filter(n => n.sim > o.minSimilarity)
    .sort((a, b) => b.sim - a.sim || a.user.id - b.user.id)
    .slice(0, o.neighbours);
}

function scoreAll(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  const neighbours = findNeighbours(user, ctx, o);
  const scores = new Map();

  if (neighbours.length === 0) {
    for (const item of candidates(user, ctx)) {
      scores.set(item.id, item.likes / ctx.maxLikes);
    }
    return scores;
  }

  const simSum = neighbours.reduce((s, n) => s + n.sim, 0);
  const raw = new Map();
  for (const { user: v, sim } of neighbours) {
    for (const id of v.train) raw.set(id, (raw.get(id) || 0) + sim);
  }
  for (const item of candidates(user, ctx)) {
    scores.set(item.id, (raw.get(item.id) || 0) / simSum);
  }
  return scores;
}

function recommend(user, ctx, opts = {}) {
  return rankScores(scoreAll(user, ctx, opts));
}

module.exports = {
  key: 'collaborative',
  name: 'Колаборативна (kNN)',
  difficulty: 4,
  personalized: true,
  defaults,
  scoreAll,
  recommend,
  findNeighbours,
};
