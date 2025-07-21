#[path = "auth/login.rs"]
mod login;

#[path = "utils/netgrab.rs"]
mod netgrab;
#[path = "utils/settings.rs"]
mod settings;
#[path = "utils/analytics.rs"]
mod analytics;
#[path = "utils/session.rs"]
mod session;


use tauri::Manager;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
#[cfg(desktop)]
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, WindowEvent, Window};
use tauri_plugin_notification;
#[cfg(desktop)]
use tauri_plugin_single_instance;
#[cfg(desktop)]
use tauri_plugin_autostart;
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog;

#[cfg(desktop)]
use url::form_urlencoded::parse;

/// Boilerplate example command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn enable_autostart(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let manager = window.app_handle().autolaunch();
        manager.enable().map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        Err("Autostart not supported on this platform".to_string())
    }
}

#[tauri::command]
fn disable_autostart(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let manager = window.app_handle().autolaunch();
        manager.disable().map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        Err("Autostart not supported on this platform".to_string())
    }
}

#[tauri::command]
fn is_autostart_enabled(window: Window) -> Result<bool, String> {
    #[cfg(desktop)]
    {
        let manager = window.app_handle().autolaunch();
        manager.is_enabled().map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        Err("Autostart not supported on this platform".to_string())
    }
}

#[cfg(desktop)]
fn run_on_tray<T: FnOnce() -> ()>(f: T) {
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::NSApp;
        use cocoa::base::id;
        use objc::{msg_send, sel, sel_impl};
        unsafe {
            let app: id = msg_send![NSApp(), sharedApplication];
            let _: () = msg_send![app, setActivationPolicy: 1];
        }
    }
    f();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimize"]),
        ));
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            println!("[Desqta] Single instance event: {:?}", argv);
            
            // Show and focus the main window when app is launched again
            if let Some(window) = app.webview_windows().get("main") {
                let _ = window.show();
                let _ = window.set_focus();
                println!("[Desqta] Brought main window to focus");
            }
            
            // Handle deep link in single instance
            if let Some(url) = argv.get(1) {
                println!("[Desqta] Processing deep link in single instance: {}", url);
                if url.starts_with("desqta://auth") {
                    // Extract cookie and URL from the deep link
                    let mut cookie = None;
                    let mut base_url = None;
                    
                    // Parse URL parameters
                    if let Some(query) = url.split('?').nth(1) {
                        println!("[Desqta] Query string: {}", query);
                        for param in query.split('&') {
                            println!("[Desqta] Processing parameter: {}", param);
                            if let Some((key, value)) = param.split_once('=') {
                                println!("[Desqta] Found parameter - key: {}, value: {}", key, value);
                                match key {
                                    "cookie" => {
                                        let decoded: String = parse(value.as_bytes()).map(|(key, val)| [key, val].concat()).collect();
                                        if !decoded.is_empty() {
                                            cookie = Some(decoded.to_string());
                                            println!("[Desqta] Decoded cookie: {}", decoded);
                                        } else {
                                            println!("[Desqta] Failed to decode cookie value: {}", value);
                                        }
                                    },
                                    "url" => {
                                        let decoded: String = parse(value.as_bytes()).map(|(key, val)| [key, val].concat()).collect();
                                        if !decoded.is_empty() {
                                            base_url = Some(decoded.to_string());
                                            println!("[Desqta] Decoded URL: {}", decoded);
                                        } else {
                                            println!("[Desqta] Failed to decode URL value: {}", value);
                                        }
                                    },
                                    _ => {
                                        println!("[Desqta] Unknown parameter: {}", key);
                                    }
                                }
                            } else {
                                println!("[Desqta] Invalid parameter format: {}", param);
                            }
                        }
                    } else {
                        println!("[Desqta] No query string found in URL");
                    }
                    
                    // Check if we have both required parameters
                    if let (Some(cookie), Some(base_url)) = (cookie, base_url) {
                        println!("[Desqta] Using base_url: {}", base_url);
                        match login::save_session(base_url, cookie) {
                            Ok(_) => {
                                println!("[Desqta] Successfully saved session from deep link. Check session.json for update.");
                                login::force_reload(app.app_handle().clone());
                            },
                            Err(e) => {
                                eprintln!("[Desqta] Failed to save session from deep link: {}", e);
                            }
                        }
                    } else {
                        eprintln!("[Desqta] Missing required parameters. Need both cookie and URL.");
                    }
                }
            }
        }));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            greet,
            quit,
            enable_autostart,
            disable_autostart,
            is_autostart_enabled,
            netgrab::get_api_data,
            netgrab::open_url,
            netgrab::get_rss_feed,
            netgrab::post_api_data,
            netgrab::fetch_api_data,
            netgrab::get_seqta_file,
            netgrab::upload_seqta_file,
            login::check_session_exists,
            login::save_session,
            login::create_login_window,
            login::logout,
            login::force_reload,
            settings::get_settings,
            settings::save_settings,
            settings::get_settings_json,
            settings::save_settings_from_json,
            settings::save_cloud_token,
            settings::get_cloud_user,
            settings::clear_cloud_token,
            settings::upload_settings_to_cloud,
            settings::download_settings_from_cloud,
            settings::check_cloud_settings,
            analytics::save_analytics,
            analytics::load_analytics,
            analytics::delete_analytics
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                // Configure the existing main window
                if let Some(window) = app.webview_windows().get("main") {
                    let _ = window.set_title("DesQTA");
                    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(900.0, 700.0))));
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(900.0, 700.0)));
                    let _ = window.set_decorations(false);
                    let _ = window.center();
                }

                // Create tray menu
                let menu = Menu::with_items(
                    app,
                    &[
                        &MenuItem::with_id(app, "open", "Open DesQTA", true, None::<&str>)?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?,
                    ],
                )?;

                // Setup tray icon
                run_on_tray(|| {
                    TrayIconBuilder::new()
                        .icon(app.default_window_icon().unwrap().clone())
                        .menu(&menu)
                        .on_menu_event(move |app, event| match event.id.as_ref() {
                            "open" => {
                                if let Some(window) = app.webview_windows().get("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {
                                println!("Menu event not handled: {:?}", event.id);
                            }
                        })
                        .build(app)
                        .expect("Error while setting up tray menu");
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Hide window instead of closing when user clicks X
                    run_on_tray(|| {
                        window.hide().unwrap();
                        api.prevent_close();
                    });
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}