extern crate capnp;
extern crate futures;
extern crate mozaic;
extern crate rand;
extern crate tokio;

extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

use rand::Rng;

use mozaic::base_capnp::{client_message, host_message};
use mozaic::cmd_capnp::{bot_input, bot_return};
use mozaic::connection_capnp::client_kicked;
use mozaic::core_capnp::{actor_joined, identify, initialize, terminate_stream};
use mozaic::errors::*;
use mozaic::messaging::reactor::*;
use mozaic::messaging::types::*;
use mozaic::modules::BotReactor;
use mozaic::runtime;
use mozaic::runtime::{Broker, BrokerHandle};

use std::env;
use std::str;
use std::process;

mod types;

fn main() {
    let args: Vec<String> = env::args().collect();
    let id = args.get(1).unwrap().parse().unwrap();
    let client_args = args
        .get(2..)
        .expect("How do you expect me to spawn your bot?")
        .to_vec();

    let addr = "127.0.0.1:9142".parse().unwrap();
    let self_id: ReactorId = rand::thread_rng().gen();

    tokio::run(futures::lazy(move || {
        let mut broker = Broker::new().unwrap();
        let reactor = ClientReactor {
            server: None,
            id,
            broker: broker.clone(),
            args: client_args,
        };
        broker
            .spawn(self_id.clone(), reactor.params(), "main")
            .display();

        tokio::spawn(runtime::connect_to_server(broker, self_id, &addr));
        Ok(())
    }));
}

// Main client logic
/// ? greeter_id is the server, the tcp stream that you connected to
/// ? runtime_id is your own runtime, to handle visualisation etc
/// ? user are you  ...
struct ClientReactor {
    server: Option<ReactorId>,
    broker: BrokerHandle,
    id: u64,
    args: Vec<String>,
}

impl ClientReactor {
    fn params<C: Ctx>(self) -> CoreParams<Self, C> {
        let mut params = CoreParams::new(self);
        params.handler(initialize::Owned, CtxHandler::new(Self::initialize));
        params.handler(actor_joined::Owned, CtxHandler::new(Self::open_host));
        return params;
    }

    // reactor setup
    fn initialize<C: Ctx>(
        &mut self,
        handle: &mut ReactorHandle<C>,
        _: initialize::Reader,
    ) -> Result<()> {
        // open link with runtime, for communicating with chat GUI
        let runtime_link = RuntimeLink::params(handle.id().clone());
        handle.open_link(runtime_link)?;

        let bot = BotReactor::new(self.broker.clone(), handle.id().clone(), self.args.clone());
        let bot_id = handle.spawn(bot.params(), "Bot Driver")?;

        handle.open_link(BotLink::params(bot_id))?;

        return Ok(());
    }

    fn open_host<C: Ctx>(
        &mut self,
        handle: &mut ReactorHandle<C>,
        r: actor_joined::Reader,
    ) -> Result<()> {
        let id = r.get_id()?;

        if let Some(server) = &self.server {
            handle.open_link(HostLink::params(ReactorId::from(id)))?;
            self.broker.register_as(id.into(), server.clone(), "Server");

            // Fake bot msg
            let mut chat_message = MsgBuffer::<bot_return::Owned>::new();
            chat_message.build(|b| {
                b.set_message(b"");
            });
            handle.send_internal(chat_message)?;
        } else {
            handle.open_link(ServerLink::params(id.into()))?;
            self.server = Some(id.into());

            let mut identify = MsgBuffer::<identify::Owned>::new();
            identify.build(|b| {
                b.set_key(self.id);
            });
            handle.send_internal(identify).display();
        }

        Ok(())
    }
}

impl Drop for ClientReactor {
    fn drop(&mut self) {
        println!("Client reactor dropped");
    }
}

// Handler for the connection with the chat server
struct ServerLink;
impl ServerLink {
    fn params<C: Ctx>(foreign_id: ReactorId) -> LinkParams<Self, C> {
        let mut params = LinkParams::new(foreign_id, Self);

        params.external_handler(
            terminate_stream::Owned,
            CtxHandler::new(Self::close_handler),
        );
        params.external_handler(actor_joined::Owned, CtxHandler::new(actor_joined::e_to_i));

        params.internal_handler(identify::Owned, CtxHandler::new(Self::identify));

        return params;
    }

