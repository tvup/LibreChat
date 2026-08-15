const express = require('express');
const { adminLogService } = require('@librechat/api');

const router = express.Router();

// Temporary debug endpoint - REMOVE AFTER DEBUGGING
router.get('/debug-stores', async (req, res) => {
  try {
    const getLogStores = require('~/cache/getLogStores');
    const { ViolationTypes } = require('librechat-data-provider');
    const debug = {};

    for (const vt of Object.values(ViolationTypes)) {
      try {
        const store = getLogStores(vt);
        const inner = store.opts?.store;
        debug[vt] = {
          storeType: inner?.constructor?.name,
          hasSize: typeof inner?.size,
          sizeValue: inner?.size,
          hasKeys: typeof inner?.keys,
          storeKeys: inner && typeof inner.keys === 'function' ? Array.from(inner.keys()).slice(0, 5) : [],
          optsKeys: Object.keys(store.opts || {}),
        };
      } catch (e) {
        debug[vt] = { error: e.message };
      }
    }
    res.json(debug);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/violations', async (req, res) => {
  try {
    const getLogStores = require('~/cache/getLogStores');
    const { ViolationTypes } = require('librechat-data-provider');
    const results = [];

    for (const violationType of Object.values(ViolationTypes)) {
      try {
        const store = getLogStores(violationType);
        let count = 0;
        const innerStore = store.opts?.store;

        if (innerStore && typeof innerStore.iterator === 'function') {
          const ns = store.opts?.namespace;
          const iterator = innerStore.iterator(ns);
          if (iterator) {
            for await (const _entry of iterator) {
              count++;
            }
          }
        }

        results.push({ type: violationType, count });
      } catch {
        results.push({ type: violationType, count: 0 });
      }
    }

    res.status(200).json(results.sort((a, b) => b.count - a.count));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching violation logs' });
  }
});

router.get('/system-info', async (req, res) => {
  try {
    const info = adminLogService.getSystemInfo();
    res.status(200).json(info);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching system info' });
  }
});

module.exports = router;
