# -*- coding: utf-8 -*-
# ==============================================================================
#  Professore Digitale - «Condividi con i tablet dell'aula» (dalla 3.4)
#  Autore: Danilo D'Auria - Licenza MIT
#
#  SPENTA per impostazione predefinita. Si accende SOLO dal PC stesso (API locale /api/tablet,
#  impostazione tabletCondividi). Accesa, il server apre un SECONDO ascolto su tutte le interfacce,
#  porta 8768 (PD_TABLET_PORT nei test), che:
#    * accetta solo indirizzi IP privati (10/8, 172.16/12, 192.168/16, 169.254/16; il loopback solo
#      con PD_TABLET_LOOPBACK=1, per i test);
#    * controlla Host (deve essere IP:porta di questo PC, cioe' l'indirizzo su cui e' arrivata la
#      connessione) e Origin;
#    * chiede un codice di 6 cifre mostrato sul PC (con un QR code): http://IP:8768/?c=CODICE
#      -> cookie di sessione casuale (HttpOnly, SameSite=Strict, 12 ore) e ritorno a "/";
#      al massimo 10 tentativi al minuto per indirizzo;
#    * con una sessione valida permette SOLO: i file dell'interfaccia (web/), GET /api/status
#      (ridotta, con "ospite": true), GET /api/packs (senza percorsi), GET /api/rete, POST /api/tts,
#      POST /api/chat (poche richieste insieme) e POST /api/ospite/presenza (quadro dell'aula).
#      Tutto il resto risponde 403.
#  I progressi dei tablet restano nel browser del tablet: il PC non salva nulla per loro.
#  Stesse regole in windows/src/pd_tablet.c.
# ==============================================================================
import ipaddress
import os
import re
import secrets
import threading
import time

PORTA_TABLET = int(os.environ.get("PD_TABLET_PORT", "8768"))
LOOPBACK_TEST = os.environ.get("PD_TABLET_LOOPBACK") == "1"
SESSIONE_S = 12 * 3600
MAX_SESSIONI = 60
TENTATIVI_MAX = 10           # tentativi del codice al minuto per indirizzo
CHAT_MAX = 2                 # risposte dell'IA in contemporanea per i tablet
TTS_MAX = 4                  # sintesi vocali in contemporanea per i tablet (oltre: 503, il tablet usa la voce del browser)
MAX_PRESENZA = 64 * 1024
COOKIE = "pd_tablet"

OSPITE_GET = ("/api/status", "/api/packs", "/api/rete")
OSPITE_POST = ("/api/tts", "/api/chat", "/api/ospite/presenza")

