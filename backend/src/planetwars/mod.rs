
use mozaic::modules::game;

use serde_json;

use std::collections::HashMap;
use std::convert::TryInto;
use std::fs::File;
use std::io::Write;

mod pw_config;
mod pw_serializer;
mod pw_rules;
mod pw_protocol;
use pw_protocol::{ self as proto, CommandError };
use pw_rules::Dispatch;
pub use pw_config::Config;

pub struct PlanetWarsGame {
    state: pw_rules::PlanetWars,
    planet_map: HashMap<String, usize>,
    log_file: File
}

impl PlanetWarsGame {

    pub fn new(state: pw_rules::PlanetWars, location: &str) -> Self {
        let planet_map = state.planets.iter().map(|p| (p.name.clone(), p.id)).collect();
        let file = File::create(location).unwrap();

        Self {
            state, planet_map,
            log_file: file,
        }
    }

    fn dispatch_state(&mut self, were_alive: Vec<usize>, updates: &mut Vec<game::Update>, ) {
        let state = pw_serializer::serialize(&self.state);
        write!(self.log_file, "{}\n", serde_json::to_string(&state).unwrap()).unwrap();

        // println!("{}", serde_json::to_string(&state).unwrap());

        for player in self.state.players.iter().filter(|p| were_alive.contains(&p.id)) {
            let state = pw_serializer::serialize_rotated(&self.state, player.id);
            let state = if player.alive && !self.state.is_finished() {
                proto::ServerMessage::GameState(state)
            } else {
                proto::ServerMessage::FinalState(state)
            };

            updates.push(
                game::Update::Player((player.id as u64).into(), serde_json::to_vec(&state).unwrap())
            );

            if !player.alive || self.state.is_finished() {
                updates.push(game::Update::Kick((player.id as u64).into()));
            }
        }
    }

    fn execute_commands<'a>(&mut self, turns: Vec<game::PlayerTurn<'a>>, updates: &mut Vec<game::Update>) {
        for (player_id, command) in turns.into_iter() {
            let player_num: usize = (*player_id).try_into().unwrap();
            let action = proto::ServerMessage::PlayerAction(self.execute_action(player_num, command));
            let serialized_action = serde_json::to_vec(&action).unwrap();
            updates.push(game::Update::Player(player_id, serialized_action));
        }
    }

    fn execute_action<'a>(&mut self, player_num: usize, turn: game::Turn<'a>) -> proto::PlayerAction {
        let turn = match turn {
            game::Turn::Timeout => return proto::PlayerAction::Timeout,
            game::Turn::Action(bytes) => bytes,
        };

        let action: proto::Action = match serde_json::from_slice(&turn) {
            Err(err) => return proto::PlayerAction::ParseError(err.to_string()),
            Ok(action) => action,
        };

        let commands = action.commands.into_iter().map(|command| {
            match self.check_valid_command(player_num, &command) {
                Ok(dispatch) => {
                    self.state.dispatch(&dispatch);
                    proto::PlayerCommand {
                        command,
                        error: None,
                    }
                },
                Err(error) => {
                    proto::PlayerCommand {
                        command,
                        error: Some(error),
                    }
                }
            }
        }).collect();

        return proto::PlayerAction::Commands(commands);
    }

    fn check_valid_command(&self, player_num: usize, mv: &proto::Command) -> Result<Dispatch, CommandError> {
        let origin_id = *self.planet_map
            .get(&mv.origin)
            .ok_or(CommandError::OriginDoesNotExist)?;

        let target_id = *self.planet_map
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

impl game::GameController for PlanetWarsGame {
    fn step<'a>(&mut self, turns: Vec<game::PlayerTurn<'a>>) -> Vec<game::Update> {
        let mut updates = Vec::new();

        let alive = self.state.living_players();

        self.state.repopulate();
        self.execute_commands(turns, &mut updates);
        self.state.step();

        self.dispatch_state(alive, &mut updates);

        updates
    }
}
