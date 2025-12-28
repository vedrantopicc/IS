import 'dotenv/config';
import app from "./app.js";
console.log('Provera: process.env.DB_HOST =', process.env.DB_HOST);
console.log('Provera: process.env.DB_PASSWORD =', process.env.DB_PASSWORD);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
