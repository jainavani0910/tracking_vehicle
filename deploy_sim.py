import pexpect
import sys

def run_command_with_password(cmd, expected_prompt, password):
    print(f"Running: {cmd}")
    child = pexpect.spawn(cmd, encoding='utf-8')
    child.logfile = sys.stdout
    
    # Wait for password prompt or EOF
    index = child.expect([expected_prompt, pexpect.EOF, pexpect.TIMEOUT], timeout=30)
    if index == 0:
        child.sendline(password)
        child.expect(pexpect.EOF, timeout=120)
    
    child.close()
    if child.exitstatus != 0:
        print(f"\nWarning: Command exited with status {child.exitstatus}")

def execute_remote():
    host = "192.168.1.180"
    user = "Harsh"
    password = "6666"
    
    # 1. SCP the file
    cmd_scp = f"scp simulation.py {user}@{host}:~/"
    run_command_with_password(cmd_scp, "(?i)password:", password)
    
    # 2. SSH and run the commands using powershell syntax (since remote is Windows)
    # Stop the previous process first
    remote_commands = "powershell -Command \"Stop-Process -Name 'python' -ErrorAction SilentlyContinue; Start-Process -FilePath python -ArgumentList 'simulation.py' -RedirectStandardOutput 'simulation.log' -RedirectStandardError 'simulation_err.log' -WindowStyle Hidden\""
    cmd_ssh = f"ssh {user}@{host} \"{remote_commands}\""
    run_command_with_password(cmd_ssh, "(?i)password:", password)
    
    print("\nDeployment complete. The simulation is now running on the remote PC in the background.")
    print("You can view logs on the remote PC via: tail -f ~/simulation.log")

if __name__ == "__main__":
    execute_remote()
