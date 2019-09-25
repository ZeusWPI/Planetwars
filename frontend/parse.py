#!/usr/bin/python3

import sys
import json

for arg in sys.argv[1:]:
    with open(arg, "r") as f:
        with open("out/"+arg, "w+") as w:
            print(arg)
            for line in f.readlines():
                obj = json.loads(line)

                if "info" in obj:
                    w.write(json.dumps(obj["info"])+"\n")
                if "state" in obj:
                    w.write(json.dumps(obj["state"])+"\n")
            w.flush()
