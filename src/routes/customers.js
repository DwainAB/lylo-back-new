'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try { res.json(await db.getAllCustomers()); } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const c = await db.getCustomerById(req.params.id);
    if (!c) return res.status(404).json({ detail: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json(await db.createCustomer(req.body)); } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const c = await db.updateCustomer(req.params.id, req.body);
    if (!c) return res.status(404).json({ detail: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await db.deleteCustomer(req.params.id);
    if (!ok) return res.status(404).json({ detail: 'Not found' });
    res.json({ status: 'ok' });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

module.exports = router;
