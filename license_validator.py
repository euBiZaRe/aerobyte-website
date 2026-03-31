import sys
import os
import subprocess
import json
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone

# --- AERO_BYTE LICENSE VALIDATOR (REST EDITION) ---
# Uses Firestore REST API directly to avoid gRPC/DNS issues on Windows.

FIRESTORE_PROJECT_ID = "aerobytebot"

def get_service_account_key():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(script_dir, 'serviceAccountKey.json')
    if not os.path.exists(key_path):
        return None, f"Service account key missing at {key_path}"
    try:
        with open(key_path, 'r') as f:
            return json.load(f), None
    except Exception as e:
        return None, f"Could not read service account key: {e}"

def get_access_token(service_account_key):
    """Get a Google OAuth2 access token using a service account JWT."""
    try:
        import base64
        import hmac
        import hashlib
        import struct

        now = int(time.time())
        
        # Build JWT header and payload
        header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b'=').decode()
        payload_data = {
            "iss": service_account_key['client_email'],
            "scope": "https://www.googleapis.com/auth/datastore",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600
        }
        payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).rstrip(b'=').decode()
        
        signing_input = f"{header}.{payload}".encode()
        
        # Sign with private key using cryptography library
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        
        private_key_pem = service_account_key['private_key'].encode()
        private_key = serialization.load_pem_private_key(private_key_pem, password=None)
        signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
        
        signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b'=').decode()
        jwt_token = f"{header}.{payload}.{signature_b64}"
        
        # Exchange JWT for access token
        token_data = urllib.parse.urlencode({
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': jwt_token
        }).encode()
        
        req = urllib.request.Request(
            'https://oauth2.googleapis.com/token',
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            token_resp = json.loads(resp.read().decode())
            return token_resp.get('access_token'), None
    except Exception as e:
        return None, f"Auth Error: {e}"

def firestore_get(access_token, collection, document_id):
    """Fetch a Firestore document via REST API."""
    url = f"https://firestore.googleapis.com/v1/projects/{FIRESTORE_PROJECT_ID}/databases/(default)/documents/{collection}/{document_id}"
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {access_token}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode()), None
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, "notfound"
        return None, f"HTTP {e.code}"
    except Exception as e:
        return None, str(e)

def firestore_update(access_token, collection, document_id, fields_dict):
    """Update specific fields in a Firestore document via REST API."""
    url = f"https://firestore.googleapis.com/v1/projects/{FIRESTORE_PROJECT_ID}/databases/(default)/documents/{collection}/{document_id}"
    # Build update mask
    field_names = list(fields_dict.keys())
    mask = "&".join(f"updateMask.fieldPaths={f}" for f in field_names)
    url = f"{url}?{mask}"
    
    # Build Firestore field value format
    fs_fields = {}
    for k, v in fields_dict.items():
        if isinstance(v, str):
            fs_fields[k] = {"stringValue": v}
        elif isinstance(v, bool):
            fs_fields[k] = {"booleanValue": v}
        elif isinstance(v, int):
            fs_fields[k] = {"integerValue": str(v)}
    
    body = json.dumps({"fields": fs_fields}).encode()
    req = urllib.request.Request(url, data=body, method='PATCH',
                                  headers={
                                      'Authorization': f'Bearer {access_token}',
                                      'Content-Type': 'application/json'
                                  })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, None
    except Exception as e:
        return False, str(e)

def parse_firestore_value(field_val):
    """Extract a Python value from a Firestore field value dict."""
    if not field_val:
        return None
    if 'stringValue' in field_val:
        return field_val['stringValue']
    if 'integerValue' in field_val:
        return int(field_val['integerValue'])
    if 'doubleValue' in field_val:
        return float(field_val['doubleValue'])
    if 'booleanValue' in field_val:
        return field_val['booleanValue']
    if 'timestampValue' in field_val:
        return field_val['timestampValue']  # ISO 8601 string
    if 'nullValue' in field_val:
        return None
    return None

def get_hwid():
    try:
        cmd = 'wmic csproduct get uuid'
        output = subprocess.check_output(cmd, shell=True).decode()
        lines = [line.strip() for line in output.split('\n') if line.strip()]
        if len(lines) > 1:
            return lines[1]
        return "UNKNOWN_HWID"
    except:
        return "UNKNOWN_HWID"

def validate_license(key_to_check):
    # Load service account credentials
    sa_key, err = get_service_account_key()
    if err:
        return f"ERROR: {err}", 1

    # Get OAuth2 access token
    access_token, err = get_access_token(sa_key)
    if err:
        return f"ERROR: {err}", 1

    current_hwid = get_hwid()

    # 1. Check the global licenses collection
    lic_doc, err = firestore_get(access_token, 'licenses', key_to_check)
    if err == "notfound":
        return "ERROR: Invalid License Key", 1
    if err:
        return f"ERROR: Could not reach license server ({err})", 1

    fields = lic_doc.get('fields', {})
    user_id = parse_firestore_value(fields.get('userId'))
    registered_hwid = parse_firestore_value(fields.get('hwid'))

    if not user_id:
        return "ERROR: Corrupt License (No User)", 1

    # 2. HWID Locking
    if not registered_hwid:
        firestore_update(access_token, 'licenses', key_to_check, {'hwid': current_hwid})
    elif registered_hwid != current_hwid:
        return "ERROR: HWID Mismatch (Locked to another PC)", 2

    # 3. User & Plan Verification
    user_doc, err = firestore_get(access_token, 'users', user_id)
    if err == "notfound":
        return "ERROR: User record missing", 1
    if err:
        return f"ERROR: Could not fetch user record ({err})", 1

    user_fields = user_doc.get('fields', {})
    plan = (parse_firestore_value(user_fields.get('plan')) or 'Free').upper()
    expires_at_raw = parse_firestore_value(user_fields.get('expiresAt'))


    # Robust Expiry Handling (Firestore Timestamp string OR numeric epoch)
    if expires_at_raw:
        try:
            now_dt = datetime.now(timezone.utc)
            # Firestore may return ISO 8601 timestamp string
            if isinstance(expires_at_raw, str):
                expiry_dt = datetime.fromisoformat(expires_at_raw.replace('Z', '+00:00'))
                is_expired = now_dt > expiry_dt
            else:
                # Numeric: ms if > 10^11, else seconds
                expiry_ts = float(expires_at_raw)
                if expiry_ts > 1e11:
                    expiry_ts /= 1000.0
                expiry_dt = datetime.fromtimestamp(expiry_ts, timezone.utc)
                is_expired = now_dt > expiry_dt

            if is_expired:
                return f"ERROR: License Expired (Ended {expiry_dt.strftime('%Y-%m-%d %H:%M UTC')})", 1
        except Exception as ex:
            return f"ERROR: Invalid Expiry Format ({ex})", 1

    # 4. Success
    return f"SUCCESS:{plan}", 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("USAGE: python license_validator.py <LICENSE_KEY>")
        sys.exit(1)

    key = sys.argv[1].strip()
    result_text, exit_code = validate_license(key)
    print(result_text)
    sys.exit(exit_code)
