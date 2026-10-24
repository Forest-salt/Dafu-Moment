"""Initialize and destroy an owned temporary MySQL; never connect to project or system DB."""
from pathlib import Path
import argparse, json, os, secrets, shutil, socket, subprocess, tempfile, time

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--mysql-bin',required=True);p.add_argument('--node',required=True);p.add_argument('--output',required=True)
    a=p.parse_args();out=Path(a.output).resolve()
    if out.exists():raise SystemExit('Refuse to reuse existing report directory')
    out.mkdir(parents=True);owned=Path(tempfile.mkdtemp(prefix='codex-db3-services-')).resolve()
    bindir=Path(a.mysql_bin).resolve();flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
    proc=None;log=None;password=None;cli=None
    try:
        r=subprocess.run([str(bindir/'mysqld.exe'),'--no-defaults','--initialize-insecure','--basedir='+str(bindir.parent),'--datadir='+str(owned/'data')],capture_output=True,creationflags=flags)
        (out/'initialization.log').write_bytes(r.stdout+r.stderr)
        if r.returncode:raise RuntimeError('MySQL temporary initialization failed')
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        log=(out/'server.log').open('wb')
        proc=subprocess.Popen([str(bindir/'mysqld.exe'),'--no-defaults','--basedir='+str(bindir.parent),'--datadir='+str(owned/'data'),'--bind-address=127.0.0.1','--port='+str(port),'--mysqlx=0','--default-time-zone=+08:00','--innodb-buffer-pool-size=64M','--innodb-redo-log-capacity=32M','--console'],stdout=log,stderr=log,creationflags=flags)
        cli=[str(bindir/'mysql.exe'),'--no-defaults','--protocol=TCP','--host=127.0.0.1','--port='+str(port),'--user=root','--batch','--skip-column-names']
        for _ in range(120):
            r=subprocess.run(cli,input=b'SELECT 1;',capture_output=True,creationflags=flags)
            if r.returncode==0:break
            if proc.poll() is not None:raise RuntimeError('Temporary server exited')
            time.sleep(.25)
        else:raise RuntimeError('Temporary server unavailable')
        password=secrets.token_hex(24)
        r=subprocess.run(cli,input=("ALTER USER 'root'@'localhost' IDENTIFIED BY '"+password+"';").encode(),capture_output=True,creationflags=flags)
        if r.returncode:raise RuntimeError('Temporary root protection failed')
        env=os.environ.copy();env.update(DB_HOST='127.0.0.1',DB_PORT=str(port),DB_USER='root',DB_PASSWORD=password,DB_NAME='db3_regression',DB3_OWNED_TEST='1')
        r=subprocess.run([a.node,str(Path(__file__).with_name('test_db3_services.js')),str(out/'verification.json')],env=env,capture_output=True,creationflags=flags,timeout=180)
        (out/'test-output.txt').write_bytes(r.stdout+r.stderr)
        print(r.stdout.decode('utf-8',errors='replace'))
        if r.returncode:
            print(r.stderr.decode('utf-8',errors='replace'));raise RuntimeError('DB3 service regression failed; see test-output.txt')
        print('Verified: '+str(out/'verification.json'))
    finally:
        if proc is not None and proc.poll() is None:
            shutdown_env=os.environ.copy()
            if password:shutdown_env['MYSQL_PWD']=password
            try:
                subprocess.run(cli,input=b'SHUTDOWN;',env=shutdown_env,capture_output=True,creationflags=flags,timeout=10)
                proc.wait(timeout=20)
            except (subprocess.TimeoutExpired,OSError):proc.terminate();proc.wait(timeout=20)
        if log:log.close()
        if owned.parent==Path(tempfile.gettempdir()).resolve() and owned.name.startswith('codex-db3-services-'):
            for attempt in range(20):
                try:shutil.rmtree(owned);break
                except PermissionError:
                    if attempt==19:raise
                    time.sleep(.5)

if __name__=='__main__':main()
