// import express from 'express';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// const distDir = path.join(__dirname, 'dist');

// app.use(express.json()); // Add JSON parsing
// app.use(express.static(distDir));

// let simulationState = {}; // Store latest simulation state

// app.post('/api/simulation', (req, res) => {
//   simulationState = req.body;
//   res.status(200).send('OK');
// });

// app.get('/api/simulation', (req, res) => {
//   res.json(simulationState);
// });

// app.get('*', (req, res) => {
//   res.sendFile(path.join(distDir, 'index.html'));
// });

// const port = process.env.PORT || 5174;
// app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
