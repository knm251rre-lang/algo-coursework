'use strict';

const CONFIG = require('../config');
const { candidates } = require('../lib/ranking');

const defaults = {
  maxPerAuthor: 2,
  cursor: null,
};

function scoreAll(user, ctx) {
  const scores = new Map();
  for (const item of candidates(user, ctx)) scores.set(item.id, -item.ageHours);
  return scores;
}

function recommend(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };

  let pool = candidates(user, ctx)
    .sort((a, b) => a.ageHours - b.ageHours || a.id - b.id);

  if (o.cursor !== null) pool = pool.filter(item => item.ageHours > o.cursor);

  const perAuthor = new Map();
  const feed = [];
  for (const item of pool) {
    const count = perAuthor.get(item.authorId) || 0;
    if (count >= o.maxPerAuthor) continue;
    perAuthor.set(item.authorId, count + 1);
    feed.push(item.id);
    if (feed.length === CONFIG.K) break;
  }
  return feed;
}

function nextCursor(feed, ctx) {
  return feed.length ? ctx.items[feed[feed.length - 1]].ageHours : null;
}

module.exports = {
  key: 'chronological',
  name: 'Хронологічний',
  difficulty: 1,
  personalized: false,
  defaults,
  scoreAll,
  recommend,
  nextCursor,
};
