'use strict';

const CONFIG = require('../config');
const { reseed, random, randInt, sample, shuffle } = require('../lib/random');

function generateItems() {
  const items = [];
  for (let id = 0; id < CONFIG.ITEMS; id++) {
    items.push({
      id,
      title: `Публікація #${id}`,
      authorId: randInt(0, CONFIG.AUTHORS - 1),
      tags: sample(CONFIG.TAGS, randInt(1, 3)),
      ageHours: Math.round(random() * CONFIG.MAX_AGE_HOURS),
      quality: random(),
      likes: 0,
      views: 0,
    });
  }
  return items;
}

function likeProbability(interests, item) {
  const overlap = item.tags.filter(t => interests.has(t)).length;
  let p = overlap > 0 ? 0.12 * overlap : 0.01;
  p *= 0.5 + item.quality;
  p *= 0.5 + 0.5 * (1 - item.ageHours / CONFIG.MAX_AGE_HOURS);
  return p;
}

function generateUsers(items) {
  const users = [];
  for (let id = 0; id < CONFIG.USERS; id++) {
    const interests = new Set(sample(CONFIG.TAGS, randInt(2, 3)));
    const liked = items.filter(item => random() < likeProbability(interests, item))
                       .map(item => item.id);

    const mixed = shuffle(liked);
    const testSize = Math.max(1, Math.round(mixed.length * CONFIG.TEST_SHARE));
    users.push({
      id,
      interests,
      test: new Set(mixed.slice(0, testSize)),
      train: new Set(mixed.slice(testSize)),
    });
  }
  return users;
}

function buildContext(seed = CONFIG.SEED) {
  reseed(seed);
  const items = generateItems();
  const users = generateUsers(items);

  for (const user of users) {
    for (const id of user.train) items[id].likes++;
  }
  for (const item of items) {
    item.views = item.likes + item.likes * randInt(3, 12) + randInt(5, 60);
  }

  const tagDf = {};
  for (const item of items) {
    for (const tag of item.tags) tagDf[tag] = (tagDf[tag] || 0) + 1;
  }

  return {
    items,
    users,
    tagDf,
    maxLikes: Math.max(...items.map(i => i.likes)) || 1,
  };
}

module.exports = { buildContext, likeProbability };
