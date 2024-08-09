#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod cmds;
mod config;
mod core;
mod enhance;
mod feat;
mod utils;

use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::{NotificationExt, PermissionState};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::{
    config::Config,
    utils::{init, resolve, server},
};
use core::tray::Tray;
use std::{thread::sleep, time::Duration};

fn main() -> std::io::Result<()> {
    // 单例检测
    if server::check_singleton().is_err() {
        println!("app exists");
        return Ok(());
    }

    crate::log_err!(init::init_config());

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if app.notification().permission_state()? == PermissionState::Unknown {
                app.notification().request_permission()?;
            }
            let _ = Tray::create_tray(app.handle());
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let enable_splashscreen = Config::verge().data().enable_splashscreen;
            let enable_splashscreen = enable_splashscreen.unwrap_or(true);
            let silent_start = Config::verge().data().enable_silent_start;
            let silent_start = silent_start.unwrap_or(false);
            if enable_splashscreen && !silent_start {
                let mut builder = tauri::webview::WebviewWindowBuilder::new(
                   app.handle(),
                    "splashscreen",
                    tauri::WebviewUrl::App("splashscreen.html".into()),
                )
                .title("splashscreen")
                .decorations(false)
                .center()
                .resizable(false)
                .inner_size(100.0, 100.0);
                #[cfg(not(target_os = "macos"))]
                {
                    builder = builder.transparent(true);
                }
                #[cfg(target_os = "windows")]
                {
                    builder = builder.additional_browser_args("--enable-features=msWebView2EnableDraggableRegions --disable-features=OverscrollHistoryNavigation,msExperimentalScrolling");
                }
                builder.build()?;
            }
            // we perform the initialization code on a new task so the app doesn't freeze
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // initialize your app here instead of sleeping :
                resolve::resolve_setup(&app_handle);
                // wait 2 seconds for clash core to init profile
                sleep(Duration::from_secs(2));
                // create main window
                if !silent_start {
                    resolve::create_window(&app_handle);
                }
            });
            Ok(())
        })
        // .on_system_tray_event(core::tray::Tray::on_system_tray_event)
        .invoke_handler(tauri::generate_handler![
            // common
            cmds::get_sys_proxy,
            cmds::get_auto_proxy,
            cmds::open_app_dir,
            cmds::open_logs_dir,
            cmds::open_web_url,
            cmds::open_core_dir,
            cmds::get_portable_flag,
            // cmds::kill_sidecar,
            cmds::restart_sidecar,
            cmds::grant_permission,
            // clash
            cmds::restart_clash,
            cmds::get_clash_configs,
            cmds::get_clash_info,
            cmds::get_clash_logs,
            cmds::patch_clash_config,
            cmds::change_clash_core,
            cmds::get_runtime_config,
            cmds::get_runtime_yaml,
            cmds::get_runtime_exists,
            cmds::get_runtime_logs,
            cmds::uwp::invoke_uwp_tool,
            // verge
            cmds::get_verge_config,
            cmds::patch_verge_config,
            cmds::test_delay,
            cmds::get_app_dir,
            cmds::copy_icon_file,
            cmds::download_icon_cache,
            cmds::open_devtools,
            cmds::restart_app,
            cmds::exit_app,
            // cmds::update_hotkeys,
            // profile
            cmds::get_profiles,
            cmds::get_template,
            cmds::enhance_profiles,
            cmds::patch_profiles_config,
            cmds::view_profile,
            cmds::patch_profile,
            cmds::create_profile,
            cmds::import_profile,
            cmds::reorder_profile,
            cmds::update_profile,
            cmds::delete_profile,
            cmds::read_profile_file,
            cmds::get_current_profile_rule_providers,
            cmds::save_profile_file,
            // service mode
            cmds::service::check_service,
            cmds::service::install_service,
            cmds::service::uninstall_service,
            // clash api
            cmds::clash_api_get_proxy_delay
        ]);

    #[cfg(target_os = "macos")]
    {
        use tauri::{Menu, MenuItem, Submenu};

        builder = builder.menu(
            Menu::new().add_submenu(Submenu::new(
                "Edit",
                Menu::new()
                    .add_native_item(MenuItem::Undo)
                    .add_native_item(MenuItem::Redo)
                    .add_native_item(MenuItem::Copy)
                    .add_native_item(MenuItem::Paste)
                    .add_native_item(MenuItem::Cut)
                    .add_native_item(MenuItem::SelectAll)
                    .add_native_item(MenuItem::CloseWindow)
                    .add_native_item(MenuItem::Quit),
            )),
        );
    }

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, e| match e {
        tauri::RunEvent::ExitRequested { api, .. } => {
            api.prevent_exit();
        }
        // tauri::RunEvent::Updater(tauri::UpdaterEvent::Downloaded) => {
        //     resolve::resolve_reset();
        //     api::process::kill_children();
        // }
        tauri::RunEvent::WindowEvent { label, event, .. } => {
            if label == "main" {
                match event {
                    tauri::WindowEvent::Destroyed => {
                        let _ = app_handle.save_window_state(StateFlags::all());
                    }
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        let _ = app_handle.save_window_state(StateFlags::all());
                        resolve::handle_window_close(api, app_handle)
                    }
                    tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                        let _ = app_handle.save_window_state(StateFlags::all());
                    }
                    _ => {}
                }
            }
        }
        _ => {}
    });

    Ok(())
}
