'use strict';

const { scoreCandidates, rankScores } = require('../lib/ranking');
const { wilsonLowerBound } = require('../lib/math');

const defaults = {
  mode: 'likes',
  bayesC: 50,
  z: 1.96,
};

function globalRatio(ctx) {
  let likes = 0, views = 0;
  for (const item of ctx.items) { likes += item.likes; views += item.views; }
  return views ? likes / views : 0;
}

function scoreAll(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  const prior = globalRatio(ctx);

  return scoreCandidates(user, ctx, item => {
    switch (o.mode) {
      case 'ratio':
        return item.views ? item.likes / item.views : 0;
      case 'bayes':
        return (item.likes + o.bayesC * prior) / (item.views + o.bayesC);
      case 'wilson':
        return wilsonLowerBound(item.likes, item.views, o.z);
      case 'likes':
      default:
        return item.likes;
    }
  });
}

function recommend(user, ctx, opts = {}) {
  return rankScores(scoreAll(user, ctx, opts));
}

module.exports = {
  key: 'popularity',
  name: 'Популярність',
  difficulty: 1,
  personalized: false,
  defaults,
  scoreAll,
  recommend,
  globalRatio,
};
