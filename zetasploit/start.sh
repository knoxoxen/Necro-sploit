#!/bin/bash

# Dependency checks
echo "Checking for required dependencies..."

check_dependency() {
  local cmd=$1
  local install_cmd=$2
  local description=$3
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: $description ('$cmd') is not installed."
    echo "Please install it using: $install_cmd"
    exit 1
  fi
}

check_dependency "python3" "sudo apt-get update && sudo apt-get install python3" "Python 3"
check_dependency "npm" "sudo apt-get update && sudo apt-get install npm" "Node.js package manager"
check_dependency "msfconsole" "sudo apt-get update && sudo apt-get install metasploit-framework" "Metasploit Framework"
check_dependency "lsof" "sudo apt-get update && sudo apt-get install lsof" "List open files utility"

echo "All required dependencies are installed."
echo ""

# Clean up msfrpcd.log on fresh start
rm -f zetasploit-backend/msfrpcd.log

# Function to clean up processes on exit
cleanup() {
  echo "Caught Ctrl+C. Terminating Zetasploit backend process..."
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null
  fi
  echo "Backend process terminated."

  echo "Deleting log files..."
  rm -f zetasploit-backend/backend.log
  rm -f zetasploit-backend/module_details_error.log
  rm -f zetasploit-backend/msfrpcd.log
  rm -f zetasploit-backend/msf_auth_response.log

  echo "Cleanup complete. Exiting."
  exit 0
}

# Trap Ctrl+C (SIGINT)
trap cleanup SIGINT

# Terminate all Python processes to ensure a clean start
echo "Terminating all Python processes for a clean start..."
killall python || true

# Start Zetasploit Backend
echo "Setting up and starting Zetasploit Backend..."
# Kill any existing process on port 5000 to prevent 'Address already in use' errors
echo "Attempting to free up port 5000..."
sudo lsof -t -i :5000 | xargs -r kill -9 || true
cd zetasploit-backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Start Flask backend in the background
echo "Starting Flask backend..."
nohup venv/bin/python app.py > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Start Zetasploit Frontend
echo "Setting up and starting Zetasploit Frontend..."
cd zetasploit-frontend

# Install Node.js dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Start React frontend
echo "Starting React frontend..."
npm start

echo "Zetasploit setup and launch complete."
