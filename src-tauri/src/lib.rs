mod everysup;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::UpdaterExt;
use std::process::Command;
use std::env;
use std::path::PathBuf;
use reqwest;
use std::fs;
use serde::Serialize;

#[derive(Serialize, Clone)]
struct UpdateInfo {
    version: String,
    url: String,
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}


#[tauri::command]
async fn check_update(app: AppHandle) -> Result<(), String> {
    if let Some(update) = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())? {
        println!("Update version: {}", update.version);
        println!("Update target: {}", update.target);
        println!("Update body: {:?}", update.body);
        println!("Update date: {:?}", update.date);
        println!("Update struct: target={}, version={}, body={:?}, date={:?}", update.target, update.version, update.body, update.date);
        let url = format!("https://github.com/SUP2Ak/decargot/releases/download/v{}/decargot.exe", update.version);
        let update_info = UpdateInfo {
            version: update.version,
            url: url,
        };
        
        app.emit("update-available", update_info)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn install_update(app: AppHandle, url: String) -> Result<(), String> {
    if let Some(update) = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())? {
        let mut downloaded = 0;
        println!("Downloading to?: {}", update.target);
        println!("Downloading from?: {}", url);
        
        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    println!("downloaded {downloaded} from {content_length:?}");
                },
                || {
                    println!("download finished, installing...");
                },
            )
            .await
            .map_err(|e| {
                println!("Error during update: {}", e);
                e.to_string()
            })?;

        println!("update installed, restarting...");
        app.restart();
        // println!("Current exe path: {:?}", env::current_exe());
        // println!("Restarting application...");
        
        // // Forcer la fermeture de l'application
        // std::process::Command::new("cmd")
        //     .args(&["/C", "timeout", "/t", "2", "&&", "start", "", env::current_exe().unwrap().to_str().unwrap()])
        //     .spawn()
        //     .map_err(|e| e.to_string())?;
            
        // app.exit(0);
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            check_update,
            install_update,
            get_app_version,
            everysup::get_drives,
            everysup::list_dir,
            everysup::search_files,
            everysup::find_targets_with_cargo,
            everysup::find_targets_with_cargo_multi,
            everysup::find_targets_with_cargo_multi_progress,
            everysup::cancel_scan,
            everysup::open_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

