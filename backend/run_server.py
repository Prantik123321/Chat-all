#!/usr/bin/env python3
"""
Watchdog script for Chat-Box Server
Auto-restarts server on crash
"""

import subprocess
import sys
import os
import time
import signal
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server_watchdog.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ServerWatchdog:
    def __init__(self):
        self.server_process = None
        self.restart_count = 0
        self.max_restarts = 10
        self.is_running = True
        
    def start_server(self):
        env = os.environ.copy()
        env['PYTHONUNBUFFERED'] = '1'
        
        cmd = [sys.executable, 'app.py']
        
        logger.info(f"Starting server... (Attempt {self.restart_count + 1})")
        
        self.server_process = subprocess.Popen(
            cmd,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        logger.info(f"Server started with PID: {self.server_process.pid}")
        
        # Monitor output
        import threading
        thread = threading.Thread(target=self.monitor_output)
        thread.daemon = True
        thread.start()
        
    def monitor_output(self):
        for line in iter(self.server_process.stdout.readline, ''):
            if line:
                timestamp = datetime.now().strftime('%H:%M:%S')
                print(f"[{timestamp}] {line}", end='')
                
    def restart_server(self):
        if self.restart_count >= self.max_restarts:
            logger.error("Max restart attempts reached. Stopping.")
            self.stop()
            return
            
        self.stop_server()
        
        delay = min(2 * (2 ** self.restart_count), 60)
        logger.info(f"Waiting {delay} seconds before restart...")
        time.sleep(delay)
        
        self.restart_count += 1
        logger.info(f"Restarting server (Attempt {self.restart_count}/{self.max_restarts})")
        
        self.start_server()
        
    def stop_server(self):
        if self.server_process:
            logger.info("Stopping server...")
            try:
                self.server_process.terminate()
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning("Force killing server...")
                self.server_process.kill()
                self.server_process.wait()
            
            self.server_process = None
            
    def stop(self):
        logger.info("Stopping watchdog...")
        self.is_running = False
        self.stop_server()
        sys.exit(0)
    
    def run(self):
        logger.info("=" * 50)
        logger.info("🚀 Chat-Box Server Watchdog Starting")
        logger.info("♻️ Auto-restart: Enabled")
        logger.info("=" * 50)
        
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        try:
            self.start_server()
            
            while self.is_running:
                if self.server_process and self.server_process.poll() is not None:
                    exit_code = self.server_process.poll()
                    logger.error(f"Server died with exit code: {exit_code}")
                    self.restart_server()
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Watchdog stopped by user")
        except Exception as e:
            logger.error(f"Watchdog error: {e}")
        finally:
            self.stop()
    
    def signal_handler(self, signum, frame):
        logger.info(f"Received signal {signum}. Shutting down...")
        self.stop()

def main():
    watchdog = ServerWatchdog()
    watchdog.run()

if __name__ == "__main__":
    main()