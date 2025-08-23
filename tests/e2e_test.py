import pytest
from playwright.sync_api import sync_playwright
import threading
import time
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from server import APIServer
import subprocess

@pytest.fixture(scope="module")
def servers():
    # Start the Python server
    server = APIServer(host='localhost', port=8080)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()
    time.sleep(1) # Give the server time to start

    # Start the scraper server
    scraper_process = subprocess.Popen(['npx', 'node', '/app/js/scraper_server.js'])
    time.sleep(1) # Give the scraper server time to start

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
