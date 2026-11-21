import { config } from './config.js';
import { crearApp } from './app.js';

crearApp().listen(config.port, () => {
  console.log(`API de Carterita escuchando en el puerto ${config.port}`);
});
