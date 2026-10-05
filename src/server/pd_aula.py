# -*- coding: utf-8 -*-
# ==============================================================================
#  Professore Digitale - Quadro dell'aula (rete locale), connessione a Internet
#  Autore: Danilo D'Auria - Licenza MIT
#
#  L'aula funziona SOLO se l'utente la attiva in Impostazioni (settings.json):
#    aulaRuolo = "facilitatore": questo PC ascolta in rete locale SOLO due indirizzi
#                (/aula/info e /aula/ciao, porta 8766) e risponde alla ricerca (UDP 8767);
#                riceve dai PC degli allievi nome, attivita' e progressi.
#    aulaRuolo = "allievo":      questo PC cerca il PC del facilitatore e gli invia
#                ogni 20 secondi un breve riepilogo (mai le conversazioni).
#  Accetta e invia dati solo verso indirizzi della rete locale (IP privati).
#  L'interfaccia resta sempre e solo su 127.0.0.1.
# ==============================================================================
import ipaddress
import json
import os
import platform
import socket
import threading
import time
import urllib.request

PORTA_AULA = int(os.environ.get("PD_AULA_PORT", "8766"))
PORTA_SCOPERTA = int(os.environ.get("PD_AULA_UDP", "8767"))
DOMANDA = b"PD-AULA?"
MAX_CIAO = 64 * 1024
MAX_CLIENTI = 200
INTERVALLO = 20


def ip_locale(ip):
    try:
        a = ipaddress.ip_address((ip or "").split("%")[0])
    except ValueError:
        return False
    return a.is_private or a.is_loopback or a.is_link_local


