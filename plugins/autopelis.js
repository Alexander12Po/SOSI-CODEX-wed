// plugins/autopelis.js
import axios from 'axios';

const TMDB_API_KEY = '7cf53f18785d537fe9d70af908066a2c';

// Mapa para guardar los intervalos activos por grupo (en memoria)
const gruposActivos = new Map();

async function obtenerPeliculaAleatoria() {
  const paginaAleatoria = Math.floor(Math.random() * 20) + 1;
  const { data } = await axios.get(
    `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=es-ES&page=${paginaAleatoria}`
  );
  const peliculas = data.results;
  return peliculas[Math.floor(Math.random() * peliculas.length)];
}

async function enviarPelicula(sock, groupId) {
  try {
    const peli = await obtenerPeliculaAleatoria();
    const posterUrl = `https://image.tmdb.org/t/p/w500${peli.poster_path}`;

    const caption = `🎬 *${peli.title}*\n\n⭐ *Calificación:* ${peli.vote_average}/10\n📅 *Estreno:* ${peli.release_date}\n\n📝 *Sinopsis:*\n${peli.overview || 'No disponible.'}`;

    await sock.sendMessage(groupId, {
      image: { url: posterUrl },
      caption
    });
  } catch (error) {
    console.error('Error enviando película automática:', error.message);
  }
}

export default {
  command: ['autopelis'],
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    if (!from.endsWith('@g.us')) {
      await sock.sendMessage(from, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });
      return false;
    }

    const accion = (args[0] || '').toLowerCase();

    if (accion === 'on') {
      if (gruposActivos.has(from)) {
        await sock.sendMessage(from, { text: '⚠️ Ya está activado en este grupo.' }, { quoted: msg });
        return false;
      }

      await enviarPelicula(sock, from);

      const intervalo = setInterval(() => enviarPelicula(sock, from), 2 * 60 * 1000);
      gruposActivos.set(from, intervalo);

      await sock.sendMessage(from, { text: '✅ Activado. Enviaré una película random cada 2 minutos en este grupo.' });

    } else if (accion === 'off') {
      if (!gruposActivos.has(from)) {
        await sock.sendMessage(from, { text: '⚠️ No está activado en este grupo.' }, { quoted: msg });
        return false;
      }

      clearInterval(gruposActivos.get(from));
      gruposActivos.delete(from);

      await sock.sendMessage(from, { text: '🛑 Desactivado. Ya no se enviarán películas automáticas aquí.' });

    } else {
      await sock.sendMessage(from, {
        text: '❓ Uso: *.autopelis on* para activar, *.autopelis off* para desactivar.'
      }, { quoted: msg });
      return false;
    }
  }
};
