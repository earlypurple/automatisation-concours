const express = require('express');
const { fillForm } = require('./form_filler.js');

const app = express();
const port = 3000;

app.use(express.json());

app.post('/fill-form', async (req, res) => {
  const { url, userData, config } = req.body;

  if (!url || !userData) {
    return res.status(400).json({ success: false, error: 'Missing url or userData' });
  }

  try {
    const result = await fillForm(url, userData, config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Scraper server listening at http://localhost:${port}`);
});
