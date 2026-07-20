import { createApp } from './app.js';


const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
