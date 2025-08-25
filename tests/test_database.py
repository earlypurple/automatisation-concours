import unittest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Opportunity, Profile
import database

class TestDatabase(unittest.TestCase):

    def setUp(self):
        """
        This method is called before each test to ensure a clean state.
        """
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        database.DBSession = self.Session

    def tearDown(self):
        Base.metadata.drop_all(self.engine)

    def test_add_opportunity(self):
        with database.db_session() as session:
            profile = Profile(name='test_profile', is_active=True)
            session.add(profile)
            session.commit()
            profile_id = profile.id

        opp = {
            'site': 'test_site',
            'title': 'Test Opportunity',
            'description': 'A test opportunity',
            'url': 'http://example.com/opp',
            'type': 'test',
            'priority': 1,
            'value': 100,
            'auto_fill': False,
            'detected_at': '2023-01-01T00:00:00',
            'expires_at': '2023-01-31T00:00:00',
            'entries_count': 10,
            'time_left': '30 days'
        }
        self.assertTrue(database.add_opportunity(opp, profile_id))

        with database.db_session() as session:
            db_opp = session.query(Opportunity).filter_by(url=opp['url']).first()
            self.assertIsNotNone(db_opp)
            self.assertEqual(db_opp.title, 'Test Opportunity')

    def test_clear_opportunities(self):
        with database.db_session() as session:
            profile = Profile(name='test_profile', is_active=True)
            session.add(profile)
            session.commit()
            profile_id = profile.id

        opp = {
            'site': 'test_site',
            'title': 'Test Opportunity',
            'description': 'A test opportunity',
            'url': 'http://example.com/opp',
            'type': 'test',
            'priority': 1,
            'value': 100,
            'auto_fill': False,
            'detected_at': '2023-01-01T00:00:00',
            'expires_at': '2023-01-31T00:00:00',
            'entries_count': 10,
            'time_left': '30 days'
        }
        database.add_opportunity(opp, profile_id)

        database.clear_opportunities(profile_id)

        with database.db_session() as session:
            self.assertEqual(session.query(Opportunity).count(), 0)

    def test_init_db_creates_default_profile(self):
        with database.db_session() as session:
            session.query(Profile).delete()
            session.commit()

        database.init_db()

        with database.db_session() as session:
            self.assertEqual(session.query(Profile).count(), 1)
            profile = session.query(Profile).first()
            self.assertEqual(profile.name, 'Défaut')

    def test_profile_management(self):
        with database.db_session() as session:
            session.query(Profile).delete()
            session.commit()

        profile_id = database.create_profile('test_profile')
        self.assertIsNotNone(profile_id)

        profiles = database.get_profiles()
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]['name'], 'test_profile')

        database.set_active_profile(profile_id)
        active_profile = database.get_active_profile()
        self.assertEqual(active_profile['id'], profile_id)

        database.update_profile(profile_id, name='updated_profile')
        updated_profile = database.get_active_profile()
        self.assertEqual(updated_profile['name'], 'updated_profile')

        database.create_profile('another_profile')
        database.delete_profile(profile_id)

        profiles = database.get_profiles()
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]['name'], 'another_profile')

    def test_update_opportunity_status(self):
        with database.db_session() as session:
            profile = Profile(name='test_profile', is_active=True)
            session.add(profile)
            session.commit()
            profile_id = profile.id

        opp = {
            'site': 'test_site',
            'title': 'Test Opportunity',
            'description': 'A test opportunity',
            'url': 'http://example.com/opp',
            'type': 'test',
            'priority': 1,
            'value': 100,
            'auto_fill': False,
            'detected_at': '2023-01-01T00:00:00',
            'expires_at': '2023-01-31T00:00:00',
            'entries_count': 10,
            'time_left': '30 days'
        }
        database.add_opportunity(opp, profile_id)

        with database.db_session() as session:
            db_opp = session.query(Opportunity).filter_by(url=opp['url']).first()
            opportunity_id = db_opp.id

        database.update_opportunity_status(opportunity_id, 'participated', 'Test log message')

        with database.db_session() as session:
            updated_opp = session.query(Opportunity).filter_by(id=opportunity_id).first()
            self.assertEqual(updated_opp.status, 'participated')
            self.assertIn('Test log message', updated_opp.log)

if __name__ == '__main__':
    unittest.main()
