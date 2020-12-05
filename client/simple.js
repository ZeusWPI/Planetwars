const fs = require('fs')
const readline = require('readline');
const rl = readline.createInterface({input: process.stdin, output: process.stdout});

const MY_PLAYER_NUMBER = 1

function move(moves) {
    let record = {'moves': moves}
    console.error(JSON.stringify(record))
    console.log(JSON.stringify(record))
}

function find_max_with_key(array, key) {
    return array.reduce((item1, item2) => {
        let val1 = item1[key];
        let val2 = item2[key];
        return (val1 > val2 ? item1 : item2);
    });
}

function find_min_with_key(array, key) {
    return array.reduce((item1, item2) => {
        let val1 = item1[key];
        let val2 = item2[key];
        return (val1 < val2 ? item1 : item2);
    });
}

/**
 * De main code van de bot
 */
function run_bot(state) {
    // Maak een lijst van mijn eigen planeten
    let my_planets = state["planets"].filter((planet) => {
        return planet['owner'] === MY_PLAYER_NUMBER
    })

    // Maak een lijst van de planeten van de tegenstander
    let other_planets = state["planets"].filter((planet) => {
        return planet['owner'] !== MY_PLAYER_NUMBER
    })

    if (my_planets.length === 0 || other_planets.length === 0) {
        // Als er al een speler dood is moet ik niets meer doen
        move([])
    } else {
        // Stuur alle schepen behalve 1 van mijn planeet met meeste schepen
        // naar die van de andere speler met zijn minste schepen
        let planet = find_max_with_key(my_planets, 'ship_count');
        let dest = find_min_with_key(other_planets, 'ship_count');

        if (planet !== undefined && dest !== undefined) {
            move([{
                'origin': planet['name'],
                'destination': dest['name'],
                'ship_count': planet['ship_count'] - 1
            }])
        }
    }
}


function main() {
    // Je kunt als 2de argument een file meegeven. De bot gaat deze dan gebruiken als input voor de ronde
    if (process.argv.length > 2) {
        try {
            const data = fs.readFileSync(process.argv[2], 'utf8')
            run_bot(JSON.parse(data))
        } catch (err) {
            console.error(err)
        }
    } else {
        // Anders gaan we stdin lezen
        rl.on('line', (data) => {
            run_bot(JSON.parse(data))
        });
    }
}

let _ = main();

