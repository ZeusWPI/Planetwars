use mozaic::modules::game;
use mozaic::modules::types::{Data, HostMsg, PlayerMsg};

use serde_json;

use std::collections::HashMap;
use std::convert::TryInto;
use std::fs::{create_dir, File};
use std::io::Write;
use std::path::PathBuf;
use std::time::SystemTime;

mod pw_config;
mod pw_protocol;
mod pw_rules;
mod pw_serializer;
pub use pw_config::{Config, Map};
use pw_protocol::{self as proto, CommandError};
use pw_rules::Dispatch;

pub struct PlanetWarsGame {
    state: pw_rules::PlanetWars,
    planet_map: HashMap<String, usize>,
    log_file_loc: String,
    log_file: File,
    turns: u64,
    name: String,
    map: String,
}

impl PlanetWarsGame {
    pub fn new(state: pw_rules::PlanetWars, location: &str, name: &str, map: &str) -> Self {
        let planet_map = state
            .planets
            .iter()
            .map(|p| (p.name.clone(), p.id))
            .collect();

        if let Err(_) = create_dir("games") {
            println!("'games' already exists");
        }

        let file = File::create(format!("games/{}", location)).unwrap();

        Self {
            state,
            planet_map,
            log_file_loc: location.to_string(),
            log_file: file,
            turns: 0,
            name: name.to_string(),
            map: PathBuf::from(map)
                .file_stem()
                .and_then(|x| x.to_str())
                .unwrap()
                .to_string(),
        }
    }

    fn dispatch_state(&mut self, were_alive: Vec<usize>, updates: &mut Vec<HostMsg>) {
        let state = pw_serializer::serialize(&self.state);
        write!(
            self.log_file,
            "{}\n",
            serde_json::to_string(&state).unwrap()
        )
        .unwrap();

        for player in self
            .state
            .players
            .iter()
            .filter(|p| were_alive.contains(&p.id))
        {
            let state = pw_serializer::serialize_rotated(&self.state, player.id);
            let state = if player.alive && !self.state.is_finished() {
                proto::ServerMessage::GameState(state)
            } else {
                proto::ServerMessage::FinalState(state)
            };

            updates.push(HostMsg::Data(
                Data {
                    value: serde_json::to_string(&state).unwrap(),
                },
                Some(player.id as u64),
            ));

            if !player.alive || self.state.is_finished() {
                updates.push(HostMsg::Kick(player.id as u64));
            }
        }
    }

    fn execute_commands<'a>(&mut self, turns: Vec<PlayerMsg>, updates: &mut Vec<HostMsg>) {
        for PlayerMsg { id, data } in turns.into_iter() {
            let player_num: usize = (id).try_into().unwrap();
            let action = proto::ServerMessage::PlayerAction(self.execute_action(player_num, data));
            let serialized_action = serde_json::to_string(&action).unwrap();
            updates.push(HostMsg::Data(
                Data {
                    value: serialized_action,
                },
                Some(id),
            ));
        }
    }

    fn execute_action<'a>(&mut self, player_num: usize, turn: Option<Data>) -> proto::PlayerAction {
        let turn = match turn {
            None => return proto::PlayerAction::Timeout,
            Some(turn) => turn.value,
        };

        let action: proto::Action = match serde_json::from_str(&turn) {
            Err(err) => return proto::PlayerAction::ParseError(err.to_string()),
            Ok(action) => action,
        };

        let commands = action
            .commands
            .into_iter()
            .map(
                |command| match self.check_valid_command(player_num, &command) {
                    Ok(dispatch) => {
                        self.state.dispatch(&dispatch);
                        proto::PlayerCommand {
                            command,
                            error: None,
                        }
                    }
                    Err(error) => proto::PlayerCommand {
                        command,
                        error: Some(error),
                    },
                },
            )
            .collect();

        return proto::PlayerAction::Commands(commands);
    }

    fn check_valid_command(
        &self,
        player_num: usize,
        mv: &proto::Command,
    ) -> Result<Dispatch, CommandError> {
        let origin_id = *self
            .planet_map
            .get(&mv.origin)
            .ok_or(CommandError::OriginDoesNotExist)?;

        let target_id = *self
            .planet_map
            .get(&mv.destination)
            .ok_or(CommandError::DestinationDoesNotExist)?;

        if self.state.planets[origin_id].owner() != Some(player_num) {
            return Err(CommandError::OriginNotOwned);
        }

        if self.state.planets[origin_id].ship_count() < mv.ship_count {
            return Err(CommandError::NotEnoughShips);
        }

        if mv.ship_count == 0 {
            return Err(CommandError::ZeroShipMove);
        }

        Ok(Dispatch {
            origin: origin_id,
            target: target_id,
            ship_count: mv.ship_count,
        })
    }
}

use serde_json::Value;

impl game::Controller for PlanetWarsGame {
    fn start(&mut self) -> Vec<HostMsg> {
        let mut updates = Vec::new();
        self.dispatch_state(self.state.living_players(), &mut updates);
        updates
    }

    fn step(&mut self, turns: Vec<PlayerMsg>) -> Vec<HostMsg> {
        self.turns += 1;

        let mut updates = Vec::new();

        let alive = self.state.living_players();

        self.state.repopulate();
        self.execute_commands(turns, &mut updates);
        self.state.step();

        self.dispatch_state(alive, &mut updates);

        updates
    }

    fn state(&mut self) -> Value {
        json!({
            "map": self.map,
        })
    }

    fn is_done(&mut self) -> Option<Value> {
        if self.state.is_finished() {
            Some(json!({
                "winners": self.state.living_players(),
                "turns": self.state.turn_num,
                "name": self.name,
                "map": self.map,
                "file": self.log_file_loc,
                "time": SystemTime::now(),
            }))
        } else {
            None
        }
    }
}

fn get_epoch() -> SystemTime {
    SystemTime::UNIX_EPOCH
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinishedState {
    pub winners: Vec<u64>,
    pub turns: u64,
    pub name: String,
    pub file: String,
    pub map: String,
    #[serde(default = "get_epoch")]
    pub time: SystemTime,
    pub players: Vec<(u64, String)>,
}
