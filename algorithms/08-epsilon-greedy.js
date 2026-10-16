'use strict';

const CONFIG = require('../config');
const { random } = require('../lib/random');
const { candidates } = require('../lib/ranking');
const hybrid = require('./07-hybrid');

const defaults = {
  epsilon: 0.2,
  epsilonMin: 0.05,
  decay: true,
  tau: 40,
  protectTop: 2,
};

function currentEpsilon(user, o) {
  if (!o.decay) return o.epsilon;
  return Math.max(o.epsilonMin, o.epsilon / (1 + user.train.size / o.tau));
}

function explorationPool(user, ctx, exploitSet) {
  const pool = candidates(user, ctx)
    .filter(item => !exploitSet.has(item.id))
    .sort((a, b) => a.likes - b.likes || a.id - b.id);

  return pool.slice(0, Math.max(1, Math.ceil(pool.length / 2))).map(i => i.id);
}

function recommend(user, ctx, opts = {}) {
  const o = { ...defaults, ...opts };
  const eps = currentEpsilon(user, o);

  const scores = hybrid.scoreAll(user, ctx);
  const exploit = hybrid.mmrRerank(scores, ctx, hybrid.defaults.mmrLambda, CONFIG.K * 3);
  const explore = explorationPool(user, ctx, new Set(exploit));

  const feed = [];
  const used = new Set();
  let e = 0;
  while (feed.length < CONFIG.K) {
    const position = feed.length;
    let id;
    if (position >= o.protectTop && random() < eps && explore.length) {
      id = explore[Math.floor(random() * explore.length)];
    } else {
      while (e < exploit.length && used.has(exploit[e])) e++;
      id = exploit[e++];
    }
    if (id !== undefined && !used.has(id)) {
      used.add(id);
      feed.push(id);
    }
  }
  return feed;
}

module.exports = {
  key: 'epsilonGreedy',
  name: 'ε-greedy',
  difficulty: 3,
  personalized: true,
  defaults,
  recommend,
  currentEpsilon,
};
