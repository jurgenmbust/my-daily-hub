"""CI-only smoke test against an isolated PostgreSQL-backed API, never production."""
import http.cookiejar
import json
from pathlib import Path
import urllib.request

BASE = 'http://127.0.0.1:5087/api'
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def post(path, body):
    request = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={'Content-Type':'application/json', 'X-Hub-Request':'1'})
    with client.open(request, timeout=15) as response:
        return json.load(response)

post('/auth/login', {'username':'fitness-ci', 'password':'fitness-ci-test-password-only'})
document = json.loads(Path('examples/my-fitness-hub-plan-v1.json').read_text(encoding='utf-8'))
preview = post('/fitness/import/preview', document)
saved = post('/fitness/import/confirm', {'document':preview['document'], 'expectedHash':preview['expectedHash'], 'confirm':True})
assert saved['version'] == '1'
with client.open(BASE + '/fitness/plans', timeout=15) as response:
    plans = json.load(response)
assert len(plans) == 1 and len(plans[0]['versions']) == 1
print('PostgreSQL migrations and fitness preview/import smoke test passed.')
