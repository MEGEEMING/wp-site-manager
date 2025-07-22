import flask
from flask import Flask, jsonify
import docker
from flask_cors import CORS
import os
import subprocess
import yaml
import secrets
import string
import random
import json
import os
import datetime
import re
import shutil

SITES_FILE_PATH = 'sites/sites.json'

app = Flask(__name__)
CORS(app) # Enable CORS for all routes
client = docker.from_env()

def load_sites_data():
    if not os.path.exists(SITES_FILE_PATH):
        return {}
    try:
        with open(SITES_FILE_PATH, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError:
        # Handle case where sites.json is empty or malformed
        return {}
    except IOError as e:
        print(f"Error reading sites.json: {e}")
        return {}

def save_sites_data(sites_data):
    try:
        # Ensure the directory exists before writing
        os.makedirs(os.path.dirname(SITES_FILE_PATH), exist_ok=True)
        with open(SITES_FILE_PATH, 'w') as f:
            json.dump(sites_data, f, indent=4)
    except IOError as e:
        print(f"Error writing sites.json: {e}")
        raise # Re-raise to be caught by the calling function if needed


@app.route('/')
def index():
    return jsonify({'message': 'Hello, World!'})

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy'})

@app.route('/api/version')
def version():
    return jsonify({'version': '1.0.0'})


@app.route('/api/sites', methods=['GET'])
def get_sites():
    sites_data = []
    # Load sites from sites.json for additional metadata
    registered_sites = load_sites_data()

    sites_base_dir = 'sites'
    if not os.path.exists(sites_base_dir):
        return jsonify({'sites': []})
    
    for site_name in registered_sites:
        site_info = registered_sites[site_name]
        sites_data.append({
            'id': site_info.get('id'),
            'name': site_info.get('name'),
            'description': site_info.get('description'),
            'url': site_info.get('url'),
            'port': site_info.get('port'),
            'status': site_info.get('status'),
            'createdAt': site_info.get('createdAt')
        })

    
    return jsonify({'sites': sites_data})

def generate_password(length=16):
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_port():
    used_ports = []
    for container in client.containers.list():
        ports = container.attrs['NetworkSettings']['Ports']
        if ports and '80/tcp' in ports and ports['80/tcp']:
            used_ports.append(int(ports['80/tcp'][0]['HostPort']))
    port = 8000
    while port in used_ports:
        port += 1
    return port
    
    
@app.route('/api/sites', methods=['POST'])
def create_site():
    data = flask.request.get_json()
    name = data.get('name')
    description = data.get('description')

    if not name or not description:
        return jsonify({'error': 'Site name and description are required'}), 400

    sanitized_name = (lambda name: ('x' if not name[0].isalnum() else '') + re.sub(r'[^a-z0-9._-]', '_', name.lower()))(name)

    site_dir = os.path.join('sites', sanitized_name)
    os.makedirs(site_dir, exist_ok=True)

    db_password = generate_password(length=12)
    db_name = f'{sanitized_name}_db'

    port = generate_port()
    url = f"http://localhost:{port}"

    compose_config = {
        'services': {
            'db': {
                'image': 'mariadb:10.6',
                'restart': 'unless-stopped',
                'environment': {
                    'MYSQL_ROOT_PASSWORD': db_password,
                    'MYSQL_DATABASE': db_name,
                    'MYSQL_USER': 'wordpress',
                    'MYSQL_PASSWORD': db_password
                },
                'volumes': [
                    f'./db_data/{sanitized_name}:/var/lib/mysql'
                ]
            },
            'wordpress': {
                'image': f"wordpress:latest",
                'restart': 'unless-stopped',
                'ports': [
                    f'{port}:80'
                ],
                'environment': {
                    'WORDPRESS_DB_HOST': 'db',
                    'WORDPRESS_DB_USER': 'wordpress',
                    'WORDPRESS_DB_PASSWORD': db_password,
                    'WORDPRESS_DB_NAME': db_name
                },
                'volumes': [
                    f'./wp_data/{sanitized_name}:/var/www/html'
                ],
                'depends_on': [
                    'db'
                ],
                'labels': {
                    'wpmanager': 'true',
                }
            }
        }
    }

    compose_file_path = os.path.join(site_dir, 'docker-compose.yml')
    try:
        with open(compose_file_path, 'w') as f:
            yaml.dump(compose_config, f, default_flow_style=False)

        # Run docker-compose up
        subprocess.run(['docker-compose', 'up', '-d'], cwd=site_dir, check=True)
        
        # Find the WordPress container
        container = next(c for c in client.containers.list(all=True)
                if c.labels.get("com.docker.compose.project") == sanitized_name
                and c.labels.get("com.docker.compose.service") == "wordpress")

        if container:

            created_at = datetime.datetime.now().isoformat()
            sites = load_sites_data()
            sites[container.short_id] = {
                'id': container.short_id,
                'name': name,
                'description': description,
                'url': url,
                'port': port,
                'status': container.status,
                'createdAt': created_at
            }
            save_sites_data(sites)

            return jsonify({
                'message': 'Site created successfully',
                'site': {
                    'id': container.short_id,
                    'name': name,
                    'description': description,
                    'url': url,
                    'port': port,
                    'status': container.status,
                    'createdAt': created_at
                }
            })
        else:
            return jsonify({'error': 'Failed to create site'}), 500
    except subprocess.CalledProcessError as e:
        return jsonify({'error': f"Docker Compose command failed: {e}"}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    
def get_wordpress_container(site_name):
    try:
        sanitized_name = site_name.replace(':', '_')
        container = next(c for c in client.containers.list(all=True)
                         if c.labels.get("com.docker.compose.project") == sanitized_name
                         and c.labels.get("com.docker.compose.service") == "wordpress")
        return container
    except StopIteration:
        print(f"No WordPress container found for site {site_name}.")
        return None
    except Exception as e:
        print(f"Error getting WordPress container for site {site_name}: {e}")
        return None

@app.route('/api/sites/<site_id>', methods=['GET'])
def get_site(site_id):
    try:
        sites_data = load_sites_data()
        site_info = sites_data.get(site_id)

        if not site_info:
            return jsonify({'error': f"Site {site_id} not found"}), 404

        return jsonify({
            'id': site_id,
            'name': site_info.get('name'),
            'description': site_info.get('description'),
            'url': site_info.get('url'),
            'port': site_info.get('port'),
            'status': site_info.get('status'),
            'createdAt': site_info.get('createdAt')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/sites/<site_id>', methods=['DELETE'])
def delete_site(site_id):
    try:
        sites_data = load_sites_data()
        site_info = sites_data.get(site_id)

        if not site_info:
            return jsonify({'error': f"Site {site_id} not found"}), 404

        # Check container status. Allow deletion if not running or not found.
        try:
            container = client.containers.get(site_id)
            if container.status == 'running':
                return jsonify({'error': 'Cannot delete a running site. Please stop it first.'}), 400
        except docker.errors.NotFound:
            pass  # Container not found, proceed with cleanup.

        name = site_info.get('name')
        sanitized_name = (lambda name: ('x' if not name[0].isalnum() else '') + re.sub(r'[^a-z0-9._-]', '_', name.lower()))(name)
        site_dir = os.path.join('sites', sanitized_name)

        # Take down the compose stack and remove volumes
        if os.path.exists(site_dir):
            compose_file = os.path.join(site_dir, 'docker-compose.yml')
            if os.path.exists(compose_file):
                subprocess.run(['docker-compose', 'down', '--volumes'], cwd=site_dir, check=True)
            
            # Remove the site directory
            shutil.rmtree(site_dir)

        # Remove site from metadata
        del sites_data[site_id]
        save_sites_data(sites_data)

        return jsonify({'message': f"Site {site_id} deleted successfully"})
    except subprocess.CalledProcessError as e:
        return jsonify({'error': f"Docker Compose command failed: {e}"}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/sites/<site_id>/stop', methods=['POST'])
def stop_site(site_id):
    try:
        sites_data = load_sites_data()
        site_info = sites_data.get(site_id)

        if not site_info:
            return jsonify({'error': f"Site {site_id} not found"}), 404

        container = client.containers.get(site_id)
        if container:
            container.stop()
            site_info['status'] = 'stopped'
            save_sites_data(sites_data)
            return jsonify({'message': f"Site {site_id} stopped successfully"})
        else:
            return jsonify({'error': f"Failed to stop site {site_id}"}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sites/<site_id>/start', methods=['POST'])
def start_site(site_id):
    try:
        sites_data = load_sites_data()
        site_info = sites_data.get(site_id)

        if not site_info:
            return jsonify({'error': f"Site {site_id} not found"}), 404

        container = client.containers.get(site_id)
        if container:
            container.start()
            container.reload()
            site_info['status'] = container.status
            save_sites_data(sites_data)
            return jsonify({'message': f"Site {site_id} started successfully"})
        else:
            return jsonify({'error': f"Failed to start site {site_id}"}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500



app.run('0.0.0.0', '5000', True)