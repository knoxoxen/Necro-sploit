import os
import subprocess
import time
import random
import string
import functools
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymetasploit3.msfrpc import MsfRpcClient

import logging
import sys
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)
MSF_RPC_PASSWORD = None
MSF_RPC_PORT = 55553 # Default Metasploit RPC port
client = None
API_KEY = None # Global variable for API Key

def generate_api_key(length=32):
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for i in range(length))

def require_api_key(view_function):
    @functools.wraps(view_function)
    def decorated_function(*args, **kwargs):
        if request.headers.get('X-API-Key') and request.headers.get('X-API-Key') == API_KEY:
            return view_function(*args, **kwargs)
        else:
            return jsonify({"error": "Unauthorized: Invalid or missing API Key"}), 401
    return decorated_function

def generate_random_password(length=16):
    characters = string.ascii_letters + string.digits + string.punctuation
    return ''.join(random.choice(characters) for i in range(length))

def start_msfrpcd():
    global MSF_RPC_PASSWORD, API_KEY
    MSF_RPC_PASSWORD = generate_random_password()
    API_KEY = generate_api_key()
    print(f"Starting msfrpcd with password: {MSF_RPC_PASSWORD}")
    print(f"Zetasploit Backend API Key: {API_KEY}")

    # Kill any existing msfrpcd processes
    try:
        subprocess.run(["pkill", "-f", "msfrpcd"], check=False)
        time.sleep(1) # Give some time for the process to terminate
    except Exception as e:
        print(f"Error trying to kill existing msfrpcd processes: {e}")

    command = [
        "msfrpcd",
        "-P", MSF_RPC_PASSWORD,
        "-S", # Enable SSL
        "-f", # Run in foreground
        "-p", str(MSF_RPC_PORT)
    ]
    # Start msfrpcd as a subprocess. We don't wait for it to finish.
    # Redirect stdout/stderr to avoid blocking and to keep the terminal clean.
    with open("msfrpcd.log", "a") as f:
        subprocess.Popen(command, stdout=f, stderr=f)
    time.sleep(5) # Give msfrpcd some time to start

def connect_to_metasploit():
    global client
    if client is None:
        print("Attempting to connect to Metasploit RPC server...")
        try:
            client = MsfRpcClient(MSF_RPC_PASSWORD, port=MSF_RPC_PORT, ssl=False)
            print("Successfully connected to Metasploit RPC server.")
        except Exception as e:
            print(f"Error connecting to Metasploit RPC server: {e}")
            client = None
            # Log the full traceback for more detailed debugging
            import traceback
            traceback.print_exc()
            # Print raw authentication response to a separate file
            if hasattr(e, 'response'):
                with open("msf_auth_response.log", "w") as f:
                    f.write(f"Raw authentication response: {e.response}\n")
    return client

@app.route('/')
def index():
    return "Zetasploit Backend is running!"

@app.route('/api_key', methods=['GET'])
def get_api_key():
    return jsonify({"api_key": API_KEY})

@app.route('/modules', methods=['GET'])
@require_api_key
def list_modules():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    modules = {
        "exploits": client.modules.exploits,
        "payloads": client.modules.payloads,
        "auxiliary": client.modules.auxiliary,
        "post": client.modules.post,
        "encoders": client.modules.encoders,
        "nops": client.modules.nops
    }
    return jsonify(modules)


@app.route('/modules/search', methods=['GET'])
@require_api_key
def search_modules():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    query = request.args.get('q', '').lower()
    platform = request.args.get('platform', '').lower()
    module_type_filter = request.args.get('module_type', '').lower()

    results = []
    module_types_to_search = ["exploits", "payloads", "auxiliary", "post", "encoders", "nops"]

    if module_type_filter and module_type_filter in module_types_to_search:
        module_types_to_search = [module_type_filter]

    for module_type in module_types_to_search:
        for module_name in getattr(client.modules, module_type):
            if query in module_name.lower():
                # Basic platform filtering (can be improved for more accuracy)
                if platform and platform not in module_name.lower():
                    continue
                results.append({"type": module_type, "name": module_name})
    return jsonify(results)

@app.route('/modules/<module_type>/<path:module_name>', methods=['GET'])
@require_api_key
def get_module_details(module_type, module_name):
    client = connect_to_metasploit()
    if not client:
        print("Client is None in get_module_details")
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    try:
        print(f"Attempting to use module: {module_type}/{module_name}")
        module = client.modules.use(module_type, module_name)
        details = {
            "name": module.info.get('fullname', module_name),
            "description": module.info.get('description', 'No description available.'),
            "options": module.options,
            "advanced_options": module.advanced,
            "evasion_options": module.evasion,
            "targets": module.targets,
            "actions": module.actions,
        }
        return jsonify(details)
    except Exception as e:
        print(f"Error using module {module_type}/{module_name}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error using module: {e}"}), 404

