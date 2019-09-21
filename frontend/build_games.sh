#!/bin/bash

echo "path=$(pwd | sed 's/.*\/static/static/')/"

for var in "$@"
do

    echo
    echo "[$var]"
    echo "name=$(basename -- $var | sed 's/\..*//')"
    echo "turns=$(wc -l $var | sed 's/ .*//')"
    echo "players=$(grep players $var | sed 's/"players"://' | tr -d "{}[]'" | tr ',' ' ')"

done
