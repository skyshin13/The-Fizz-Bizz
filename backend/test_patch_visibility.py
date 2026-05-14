"""Test patching visibility on a beer project to diagnose the failure."""
import requests

BASE = "https://the-fizz-bizz-backend-production.up.railway.app"  # prod
# LOCAL = "http://localhost:8000"

# First login to get a token
login = requests.post(f"{BASE}/api/auth/login", json={"username": "skylershin", "password": "Skyshin13!!"})
print("Login status:", login.status_code)
if login.status_code != 200:
    print(login.text)
    exit(1)
token = login.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Try patching California Ale (id=18, BEER) to public
resp = requests.patch(f"{BASE}/api/projects/18", headers=headers, json={"visibility": "everyone", "is_public": True})
print("PATCH /projects/18 status:", resp.status_code)
print("Response:", resp.text[:500])