@app.route('/modules/<module_type>/<path:module_name>/execute', methods=['POST'])
@require_api_key
def execute_module(module_type, module_name):
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    options = request.json.get('options', {})
    try:
        singular_module_type = module_type.rstrip('s') # Remove 's' from 'exploits', 'auxiliarys', etc.
        module = client.modules.use(singular_module_type, module_name)
        # Set options
        for opt, value in options.items():
            module[opt] = value
        
        # Execute and get job ID
        job_id = module.execute(payload=options.get('PAYLOAD')) # Pass payload if it's an exploit
        return jsonify({"message": "Module executed", "job_id": job_id})
    except Exception as e:
        print(f"Error executing module {module_type}/{module_name}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error executing module: {e}"}), 500

@app.route('/sessions', methods=['GET'])
@require_api_key
def list_sessions():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    sessions = client.sessions.list
    return jsonify(sessions)

@app.route('/platforms', methods=['GET'])
@require_api_key
def list_platforms():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    platforms = client.modules.platforms
    return jsonify(platforms)

@app.route('/jobs', methods=['GET'])
@require_api_key
def list_jobs():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    jobs = client.jobs.list
    return jsonify(jobs)

@app.route('/jobs/<job_id>', methods=['GET'])
@require_api_key
def get_job_details(job_id):
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    try:
        job_details = client.jobs.info(job_id)
        return jsonify(job_details)
    except Exception as e:
        return jsonify({"error": f"Error getting job details: {e}"}), 404

@app.route('/jobs/<job_id>/stop', methods=['POST'])
@require_api_key
def stop_job(job_id):
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    try:
        client.jobs.stop(job_id)
        return jsonify({"message": f"Job {job_id} stopped successfully."})
    except Exception as e:
        return jsonify({"error": f"Error stopping job: {e}"}), 404

@app.route('/console/read', methods=['GET'])
@require_api_key
def read_console():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    console_id = request.args.get('console_id')
    if not console_id:
        return jsonify({"error": "console_id is required"}), 400
        
    try:
        console_output = client.consoles.console(console_id).read()
        return jsonify(console_output)
    except Exception as e:
        return jsonify({"error": f"Error reading console: {e}"}), 500

@app.route('/console/write', methods=['POST'])
@require_api_key
def write_console():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    console_id = request.json.get('console_id')
    command = request.json.get('command')
    
    if not console_id or not command:
        return jsonify({"error": "console_id and command are required"}), 400
        
    # Whitelist of allowed commands (example)
    allowed_commands = [
        'sessions', 'help', 'show', 'use', 'set', 'unset', 'exploit', 
        'run', 'check', 'info', 'search', 'db_status', 'db_nmap',
        'workspace', 'hosts', 'services', 'vulns', 'loot', 'creds'
    ]
    
    # Basic validation: only allow commands from the whitelist
    command_parts = command.strip().split()
    if not command_parts or command_parts[0] not in allowed_commands:
        return jsonify({"error": f"Command not allowed: {command_parts[0]}"}), 403

    try:
        client.consoles.console(console_id).write(command)
        return jsonify({"message": "Command written to console"})
    except Exception as e:
        return jsonify({"error": f"Error writing to console: {e}"}), 500

@app.route('/console/create', methods=['POST'])
@require_api_key
def create_console():
    client = connect_to_metasploit()
    if not client:
        return jsonify({"error": "Could not connect to Metasploit RPC server."}), 500
    
    try:
        console = client.consoles.console()
        return jsonify({"console_id": console.cid})
    except Exception as e:
        return jsonify({"error": f"Error creating console: {e}"}), 500



