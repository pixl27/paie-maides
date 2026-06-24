/**
 * Implémentation compacte de sprintf type C/PHP, pour la fonction maides `formate()`.
 * Gère les drapeaux ( - + espace 0 # ), la largeur, la précision et les
 * spécificateurs d i u f F s x X o b e E g G c %.
 */

export function sprintf(format: string, ...args: any[]): string {
  let argIndex = 0;
  const re = /%(?:(\d+)\$)?([-+ 0#]*)(\d+)?(?:\.(\d+))?([diuxXobfFeEgGsc%])/g;

  return format.replace(re, (_match, argnum, flags, width, precision, spec) => {
    if (spec === '%') return '%';

    const value = argnum !== undefined ? args[Number(argnum) - 1] : args[argIndex++];
    const w = width !== undefined ? parseInt(width, 10) : 0;
    const p = precision !== undefined ? parseInt(precision, 10) : undefined;
    const leftAlign = flags.includes('-');
    const zeroPad = flags.includes('0') && !leftAlign;
    const plusSign = flags.includes('+');
    const spaceSign = flags.includes(' ');

    let out: string;
    let isNegative = false;
    let numeric = false;

    switch (spec) {
      case 'd':
      case 'i':
      case 'u': {
        numeric = true;
        const n = Math.trunc(Number(value) || 0);
        isNegative = n < 0;
        out = Math.abs(n).toString();
        break;
      }
      case 'x':
        out = (Math.trunc(Number(value) || 0) >>> 0).toString(16);
        break;
      case 'X':
        out = (Math.trunc(Number(value) || 0) >>> 0).toString(16).toUpperCase();
        break;
      case 'o':
        out = (Math.trunc(Number(value) || 0) >>> 0).toString(8);
        break;
      case 'b':
        out = (Math.trunc(Number(value) || 0) >>> 0).toString(2);
        break;
      case 'f':
      case 'F': {
        numeric = true;
        const n = Number(value) || 0;
        isNegative = n < 0;
        out = Math.abs(n).toFixed(p === undefined ? 6 : p);
        break;
      }
      case 'e':
      case 'E': {
        numeric = true;
        const n = Number(value) || 0;
        isNegative = n < 0;
        out = Math.abs(n).toExponential(p === undefined ? 6 : p);
        if (spec === 'E') out = out.toUpperCase();
        break;
      }
      case 'g':
      case 'G': {
        numeric = true;
        const n = Number(value) || 0;
        isNegative = n < 0;
        out = String(Math.abs(n));
        break;
      }
      case 'c':
        out = String.fromCharCode(Number(value));
        break;
      case 's':
      default: {
        out = value === undefined || value === null ? '' : String(value);
        if (p !== undefined) out = out.slice(0, p);
        break;
      }
    }

    let sign = '';
    if (numeric) {
      if (isNegative) sign = '-';
      else if (plusSign) sign = '+';
      else if (spaceSign) sign = ' ';
    }

    const totalLen = sign.length + out.length;
    if (w > totalLen) {
      const padLen = w - totalLen;
      if (leftAlign) {
        return sign + out + ' '.repeat(padLen);
      }
      if (zeroPad && numeric) {
        return sign + '0'.repeat(padLen) + out;
      }
      return ' '.repeat(padLen) + sign + out;
    }
    return sign + out;
  });
}