_RETI = [ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16")]
_RE_COOKIE = re.compile(r"(?:^|;)\s*" + COOKIE + r"=([0-9a-f]{32})\s*(?:;|$)")


def ip_privato(ip):
    """Solo le reti private IPv4 (e il loopback se lo chiedono i test)."""
    try:
        a = ipaddress.ip_address((ip or "").split("%")[0])
    except ValueError:
        return False
    if getattr(a, "ipv4_mapped", None):
        a = a.ipv4_mapped
    if a.version != 4:
        return False
    if a.is_loopback:
        return LOOPBACK_TEST
    return any(a in n for n in _RETI)


def token_da_cookie(header):
    m = _RE_COOKIE.search(header or "")
    return m.group(1) if m else None


PAGINA_CODICE = u"""<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Professore Digitale - codice</title>
<style>
body{margin:0;font-family:"DejaVu Sans",Arial,sans-serif;background:#f4f1ea;color:#1d2433;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border-radius:18px;box-shadow:0 6px 24px rgba(0,0,0,.12);padding:2rem 1.6rem;max-width:26rem;margin:1rem;text-align:center}
h1{font-size:1.6rem;margin:.2rem 0 1rem}p{font-size:1.25rem;line-height:1.45}
input{font-size:2.2rem;letter-spacing:.3em;text-align:center;width:11rem;padding:.4rem;border:3px solid #2f5d8a;border-radius:12px}
button{font-size:1.4rem;margin-top:1rem;padding:.7rem 2rem;border:0;border-radius:12px;background:#2f5d8a;color:#fff}
.err{color:#a01818;font-weight:bold}
</style></head><body><main>
<h1>&#128241; Professore Digitale</h1>
<p>Inserite il codice che vedete sullo schermo del facilitatore.</p>
@ERRORE@<form method="get" action="/"><input name="c" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" autofocus aria-label="Codice di 6 cifre"><br>
<button type="submit">Entra</button></form>
</main></body></html>
"""
CSP_CODICE = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
ERRORI = {"sbagliato": u"Il codice non è giusto. Controllate le cifre e riprovate.",
          "troppi": u"Troppi tentativi. Aspettate un minuto e riprovate.",
          "scaduto": u"Il collegamento è scaduto o il codice è cambiato: inserite il nuovo codice."}


def pagina_codice(errore=""):
    msg = ERRORI.get(errore, "")
    return PAGINA_CODICE.replace("@ERRORE@", '<p class="err" role="alert">%s</p>\n' % msg if msg else "")


class Condivisione(object):
    """Stato della condivisione con i tablet (una sola per server)."""

    def __init__(self, log, indirizzi):
        self.log = log
        self.indirizzi = indirizzi          # funzione: IP IPv4 di questo PC
        self.lock = threading.Lock()
        self.porta = PORTA_TABLET
        self.attivo = False
        self.codice = ""
        self.errore = ""
        self.sessioni = {}                  # token -> {id, ip, creata, visto, nome, pagina}
        self.tentativi = {}                 # ip -> [istanti]
        self.server = None
        self.fabbrica = None                # funzione (porta) -> server HTTP con il gestore dei tablet
        self.chat = threading.BoundedSemaphore(CHAT_MAX)
        self.tts = threading.BoundedSemaphore(TTS_MAX)

    # ------------------------------------------------------------------ accensione (solo dal PC)
    def accendi(self):
        with self.lock:
            if self.attivo and self.server:
                return True
            try:
                srv = self.fabbrica(self.porta)
            except OSError as e:
                self.errore = "la porta %d è occupata o bloccata (%s)" % (self.porta, e)
                self.log("tablet:", self.errore)
                return False
            self.server = srv
            self.attivo = True
            self.errore = ""
            self.codice = self._nuovo_codice()
            self.sessioni = {}
            self.tentativi = {}
        threading.Thread(target=srv.serve_forever, kwargs={"poll_interval": 0.3}, daemon=True).start()
        self.log("tablet: condivisione accesa sulla porta", self.porta)
        return True

    def spegni(self):
        with self.lock:
            srv, self.server = self.server, None
            self.attivo = False
            self.codice = ""
            self.sessioni = {}
            self.tentativi = {}
        if srv:
            # si aspetta (al massimo 3 s) che il ciclo dell'ascolto finisca, poi la porta si chiude davvero
            t = threading.Thread(target=srv.shutdown, daemon=True)
            t.start()
            t.join(3)
            srv.server_close()
            self.log("tablet: condivisione spenta")

    def cambia_codice(self):
        with self.lock:
            if self.attivo:
                self.codice = self._nuovo_codice()
                self.sessioni = {}      # i tablet gia' collegati devono inserire il nuovo codice

    def togli(self, sid):
        with self.lock:
            for t, s in list(self.sessioni.items()):
                if s["id"] == sid:
                    del self.sessioni[t]

    def _nuovo_codice(self):
        c = self.codice
        while c == self.codice:
            c = "%06d" % secrets.randbelow(1000000)
        return c

    # ------------------------------------------------------------------ accesso dei tablet
    def prova_codice(self, ip, codice):
        """Restituisce (esito, token): esito = "ok" | "sbagliato" | "troppi" | "spento"."""
        ora = time.time()
        with self.lock:
            if not self.attivo:
                return "spento", None
            t = [x for x in self.tentativi.get(ip, []) if ora - x < 60]
            if len(t) >= TENTATIVI_MAX:
                self.tentativi[ip] = t
                return "troppi", None
            t.append(ora)
            self.tentativi[ip] = t
            if len(self.tentativi) > 1000:      # niente memoria senza limiti
                self.tentativi = {k: v for k, v in self.tentativi.items() if v and ora - v[-1] < 60}
            if not (isinstance(codice, str) and len(codice) == 6 and codice.isdigit()
                    and secrets.compare_digest(codice, self.codice)):
                return "sbagliato", None
            self._pulisci(ora)
            if len(self.sessioni) >= MAX_SESSIONI:
                vecchio = min(self.sessioni, key=lambda k: self.sessioni[k]["visto"])
                del self.sessioni[vecchio]
            token = secrets.token_hex(16)
            self.sessioni[token] = {"id": secrets.token_hex(4), "ip": ip, "creata": ora, "visto": ora, "nome": "", "pagina": ""}
            return "ok", token

    def _pulisci(self, ora):
        for k in [k for k, s in self.sessioni.items() if ora - s["creata"] > SESSIONE_S]:
            del self.sessioni[k]

    def sessione(self, token, ip):
        """Sessione valida (copia) per il token del cookie, oppure None. Aggiorna l'ultimo accesso."""
        if not token:
            return None
        ora = time.time()
        with self.lock:
            if not self.attivo:
                return None
            s = self.sessioni.get(token)
            if not s or ora - s["creata"] > SESSIONE_S:
                self.sessioni.pop(token, None)
                return None
            s["visto"], s["ip"] = ora, ip
            return dict(s)

    def aggiorna(self, token, nome, pagina):
        with self.lock:
            s = self.sessioni.get(token)
            if s:
                s["nome"], s["pagina"] = nome, pagina

    # ------------------------------------------------------------------ stato per il PC
    def stato(self):
        ora = time.time()
        ips = [ip for ip in self.indirizzi() if ip_privato(ip)]
        if LOOPBACK_TEST:
            ips.append("127.0.0.1")
        with self.lock:
            self._pulisci(ora)
            disp = sorted(({"id": s["id"], "ip": s["ip"], "nome": s["nome"], "pagina": s["pagina"],
                            "fa_s": int(ora - s["visto"])} for s in self.sessioni.values()),
                          key=lambda d: d["fa_s"])
            return {"ok": True, "attivo": self.attivo, "porta": self.porta, "codice": self.codice,
                    "ips": ips, "indirizzi": ["http://%s:%d/?c=%s" % (ip, self.porta, self.codice) for ip in ips] if self.attivo else [],
                    "dispositivi": disp, "errore": self.errore}
