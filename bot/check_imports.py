try:
    import telegram
    print("telegram: OK")
except ImportError:
    print("telegram: FAILED")

try:
    import httpx
    print("httpx: OK")
except ImportError:
    print("httpx: FAILED")

try:
    import pydantic
    print("pydantic: OK")
except ImportError:
    print("pydantic: FAILED")

try:
    import PIL
    print("Pillow: OK")
except ImportError:
    print("Pillow: FAILED")

try:
    from pydantic_settings import BaseSettings
    print("pydantic-settings: OK")
except ImportError:
    print("pydantic-settings: FAILED")
