import ctypes
import logging
from pathlib import Path

# Preload OpenMP library for LightGBM on Linux serverless runtimes (Vercel)
_libgomp = Path(__file__).resolve().parent.parent / "lib" / "libgomp.so.1"
if _libgomp.exists():
    try:
        ctypes.CDLL(str(_libgomp), mode=ctypes.RTLD_GLOBAL)
    except Exception as e:
        logging.getLogger(__name__).warning("Could not preload %s: %s", _libgomp, e)

from composer.app import app
