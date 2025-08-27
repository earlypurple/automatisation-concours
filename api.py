print("Importing dependencies...")
from fastapi import FastAPI, HTTPException, Response
import time
import psutil
import database as db
from logger import logger
import os

app = FastAPI()
start_time = time.time()

def check_scraper_status():
    """Checks the scraper's status by testing basic connectivity."""
    try:
        # A simple test to check if the scraper module is accessible
        import scraper
        return 'ok'
    except Exception as e:
        logger.warning(f"Scraper status check failed: {e}")
        return 'degraded'

def get_memory_usage():
    """Gets memory usage if available."""
    try:
        process = psutil.Process(os.getpid())
        return {
            'rss_mb': round(process.memory_info().rss / 1024 / 1024, 2),
            'vms_mb': round(process.memory_info().vms / 1024 / 1024, 2)
        }
    except ImportError:
        return {'status': 'unavailable', 'reason': 'psutil not installed'}

@app.get("/api/health")
def health_check():
    """Handles health check requests with advanced metrics."""
    try:
        db_status = db.check_db_status()
        scraper_status = check_scraper_status()

        uptime = time.time() - start_time

        status = {
            'status': 'healthy',
            'timestamp': time.time(),
            'version': '4.0.0',
            'services': {
                'api': {'status': 'ok', 'uptime_seconds': uptime},
                'database': {'status': db_status, 'active_profile': db.get_active_profile() is not None},
                'scraper': {'status': scraper_status},
            },
            'system': {
                'uptime_seconds': uptime,
                'uptime_human': f"{int(uptime//3600)}h {int((uptime%3600)//60)}m",
                'memory_usage': get_memory_usage(),
                'cache_enabled': True
            }
        }

        all_services_ok = all(
            service['status'] == 'ok'
            for service in status['services'].values()
        )

        if not all_services_ok:
            status['status'] = 'degraded'

        status_code = 200 if status['status'] == 'healthy' else 503
        return Response(content=str(status), status_code=status_code, media_type="application/json")

    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=503, detail={
            'status': 'error',
            'message': 'Health check failed',
            'error': str(e)
        })

from config_handler import config_handler
from pydantic import BaseModel

class Config(BaseModel):
    # Define the structure of your config here for validation
    pass

@app.get("/api/config")
def get_config():
    """Gets the application configuration."""
    return config_handler.get_config()

@app.post("/api/config")
def save_config(config: dict):
    """Saves the application configuration."""
    config_handler.save_config(config)
    return {"message": "Configuration saved successfully"}

class Profile(BaseModel):
    name: str
    email: str
    userData: dict
    settings: dict

@app.get("/api/profiles")
def get_profiles():
    """Gets all profiles."""
    return db.get_profiles()

@app.post("/api/profiles")
def create_profile(profile: Profile):
    """Creates a new profile."""
    profile_id = db.create_profile(profile.name, profile.email, profile.userData, profile.settings)
    return {'id': profile_id, 'message': 'Profile created successfully'}

@app.put("/api/profiles/{profile_id}")
def update_profile(profile_id: int, profile: Profile):
    """Updates a profile."""
    db.update_profile(profile_id, profile.name, profile.email, profile.userData, profile.settings)
    return {'message': f'Profile {profile_id} updated'}

@app.delete("/api/profiles/{profile_id}")
def delete_profile(profile_id: int):
    """Deletes a profile."""
    try:
        db.delete_profile(profile_id)
        return {'message': f'Profile {profile_id} deleted'}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/profiles/{profile_id}/activate")
def activate_profile(profile_id: int):
    """Activates a profile."""
    db.set_active_profile(profile_id)
    return {'message': f'Profile {profile_id} activated'}

@app.get("/api/profiles/active")
def get_active_profile():
    """Gets the active profile."""
    return db.get_active_profile()

@app.get("/api/proxies")
def get_proxies():
    """Gets the list of proxies."""
    return config_handler.get_proxies()

from intelligent_cache import api_cache
import analytics
from fastapi import BackgroundTasks, Depends, Request
import json
from rate_limiter import rate_limiter

def get_client_ip(request: Request):
    return request.client.host

@app.get("/api/data")
def get_data(client_ip: str = Depends(get_client_ip)):
    """Gets opportunities and stats for the active profile."""
    if not rate_limiter.is_allowed(client_ip, 'api'):
        raise HTTPException(status_code=429, detail='Rate limit exceeded')

    active_profile = db.get_active_profile()
    if not active_profile:
        raise HTTPException(status_code=404, detail='No active profile found')

    cache_key = f"opportunities_data_{active_profile['id']}"
    cached_data = api_cache.get(cache_key)
    if cached_data:
        cached_data['cached'] = True
        return cached_data

    opportunities = db.get_opportunities(active_profile['id'])
    stats = analytics.get_analytics_data(active_profile['id'])

    response_data = {
        'opportunities': opportunities,
        'stats': stats,
        'profile': active_profile,
        'cached': False,
        'timestamp': time.time()
    }

    api_cache.set(cache_key, response_data, ttl=300)

    return response_data

@app.post("/api/participate")
def participate(background_tasks: BackgroundTasks, id: int, client_ip: str = Depends(get_client_ip)):
    """Queues a participation job."""
    if not rate_limiter.is_allowed(client_ip, 'heavy'):
        raise HTTPException(status_code=429, detail='Rate limit exceeded')

    active_profile = db.get_active_profile()
    if not active_profile:
        raise HTTPException(status_code=400, detail='No active profile to participate with.')

    opportunity = db.get_opportunity_by_id(id)
    if not opportunity:
        raise HTTPException(status_code=404, detail='Opportunity not found')

    user_data = json.loads(active_profile['user_data'])
    site_key = opportunity.get('site')
    site_config = config_handler.get_config().get('sites', {}).get(site_key, {})
    requires_confirmation = site_config.get('requires_email_confirmation', False)

    job = {
        'id': id,
        'url': opportunity['url'],
        'userData': user_data,
        'requires_email_confirmation': requires_confirmation,
        'profile_id': active_profile['id']
    }

    # This is a simplified version of the worker queue.
    # In a real-world scenario, you would use a more robust solution like Celery.
    # For now, we'll just log the job.
    logger.info(f"Participation queued for opportunity {id}")
    db.update_opportunity_status(id, 'pending', 'Participation mise en file d\'attente.')

    return {'success': True, 'message': 'Participation en file d\'attente.'}
