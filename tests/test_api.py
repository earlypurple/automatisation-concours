import unittest
from unittest import mock
from unittest.mock import MagicMock, patch
import io
import threading
import time
import os
import sys
import json

# Add the root directory to the Python path to allow importing server and database
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from logger import logger
import server
import database as db
import analytics
from intelligent_cache import api_cache, analytics_cache

class TestApi(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.db_file = 'test_surveillance.db'
        db.DB_FILE = cls.db_file
        if os.path.exists(cls.db_file):
            os.remove(cls.db_file)

        db.run_migrations()
        db.init_db()

        # We still need the APIServer instance because the Handler class depends on it
        # for things like the participation queue. But we will not run it.
        cls.api_server = server.APIServer(host='localhost', port=8081)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.db_file):
            os.remove(cls.db_file)

    def setUp(self):
        with db.db_cursor() as cur:
            cur.execute("DELETE FROM opportunities")
            cur.execute("DELETE FROM participation_history")
            cur.execute("DELETE FROM profiles WHERE id > 1")
            cur.execute("UPDATE profiles SET is_active = 1 WHERE id = 1")

    def tearDown(self):
        # This method is called after each test.
        # We clean up the tables and caches that are modified by multiple tests
        # to ensure a clean state for the next test.
        with db.db_cursor() as cur:
            cur.execute("DELETE FROM opportunities")
            cur.execute("DELETE FROM participation_history")

        api_cache.clear()
        analytics_cache.clear()

    # --- Helper Methods ---
    def _simulate_request(self, method, endpoint, body=None):
        """
        Simulates an HTTP request to the API handler without a live server.
        This version patches the parent __init__ to prevent any socket/request handling.
        """
        # Patch the parent's __init__ so it does nothing. This prevents the handler
        # from trying to read from a socket during instantiation.
        with patch('http.server.SimpleHTTPRequestHandler.__init__', lambda *args, **kwargs: None):
            handler = server.Handler(None, None, None, api_server=self.api_server)

        # Now, manually set up the handler with the necessary attributes for the test.
        request_body_bytes = json.dumps(body).encode('utf-8') if body is not None else b''
        handler.rfile = io.BytesIO(request_body_bytes)
        handler.wfile = io.BytesIO()
        handler.path = f"/api{endpoint}"
        handler.command = method
        handler.headers = {
            'Host': 'localhost:8081',
            'Content-Type': 'application/json',
            'Content-Length': str(len(request_body_bytes))
        }

        # Mock the response methods that would normally write to a socket.
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()

        # Call the appropriate do_METHOD (e.g., do_GET, do_POST)
        do_method = getattr(handler, f'do_{method}')
        do_method()

        # Create a mock response object to return, mimicking `requests.Response`.
        mock_response = MagicMock()

        if handler.send_response.called:
            mock_response.status_code = handler.send_response.call_args[0][0]
        else:
            mock_response.status_code = 500  # Default to error if response wasn't sent

        response_body = handler.wfile.getvalue().decode('utf-8')

        def json_func():
            # Mimic requests.json() which fails on empty body
            if not response_body:
                raise json.JSONDecodeError("Expecting value", response_body, 0)
            return json.loads(response_body)

        mock_response.json = json_func

        return mock_response

    def _api_get(self, endpoint):
        return self._simulate_request('GET', endpoint)

    def _api_post(self, endpoint, data=None):
        return self._simulate_request('POST', endpoint, body=data)

    def _api_put(self, endpoint, data=None):
        return self._simulate_request('PUT', endpoint, body=data)

    def _api_delete(self, endpoint):
        return self._simulate_request('DELETE', endpoint)

    def _create_profile(self, name="Test Profile"):
        data = {
            "name": name,
            "email": f"{name.lower().replace(' ', '_')}@example.com",
            "userData": {"name": name}
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

    def test_03_get_data_with_analytics(self):
        # 1. Create and activate a new profile for this test
        profile_data = self._create_profile("Analytics Test Profile")
        profile_id = profile_data['id']
        self._api_post(f"/profiles/{profile_id}/activate")

        # 2. Add dummy data for THIS profile
        with db.db_cursor() as cur:
            # Opportunities in different months
            cur.execute("INSERT INTO opportunities (id, title, site, url, detected_at, profile_id) VALUES (?, ?, ?, ?, ?, ?)",
                        (101, 'Opp Jan', 's1', 'u1', '2023-01-10T10:00:00', profile_id))
            cur.execute("INSERT INTO opportunities (id, title, site, url, detected_at, profile_id) VALUES (?, ?, ?, ?, ?, ?)",
                        (102, 'Opp Jan 2', 's1', 'u2', '2023-01-20T10:00:00', profile_id))
            cur.execute("INSERT INTO opportunities (id, title, site, url, detected_at, profile_id) VALUES (?, ?, ?, ?, ?, ?)",
                        (103, 'Opp Feb', 's1', 'u3', '2023-02-05T10:00:00', profile_id))

            # Participation history for success rate calculation
            # 3 successes, 1 failure -> 75% success rate
            cur.execute("INSERT INTO participation_history (opportunity_id, participation_date, status, profile_id) VALUES (?, ?, ?, ?)",
                        (101, '2023-01-11T10:00:00', 'success', profile_id))
            cur.execute("INSERT INTO participation_history (opportunity_id, participation_date, status, profile_id) VALUES (?, ?, ?, ?)",
                        (102, '2023-01-21T10:00:00', 'participated', profile_id))
            cur.execute("INSERT INTO participation_history (opportunity_id, participation_date, status, profile_id) VALUES (?, ?, ?, ?)",
                        (103, '2023-02-06T10:00:00', 'success', profile_id))
            cur.execute("INSERT INTO participation_history (opportunity_id, participation_date, status, profile_id) VALUES (?, ?, ?, ?)",
                        (103, '2023-02-07T10:00:00', 'failed', profile_id))

        # Call the API
        response = self._api_get("/data")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        stats = data.get('stats', {})

        # Assertions for stats
        self.assertIn('opportunities_over_time', stats)
        self.assertIn('success_rate', stats)

        # Check success rate (3/4 = 75%)
        self.assertEqual(stats['success_rate'], 75.0)

        # Check opportunities over time
        time_data = stats['opportunities_over_time']
        self.assertEqual(len(time_data), 2)

        jan_data = next((item for item in time_data if 'Jan 2023' in item['name']), None)
        feb_data = next((item for item in time_data if 'Feb 2023' in item['name']), None)

        self.assertIsNotNone(jan_data)
        self.assertIsNotNone(feb_data)
        self.assertEqual(jan_data['opportunités'], 2)
        self.assertEqual(feb_data['opportunités'], 1)



if __name__ == '__main__':
    unittest.main()
