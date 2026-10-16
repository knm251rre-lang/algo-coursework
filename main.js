'use strict';

const CONFIG = require('./config');
const { buildContext } = require('./data/generator');
const { evaluate, toRow } = require('./metrics');
const { reseed } = require('./lib/random');
const { mean, std } = require('./lib/math');
const ALGORITHMS = require('./algorithms');

const byKey = Object.fromEntries(ALGORITHMS.map(a => [a.key, a]));

function header(title) {
  console.log('\n' + '='.repeat(78));
  console.log(' ' + title);
  console.log('='.repeat(78));
}

function runComparison(ctx) {
  header('ПОРІВНЯННЯ АЛГОРИТМІВ ВИДАЧІ КОНТЕНТУ');
  const totalLikes = ctx.users.reduce((s, u) => s + u.train.size + u.test.size, 0);
  console.log(`Публікацій: ${CONFIG.ITEMS}, користувачів: ${CONFIG.USERS}, ` +
              `авторів: ${CONFIG.AUTHORS}, вподобань: ${totalLikes}, K = ${CONFIG.K}`);

  const results = ALGORITHMS.map(a => evaluate(a, ctx));
  console.table(results.map(toRow));
  return results;
}

function chooseAlgorithm(meanNdcg) {
  const rows = ALGORITHMS.map(a => ({ name: a.name, difficulty: a.difficulty, ndcg: meanNdcg[a.name] }));
  const best = [...rows].sort((a, b) => b.ndcg - a.ndcg)[0];
  const chosen = rows
    .filter(r => r.ndcg >= best.ndcg * 0.85)
    .sort((a, b) => a.difficulty - b.difficulty || b.ndcg - a.ndcg)[0];

  console.log(`\nНайвища середня якість (nDCG@${CONFIG.K}): ${best.name} — ${best.ndcg.toFixed(3)}`);
  console.log(`ОБРАНО — найпростіший алгоритм з якістю >= 85% від найкращої: ${chosen.name} — ` +
              `${chosen.ndcg.toFixed(3)} (${Math.round(chosen.ndcg / best.ndcg * 100)}% від найкращого, ` +
              `складність ${chosen.difficulty} з 5)`);
  return chosen;
}

function runParams(ctx) {
  header('ВПЛИВ ПАРАМЕТРІВ АЛГОРИТМІВ');

  const experiments = [
    ['Хронологічний: обмеження на автора', 'chronological', [
      ['без обмеження', { maxPerAuthor: Infinity }],
      ['maxPerAuthor = 2', { maxPerAuthor: 2 }],
      ['maxPerAuthor = 1', { maxPerAuthor: 1 }],
    ]],
    ['Випадковий: режим вибірки', 'random', [
      ['рівномірна', { mode: 'uniform' }],
      ['зважена (A-Res)', { mode: 'weighted' }],
    ]],
    ['Популярність: спосіб оцінки', 'popularity', [
      ['лайки', { mode: 'likes' }],
      ['частка лайків', { mode: 'ratio' }],
      ['байєсове середнє', { mode: 'bayes' }],
      ['межа Вілсона', { mode: 'wilson' }],
    ]],
    ['Часове згасання: формула і гравітація', 'timeDecay', [
      ['HN, G = 1.2', { mode: 'hn', gravity: 1.2 }],
      ['HN, G = 1.8', { mode: 'hn', gravity: 1.8 }],
      ['HN, G = 2.5', { mode: 'hn', gravity: 2.5 }],
      ['Reddit Hot', { mode: 'reddit' }],
    ]],
    ['Контентна фільтрація: зважування тегів', 'contentBased', [
      ['бінарні ваги', { useIdf: false }],
      ['TF-IDF', { useIdf: true }],
    ]],
    ['Колаборативна: міра подібності і k', 'collaborative', [
      ['Жаккар, k = 5', { similarity: 'jaccard', neighbours: 5 }],
      ['Жаккар, k = 15', { similarity: 'jaccard', neighbours: 15 }],
      ['Жаккар, k = 40', { similarity: 'jaccard', neighbours: 40 }],
      ['косинус IUF, k = 15', { similarity: 'cosine', neighbours: 15 }],
    ]],
    ['Гібридна: переранжування MMR', 'hybrid', [
      ['без MMR', { useMMR: false }],
      ['MMR, λ = 0.85', { useMMR: true, mmrLambda: 0.85 }],
      ['MMR, λ = 0.6', { useMMR: true, mmrLambda: 0.6 }],
      ['лише контент', { useMMR: false, weights: { content: 1, collaborative: 0, popularity: 0, freshness: 0 } }],
    ]],
    ['ε-greedy: імовірність дослідження', 'epsilonGreedy', [
      ['ε = 0.1, без згасання', { epsilon: 0.1, decay: false }],
      ['ε = 0.2, без згасання', { epsilon: 0.2, decay: false }],
      ['ε = 0.2, зі згасанням', { epsilon: 0.2, decay: true }],
      ['ε = 0.4, без згасання', { epsilon: 0.4, decay: false }],
    ]],
  ];

  const all = {};
  for (const [title, key, variants] of experiments) {
    console.log(`\n--- ${title} ---`);
    const rows = variants.map(([label, opts]) => evaluate(byKey[key], ctx, opts, label));
    console.table(rows.map(toRow).map(r => {
      delete r['Складн.'];
      return r;
    }));
    all[key] = rows;
  }
  return all;
}

