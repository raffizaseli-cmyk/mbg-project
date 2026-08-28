import importlib

for pkg in ["psycopg2", "psycopg", "asyncpg", "sqlalchemy", "pg8000"]:
    try:
        importlib.import_module(pkg)
        print(f"Driver '{pkg}' is INSTALLED")
    except ImportError:
        print(f"Driver '{pkg}' is NOT installed")
