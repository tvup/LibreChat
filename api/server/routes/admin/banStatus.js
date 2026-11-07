const mongoose = require('mongoose');
const { Keyv } = require('keyv');
const { keyvMongo } = require('@librechat/api');
const { CacheKeys, ViolationTypes } = require('librechat-data-provider');
const { deleteAllUserSessions } = require('~/models');
const getLogStores = require('~/cache/getLogStores');

/**
 * Admin-ban helpers.
 *
 * Et ban ligger to steder i Mongo-collectionen `logs` (via keyvMongo):
 *  - `BANS:<userId>`: selve ban-loggen (getLogStores(ViolationTypes.BAN))
 *  - `ban:<userId>`:  checkBan-middlewarens cache, skrevet første gang brugeren afvises
 * Status læses fra begge, så GUI'en viser det samme som det, der faktisk håndhæves.
 */

const USER_ID = /^[0-9a-f]{24}$/;
const LOG_PREFIX = `${CacheKeys.BANS}:`;
const CACHE_PREFIX = `${ViolationTypes.BAN}:`;

/** "Permanent" ban = 100 år. Holder hele ban-flowet (TTL, checkBan, status) uændret. */
const PERMANENT_BAN_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/**
 * Læser varighed fra et ban-request: `{ permanent: true }` eller `{ duration: <minutter> }`.
 * Returnerer null ved ugyldig varighed.
 */
function parseBanDuration(body) {
  if (body?.permanent === true) {
    return PERMANENT_BAN_MS;
  }
  const minutes = Number(body?.duration);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60000 : null;
}

const banCache = new Keyv({ store: keyvMongo, namespace: ViolationTypes.BAN, ttl: 0 });

const isValidUserId = (id) => typeof id === 'string' && USER_ID.test(id);

/** Keyv gemmer `{"value": ..., "expires": ...}` som JSON-streng */
function parseBanExpiry(doc, now) {
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= now) {
    return null;
  }
  try {
    const raw = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
    const data = raw?.value ?? raw;
    const expiresAt = Number(data?.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      return null;
    }
    return expiresAt;
  } catch {
    return null;
  }
}

/**
 * Returnerer aktive bruger-ban som Map<userId, expiresAt (ms)>.
 * Uden `userIds` returneres alle aktive bruger-ban (IP-ban tælles ikke med).
 */
async function getActiveUserBans(userIds) {
  const now = Date.now();
  let filter;
  if (Array.isArray(userIds)) {
    const ids = userIds.filter(isValidUserId);
    if (ids.length === 0) {
      return new Map();
    }
    filter = {
      key: { $in: ids.flatMap((id) => [`${LOG_PREFIX}${id}`, `${CACHE_PREFIX}${id}`]) },
    };
  } else {
    filter = { key: { $regex: `^(${LOG_PREFIX}|${CACHE_PREFIX})[0-9a-f]{24}$` } };
  }

  const docs = await mongoose.connection.db
    .collection('logs')
    .find(filter, { projection: { key: 1, value: 1, expiresAt: 1 } })
    .toArray();

  const bans = new Map();
  for (const doc of docs) {
    const userId = doc.key.slice(doc.key.indexOf(':') + 1);
    const expiresAt = parseBanExpiry(doc, now);
    if (expiresAt && expiresAt > (bans.get(userId) ?? 0)) {
      bans.set(userId, expiresAt);
    }
  }
  return bans;
}

/**
 * Udelukker en bruger i `durationMs` og logger brugeren ud af alle sessioner,
 * så ban'et virker med det samme og ikke kun ved næste login.
 */
async function banUser(userId, durationMs) {
  const banLogs = getLogStores(ViolationTypes.BAN);
  const expiresAt = Date.now() + durationMs;
  // TTL sendes eksplicit — ellers bruger Keyv BAN_DURATION (default 2 timer).
  await banLogs.set(
    userId,
    {
      type: 'admin_ban',
      violation_count: 0,
      duration: durationMs,
      expiresAt,
      permanent: durationMs >= PERMANENT_BAN_MS,
    },
    durationMs,
  );
  await deleteAllUserSessions({ userId });
  return expiresAt;
}

/** Ophæver et ban både i ban-loggen og i checkBan-cachen */
async function unbanUser(userId) {
  const banLogs = getLogStores(ViolationTypes.BAN);
  await Promise.all([
    banLogs.delete(userId),
    banCache.delete(userId),
    banCache.delete(`ban_cache:user:${userId}`),
  ]);
}

module.exports = { parseBanDuration, isValidUserId, getActiveUserBans, banUser, unbanUser };
