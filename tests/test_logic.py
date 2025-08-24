import unittest
import pandas as pd
from unittest.mock import MagicMock
import os
import sys
from datetime import datetime, timedelta

# Add the root directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import selection_logic  # We don't import train_model here as we are not testing it in this file yet.


class TestSelectionLogic(unittest.TestCase):

    def setUp(self):
        # Reset the model in selection_logic before each test
        selection_logic.model = None

    def test_calculate_score_with_mock_model(self):
        """
        Test that calculate_score uses the ML model if available.
        """
        # 1. Create a mock model
        mock_model = MagicMock()
        # Configure the mock to return a specific probability
        # predict_proba returns a list of [prob_class_0, prob_class_1]
        mock_model.predict_proba.return_value = [[0.2, 0.8]]

        # 2. Inject the mock model into the module
        selection_logic.model = mock_model

        # 3. Create a sample opportunity
        opportunity = {
            'value': 100, 'priority': 5, 'entries_count': 50,
            'type': 'giveaway', 'site': 'testsite',
            'expires_at': (datetime.now() + timedelta(days=5)).isoformat()
        }

        # 4. Call the function
        score = selection_logic.calculate_score(opportunity)

        # 5. Assertions
        self.assertEqual(score, 80.0)  # 0.8 * 100
        # Check that predict_proba was called once
        mock_model.predict_proba.assert_called_once()
        # Check the structure of the DataFrame passed to the model
        call_args = mock_model.predict_proba.call_args
        input_df = call_args[0][0]  # First argument of the call
        self.assertIsInstance(input_df, pd.DataFrame)
        self.assertIn('time_left_days', input_df.columns)
        self.assertAlmostEqual(input_df['time_left_days'][0], 5, delta=0.1)

    def test_calculate_score_fallback_logic(self):
        """
        Test that the fallback logic is used when the model is None.
        """
        # Ensure model is None (done in setUp)
        self.assertIsNone(selection_logic.model)

        # Create a sample opportunity that triggers the fallback logic
        opportunity = {
            'value': 50,  # score += 50 * 1.5 = 75
            'priority': 8,  # score += 8 * 10 = 80 -> 155
            'entries_count': 1000,  # score -= 1000 / 100 = 10 -> 145
            'expires_at': (datetime.now() + timedelta(days=1)).isoformat()  # score += 20 -> 165
        }

        expected_score = (50 * 1.5) + (8 * 10) - (1000 / 100) + 20
        score = selection_logic.calculate_score(opportunity)
        self.assertEqual(score, expected_score)

    def test_fallback_with_missing_keys(self):
        """
        Test that the fallback logic handles missing keys gracefully.
        """
        opportunity = {
            'value': 50,  # score = 75
            # priority is missing
        }
        # Expected score: 50 * 1.5 = 75
        self.assertEqual(selection_logic.calculate_score(opportunity), 75)

        opportunity_2 = {
            'priority': 8,  # score = 80
            'entries_count': 1000  # score -= 10
        }
        # Expected score: 8 * 10 - (1000 / 100) = 70
        self.assertEqual(selection_logic.calculate_score(opportunity_2), 70)

    def test_fallback_with_invalid_date(self):
        """
        Test that the fallback logic handles invalid date formats.
        """
        opportunity = {
            'value': 10,  # score = 15
            'expires_at': 'not-a-date'
        }
        # Should not add the expiry bonus and not crash
        self.assertEqual(selection_logic.calculate_score(opportunity), 15)

    def test_fallback_handles_negative_score(self):
        """
        Test that the score cannot be negative.
        """
        opportunity = {
            'entries_count': 50000  # score = -500
        }
        # max(0, score) should return 0
        self.assertEqual(selection_logic.calculate_score(opportunity), 0)

    def test_calculate_score_model_exception(self):
        """
        Test that fallback logic is used if the model throws an exception.
        """
        # 1. Create a mock model that raises an exception
        mock_model = MagicMock()
        mock_model.predict_proba.side_effect = Exception("Model failure")

        # 2. Inject the mock model
        selection_logic.model = mock_model

        # 3. Create a sample opportunity
        opportunity = {'value': 50, 'priority': 8}  # Data for fallback
        expected_fallback_score = (50 * 1.5) + (8 * 10)

        # 4. Call the function
        score = selection_logic.calculate_score(opportunity)

        # 5. Assert that the score is from the fallback logic
        self.assertEqual(score, expected_fallback_score)


import train_model

class TestTrainModelLogic(unittest.TestCase):

    def test_prepare_data(self):
        """
        Test the data preparation logic from train_model.py
        """
        # 1. Create sample data
        now = datetime.now()
        tomorrow = now + timedelta(days=1)

        data = {
            'participation_status': ['won', 'lost', 'won'],
            'value': [100, None, 50],
            'priority': [5, 10, None],
            'entries_count': [20, None, 30],
            'expires_at': [tomorrow.isoformat(), None, 'Invalid Date']
        }
        df = pd.DataFrame(data)

        # 2. Call the function
        prepared_df = train_model.prepare_data(df)

        # 3. Assertions
        # Target column
        self.assertListEqual(prepared_df['target'].tolist(), [1, 0, 1])

        # FillNA for numeric columns
        self.assertEqual(prepared_df['value'][1], 0)
        self.assertEqual(prepared_df['priority'][2], 0)
        self.assertEqual(prepared_df['entries_count'][1], 0)

        # time_left_days calculation
        self.assertAlmostEqual(prepared_df['time_left_days'][0], 1, delta=0.1)
        self.assertEqual(prepared_df['time_left_days'][1], 30)  # None date
        self.assertEqual(prepared_df['time_left_days'][2], 30)  # Invalid date


if __name__ == '__main__':
    unittest.main()
