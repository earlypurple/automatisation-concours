import pytest
from playwright.sync_api import sync_playwright
import threading
import time
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from server import APIServer
import subprocess

import database

@pytest.fixture(scope="module")
def servers():
    # Initialize a clean database for testing
    if os.path.exists(database.DB_FILE):
        os.remove(database.DB_FILE)
    database.run_migrations()
    database.init_db()

    # Add some sample data for testing
    with database.db_cursor() as cur:
        cur.execute("INSERT INTO opportunities (id, title, description, value, priority, score, url, site, type, auto_fill, detected_at, expires_at, status, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (1, 'Great Opportunity', 'A really great opportunity', 100, 5, 500, 'http://example.com/great', 'example.com', 'test', 1, '2025-01-01', '2025-12-31', 'pending', 1))
        cur.execute("INSERT INTO opportunities (id, title, description, value, priority, score, url, site, type, auto_fill, detected_at, expires_at, status, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (2, 'Awesome Opportunity', 'An awesome opportunity', 50, 10, 1000, 'http://example.com/awesome', 'example.com', 'test', 1, '2025-01-01', '2025-12-31', 'pending', 1))
        cur.execute("INSERT INTO opportunities (id, title, description, value, priority, score, url, site, type, auto_fill, detected_at, expires_at, status, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (3, 'Another Great Deal', 'A great deal for you', 200, 2, 250, 'http://example.com/another', 'example.com', 'test', 1, '2025-01-01', '2025-12-31', 'pending', 1))

    # Start the Python server
    server = APIServer(host='localhost', port=8080)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()
    time.sleep(1)  # Give the server time to start

    # Start the scraper server
    scraper_process = subprocess.Popen(['node', 'js/scraper_server.js'])
    time.sleep(1)  # Give the scraper server time to start

    yield

    # Stop the servers
    server.shutdown()
    scraper_process.terminate()


def test_homepage(servers):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8080")
        assert page.title() == "🎯 Surveillance Gratuite Pro - Dashboard V3.0"

        # Check that the opportunities grid is displayed
        opportunities_grid = page.query_selector(".opportunities-grid")
        assert opportunities_grid is not None

        browser.close()


def test_navigation_to_settings_page(servers):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8080")

        # Click the "Settings" link
        page.click("text=Settings")

        # Check that the URL is correct
        assert page.url == "http://localhost:8080/settings"

        # Check that the settings page heading is displayed
        settings_heading = page.query_selector("h1:has-text('Settings')")
        assert settings_heading is not None

        browser.close()


def test_filtering_and_sorting(servers):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8080")

        # 1. Initial state: all opportunities are displayed
        page.wait_for_selector(".opportunity-card")
        cards = page.query_selector_all(".opportunity-card")
        assert len(cards) == 3

        # 2. Filter by title
        page.fill("input[placeholder='Search by title...']", "Great")
        cards = page.query_selector_all(".opportunity-card")
        assert len(cards) == 2
        titles = [card.query_selector("h3").inner_text() for card in cards]
        assert "Great Opportunity" in titles
        assert "Another Great Deal" in titles

        # 3. Clear filter
        page.fill("input[placeholder='Search by title...']", "")
        cards = page.query_selector_all(".opportunity-card")
        assert len(cards) == 3

        # 4. Sort by value
        page.select_option("select", "value")
        titles = [card.query_selector("h3").inner_text() for card in page.query_selector_all(".opportunity-card")]
        assert titles == ["Another Great Deal", "Great Opportunity", "Awesome Opportunity"]

        # 5. Sort by priority
        page.select_option("select", "priority")
        titles = [card.query_selector("h3").inner_text() for card in page.query_selector_all(".opportunity-card")]
        assert titles == ["Awesome Opportunity", "Great Opportunity", "Another Great Deal"]

        browser.close()