function runSeeds(count) {
  header(`СТІЙКІСТЬ РЕЗУЛЬТАТІВ: ${count} НАБОРІВ ДАНИХ`);
  const table = {};
  for (let s = 1; s <= count; s++) {
    const ctx = buildContext(1000 + s);
    for (const a of ALGORITHMS) {
      (table[a.name] ||= []).push(evaluate(a, ctx).ndcg);
    }
  }
  const rows = Object.entries(table).map(([name, values]) => ({
    'Алгоритм': name,
    'nDCG сер.': +mean(values).toFixed(3),
    'Ст. відх.': +std(values).toFixed(3),
    'Мін': +Math.min(...values).toFixed(3),
    'Макс': +Math.max(...values).toFixed(3),
  }));
  console.table(rows);

  const wins = {};
  for (let i = 0; i < count; i++) {
    const winner = Object.entries(table).sort((a, b) => b[1][i] - a[1][i])[0][0];
    wins[winner] = (wins[winner] || 0) + 1;
  }
  console.log('Перемоги за nDCG:', wins);

  const meanNdcg = Object.fromEntries(Object.entries(table).map(([n, v]) => [n, mean(v)]));
  const chosen = chooseAlgorithm(meanNdcg);
  return { rows, wins, table, chosen };
}

const { likeProbability } = require('./data/generator');
const { candidates, rankScores } = require('./lib/ranking');

const oracle = {
  key: 'oracle',
  name: 'Оракул (стеля якості)',
  difficulty: 0,
  recommend(user, ctx) {
    const scores = new Map();
    for (const item of candidates(user, ctx)) {
      scores.set(item.id, likeProbability(user.interests, item));
    }
    return rankScores(scores);
  },
};

function runOracle(count = 10) {
  header('ВЕРХНЯ МЕЖА ЯКОСТІ (ОРАКУЛ)');
  const values = [];
  for (let s = 1; s <= count; s++) values.push(evaluate(oracle, buildContext(1000 + s)).ndcg);
  const single = evaluate(oracle, buildContext());
  console.table([toRow(single)]);
  console.log(`nDCG оракула на ${count} наборах: ${mean(values).toFixed(3)} ± ${std(values).toFixed(3)}`);
}

function printFeed(userId, ctx) {
  const user = ctx.users[userId];
  if (!user) {
    console.log(`Користувача №${userId} не існує (0..${ctx.users.length - 1}).`);
    return;
  }
  header(`СТРІЧКА КОРИСТУВАЧА №${user.id}`);
  console.log(`Справжні інтереси (прихований параметр): ${[...user.interests].join(', ')}`);
  console.log(`Вподобань в історії: ${user.train.size}, приховано для перевірки: ${user.test.size}\n`);

  for (const algo of ALGORITHMS) {
    reseed(CONFIG.SEED + 1);
    const feed = algo.recommend(user, ctx).slice(0, 5);
    console.log(`--- ${algo.name} ---`);
    for (const id of feed) {
      const it = ctx.items[id];
      const mark = user.test.has(id) ? '✔' : ' ';
      let line = `  ${mark} ${it.title.padEnd(16)} [${it.tags.join(', ')}] ` +
                 `♥${it.likes}, ${it.ageHours} год тому, автор ${it.authorId}`;
      if (algo.key === 'contentBased') {
        line += `  ← бо ви любите: ${byKey.contentBased.explain(user, it, ctx).join(', ')}`;
      }
      console.log(line);
    }
    console.log('');
  }

  const chrono = byKey.chronological;
  const page1 = chrono.recommend(user, ctx);
  const cursor = chrono.nextCursor(page1, ctx);
  const page2 = chrono.recommend(user, ctx, { cursor });
  console.log(`Хронологічна стрічка, сторінка 2 (курсор = ${cursor} год): ` +
              page2.slice(0, 5).map(id => `#${id}`).join(', ') + ' ...');
  console.log('✔ — публікація, яку користувач насправді вподобав (влучання).');
}

function main() {
  const args = typeof process !== 'undefined' ? process.argv.slice(2) : [];
  const command = args[0] || 'compare';
  const ctx = buildContext();

  switch (command) {
    case 'compare': runComparison(ctx); runSeeds(10); break;
    case 'params':  runParams(ctx); break;
    case 'seeds':   runSeeds(Number(args[1] || 10)); break;
    case 'feed':    printFeed(Number(args[1] ?? 0), ctx); break;
    case 'oracle':  runOracle(10); break;
    case 'all':
      runComparison(ctx);
      runParams(ctx);
      runSeeds(10);
      runOracle(10);
      printFeed(15, ctx);
      break;
    default:
      console.log('Невідома команда. Доступні: compare, params, seeds N, feed N, all');
  }
}

if (require.main === module) main();

module.exports = { runComparison, runParams, runSeeds, runOracle, printFeed, chooseAlgorithm };
