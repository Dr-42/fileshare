use std::sync::Arc;

use axum::{
    body::{self, Full},
    extract::DefaultBodyLimit,
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

#[derive(Serialize, Deserialize)]
struct File {
    id: u64,
    name: String,
    size: u64,
}

#[derive(Serialize, Deserialize)]
struct List {
    files: Vec<File>,
}

impl List {
    fn new() -> Self {
        Self { files: vec![] }
    }

    fn load(path: &str) -> Result<Self> {
        let result = serde_json::from_str(&std::fs::read_to_string(path)?)?;
        Ok(result)
    }

    fn add(&mut self, file: File) {
        self.files.push(file);
    }

    fn remove(&mut self, id: u64) {
        self.files.retain(|f| f.id != id);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = std::env::args().collect::<Vec<String>>();
    let ip = if args.len() == 2 {
        args[1].parse::<String>()?
    } else {
        println!("Usage: {} <ip:port>", args[0]);
        return Ok(());
    };

    if !std::path::Path::new("list.json").exists() {
        std::fs::write("list.json", serde_json::to_string(&List::new())?)?;
    }
    let state = Arc::new(tokio::sync::Mutex::new(List::load("list.json")?));

    let routes = Router::new()
        .route("/", get(index))
        .route("/index.js", get(index_js))
        .route("/index.css", get(index_css))
        .route("/favicon.png", get(favicon))
        .route("/upload", post(upload))
        .route("/file/:key", get(file))
        .layer(CorsLayer::permissive())
        .layer(DefaultBodyLimit::max(1024 * 1024 * 1024));
    let router_service = routes.with_state(state).into_make_service();
    axum::Server::bind(&ip.parse()?)
        .serve(router_service)
        .await?;
    Ok(())
}

async fn index() -> Html<String> {
    let file = include_str!("../static/index.html");
    Html(file.to_string())
}

async fn upload() -> impl IntoResponse {
    todo!()
}

async fn file() -> impl IntoResponse {
    todo!()
}

async fn index_js() -> impl IntoResponse {
    let m = "text/javascript";
    let content = include_str!("../static/index.js");
    let mut result = String::new();
    result.push_str("let global_ip = \"");
    result.push_str(&std::env::args().collect::<Vec<String>>()[1]);
    result.push_str("\";");
    result.push_str(content);
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str(m).unwrap(),
        )
        .body(result)
        .unwrap()
}

async fn index_css() -> impl IntoResponse {
    let m = "text/css";
    let content = include_str!("../static/index.css");
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str(m).unwrap(),
        )
        .body(content.to_string())
        .unwrap()
}

async fn favicon() -> impl IntoResponse {
    let m = "image/x-icon";
    let body = include_bytes!("../static/favicon.png").to_vec();
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str(m).unwrap(),
        )
        .body(body::boxed(Full::from(body)))
        .unwrap()
}
