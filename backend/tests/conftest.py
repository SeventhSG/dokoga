import os, sys
# Dev mode: lets the email flow return codes in tests (no Resend key needed)
# and keeps cookies non-Secure so TestClient (http) stores them.
os.environ.setdefault("DOKOGA_DEV", "1")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
