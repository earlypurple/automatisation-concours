import unittest
import requests
import json
import threading
import time
import os
import sys

# Add the root directory to the Python path to allow importing server and database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from logger import logger
import server
import database as db

class TestApi(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Initialiser la base de données pour les tests
        cls.db_file = 'test_surveillance.db'
        logger.info(f"--- Test setup: Using database file: {os.path.abspath(cls.db_file)} ---")
        db.DB_FILE = cls.db_file
        if os.path.exists(cls.db_file):
            logger.info("--- Test setup: Removing existing test database. ---")
            os.remove(cls.db_file)

        logger.info("--- Test setup: Running migrations... ---")
        db.run_migrations()
        logger.info("--- Test setup: Migrations finished. ---")

        logger.info("--- Test setup: Initializing database (for default profile)... ---")
        db.init_db()
        logger.info("--- Test setup: Database initialized. ---")

        # Démarrer le serveur dans un thread séparé
        cls.api_server = server.APIServer(host='localhost', port=8081)
        cls.server_thread = threading.Thread(target=cls.api_server.run, daemon=True)
        cls.server_thread.start()
        time.sleep(1) # Laisser le temps au serveur de démarrer

    @classmethod
    def tearDownClass(cls):
        cls.api_server.shutdown()
        if os.path.exists(cls.db_file):
            os.remove(cls.db_file)

    def setUp(self):
        # Nettoyer la base de données avant chaque test
        with db.db_cursor() as cur:
            # Clear data, but not profiles, to let init_db manage the default
            cur.execute("DELETE FROM opportunities")
            cur.execute("DELETE FROM participation_history")
        # No need to call init_db() here again, setUpClass handles it.

    def test_01_profiles_api_lifecycle(self):
        base_url = "http://localhost:8081/api/profiles"

        # 1. GET initial profiles (should be just the default one)
        response = requests.get(base_url)
        self.assertEqual(response.status_code, 200)
        profiles = response.json()
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]['name'], 'Défaut')

        # 2. CREATE a new profile
        new_profile_data = {
            "name": "Test Profile",
            "email": "test@example.com",
            "userData": {"name": "Test User"}
        }
        response = requests.post(base_url, json=new_profile_data)
        self.assertEqual(response.status_code, 201)
        new_profile = response.json()
        self.assertIn('id', new_profile)
        profile_id = new_profile['id']

        # 3. GET profiles again (should be two now)
        response = requests.get(base_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

        # 4. ACTIVATE the new profile
        response = requests.post(f"{base_url}/{profile_id}/activate")
        self.assertEqual(response.status_code, 200)

        # 5. GET active profile
        response = requests.get(f"{base_url}/active")
        self.assertEqual(response.status_code, 200)
        active_profile = response.json()
        self.assertEqual(active_profile['id'], profile_id)
        self.assertEqual(active_profile['name'], "Test Profile")

        # 6. UPDATE the profile
        update_data = {"name": "Updated Profile Name"}
        response = requests.put(f"{base_url}/{profile_id}", json=update_data)
        self.assertEqual(response.status_code, 200)

        # Verify update
        response = requests.get(f"{base_url}/active")
        self.assertEqual(response.json()['name'], "Updated Profile Name")

        # 7. DELETE the profile
        response = requests.delete(f"{base_url}/{profile_id}")
        self.assertEqual(response.status_code, 200)

        # 8. GET profiles again (should be back to one)
        response = requests.get(base_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_02_data_is_profile_specific(self):
        base_url = "http://localhost:8081/api"

        # Get the default profile created by setUp
        default_profile_id = requests.get(f"{base_url}/profiles/active").json()['id']

        # Create a second profile
        profile2_res = requests.post(f"{base_url}/profiles", json={"name": "Profile 2"})
        profile2_id = profile2_res.json()['id']

        # Make sure default profile is active
        requests.post(f"{base_url}/profiles/{default_profile_id}/activate")

        # Add an opportunity for the default profile
        with db.db_cursor() as cur:
            cur.execute("INSERT INTO opportunities (title, site, url, detected_at, profile_id) VALUES (?, ?, ?, ?, ?)",
                        ('Opp 1', 'site1', 'url1', '2023-01-01', default_profile_id))

        # API should return one opportunity for the active (default) profile
        response = requests.get(f"{base_url}/data")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['opportunities']), 1)
        self.assertEqual(response.json()['opportunities'][0]['title'], 'Opp 1')

        # Activate profile 2
        requests.post(f"{base_url}/profiles/{profile2_id}/activate")

        # API should now return zero opportunities for the new active profile
        response = requests.get(f"{base_url}/data")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['opportunities']), 0)


if __name__ == '__main__':
    unittest.main()
