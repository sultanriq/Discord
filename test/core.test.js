process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const { monthKey, shuffle } = require('../src/utils');
const { nextTopic } = require('../src/features/daily');
const TOPICS = require('../src/data/topics');
const cron = require('node-cron');
const WEEKLY = require('../src/data/weekly');

test('monthKey handles offsets and year rollover', () => {
  const d = new Date('2026-01-15T05:00:00Z');
  assert.strictEqual(monthKey(d), '2026-01');
  assert.strictEqual(monthKey(d, -1), '2025-12');
  // 31 Dis 20:00 UTC = 1 Jan 04:00 MYT
  assert.strictEqual(monthKey(new Date('2025-12-31T20:00:00Z')), '2026-01');
});

test('leaderboard ranks by points (messages + voice/10 + bonus)', () => {
  const db = open(':memory:');
  const m = '2026-11';
  db.addMessage('g', 'a', m, 10);
  db.addVoice('g', 'b', m, 150); // 15 mata
  db.addBonus('g', 'c', m, 20);
  db.addMessage('g', 'old', '2026-10', 999);
  const top = db.top('g', m);
  assert.deepStrictEqual(top.map((r) => [r.user_id, r.points]), [['c', 20], ['b', 15], ['a', 10]]);
  assert.strictEqual(db.rankOf('g', m, 15), 2);
  assert.strictEqual(db.top('g', m, 2).length, 2);
});

test('party persistence round-trip', () => {
  const db = open(':memory:');
  db.createParty({ message_id: '1', guild_id: 'g', channel_id: 'c', host_id: 'h', mode: 'Ranked', rank: 'epic', slots: 5, lanes: 'mid', note: null, members: ['h'], created_at: 0 });
  const p = db.getParty('1');
  p.members.push('x'); p.status = 'full';
  db.saveParty(p);
  assert.deepStrictEqual(db.getParty('1').members, ['h', 'x']);
  assert.strictEqual(db.expiredParties(1).length, 1);
});

test('daily topics cycle without repeats', () => {
  const db = open(':memory:');
  const seen = new Set();
  for (let i = 0; i < TOPICS.length; i++) seen.add(nextTopic(db, 'g').topic);
  assert.strictEqual(seen.size, TOPICS.length);
});

test('shuffle keeps elements', () => {
  assert.deepStrictEqual(shuffle([1, 2, 3, 4]).sort(), [1, 2, 3, 4]);
});

test('weekly cron expressions & polls are valid', () => {
  for (const e of WEEKLY.schedule) {
    assert.ok(cron.validate(e.cron), e.cron);
    if (e.drawCron) assert.ok(cron.validate(e.drawCron));
  }
  for (const p of WEEKLY.polls) assert.ok(p.a.length >= 2 && p.a.length <= 10 && p.q.length <= 300);
});

test('slash command definitions are valid', () => {
  const { definitions, handlers } = require('../src/commands');
  for (const d of definitions) {
    const json = d.toJSON();
    assert.ok(handlers[json.name], `handler for ${json.name}`);
  }
});
