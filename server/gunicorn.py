# This exists because gunicorn requires the app variable to be global.
import logging

from . import server

logging.basicConfig(
    level=logging.INFO,
    format=r"%(asctime)s:%(levelname)s:%(message)s",
    datefmt=r"%Y%m%d-%H:%M:%S",
)
app = server.MainApp().app

