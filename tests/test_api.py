import unittest
import requests
import threading
import time
import os
import sys
import json

# Add the root directory to the Python path to allow importing server and database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from logger import logger
import server
import database as db

class TestApi(unittest.TestCase):

    BASE_URL = "http://localhost:8081/api"

    @classmethod
    def setUpClass(cls):
        cls.db_file = 'test_surveillance.db'
        db.DB_FILE = cls.db_file
        if os.path.exists(cls.db_file):
            os.remove(cls.db_file)

        db.run_migrations()
        db.init_db()

        cls.api_server = server.APIServer(host='localhost', port=8081)
        cls.server_thread = threading.Thread(target=cls.api_server.run, daemon=True)
        cls.server_thread.start()
        time.sleep(1)

    @classmethod
    def tearDownClass(cls):
        cls.api_server.shutdown()
        if os.path.exists(cls.db_file):
            os.remove(cls.db_file)

    def setUp(self):
        with db.db_cursor() as cur:
            cur.execute("DELETE FROM opportunities")
            cur.execute("DELETE FROM participation_history")
            cur.execute("DELETE FROM profiles WHERE id > 1")
            cur.execute("UPDATE profiles SET is_active = 1 WHERE id = 1")

    # --- Helper Methods ---
    def _api_get(self, endpoint):
        return requests.get(f"{self.BASE_URL}{endpoint}")

    def _api_post(self, endpoint, data=None):
        return requests.post(f"{self.BASE_URL}{endpoint}", json=data)

    def _api_put(self, endpoint, data=None):
        return requests.put(f"{self.BASE_URL}{endpoint}", json=data)

    def _api_delete(self, endpoint):
        return requests.delete(f"{self.BASE_URL}{endpoint}")

    def _create_profile(self, name="Test Profile"):
        data = {
            "name": name,
            "email": f"{name.lower().replace(' ', '_')}@example.com",
            "userData": json.dumps({"name": name})
        }
        response = self._api_post("/profiles", data)
        self.assertEqual(response.status_code, 201)
        return response.json()

    # --- Tests ---
    def test_01_profiles_api_lifecycle(self):
        # 1. GET initial profiles
        response = self._api_get("/profiles")
        self.assertEqual(response.status_code, 200)
        profiles = response.json()
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]['name'], 'Défaut')

        # 2. CREATE a new profile
        new_profile = self._create_profile("Test Profile")
        profile_id = new_profile['id']

        # 3. GET profiles again
        response = self._api_get("/profiles")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

        # 4. ACTIVATE the new profile
        response = self._api_post(f"/profiles/{profile_id}/activate")
        self.assertEqual(response.status_code, 200)

        # 5. GET active profile
        response = self._api_get("/profiles/active")
        self.assertEqual(response.status_code, 200)
        active_profile = response.json()
        self.assertEqual(active_profile['id'], profile_id)
        self.assertEqual(active_profile['name'], "Test Profile")

        # 6. UPDATE the profile
        update_data = {"name": "Updated Profile Name"}
        response = self._api_put(f"/profiles/{profile_id}", update_data)
        self.assertEqual(response.status_code, 200)

        # Verify update
        response = self._api_get("/profiles/active")
        self.assertEqual(response.json()['name'], "Updated Profile Name")

        # 7. DELETE the profile
        response = self._api_delete(f"/profiles/{profile_id}")
        self.assertEqual(response.status_code, 200)

        # 8. GET profiles again
        response = self._api_get("/profiles")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_02_data_is_profile_specific(self):
        # Get the default profile ID
        default_profile_id = self._api_get("/profiles/active").json()['id']

        # Create a second profile
        profile2 = self._create_profile("Profile 2")
        profile2_id = profile2['id']

        # Make sure default profile is active
        self._api_post(f"/profiles/{default_profile_id}/activate")

        # Add an opportunity for the default profile
        with db.db_cursor() as cur:
            cur.execute("INSERT INTO opportunities (title, site, url, detected_at, profile_id) VALUES (?, ?, ?, ?, ?)",
                        ('Opp 1', 'site1', 'url1', '2023-01-01', default_profile_id))

        # API should return one opportunity for the active (default) profile
        response = self._api_get("/data")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['opportunities']), 1)
        self.assertEqual(response.json()['opportunities'][0]['title'], 'Opp 1')

        # Activate profile 2
        self._api_post(f"/profiles/{profile2_id}/activate")

        # API should now return zero opportunities for the new active profile
        response = self._api_get("/data")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['opportunities']), 0)

if __name__ == '__main__':
    unittest.main()
