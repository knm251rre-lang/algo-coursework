'use strict';

const CONFIG = require('./config');
const { reseed } = require('./lib/random');
const { jaccard } = require('./lib/math');

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function ndcgAtK(feed, relevant, k = CONFIG.K) {
  let dcg = 0, idcg = 0;
  feed.forEach((id, i) => { if (relevant.has(id)) dcg += 1 / Math.log2(i + 2); });
  for (let i = 0; i < Math.min(k, relevant.size); i++) idcg += 1 / Math.log2(i + 2);
  return idcg ? dcg / idcg : 0;
}

function intraListDiversity(feed, ctx) {
  let sum = 0, pairs = 0;
  for (let i = 0; i < feed.length; i++) {
    for (let j = i + 1; j < feed.length; j++) {
      const a = new Set(ctx.items[feed[i]].tags);
      const b = new Set(ctx.items[feed[j]].tags);
      sum += 1 - jaccard(a, b);
      pairs++;
    }
  }
  return pairs ? sum / pairs : 0;
}

function novelty(feed, ctx) {
  const U = ctx.users.length;
  const values = feed.map(id => -Math.log2((ctx.items[id].likes + 1) / (U + 1)));
  return values.reduce((s, x) => s + x, 0) / feed.length;
}

function evaluate(algo, ctx, opts = {}, label = algo.name) {
  reseed(CONFIG.SEED + 1);

  const t0 = now();
  const feeds = ctx.users.map(u => algo.recommend(u, ctx, opts));
  const timeMs = now() - t0;

  const acc = { precision: 0, recall: 0, ndcg: 0, hit: 0, ild: 0, novelty: 0, age: 0 };
  const shown = new Set();

  ctx.users.forEach((user, idx) => {
    const feed = feeds[idx];
    const hits = feed.filter(id => user.test.has(id)).length;
    acc.precision += hits / CONFIG.K;
    acc.recall += hits / user.test.size;
    acc.ndcg += ndcgAtK(feed, user.test);
    if (hits > 0) acc.hit++;
    acc.ild += intraListDiversity(feed, ctx);
    acc.novelty += novelty(feed, ctx);
    acc.age += feed.reduce((s, id) => s + ctx.items[id].ageHours, 0) / feed.length;
    feed.forEach(id => shown.add(id));
  });

  const n = ctx.users.length;
  return {
    name: label,
    precision: acc.precision / n,
    recall: acc.recall / n,
    ndcg: acc.ndcg / n,
    hitRate: acc.hit / n,
    coverage: shown.size / ctx.items.length,
    ild: acc.ild / n,
    novelty: acc.novelty / n,
    avgAge: acc.age / n,
    timeMs,
    difficulty: algo.difficulty,
  };
}

function toRow(r) {
  return {
    'Алгоритм': r.name,
    'Precision': +r.precision.toFixed(3),
    'Recall': +r.recall.toFixed(3),
    'nDCG': +r.ndcg.toFixed(3),
    'HitRate': +r.hitRate.toFixed(2),
    'Покриття': +r.coverage.toFixed(2),
    'ILD': +r.ild.toFixed(2),
    'Новизна': +r.novelty.toFixed(2),
    'Вік, год': Math.round(r.avgAge),
    'Час, мс': +r.timeMs.toFixed(1),
    'Складн.': r.difficulty,
  };
}

module.exports = { evaluate, toRow, ndcgAtK, intraListDiversity, novelty };
