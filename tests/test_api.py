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
from alembic.config import Config
from alembic import command

class TestApi(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Set a dummy API_KEY for testing
        os.environ['API_KEY'] = 'test-api-key'

        cls.db_file = 'test_surveillance.db'
        if os.path.exists(cls.db_file):
            os.remove(cls.db_file)

        # Initialize the database engine for the test database
        db.init_engine(cls.db_file)

        # Run migrations on the test database
        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{cls.db_file}")
        command.upgrade(alembic_cfg, "head")

        # Initialize with default data if needed
        db.init_db()

        # We still need the APIServer instance because the Handler class depends on it
        # for things like the participation queue. But we will not run it.
        cls.api_server = server.APIServer(host='localhost', port=8081)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.db_file):
            os.remove(cls.db_file)

    def setUp(self):
        with db.db_session() as session:
            session.query(db.Opportunity).delete()
            session.query(db.ParticipationHistory).delete()
            session.query(db.Profile).filter(db.Profile.id > 1).delete()
            session.query(db.Profile).filter(db.Profile.id == 1).update({'is_active': True})
            session.commit()

    def tearDown(self):
        # This method is called after each test.
        # We clean up the tables and caches that are modified by multiple tests
        # to ensure a clean state for the next test.
        with db.db_session() as session:
            session.query(db.Opportunity).delete()
            session.query(db.ParticipationHistory).delete()

        api_cache.clear()
        analytics_cache.clear()

    # --- Helper Methods ---
    def _simulate_request(self, method, endpoint, body=None, headers=None):
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

        # Default headers, can be overridden
        default_headers = {
            'Host': 'localhost:8081',
            'Content-Type': 'application/json',
            'Content-Length': str(len(request_body_bytes)),
            'X-API-Key': os.getenv('API_KEY')
        }
        if headers:
            default_headers.update(headers)
        handler.headers = default_headers

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
        with db.db_session() as session:
            new_opp = db.Opportunity(title='Opp 1', site='site1', url='url1', detected_at='2023-01-01', profile_id=default_profile_id)
            session.add(new_opp)
            session.commit()

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
        with db.db_session() as session:
            # Opportunities
            opp1 = db.Opportunity(id=101, title='Opp Jan', site='s1', url='u1', detected_at='2023-01-10T10:00:00', profile_id=profile_id)
            opp2 = db.Opportunity(id=102, title='Opp Jan 2', site='s1', url='u2', detected_at='2023-01-20T10:00:00', profile_id=profile_id)
            opp3 = db.Opportunity(id=103, title='Opp Feb', site='s1', url='u3', detected_at='2023-02-05T10:00:00', profile_id=profile_id)
            session.add_all([opp1, opp2, opp3])
            session.commit()

            # Participation history
            hist1 = db.ParticipationHistory(opportunity_id=101, participation_date='2023-01-11T10:00:00', status='success', profile_id=profile_id)
            hist2 = db.ParticipationHistory(opportunity_id=102, participation_date='2023-01-21T10:00:00', status='participated', profile_id=profile_id)
            hist3 = db.ParticipationHistory(opportunity_id=103, participation_date='2023-02-06T10:00:00', status='success', profile_id=profile_id)
            hist4 = db.ParticipationHistory(opportunity_id=103, participation_date='2023-02-07T10:00:00', status='failed', profile_id=profile_id)
            session.add_all([hist1, hist2, hist3, hist4])
            session.commit()

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

    def test_04_unauthorized_access(self):
        # Case 1: No API Key provided
        response_no_key = self._simulate_request('GET', '/profiles', headers={'X-API-Key': ''})
        self.assertEqual(response_no_key.status_code, 401)

        # Case 2: Incorrect API Key provided
        response_wrong_key = self._simulate_request('GET', '/profiles', headers={'X-API-Key': 'wrong-key'})
        self.assertEqual(response_wrong_key.status_code, 401)


if __name__ == '__main__':
    unittest.main()
