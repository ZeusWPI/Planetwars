#!/bin/bash

curl -X POST -H "Content-Type: application/json" -d @game_start.json ${HOST:-localhost:8000}/lobby | \
	python3 -c "import sys, json; print('\n'.join(str(x) for x in json.load(sys.stdin)['players']))"