@app.route('/msfvenom/payloads', methods=['GET'])
@require_api_key
def list_msfvenom_payloads():
    payloads = {
        "Windows": [
            {"name": "windows/meterpreter/reverse_tcp", "description": "Windows Meterpreter (Reflective Injection), Reverse TCP Stager"},
            {"name": "windows/x64/meterpreter/reverse_tcp", "description": "Windows x64 Meterpreter (Reflective Injection), Reverse TCP Stager"},
            {"name": "windows/shell/reverse_tcp", "description": "Windows Command Shell, Reverse TCP Stager"},
            {"name": "windows/x64/shell/reverse_tcp", "description": "Windows x64 Command Shell, Reverse TCP Stager"},
            {"name": "windows/powershell_reverse_tcp", "description": "Windows PowerShell Reverse TCP Stager"},
            {"name": "windows/meterpreter/reverse_https", "description": "Windows Meterpreter, Reverse HTTPS Stager"},
            {"name": "windows/x64/meterpreter/reverse_https", "description": "Windows x64 Meterpreter, Reverse HTTPS Stager"}
        ],
        "Linux": [
            {"name": "linux/x86/meterpreter/reverse_tcp", "description": "Linux x86 Meterpreter, Reverse TCP Stager"},
            {"name": "linux/x64/meterpreter/reverse_tcp", "description": "Linux x64 Meterpreter, Reverse TCP Stager"},
            {"name": "linux/x86/shell/reverse_tcp", "description": "Linux x86 Command Shell, Reverse TCP Stager"},
            {"name": "linux/x64/shell/reverse_tcp", "description": "Linux x64 Command Shell, Reverse TCP Stager"}
        ],
        "macOS": [
            {"name": "osx/x64/meterpreter/reverse_tcp", "description": "OSX x64 Meterpreter, Reverse TCP Stager"},
            {"name": "osx/x64/shell/reverse_tcp", "description": "OSX x64 Command Shell, Reverse TCP Stager"}
        ],
        "Web": [
            {"name": "php/meterpreter/reverse_tcp", "description": "PHP Meterpreter, Reverse TCP Stager"},
            {"name": "java/jsp_shell_reverse_tcp", "description": "Java JSP Command Shell, Reverse TCP Stager"},
            {"name": "war/shell_reverse_tcp", "description": "WAR file Command Shell, Reverse TCP Stager"}
        ],
        "Scripting": [
            {"name": "python/meterpreter/reverse_tcp", "description": "Python Meterpreter, Reverse TCP Stager"},
            {"name": "ruby/shell_reverse_tcp", "description": "Ruby Command Shell, Reverse TCP Stager"},
            {"name": "perl/shell_reverse_tcp", "description": "Perl Command Shell, Reverse TCP Stager"}
        ],
        "Android": [
            {"name": "android/meterpreter/reverse_tcp", "description": "Android Meterpreter, Reverse TCP Stager"}
        ]
    }
    encoders = {
        "x86": ["x86/shikata_ga_nai", "x86/jmp_call_additive", "x86/call4_dword_xor"],
        "x64": ["x64/xor", "x64/zutto_dekiru"],
        "cmd": ["cmd/powershell_base64"],
        "php": ["php/base64"],
        "ruby": ["ruby/base64"],
        "python": ["python/base64"]
    }
    formats = {
        "Windows": ["exe", "dll", "ps1", "py"],
        "Linux": ["elf", "sh", "py"],
        "macOS": ["macho", "sh", "py"],
        "Web": ["php", "asp", "jsp", "war"],
        "Scripting": ["py", "rb", "pl"],
        "Android": ["apk"]
    }
    return jsonify({"payloads": payloads, "encoders": encoders, "formats": formats})

@app.route('/msfvenom/generate', methods=['POST'])
@require_api_key
def generate_payload():
    data = request.json
    payload = data.get('payload')
    options = data.get('options', {})
    format_type = data.get('format', 'raw')
    encoder = data.get('encoder')
    iterations = data.get('iterations')
    template = data.get('template')
    
    if not payload:
        return jsonify({"error": "Payload is required"}), 400
        
    command = ['msfvenom', '-p', payload, '-f', format_type]
    for key, value in options.items():
        command.extend([key, value])
        
    if encoder:
        command.extend(['-e', encoder])
    if iterations:
        command.extend(['-i', str(iterations)])
    if template:
        command.extend(['-x', template])
        
    try:
        # Ensure the output directory exists
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generated_payloads')
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        # Generate a unique filename
        file_extension = format_type if format_type != 'raw' else 'bin'
        filename = f"{payload.replace('/', '_')}_{int(time.time())}.{file_extension}"
        output_path = os.path.join(output_dir, filename)
        
        # Add the output option to the command
        command.extend(['-o', output_path])
        
        subprocess.run(command, check=True, capture_output=True, text=True)
        
        # For simplicity, we'll return a success message with the path
        # In a real-world app, you'd want to handle file serving properly
        return jsonify({"message": "Payload generated successfully", "file_path": output_path})
        
    except subprocess.CalledProcessError as e:
        print(f"msfvenom stdout: {e.stdout}")
        print(f"msfvenom stderr: {e.stderr}")
        return jsonify({"error": "Failed to generate payload", "details": e.stderr, "stdout": e.stdout}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    start_msfrpcd()
    app.run(host='0.0.0.0', port=5000, debug=True)