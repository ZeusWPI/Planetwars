
use serde::{Deserialize};

use rocket::Route;
use rocket::response::NamedFile;

use rocket_contrib::templates::Template;
use rocket_contrib::json::Json;

use async_std::prelude::*;
use async_std::fs;
use async_std::io::ReadExt;

use crate::util::*;

use std::path::Path;

#[get("/<file..>", rank = 6)]
async fn files(file: PathBuf) -> Option<NamedFile> {
    NamedFile::open(Path::new("static/").join(file)).ok()
}

#[get("/")]
async fn index() -> Template {
    // let context = context();
    let context = Context { name: "Arthur".into(), maps: None };
    // context.insert("name".to_string(), "Arthur".to_string());
    Template::render("index", &context)
}

#[get("/status")]
async fn status() -> Template {
    // let context = context();
    let context = Context { name: "Arthur".into(), maps: None };
    // context.insert("name".to_string(), "Arthur".to_string());
    Template::render("index", &context)
}

#[derive(Deserialize, Debug)]
struct MapReq {
    pub name: String,
    pub map: crate::planetwars::Map,
}

use std::path::PathBuf;

#[post("/maps", data="<map_req>")]
async fn map_post(map_req: Json<MapReq>) -> Result<String, String> {
    let MapReq { name, map } = map_req.into_inner();

    let path: PathBuf = PathBuf::from(format!("maps/{}.json", name));
    if path.exists() {
        return Err("File already exists!".into());
    }

    let mut file = fs::File::create(path).await.map_err(|_| "IO error".to_string())?;
    file.write_all(&serde_json::to_vec_pretty(&map).unwrap()).await.map_err(|_| "IO error".to_string())?;

    Ok("ok".into())
}

#[get("/maps")]
async fn maps_get() -> Result<Template, String> {
    let maps = get_maps().await?;

    let context = Context { name: "Arthur".into(), maps: Some(maps) };
    Ok(Template::render("lobby", &context))
}

#[get("/maps/<file>")]
async fn map_get(file: String) -> Result<Template, String> {
    let mut content = String::new();
    let mut file = fs::File::open(Path::new("maps/").join(file)).await.map_err(|_| "IO ERROR".to_string())?;
    file.read_to_string(&mut content).await.map_err(|_| "IO ERROR".to_string())?;

    Ok(Template::render("map_partial", &serde_json::from_str::<serde_json::Value>(&content).unwrap()))
}

pub fn fuel(routes: &mut Vec<Route>) {
    routes.extend(routes![files, status, index, map_post, map_get, maps_get]);
}
