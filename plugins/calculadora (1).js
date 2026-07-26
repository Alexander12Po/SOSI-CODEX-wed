import { botConfig } from '../config.js';

function extraerComando(body) {
  // body llega como ".sumar 5 3" -> extraemos "sumar"
  const sinPrefijo = body.slice(botConfig.prefix.length).trim();
  return sinPrefijo.split(/ +/)[0].toLowerCase();
}

function esNumeroValido(n) {
  return n !== undefined && n !== '' && !isNaN(Number(n));
}

export default {
  command: ['sumar', 'restar', 'multiplicar', 'dividir', 'calcular'],
  cost: 0,
  async exec({ sock, msg, from, args, body }) {
    const cmd = extraerComando(body);

    // Modo "calcular": .calcular 5 + 3  |  .calcular 10 * 2
    if (cmd === 'calcular') {
      if (args.length < 3) {
        await sock.sendMessage(from, {
          text: '📐 Uso: *.calcular <número> <operador> <número>*\nEjemplo: *.calcular 5 + 3*\nOperadores: + - * /'
        }, { quoted: msg });
        return false;
      }

      const [a, operador, b] = args;
      if (!esNumeroValido(a) || !esNumeroValido(b)) {
        await sock.sendMessage(from, { text: '❌ Ingresa números válidos.' }, { quoted: msg });
        return false;
      }

      const numA = Number(a);
      const numB = Number(b);
      let resultado;

      switch (operador) {
        case '+': resultado = numA + numB; break;
        case '-': resultado = numA - numB; break;
        case '*': case 'x': resultado = numA * numB; break;
        case '/':
          if (numB === 0) {
            await sock.sendMessage(from, { text: '❌ No se puede dividir entre cero.' }, { quoted: msg });
            return false;
          }
          resultado = numA / numB;
          break;
        default:
          await sock.sendMessage(from, { text: '❌ Operador no válido. Usa + - * /' }, { quoted: msg });
          return false;
      }

      await sock.sendMessage(from, { text: `🧮 Resultado: *${resultado}*` }, { quoted: msg });
      return true;
    }

    // Modo directo: .sumar 5 3  |  .restar 10 4  |  .multiplicar 6 7  |  .dividir 20 5
    if (args.length < 2) {
      await sock.sendMessage(from, {
        text: `📐 Uso: *.${cmd} <número1> <número2>*\nEjemplo: *.${cmd} 5 3*`
      }, { quoted: msg });
      return false;
    }

    const [a, b] = args;
    if (!esNumeroValido(a) || !esNumeroValido(b)) {
      await sock.sendMessage(from, { text: '❌ Ingresa números válidos.' }, { quoted: msg });
      return false;
    }

    const numA = Number(a);
    const numB = Number(b);
    let resultado;
    let simbolo;

    switch (cmd) {
      case 'sumar':
        resultado = numA + numB;
        simbolo = '+';
        break;
      case 'restar':
        resultado = numA - numB;
        simbolo = '-';
        break;
      case 'multiplicar':
        resultado = numA * numB;
        simbolo = '*';
        break;
      case 'dividir':
        if (numB === 0) {
          await sock.sendMessage(from, { text: '❌ No se puede dividir entre cero.' }, { quoted: msg });
          return false;
        }
        resultado = numA / numB;
        simbolo = '/';
        break;
    }

    await sock.sendMessage(from, {
      text: `🧮 ${numA} ${simbolo} ${numB} = *${resultado}*`
    }, { quoted: msg });
    return true;
  }
};
