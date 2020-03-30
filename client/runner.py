#! /usr/bin/env python

import socket, sys, subprocess, argparse, io, threading, json


def execute(cmd):
    popen = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, universal_newlines=True)
    yield(popen.stdin)

    for stdout_line in iter(popen.stdout.readline, "\n"):
        yield stdout_line
    popen.stdout.close()
    return_code = popen.wait()
    if return_code:
        raise subprocess.CalledProcessError(return_code, cmd)

def connect(host, port, id):
    print(host, port)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))
    s.sendall(f"{id.strip()}\n".encode("utf8"))
    return s

def handle_input(it, socket):
    for line in it:
        socket.sendall(line.encode('utf8'))

def main():
    parser = argparse.ArgumentParser(description='Run MOZAIC bot')
    parser.add_argument('--id', '-i', required=True,
                        help='The bot\'s ID')
    parser.add_argument('--host', default="localhost",
                        help='What host to connect to')
    parser.add_argument('--port', '-p', default=6666, type=int,
                        help='What port to connect to')
    parser.add_argument('arguments', nargs=argparse.REMAINDER,
                        help='How to run the bot')
    args = parser.parse_args()

    sock = connect(args.host, args.port, args.id)
    f = sock.makefile("rw")

    it = execute(args.arguments)
    stdin = next(it)

    threading.Thread(target=lambda: handle_input(it, sock), daemon=True).start()

    line = f.readline()
    content = "Nothing"
    while line:
        content = json.loads(line)
        if content["type"] == "game_state":
            stdin.write(json.dumps(content["content"])+"\n")
            stdin.flush()
        if content["type"] == "player_action":
            if content["content"]["type"] == "parse_error":
                sys.stderr.write(content["content"]["value"] + '\n')
                sys.stderr.flush()
        line = f.readline()

    print(content)

if __name__ == "__main__":
    main()
