#!/usr/bin/env python3
"""Run the standalone simulator on localhost, using only Python's standard library."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Timer
import webbrowser

directory = Path(__file__).resolve().parent / 'dist'
url = 'http://localhost:4173/'
try:
    server = ThreadingHTTPServer(('127.0.0.1', 4173), partial(SimpleHTTPRequestHandler, directory=str(directory)))
except OSError as exc:
    print('Could not start localhost:4173:', exc)
    print('You can open dist/Bo-cau-lab.html directly instead.')
    raise SystemExit(1)
print('Pigeon Flight Lab:', url, '\nPress Ctrl+C to stop.')
Timer(0.5, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
