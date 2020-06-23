# Planetwars

## Docker

Build: `docker build --tag pw:1.0 .`

Run: `docker run --rm -p 8123:8123 -p 9142:9142 -p 3012:3012 -v $(pwd)/backend/games:/planetwars/backend/games --name planetwars pw:1.0`

Add parameter `-e ROCKET_HOST_NAME=<domain>`, for example `-e ROCKET_HOST_NAME=mozaic.zeus.gent`, to set the domain used in the application.
