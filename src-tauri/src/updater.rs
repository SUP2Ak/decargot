use tauri::{command, AppHandle};
use tauri_plugin_updater::UpdaterExt;

#[command]
pub async fn check_update(app: AppHandle) -> Result<(bool, String, String), String> {
    if let Some(update) = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
    {
        Ok((true, update.version, env!("CARGO_PKG_VERSION").to_string()))
    } else {
        Ok((false, String::new(), env!("CARGO_PKG_VERSION").to_string()))
    }
}

#[command]
pub async fn install_update(app: AppHandle, url: String) -> Result<(), String> {
    if let Some(update) = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
    {
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
    }
    Ok(())
}
