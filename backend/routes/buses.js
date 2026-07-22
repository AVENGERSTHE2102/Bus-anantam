const express = require('express');
const Bus = require('../models/Bus');

const router = express.Router();

router.get('/', async (req, res) => {
  res.json(await Bus.find());
});

module.exports = router;
