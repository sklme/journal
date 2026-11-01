#!/usr/bin/env python3
"""One-shot macOS state read. No input, screenshots, unlock or wake assertions."""
import ctypes
from datetime import datetime
import json
import plistlib
import subprocess
import sys


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def registry(*args):
    result = subprocess.run(
        ['/usr/sbin/ioreg', *args, '-a'], capture_output=True, timeout=5, check=True,
    )
    return list(walk(plistlib.loads(result.stdout)))


def console_state():
    for node in registry('-n', 'Root', '-d', '1'):
        for session in node.get('IOConsoleUsers', []):
            if session.get('kCGSSessionOnConsoleKey') is True:
                locked = session.get('CGSSessionScreenIsLocked')
                return {
                    'query_available': True,
                    'on_console': True,
                    'login_done': session.get('kCGSessionLoginDoneKey', session.get('kCGSSessionLoginDoneKey')),
                    'lock_flag_present': 'CGSSessionScreenIsLocked' in session,
                    'screen_locked': locked if isinstance(locked, bool) else None,
                }
    return {'query_available': False, 'screen_locked': None, 'error': 'No active console found'}


def display_state():
    cg = ctypes.CDLL('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    cg.CGMainDisplayID.argtypes = []
    cg.CGMainDisplayID.restype = ctypes.c_uint32
    cg.CGDisplayIsAsleep.argtypes = [ctypes.c_uint32]
    cg.CGDisplayIsAsleep.restype = ctypes.c_uint32
    display = cg.CGMainDisplayID()
    return {'query_available': bool(display),
            'main_display_asleep': bool(cg.CGDisplayIsAsleep(display)) if display else None}


def idle_state():
    for node in registry('-r', '-c', 'IOHIDSystem', '-d', '1'):
        if 'HIDIdleTime' in node:
            value = node['HIDIdleTime']
            if isinstance(value, bytes):
                value = int.from_bytes(value, 'little')
            return {'seconds': round(value / 1_000_000_000, 3)}
    return {'seconds': None, 'error': 'HIDIdleTime unavailable'}


def main():
    if sys.platform != 'darwin':
        print(json.dumps({'error': 'This diagnostic supports macOS only'}))
        return 2
    result = {'time': datetime.now().astimezone().isoformat(timespec='seconds')}
    for name, read in [('console', console_state), ('display', display_state), ('hid_idle', idle_state)]:
        try:
            result[name] = read()
        except Exception as exc:
            # Do not emit raw registry output, account data or command stderr.
            result[name] = {'query_available': False, 'error': type(exc).__name__}
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