    fn identify<C: Ctx>(&mut self, handle: &mut LinkHandle<C>, id: identify::Reader) -> Result<()> {
        let id = id.get_key();

        let mut chat_message = MsgBuffer::<identify::Owned>::new();
        chat_message.build(|b| {
            b.set_key(id);
        });

        handle.send_message(chat_message).display();
        Ok(())
    }

    fn close_handler<C: Ctx>(
        &mut self,
        handle: &mut LinkHandle<C>,
        _: terminate_stream::Reader,
    ) -> Result<()> {
        // also close our end of the stream
        handle.close_link()?;
        return Ok(());
    }
}

struct HostLink;
impl HostLink {
    fn params<C: Ctx>(remote_id: ReactorId) -> LinkParams<Self, C> {
        let mut params = LinkParams::new(remote_id, HostLink);

        params.external_handler(
            host_message::Owned,
            CtxHandler::new(Self::receive_host_message),
        );

        params.internal_handler(bot_return::Owned, CtxHandler::new(Self::send_chat_message));

        params.external_handler(client_kicked::Owned, CtxHandler::new(client_kicked::e_to_i));

        return params;
    }

    // pick up a 'send_message' event from the reactor, and put it to effect
    // by constructing the chat message and sending it to the chat server.
    fn send_chat_message<C: Ctx>(
        &mut self,
        handle: &mut LinkHandle<C>,
        send_message: bot_return::Reader,
    ) -> Result<()> {
        let message = send_message.get_message()?;

        println!("Our bot sent");
        println!("{}", str::from_utf8(&message).unwrap());

        let mut chat_message = MsgBuffer::<client_message::Owned>::new();
        chat_message.build(|b| {
            b.set_data(message);
        });

        handle.send_message(chat_message)?;

        return Ok(());
    }

    // receive a chat message from the chat server, and broadcast it on the
    // reactor.
    fn receive_host_message<C: Ctx>(
        &mut self,
        handle: &mut LinkHandle<C>,
        host_message: host_message::Reader,
    ) -> Result<()> {
        let message = host_message.get_data()?;

        let message: types::ServerMessage = serde_json::from_slice(message).unwrap();

        println!("");
        match message {
            types::ServerMessage::GameState(state) => {
                // println!("New game state");
                let mut bot_msg = MsgBuffer::<bot_input::Owned>::new();

                bot_msg.build(|b| {
                    b.set_input(&serde_json::to_vec(&state).unwrap());
                });
                handle.send_internal(bot_msg).display();
            }
            types::ServerMessage::FinalState(state) => {
                println!("Game finished with");
                println!("{:?}", state);
                process::exit(0);
            }
            types::ServerMessage::PlayerAction(action) => {
                println!("Out bot did");
                println!("{:?}", action);
            }
        }

        return Ok(());
    }
}

struct BotLink;
impl BotLink {
    fn params<C: Ctx>(foreign_id: ReactorId) -> LinkParams<Self, C> {
        let mut params = LinkParams::new(foreign_id, Self);

        params.external_handler(bot_return::Owned, CtxHandler::new(bot_return::e_to_i));
        params.internal_handler(bot_input::Owned, CtxHandler::new(bot_input::i_to_e));
        params.internal_handler(client_kicked::Owned, CtxHandler::new(Self::close));
        return params;
    }

        // pick up a 'send_message' event from the reactor, and put it to effect
    // by constructing the chat message and sending it to the chat server.
    fn close<C: Ctx>(
        &mut self,
        handle: &mut LinkHandle<C>,
        _: client_kicked::Reader,
    ) -> Result<()> {
        handle.close_link()?;

        return Ok(());
    }
}

struct RuntimeLink;
impl RuntimeLink {
    fn params<C: Ctx>(foreign_id: ReactorId) -> LinkParams<Self, C> {
        let mut params = LinkParams::new(foreign_id, Self);

        params.external_handler(actor_joined::Owned, CtxHandler::new(actor_joined::e_to_i));
        params.internal_handler(client_kicked::Owned, CtxHandler::new(Self::close));
        return params;
    }

        // pick up a 'send_message' event from the reactor, and put it to effect
    // by constructing the chat message and sending it to the chat server.
    fn close<C: Ctx>(
        &mut self,
        handle: &mut LinkHandle<C>,
        _: client_kicked::Reader,
    ) -> Result<()> {
        handle.close_link()?;

        return Ok(());
    }
}
