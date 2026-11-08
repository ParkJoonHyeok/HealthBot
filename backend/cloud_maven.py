"""Run Maven in the managed Linux environment using its proxy and writable cache."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

backend = Path(__file__).resolve().parent
cache = Path(os.environ.get('HEALBOT_MAVEN_CACHE', backend / '.cache')).resolve()
cache.mkdir(parents=True, exist_ok=True)
settings = ET.Element('settings')
ET.SubElement(settings, 'localRepository').text = str(cache / 'm2')
proxy = urlsplit(os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy') or '')
if proxy.hostname:
    entry = ET.SubElement(ET.SubElement(settings, 'proxies'), 'proxy')
    bypass = ['localhost', '127.0.0.1']
    for host in (os.environ.get('NO_PROXY') or os.environ.get('no_proxy') or '').split(','):
        host = host.strip()
        if host and '/' not in host and ':' not in host:
            bypass.append('*' + host if host.startswith('.') else host)
    for key, value in [('id', 'cloud'), ('active', 'true'), ('protocol', 'http'),
                       ('host', proxy.hostname), ('port', str(proxy.port or 80)),
                       ('nonProxyHosts', '|'.join(bypass))]:
        ET.SubElement(entry, key).text = value
    if proxy.username or proxy.password:
        sys.exit('Proxy URL authentication needs a separately secured Maven settings file.')
java = Path(os.environ['JAVA_HOME']) if os.environ.get('JAVA_HOME') else Path(shutil.which('java') or '/missing/java').resolve().parent.parent
flags = []
if not (java / 'lib' / 'ct.sym').exists():
    version = subprocess.run([str(java / 'bin' / 'java'), '-version'], capture_output=True, text=True, check=True)
    if 'version "21.' not in version.stderr:
        sys.exit('A complete JDK 21 is required; unsupported partial Java installation.')
    print('Partial Java 21: compiling with source/target 21 instead of --release.', flush=True)
    flags = ['-Dmaven.compiler.release=', '-Dmaven.compiler.source=21', '-Dmaven.compiler.target=21']
env = dict(os.environ, MAVEN_USER_HOME=str(cache / 'wrapper'))
with tempfile.TemporaryDirectory(prefix='healbot-maven-') as temp:
    config = Path(temp) / 'settings.xml'
    ET.ElementTree(settings).write(config, encoding='unicode')
    config.chmod(0o600)
    result = subprocess.run([str(backend / 'mvnw'), '-s', str(config), '-B', '-ntp', *flags, *(sys.argv[1:] or ['verify'])], cwd=backend, env=env)
sys.exit(result.returncode)
