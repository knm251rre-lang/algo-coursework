'use strict';

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const key in a) {
    na += a[key] * a[key];
    if (key in b) dot += a[key] * b[key];
  }
  for (const key in b) nb += b[key] * b[key];
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function minMaxNormalize(map) {
  let min = Infinity, max = -Infinity;
  for (const v of map.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  const out = new Map();
  for (const [k, v] of map) out.set(k, range > 0 ? (v - min) / range : 0);
  return out;
}

function wilsonLowerBound(positive, n, z = 1.96) {
  if (n === 0) return 0;
  const p = positive / n;
  const z2 = z * z;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return (centre - margin) / (1 + z2 / n);
}

function mean(arr) {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

module.exports = { cosine, jaccard, minMaxNormalize, wilsonLowerBound, mean, std };
