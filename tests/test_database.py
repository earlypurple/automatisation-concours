import unittest
import os
import sys
import json
import sqlite3
from unittest.mock import patch
from contextlib import contextmanager

# Add the root directory to the Python path to allow importing project modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import database as db


class TestDatabase(unittest.TestCase):

    conn = None
    db_cursor_patcher = None

    @classmethod
    def setUpClass(cls):
        """
        Set up a single, shared in-memory SQLite database for all tests in this class.
        This method manually replicates the migration logic from `migrations/migrate.py`
        to ensure the schema is correctly built in the in-memory database.
        """
        cls.conn = sqlite3.connect(':memory:')
        cls.conn.row_factory = sqlite3.Row

        cursor = cls.conn.cursor()

        # 1. Create the migrations tracking table, mimicking the migration script.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 2. Find all migration .sql files and apply them in sorted order.
        versions_dir = os.path.join(os.path.dirname(__file__), '..', 'migrations', 'versions')
        migration_files = sorted([f for f in os.listdir(versions_dir) if f.endswith('.sql')])

        for filename in migration_files:
            filepath = os.path.join(versions_dir, filename)
            with open(filepath, 'r') as f:
                sql_script = f.read()

            # Apply the entire SQL script from the migration file.
            cursor.executescript(sql_script)
            # Record that this migration version has been applied.
            cursor.execute("INSERT INTO schema_migrations (version) VALUES (?)", (filename,))

        cls.conn.commit()
        cursor.close()

        # 3. Patch the db_cursor context manager to use our in-memory connection.
        cls.db_cursor_patcher = patch('database.db_cursor')
        mock_db_cursor = cls.db_cursor_patcher.start()

        @contextmanager
        def mock_cursor_context():
            """A mock context manager that yields a cursor from our shared connection."""
            c = cls.conn.cursor()
            try:
                yield c
                cls.conn.commit()
            except sqlite3.Error:
                cls.conn.rollback()
                raise

        mock_db_cursor.side_effect = mock_cursor_context

    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests in the class."""
        cls.db_cursor_patcher.stop()
        if cls.conn:
            cls.conn.close()

    def setUp(self):
        """
        This method is called before each test to ensure a clean state.
        """
        # It's faster to delete data than to rebuild the schema for each test.
        with db.db_cursor() as cur:
            cur.execute("DELETE FROM participation_history")
            cur.execute("DELETE FROM opportunities")
            cur.execute("DELETE FROM profiles")

        # Create the default profile needed for many tests.
        db.init_db()

    def test_init_db_creates_default_profile(self):
        """
        Test that init_db correctly creates a default profile in a clean database.
        """
        profiles = db.get_profiles()
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]['name'], 'Défaut')

    def test_add_opportunity(self):
        """
        Test adding a new opportunity and retrieving it.
        """
        profile = db.get_active_profile()
        opp_data = {
            'site': 'test.com', 'title': 'Test Opp', 'description': 'A test opportunity',
            'url': 'http://test.com/opp1', 'type': 'giveaway', 'priority': 5, 'value': 100,
            'detected_at': '2023-01-01T00:00:00', 'expires_at': None
        }

        # Add a new opportunity
        was_added = db.add_opportunity(opp_data, profile['id'])
        self.assertTrue(was_added)

        # Verify it was added
        opportunities = db.get_opportunities(profile['id'])
        self.assertEqual(len(opportunities), 1)
        self.assertEqual(opportunities[0]['title'], 'Test Opp')

        # Try to add the same opportunity again (should fail)
        was_added_again = db.add_opportunity(opp_data, profile['id'])
        self.assertFalse(was_added_again)

    def test_update_opportunity_status(self):
        """
        Test updating the status and log of an opportunity.
        """
        profile = db.get_active_profile()
        opp_data = {'site': 'test.com', 'title': 'Status Test', 'url': 'http://test.com/status', 'detected_at': '2023-01-01', 'type': 'test', 'priority': 1, 'value': 1, 'description': 'Test description', 'expires_at': None}
        db.add_opportunity(opp_data, profile['id'])
        opp = db.get_opportunities(profile['id'])[0]

        # Update status and check
        db.update_opportunity_status(opp['id'], 'participated', 'First log message.')
        updated_opp = db.get_opportunity_by_id(opp['id'])
        self.assertEqual(updated_opp['status'], 'participated')
        self.assertIn('First log message.', updated_opp['log'])

        # Append to log
        db.update_opportunity_status(opp['id'], 'success', 'Second log message.')
        updated_opp_2 = db.get_opportunity_by_id(opp['id'])
        self.assertEqual(updated_opp_2['status'], 'success')
        self.assertIn('First log message.', updated_opp_2['log'])
        self.assertIn('Second log message.', updated_opp_2['log'])

    def test_profile_management(self):
        """
        Test the full lifecycle of a profile: create, activate, update, delete.
        """
        # 1. Create a new profile
        profile_id = db.create_profile("Test User", "test@example.com", {"city": "Testville"})
        self.assertIsNotNone(profile_id)
        profiles = db.get_profiles()
        self.assertEqual(len(profiles), 2)  # Default + new one

        # 2. Set the new profile as active
        db.set_active_profile(profile_id)
        active_profile = db.get_active_profile()
        self.assertEqual(active_profile['id'], profile_id)
        self.assertEqual(active_profile['name'], 'Test User')

        # 3. Update the profile
        db.update_profile(profile_id, name="Updated User", user_data={"city": "Newville"})
        updated_profile = db.get_active_profile()
        self.assertEqual(updated_profile['name'], 'Updated User')
        user_data = json.loads(updated_profile['user_data'])
        self.assertEqual(user_data['city'], 'Newville')

        # 4. Delete the profile
        db.delete_profile(profile_id)
        profiles_after_delete = db.get_profiles()
        self.assertEqual(len(profiles_after_delete), 1)
        self.assertEqual(profiles_after_delete[0]['name'], 'Défaut')

        # 5. Test deleting the last profile raises an error
        last_profile_id = profiles_after_delete[0]['id']
        with self.assertRaises(ValueError):
            db.delete_profile(last_profile_id)

    def test_clear_opportunities(self):
        """
        Test that opportunities for a specific profile can be cleared.
        """
        # Create two profiles and add opportunities to both
        profile1_id = db.get_active_profile()['id']
        profile2_id = db.create_profile("Profile 2")

        opp_base = {'site': 's', 'title': 't', 'detected_at': 'd', 'type': 't', 'priority': 1, 'value': 1, 'description': '', 'expires_at': None}
        db.add_opportunity({**opp_base, 'url': 'p1_opp1'}, profile1_id)
        db.add_opportunity({**opp_base, 'url': 'p2_opp1'}, profile2_id)
        db.add_opportunity({**opp_base, 'url': 'p2_opp2'}, profile2_id)

        self.assertEqual(len(db.get_opportunities(profile1_id)), 1)
        self.assertEqual(len(db.get_opportunities(profile2_id)), 2)

        # Clear opportunities for profile 2
        db.clear_opportunities(profile2_id)

        # Verify clearance
        self.assertEqual(len(db.get_opportunities(profile1_id)), 1)
        self.assertEqual(len(db.get_opportunities(profile2_id)), 0)


if __name__ == '__main__':
    unittest.main()
