import requests

import os
API_KEY = os.environ['SENDGRID_API_KEY']
TO = 'skyler.shin@cooper.edu'

payload = {
    'personalizations': [{'to': [{'email': TO}]}],
    'from': {'email': 'fizzbizz.app@gmail.com', 'name': 'Fizz Bizz'},
    'subject': 'Fizz Bizz — Reminder Created: Jun Kombucha',
    'content': [{
        'type': 'text/plain',
        'value': (
            'Reminder set for "Jun Kombucha"\n'
            "You'll be notified tomorrow at 1:35 AM (and every 24h after):\n"
            '"Time to check the pH on your fermentation!"'
        ),
    }],
}
resp = requests.post(
    'https://api.sendgrid.com/v3/mail/send',
    headers={'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'},
    json=payload,
)
print('Status:', resp.status_code)
print('Body:', resp.text or '(empty — accepted)')
