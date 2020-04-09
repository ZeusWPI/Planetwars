use serde::Deserialize;

use rocket::Route;
use rocket_contrib::json::Json;
use rocket_contrib::templates::Template;

use async_std::fs;
use async_std::io::ReadExt;
use async_std::prelude::*;

use std::path::{Path, PathBuf};

/// The expected body to create a map.
#[derive(Deserialize, Debug)]
struct MapReq {
    pub name: String,
    pub map: crate::planetwars::Map,
}

/// Post route to create a map.
#[post("/maps", data = "<map_req>")]
async fn map_post(map_req: Json<MapReq>) -> Result<String, String> {
    let MapReq { name, map } = map_req.into_inner();

    let path: PathBuf = PathBuf::from(format!("maps/{}.json", name));
    if path.exists() {
        return Err("File already exists!".into());
    }

    let mut file = fs::File::create(path)
        .await
        .map_err(|_| "IO error".to_string())?;
    file.write_all(&serde_json::to_vec_pretty(&map).unwrap())
        .await
        .map_err(|_| "IO error".to_string())?;

    Ok("ok".into())
}

/// Map partial, rendering a map as svg and returning the svg element
/// Used in the lobby page for the map previewer
#[get("/maps/<file>")]
async fn map_get(file: String) -> Result<Template, String> {
    let mut content = String::new();
    let mut file = fs::File::open(Path::new("maps/").join(file))
        .await
        .map_err(|_| "IO ERROR".to_string())?;
    file.read_to_string(&mut content)
        .await
        .map_err(|_| "IO ERROR".to_string())?;

    Ok(Template::render(
        "map_partial",
        &serde_json::from_str::<serde_json::Value>(&content).unwrap(),
    ))
}

pub fn fuel(routes: &mut Vec<Route>) {
    routes.extend(routes![map_post, map_get]);
}
