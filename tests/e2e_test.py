import pytest
from playwright.sync_api import sync_playwright, expect
from intelligent_cache import api_cache
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

@pytest.fixture(autouse=True)
def clear_api_cache():
    """Clears the API cache before each test."""
    api_cache.clear()

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

def setup_test_database():
    """Sets up the database for testing."""
    if os.path.exists("surveillance.db"):
        os.remove("surveillance.db")
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    profile_id = database.create_profile(name="default", email="test@example.com", user_data={}, settings={})
    database.set_active_profile(profile_id)

@pytest.fixture(scope="module")
def servers():
    """Starts the backend and frontend servers."""
    for proc in psutil.process_iter():
        if proc.name() == "node" or proc.name() == "vite" or "python" in proc.name():
            try:
                proc.kill()
            except psutil.NoSuchProcess:
                pass

    setup_test_database()

    # Start backend server
    print("Starting backend server...")
    backend_process = subprocess.Popen(
        ["python", "run.py"],
        env={**os.environ, "PYTHONPATH": "."},
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    print("Backend server started.")

    # Start frontend server
    print("Starting frontend server...")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    print("Frontend server started.")

    try:
        wait_for_server(BACKEND_URL)
        wait_for_server(BASE_URL)
        time.sleep(10) # Give servers time to settle
        yield
    finally:
        for proc in psutil.process_iter():
            if proc.name() == "node" or proc.name() == "vite" or proc.pid == backend_process.pid:
                proc.kill()
        print("Servers stopped.")

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

    # Add dummy opportunities to the database for testing
    with database.db_session() as session:
        profile = database.get_active_profile()
        opp1 = {
            'site': 'TestSite',
            'title': 'Alpha Opportunity',
            'description': 'A test opportunity',
            'url': 'http://example.com/opp1',
            'type': 'test',
            'priority': 2,
            'value': 100,
            'auto_fill': False,
            'detected_at': '2023-01-01T00:00:00',
            'expires_at': '2023-01-31T00:00:00',
            'entries_count': 10,
            'time_left': '30 days',
            'score': 80
        }
        opp2 = {
            'site': 'AnotherSite',
            'title': 'Beta Opportunity',
            'description': 'Another test opportunity',
            'url': 'http://example.com/opp2',
            'type': 'test',
            'priority': 1,
            'value': 200,
            'auto_fill': False,
            'detected_at': '2023-01-01T00:00:00',
            'expires_at': '2023-01-31T00:00:00',
            'entries_count': 20,
            'time_left': '30 days',
            'score': 90
        }
        database.add_opportunity(opp1, profile['id'])
        database.add_opportunity(opp2, profile['id'])

    page.reload()

    # Wait for the grid to be populated
    expect(page.locator(".opportunity-card")).to_have_count(2)

    # Test filtering
    page.fill("input[type='text']", "Alpha")
    expect(page.locator(".opportunity-card")).to_have_count(1)
    expect(page.locator(".opportunity-card h3")).to_have_text("Alpha Opportunity")
    page.fill("input[type='text']", "") # Clear filter

    # Test sorting by value
    page.select_option("select", "value")
    cards = page.locator(".opportunity-card").all()
    expect(cards[0].locator("h3")).to_have_text("Beta Opportunity") # Higher value
    expect(cards[1].locator("h3")).to_have_text("Alpha Opportunity")

    # Test sorting by priority
    page.select_option("select", "priority")
    cards = page.locator(".opportunity-card").all()
    expect(cards[0].locator("h3")).to_have_text("Alpha Opportunity") # Higher priority
    expect(cards[1].locator("h3")).to_have_text("Beta Opportunity")
