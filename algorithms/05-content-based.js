'use strict';

const { candidates, rankScores } = require('../lib/ranking');
const { cosine } = require('../lib/math');

const defaults = {
  useIdf: false,
};

function idf(tag, ctx) {
  return Math.log(ctx.items.length / (ctx.tagDf[tag] || 1));
}

function itemVector(item, ctx, useIdf) {
  const v = {};
  const tf = 1 / item.tags.length;
  for (const tag of item.tags) v[tag] = useIdf ? tf * idf(tag, ctx) : 1;
  return v;
}

function buildProfile(user, ctx, useIdf = defaults.useIdf) {
  const profile = {};
  for (const id of user.train) {
    const v = itemVector(ctx.items[id], ctx, useIdf);
    for (const tag in v) profile[tag] = (profile[tag] || 0) + v[tag];
  }
  return profile;
}

function scoreAll(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  const profile = buildProfile(user, ctx, o.useIdf);
  const scores = new Map();
  for (const item of candidates(user, ctx)) {
    scores.set(item.id, cosine(profile, itemVector(item, ctx, o.useIdf)));
  }
  return scores;
}

function recommend(user, ctx, opts = {}) {
  return rankScores(scoreAll(user, ctx, opts));
}

function explain(user, item, ctx) {
  const profile = buildProfile(user, ctx);
  const v = itemVector(item, ctx, defaults.useIdf);
  return Object.keys(v)
    .map(tag => ({ tag, contribution: (profile[tag] || 0) * v[tag] }))
    .filter(x => x.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .map(x => x.tag);
}

module.exports = {
  key: 'contentBased',
  name: 'Контентна фільтрація',
  difficulty: 2,
  personalized: true,
  defaults,
  scoreAll,
  recommend,
  buildProfile,
  itemVector,
  explain,
};
