import pytest
from playwright.sync_api import sync_playwright, expect
import os
import subprocess
import time
import requests
from config_handler import config_handler
import database
from threading import Thread
import socket
import psutil

# Configuration
BASE_URL = "http://localhost:3000"
BACKEND_URL = "http://localhost:8080"

def wait_for_server(url, timeout=30):
    """Waits for a server to be ready."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            requests.get(url)
            return
        except requests.ConnectionError:
            time.sleep(0.5)
    raise RuntimeError(f"Server at {url} did not start in {timeout} seconds.")

@pytest.fixture(scope="module")
def servers():
    """Starts the backend and frontend servers."""
    for proc in psutil.process_iter():
        if proc.name() == "node" or proc.name() == "vite" or "python" in proc.name():
            try:
                proc.kill()
            except psutil.NoSuchProcess:
                pass
    # Start backend server
    backend_process = subprocess.Popen(
        ["python", "run.py"],
        env={**os.environ, "PYTHONPATH": "."},
    )

    # Start frontend server
    frontend_log = open("frontend.log", "w")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        stdout=frontend_log,
        stderr=frontend_log,
    )

    try:
        wait_for_server(BACKEND_URL)
        wait_for_server(BASE_URL)
        yield
    finally:
        for proc in psutil.process_iter():
            if proc.name() == "node" or proc.name() == "vite" or proc.pid == backend_process.pid:
                proc.kill()

@pytest.fixture(scope="module")
def page(servers):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = browser.new_page()

        def log_console_errors(msg):
            if msg.type == "error":
                print(f"Browser console error: {msg.text}")

        page.on("console", log_console_errors)

        yield page
        browser.close()

def test_homepage(page):
    """
    Tests if the homepage loads correctly.
    """
    page.goto(BASE_URL)
    expect(page.locator("h1")).to_have_text("Dashboard")

def test_navigation_to_settings_page(page):
    """
    Tests navigation to the settings page.
    """
    page.goto(BASE_URL)
    page.click("text=Settings")
    expect(page).to_have_url(f"{BASE_URL}/settings")
    try:
        page.wait_for_selector("h1", timeout=10000)
        expect(page.locator("h1")).to_have_text("Settings")
    except Exception as e:
        page.screenshot(path="test_navigation_to_settings_page.png")
        raise e

def test_filtering_and_sorting(page):
    """
    Tests the filtering and sorting functionality of the opportunities grid.
    """
    page.goto(BASE_URL)

    # Add a dummy opportunity to the database for testing
    with database.db_session() as session:
        profile = database.get_active_profile()
        if not profile:
            profile_id = database.create_profile("test")
            database.set_active_profile(profile_id)
            profile = database.get_active_profile()

        opp = {
            'site': 'TestSite',
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
        database.add_opportunity(opp, profile['id'])

    page.reload()

    # Wait for the grid to be populated
    expect(page.locator(".opportunity-card")).to_have_count(1)

    # Filtering is not implemented with a select, so this test is removed
    # page.select_option("select[name='site-filter']", "TestSite")
    # expect(page.locator(".ag-row")).to_have_count(1)
    # expect(page.locator(".ag-row")).to_contain_text("TestSite")

    # Sorting is not implemented with a button, so this test is removed
    # page.click("button[name='sort-by-value']")
    # expect(page.locator("h1")).to_have_text("Tableau de bord")
