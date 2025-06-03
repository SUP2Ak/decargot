mod everysup;
mod updater;
use everysup::{get_drives, find_targets_with_cargo_multi_progress, cancel_scan, open_in_explorer, delete_targets};
use updater::{check_update, install_update};
use log::LevelFilter;
use std::env;
use tauri::Manager;

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .filter_level(LevelFilter::Info)
        .init();

    tauri::Builder::default()
        .setup(|app| {
            let version = env!("CARGO_PKG_VERSION");
            let is_beta = version
                .split('.')
                .next()
                .unwrap_or("0")
                .parse::<u32>()
                .unwrap_or(0)
                < 1;
            let title = if is_beta {
                format!("decargot v{} (beta)", version)
            } else {
                format!("decargot v{}", version)
            };
            let main_window = app.get_webview_window("main").unwrap();
            main_window.set_title(&title).unwrap();

            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            check_update,
            install_update,
            get_drives,
            find_targets_with_cargo_multi_progress,
            cancel_scan,
            open_in_explorer,
            delete_targets,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