def indirizzi_locali():
    """Indirizzi IPv4 di questo computer (senza inviare nulla in rete)."""
    ips = []
    for dest in ("10.255.255.255", "192.168.255.255", "172.31.255.255"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((dest, 1))          # UDP "connect": nessun pacchetto viene spedito
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
        except OSError:
            pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


def nome_pc():
    return (socket.gethostname() or "computer")[:60]


# ------------------------------------------------------------------------------
#  Connessione a Internet: prova leggerissima (solo l'apertura di una connessione,
#  nessun dato inviato) verso server pubblici neutrali. Su richiesta dell'interfaccia.
# ------------------------------------------------------------------------------
_RETE = {"t": 0, "online": False, "via": ""}
_RETE_LOCK = threading.Lock()
BERSAGLI = (("1.1.1.1", 443), ("9.9.9.9", 443), ("8.8.8.8", 53), ("208.67.222.222", 443))


def stato_rete(forza=False):
    with _RETE_LOCK:
        if not forza and time.time() - _RETE["t"] < 45:
            return dict(_RETE)
    online, via = False, ""
    for host, porta in BERSAGLI:
        try:
            s = socket.create_connection((host, porta), timeout=2.5)
            s.close()
            online, via = True, host
            break
        except OSError:
            continue
    with _RETE_LOCK:
        _RETE.update({"t": time.time(), "online": online, "via": via})
        return dict(_RETE)


# ------------------------------------------------------------------------------
#  Stato condiviso
# ------------------------------------------------------------------------------
class Aula(object):
    def __init__(self, data_dir, version, read_settings, log):
        self.data_dir = data_dir
        self.version = version
        self.read_settings = read_settings
        self.log = log
        self.lock = threading.Lock()
        self.ruolo = ""
        self.cfg = {}
        self.clienti = {}
        self.annuncio = {"id": 0, "testo": ""}
        self.presenza = {}          # ultimo stato inviato dall'interfaccia (PC allievo)
        self.server = None          # facilitatore trovato (PC allievo)
        self.ultimo_invio = {"t": 0, "ok": False, "errore": ""}
        self.annuncio_ricevuto = {"id": 0, "testo": ""}
        self._http = None
        self._udp = None
        self._file = os.path.join(data_dir, "aula-clienti.json")
        self._carica()

    # --- persistenza dei clienti visti (facilitatore) ---
    def _carica(self):
        try:
            with open(self._file, encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict):
                self.clienti = {k: v for k, v in d.get("clienti", {}).items() if isinstance(v, dict)}
                a = d.get("annuncio")
                if isinstance(a, dict):
                    self.annuncio = {"id": int(a.get("id", 0)), "testo": str(a.get("testo", ""))[:500]}
        except (OSError, ValueError, TypeError):
            pass

    def _salva(self):
        try:
            tmp = self._file + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"clienti": self.clienti, "annuncio": self.annuncio}, f, ensure_ascii=False)
            os.replace(tmp, self._file)
        except OSError:
            pass

    # --- configurazione letta dalle impostazioni ---
    def applica(self):
        s = self.read_settings() or {}
        ruolo = s.get("aulaRuolo") if s.get("aulaRuolo") in ("facilitatore", "allievo") else ""
        cfg = {"nome": str(s.get("aulaNome") or "Aula")[:60], "codice": str(s.get("aulaCodice") or "")[:12],
               "server": str(s.get("aulaServer") or "").strip()[:100], "allievo": str(s.get("studentName") or "")[:60]}
        with self.lock:
            self.cfg = cfg
            cambiato = ruolo != self.ruolo
            self.ruolo = ruolo
        if cambiato:
            self.log("aula: ruolo", ruolo or "nessuno")
            if ruolo == "facilitatore":
                self._avvia_facilitatore()
            else:
                self._ferma_facilitatore()
            if ruolo != "allievo":
                self.server = None

    def avvia(self):
        self.applica()
        threading.Thread(target=self._ciclo, daemon=True).start()

    def _ciclo(self):
        while True:
            try:
                self.applica()
                if self.ruolo == "allievo":
                    self._invia()
            except Exception as e:   # l'aula non deve mai fermare il Professore
                self.log("aula:", repr(e))
            time.sleep(INTERVALLO if self.ruolo == "allievo" else 5)

    # ------------------------------------------------------------------ facilitatore
    def _avvia_facilitatore(self):
        self._ferma_facilitatore()
        aula = self
        from http.server import BaseHTTPRequestHandler
        try:
            from http.server import ThreadingHTTPServer
        except ImportError:
            from http.server import HTTPServer as ThreadingHTTPServer

        class H(BaseHTTPRequestHandler):
            server_version = "ProfessoreDigitale-Aula"
            protocol_version = "HTTP/1.1"

            def log_message(self, *a):
                pass

            def _send(self, code, obj):
                b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
                self.send_response(code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(b)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(b)

            def _consentito(self):
                return ip_locale(self.client_address[0])

            def do_GET(self):
                if not self._consentito():
                    return self._send(403, {"ok": False})
                if self.path.split("?")[0] == "/aula/info":
                    return self._send(200, aula.info())
                return self._send(404, {"ok": False})

            def do_POST(self):
                if not self._consentito() or self.path.split("?")[0] != "/aula/ciao":
                    return self._send(404, {"ok": False})
                try:
                    n = int(self.headers.get("Content-Length") or 0)
                    if n <= 0 or n > MAX_CIAO:
                        raise ValueError("dimensione")
                    d = json.loads(self.rfile.read(n).decode("utf-8"))
                    codice, risposta = aula.ricevi(d, self.client_address[0])
                except (ValueError, TypeError, AttributeError):
                    return self._send(400, {"ok": False, "error": "richiesta non valida"})
                return self._send(codice, risposta)

        class S(ThreadingHTTPServer):
            daemon_threads = True
            allow_reuse_address = True

        try:
            self._http = S(("0.0.0.0", PORTA_AULA), H)
            threading.Thread(target=self._http.serve_forever, daemon=True).start()
        except OSError as e:
            self._http = None
            self.log("aula: porta %d non disponibile: %s" % (PORTA_AULA, e))
        try:
            u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            u.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            u.bind(("0.0.0.0", PORTA_SCOPERTA))
            u.settimeout(1.0)
            self._udp = u
            threading.Thread(target=self._rispondi_ricerche, args=(u,), daemon=True).start()
        except OSError as e:
            self._udp = None
            self.log("aula: scoperta UDP non disponibile:", e)

    def _ferma_facilitatore(self):
        if self._http:
            h, self._http = self._http, None
            threading.Thread(target=lambda: (h.shutdown(), h.server_close()), daemon=True).start()
        if self._udp:
            try:
                self._udp.close()
            except OSError:
                pass
            self._udp = None

    def _rispondi_ricerche(self, u):
        while self._udp is u:
            try:
                data, addr = u.recvfrom(256)
            except socket.timeout:
                continue
            except OSError:
                return
            if data.strip() == DOMANDA and ip_locale(addr[0]) and self.ruolo == "facilitatore":
                try:
                    u.sendto(json.dumps(self.info()).encode("utf-8"), addr)
                except OSError:
                    pass

    def info(self):
        return {"app": "professore-digitale", "ruolo": "facilitatore", "nome": self.cfg.get("nome", "Aula"),
                "pc": nome_pc(), "versione": self.version, "porta": PORTA_AULA,
                "codice_richiesto": bool(self.cfg.get("codice"))}

    def ricevi(self, d, ip):
        if not isinstance(d, dict):
            raise ValueError("oggetto atteso")
        if self.ruolo != "facilitatore":
            return 503, {"ok": False, "error": "questo PC non è il facilitatore"}
        codice = self.cfg.get("codice")
        if codice and str(d.get("codice", "")) != codice:
            return 403, {"ok": False, "error": "codice dell'aula non corretto"}
        cid = str(d.get("id", ""))[:40]
        if not cid or not all(c.isalnum() or c == "-" for c in cid):
            raise ValueError("id")

        def t(x, n=120):
            return str(x if x is not None else "")[:n]

        def num(x):
            try:
                return max(0, min(10 ** 7, int(x)))
            except (TypeError, ValueError):
                return 0
        p = d.get("progressi") if isinstance(d.get("progressi"), dict) else {}
        att = d.get("attivita") if isinstance(d.get("attivita"), dict) else {}
        sis = d.get("sistema") if isinstance(d.get("sistema"), dict) else {}
        comp = d.get("componenti") if isinstance(d.get("componenti"), dict) else {}
        quiz = [{"titolo": t(q.get("titolo"), 80), "migliore": num(q.get("migliore")), "superata": bool(q.get("superata"))}
                for q in (p.get("quiz") or [])[:20] if isinstance(q, dict)]
        attestati = [{"titolo": t(a.get("titolo"), 80), "data": t(a.get("data"), 20), "punteggio": num(a.get("punteggio"))}
                     for a in (p.get("attestati") or [])[:30] if isinstance(a, dict)]
        rec = {
            "id": cid, "ip": ip, "pc": t(d.get("pc"), 60), "utente": t(d.get("utente"), 60),
            "versione": t(d.get("versione"), 20), "visto": time.time(),
            "sistema": {"os": t(sis.get("os"), 80), "ram_mb": num(sis.get("ram_mb")), "cpus": num(sis.get("cpus")),
                        "arch": t(sis.get("arch"), 20)},
            "componenti": {"ia": t(comp.get("ia"), 60), "voce": t(comp.get("voce"), 60), "microfono": t(comp.get("microfono"), 40)},
            "attivita": {"vista": t(att.get("vista"), 30), "titolo": t(att.get("titolo"), 120), "inattivo_s": num(att.get("inattivo_s"))},
            "progressi": {"lezioni_fatte": num(p.get("lezioni_fatte")), "lezioni_totali": num(p.get("lezioni_totali")),
                          "quiz": quiz, "attestati": attestati, "palestra": num(p.get("palestra"))},
        }
        with self.lock:
            if cid not in self.clienti and len(self.clienti) >= MAX_CLIENTI:
                vecchio = min(self.clienti.values(), key=lambda c: c.get("visto", 0))
                self.clienti.pop(vecchio["id"], None)
            self.clienti[cid] = rec
            self._salva()
            ann = dict(self.annuncio)
        return 200, {"ok": True, "nome": self.cfg.get("nome"), "annuncio": ann}

    def imposta_annuncio(self, testo):
        with self.lock:
            self.annuncio = {"id": int(time.time()), "testo": str(testo or "")[:500]}
            self._salva()
            return dict(self.annuncio)

    def rimuovi(self, cid):
        with self.lock:
            if cid == "*":
                self.clienti = {}
            else:
                self.clienti.pop(str(cid), None)
            self._salva()

    # ------------------------------------------------------------------ allievo
    def aggiorna_presenza(self, d):
        if isinstance(d, dict):
            with self.lock:
                self.presenza = d

    def cerca(self, attesa=1.5):
        """Cerca i PC dei facilitatori nella rete locale (broadcast UDP). Restituisce un elenco."""
        trovati, visti = [], set()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            s.settimeout(0.3)
            dest = {"255.255.255.255"}
            for ip in indirizzi_locali():   # anche il broadcast della propria sottorete /24
                parti = ip.split(".")
                if len(parti) == 4:
                    dest.add(".".join(parti[:3] + ["255"]))
            for d in dest:
                try:
                    s.sendto(DOMANDA, (d, PORTA_SCOPERTA))
                except OSError:
                    pass
            fine = time.time() + attesa
            while time.time() < fine:
                try:
                    data, addr = s.recvfrom(2048)
                except socket.timeout:
                    continue
                except OSError:
                    break
                if addr[0] in visti or not ip_locale(addr[0]):
                    continue
                try:
                    info = json.loads(data.decode("utf-8"))
                except ValueError:
                    continue
                if isinstance(info, dict) and info.get("app") == "professore-digitale":
                    visti.add(addr[0])
                    info["ip"] = addr[0]
                    trovati.append(info)
            s.close()
        except OSError as e:
            self.log("aula: ricerca non riuscita:", e)
        return trovati

    def _indirizzo_server(self):
        manuale = self.cfg.get("server")
        if manuale:
            host = manuale.replace("http://", "").split("/")[0]
            if ":" not in host:
                host += ":%d" % PORTA_AULA
            return host, {"ip": host.split(":")[0], "nome": "", "manuale": True}
        if self.server and time.time() - self.server.get("t", 0) < 300:
            return "%s:%s" % (self.server["ip"], self.server.get("porta", PORTA_AULA)), self.server
        trovati = self.cerca()
        if trovati:
            srv = dict(trovati[0])
            srv["t"] = time.time()
            self.server = srv
            return "%s:%s" % (srv["ip"], srv.get("porta", PORTA_AULA)), srv
        return None, None

    def _invia(self, sistema=None):
        host, srv = self._indirizzo_server()
        if not host:
            self.ultimo_invio = {"t": time.time(), "ok": False, "errore": "nessun PC del facilitatore trovato in rete"}
            return
        if not ip_locale(host.split(":")[0]):
            self.ultimo_invio = {"t": time.time(), "ok": False, "errore": "l'indirizzo del facilitatore deve essere nella rete locale"}
            return
        with self.lock:
            pres = dict(self.presenza)
        corpo = {
            "id": self.id_pc(), "codice": self.cfg.get("codice", ""), "pc": nome_pc(),
            "utente": self.cfg.get("allievo") or pres.get("utente", ""), "versione": self.version,
            "sistema": sistema or self.sistema, "componenti": pres.get("componenti", {}),
            "attivita": pres.get("attivita", {}), "progressi": pres.get("progressi", {}),
        }
        req = urllib.request.Request("http://%s/aula/ciao" % host, data=json.dumps(corpo).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # mai attraverso un proxy
            with opener.open(req, timeout=5) as r:
                risp = json.loads(r.read(MAX_CIAO).decode("utf-8"))
            self.ultimo_invio = {"t": time.time(), "ok": True, "errore": ""}
            if srv is not None and risp.get("nome"):
                srv["nome"] = str(risp.get("nome"))[:60]
            a = risp.get("annuncio")
            if isinstance(a, dict):
                self.annuncio_ricevuto = {"id": int(a.get("id") or 0), "testo": str(a.get("testo") or "")[:500]}
        except Exception as e:
            err = getattr(e, "code", None)
            msg = "codice dell'aula non corretto" if err == 403 else "il PC del facilitatore non risponde"
            self.ultimo_invio = {"t": time.time(), "ok": False, "errore": msg}
            self.server = None if not self.cfg.get("server") else self.server

    sistema = {}

    def id_pc(self):
        f = os.path.join(self.data_dir, "aula-id.txt")
        try:
            with open(f) as fh:
                v = fh.read().strip()
            if v:
                return v[:40]
        except OSError:
            pass
        import uuid
        v = str(uuid.uuid4())
        try:
            with open(f, "w") as fh:
                fh.write(v)
        except OSError:
            pass
        return v

    # ------------------------------------------------------------------ per l'interfaccia locale
    def stato(self):
        ora = time.time()
        with self.lock:
            clienti = []
            for c in sorted(self.clienti.values(), key=lambda c: (c.get("utente") or c.get("pc") or "").lower()):
                c = dict(c)
                c["fa_s"] = int(ora - c.get("visto", 0))
                c["online"] = c["fa_s"] < INTERVALLO * 3 + 10
                clienti.append(c)
            out = {"ok": True, "ruolo": self.ruolo, "nome": self.cfg.get("nome", ""), "codice": self.cfg.get("codice", ""),
                   "pc": nome_pc(), "ips": indirizzi_locali(), "porta": PORTA_AULA, "versione": self.version,
                   "sistema_os": platform.system()}
            if self.ruolo == "facilitatore":
                out.update({"in_ascolto": bool(self._http), "scoperta": bool(self._udp), "clienti": clienti,
                            "annuncio": dict(self.annuncio)})
            elif self.ruolo == "allievo":
                srv = self.server or ({"ip": self.cfg.get("server"), "manuale": True} if self.cfg.get("server") else None)
                out.update({"server": srv, "invio": dict(self.ultimo_invio, fa_s=int(ora - self.ultimo_invio["t"]) if self.ultimo_invio["t"] else None),
                            "annuncio": dict(self.annuncio_ricevuto), "allievo": self.cfg.get("allievo", "")})
        return out
