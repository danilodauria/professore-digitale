/* ==============================================================================
 *  PROFESSORE DIGITALE - Piccolo generatore di QR code (nessuna libreria esterna)
 *  Modalità byte, correzione degli errori M (circa 15%), versioni da 1 a 6 (fino a 106 byte):
 *  basta per indirizzi come http://192.168.100.200:8768/?c=123456.
 *  Segue la norma ISO/IEC 18004: Reed-Solomon su GF(256), maschera scelta con le penalità.
 *  API: PD.qr.matrice(testo) -> {size, m: [[true|false]]};  PD.qr.svg(testo, lato_px) -> "<svg…>".
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD = window.PD || {};

  /* --- aritmetica di GF(256) con il polinomio 0x11D --- */
  var EXP = [], LOG = [], i, x = 1;
  for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }

  function generatore(n) {            // coefficienti dal grado più alto: [1, g1, …, gn]
    var g = [1], k, j;
    for (k = 0; k < n; k++) {
      var ng = [];
      for (j = 0; j <= g.length; j++) ng.push(0);
      for (j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[k]); }
      g = ng;
    }
    return g;
  }
  function correzione(dati, n) {      // resto della divisione: i codici di correzione
    var g = generatore(n), r = [], k, j;
    for (j = 0; j < n; j++) r.push(0);
    for (k = 0; k < dati.length; k++) {
      var f = dati[k] ^ r.shift(); r.push(0);
      for (j = 0; j < n; j++) r[j] ^= mul(g[j + 1], f);
    }
    return r;
  }

  /* --- livello M: [blocchi, dati per blocco, correzione per blocco]; allineamento --- */
  var TAB = [null, [1, 16, 10], [1, 28, 16], [1, 44, 26], [2, 32, 18], [2, 43, 24], [4, 27, 16]];
  var ALL = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

  function utf8(s) {
    var b = unescape(encodeURIComponent(String(s))), out = [];
    for (var k = 0; k < b.length; k++) out.push(b.charCodeAt(k));
    return out;
  }

  function codifica(byte, ver) {
    var t = TAB[ver], capienza = t[0] * t[1], bit = [], k;
    function metti(v, n) { for (var j = n - 1; j >= 0; j--) bit.push((v >>> j) & 1); }
    metti(4, 4); metti(byte.length, 8);
    for (k = 0; k < byte.length; k++) metti(byte[k], 8);
    metti(0, Math.min(4, capienza * 8 - bit.length));
    while (bit.length % 8) bit.push(0);
    var dati = [];
    for (k = 0; k < bit.length; k += 8) {
      var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bit[k + j];
      dati.push(v);
    }
    for (k = 0; dati.length < capienza; k++) dati.push(k % 2 ? 0x11 : 0xec);
    // blocchi, correzione e intreccio
    var blocchi = [], ec = [];
    for (k = 0; k < t[0]; k++) { var bl = dati.slice(k * t[1], (k + 1) * t[1]); blocchi.push(bl); ec.push(correzione(bl, t[2])); }
    var out = [];
    for (k = 0; k < t[1]; k++) for (j = 0; j < t[0]; j++) out.push(blocchi[j][k]);
    for (k = 0; k < t[2]; k++) for (j = 0; j < t[0]; j++) out.push(ec[j][k]);
    return out;
  }

  function vuota(n, v) { var m = [], r, c; for (r = 0; r < n; r++) { m.push([]); for (c = 0; c < n; c++) m[r].push(v); } return m; }

  function base(ver) {
    var n = 17 + 4 * ver, m = vuota(n, false), f = vuota(n, false), k;
    function set(r, c, v) { if (r >= 0 && r < n && c >= 0 && c < n) { m[r][c] = v; f[r][c] = true; } }
    function cercatore(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var bordo = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        set(r0 + dr, c0 + dc, bordo !== 2 && bordo !== 4);
      }
    }
    cercatore(0, 0); cercatore(0, n - 7); cercatore(n - 7, 0);
    for (k = 8; k < n - 8; k++) { set(6, k, k % 2 === 0); set(k, 6, k % 2 === 0); }
    var p = ALL[ver];
    for (var a = 0; a < p.length; a++) for (var b = 0; b < p.length; b++) {
      if ((a === 0 && b === 0) || (a === 0 && b === p.length - 1) || (a === p.length - 1 && b === 0)) continue;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) set(p[a] + dr, p[b] + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    // spazio riservato al formato e modulo scuro
    for (k = 0; k < 9; k++) if (k !== 6) { set(8, k, false); set(k, 8, false); }
    for (k = 0; k < 8; k++) { set(8, n - 1 - k, false); set(n - 1 - k, 8, false); }
    set(n - 8, 8, true);
    return { n: n, m: m, f: f };
  }

  function posiziona(q, cw) {
    var n = q.n, k = 0, tot = cw.length * 8;
    for (var destra = n - 1; destra >= 1; destra -= 2) {
      if (destra === 6) destra = 5;
      for (var v = 0; v < n; v++) for (var j = 0; j < 2; j++) {
        var c = destra - j, su = ((destra + 1) & 2) === 0, r = su ? n - 1 - v : v;
        if (!q.f[r][c]) { q.m[r][c] = k < tot ? ((cw[k >> 3] >>> (7 - (k & 7))) & 1) === 1 : false; k++; }
      }
    }
  }

  var MASCHERE = [
    function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
    function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
  ];

  function formato(q, maschera) {
    var dati = maschera, rem = dati, k, n = q.n;     // livello M = 00
    for (k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var b = ((dati << 10) | rem) ^ 0x5412;
    function bit(i) { return ((b >>> i) & 1) === 1; }
    for (k = 0; k <= 5; k++) q.m[k][8] = bit(k);
    q.m[7][8] = bit(6); q.m[8][8] = bit(7); q.m[8][7] = bit(8);
    for (k = 9; k < 15; k++) q.m[8][14 - k] = bit(k);
    for (k = 0; k < 8; k++) q.m[8][n - 1 - k] = bit(k);
    for (k = 8; k < 15; k++) q.m[n - 15 + k][8] = bit(k);
    q.m[n - 8][8] = true;
  }

  function penalita(m) {
    var n = m.length, p = 0, r, c, k;
    function righe(get) {
      for (var a = 0; a < n; a++) {
        var run = 1, riga = [];
        for (var b = 0; b < n; b++) riga.push(get(a, b));
        for (b = 1; b <= n; b++) {
          if (b < n && riga[b] === riga[b - 1]) run++;
          else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
        // motivi simili ai cercatori: 1011101 con 4 moduli chiari da una parte
        var s = riga.map(function (v) { return v ? "1" : "0"; }).join(""), t = "0000" + s + "0000", i0 = -1;
        while ((i0 = t.indexOf("10111010000", i0 + 1)) >= 0) p += 40;
        i0 = -1;
        while ((i0 = t.indexOf("00001011101", i0 + 1)) >= 0) p += 40;
      }
    }
    righe(function (a, b) { return m[a][b]; });
    righe(function (a, b) { return m[b][a]; });
    for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) {
      k = m[r][c]; if (k === m[r][c + 1] && k === m[r + 1][c] && k === m[r + 1][c + 1]) p += 3;
    }
    var scuri = 0;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) scuri++;
    p += (Math.ceil(Math.abs(scuri * 20 - n * n * 10) / (n * n)) - 1) * 10;
    return p;
  }

  function matrice(testo) {
    var byte = utf8(testo), ver;
    for (ver = 1; ver <= 6; ver++) if (byte.length <= TAB[ver][0] * TAB[ver][1] - 2) break;
    if (ver > 6) throw new Error("testo troppo lungo per il QR code");
    var cw = codifica(byte, ver), migliore = null, minimo = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      var q = base(ver);
      posiziona(q, cw);
      for (var r = 0; r < q.n; r++) for (var c = 0; c < q.n; c++) if (!q.f[r][c] && MASCHERE[mk](r, c)) q.m[r][c] = !q.m[r][c];
      formato(q, mk);
      var p = penalita(q.m);
      if (p < minimo) { minimo = p; migliore = q; }
    }
    return { size: migliore.n, versione: ver, m: migliore.m };
  }

  function svg(testo, lato) {
    var q = matrice(testo), z = 4, n = q.size + 2 * z, d = [];
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) if (q.m[r][c]) d.push("M" + (c + z) + " " + (r + z) + "h1v1h-1z");
    return '<svg xmlns="http://www.w3.org/2000/svg" class="pd-qr" viewBox="0 0 ' + n + " " + n + '"' + (lato ? ' width="' + lato + '" height="' + lato + '"' : "") +
      ' shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path fill="#000" d="' + d.join("") + '"/></svg>';
  }

  PD.qr = { matrice: matrice, svg: svg };
})();
