import firebase_admin
from firebase_admin import credentials, firestore
import time

# --- AERO_BYTE LICENSE VALIDATOR (CLIENT-SIDE SIMULATION) ---
# This script demonstrates how your application can verify keys.

def validate_license(key_to_check):
    # 1. Initialize Firebase (Ensure you have your serviceAccountKey.json)
    if not firebase_admin._apps:
        try:
            cred = credentials.Certificate('serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        except Exception as e:
            return f"❌ Configuration Error: Please ensure 'serviceAccountKey.json' is present. ({e})"

    db = firestore.client()

    print(f"🔍 Validating License: {key_to_check}...")

    # 2. Check the global licenses collection
    lic_ref = db.collection('licenses').document(key_to_check)
    lic_doc = lic_ref.get()

    if not lic_doc.exists:
        return "❌ Invalid License Key: This key does not exist in our database."

    lic_data = lic_doc.to_dict()
    user_id = lic_data.get('userId')
    
    if not user_id:
        return "❌ Corrupt License: No user associated with this key."

    # 3. Check the user's actual subscription status and expiry
    user_ref = db.collection('users').document(user_id)
    user_doc = user_ref.get()

    if not user_doc.exists:
        return "❌ Error: Associated user account no longer exists."

    user_data = user_doc.to_dict()
    plan = user_data.get('plan', 'Free')
    expires_at = user_data.get('expiresAt') # Milliseconds timestamp

    # 4. Check Expiration
    current_time_ms = int(time.time() * 1000)

    if plan == 'Free':
        return "❌ Access Denied: This key is linked to a Free plan."

    if expires_at and current_time_ms > expires_at:
        return f"⌛ License Expired: Your {plan} subscription ended on {time.ctime(expires_at/1000)}."

    # 5. Success!
    status = "LIFETIME" if not expires_at else f"Expires: {time.ctime(expires_at/1000)}"
    return f"✅ Access Granted! [Tier: {plan}] [Status: {status}]"

if __name__ == "__main__":
    print("--- AeroByte Professional License System ---")
    user_input = input("Enter your License Key: ").strip()
    result = validate_license(user_input)
    print("\n" + result)
    
    if "✅ Access Granted" in result:
        print("\n🚀 Unlocking Professional Features...")
        # Your app logic here
    else:
        print("\n⚠️ Please visit https://aerobyte.shop to upgrade.")
