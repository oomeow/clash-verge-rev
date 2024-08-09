use crate::{
    cmds,
    config::Config,
    feat,
    utils::{dirs, resolve},
};
use anyhow::Result;
use std::collections::HashMap;
use tauri::{
    image::Image,
    menu::{CheckMenuItemBuilder, Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Wry,
};

pub struct Tray {}

impl Tray {
    pub fn tray_menu(app_handle: &AppHandle) -> Menu<Wry> {
        let zh = { Config::verge().latest().language == Some("zh".into()) };

        let version = app_handle.package_info().version.to_string();

        macro_rules! t {
            ($en: expr, $zh: expr) => {
                if zh {
                    $zh
                } else {
                    $en
                }
            };
        }

        let open_window = MenuItemBuilder::with_id("open_window", t!("Dashboard", "打开面板"))
            .build(app_handle)
            .unwrap();

        let rule_mode = CheckMenuItemBuilder::with_id("rule_mode", t!("rule_mode", "规则模式"))
            .checked(false)
            .build(app_handle)
            .unwrap();
        let global_mode =
            CheckMenuItemBuilder::with_id("global_mode", t!("global_mode", "全局模式"))
                .checked(false)
                .build(app_handle)
                .unwrap();
        let direct_mode =
            CheckMenuItemBuilder::with_id("direct_mode", t!("direct_mode", "直连模式"))
                .checked(false)
                .build(app_handle)
                .unwrap();

        let system_proxy =
            CheckMenuItemBuilder::with_id("system_proxy", t!("system_proxy", "系统代理"))
                .checked(false)
                .build(app_handle)
                .unwrap();
        let tun_mode = CheckMenuItemBuilder::with_id("tun_mode", t!("tun_mode", "Tun 模式"))
            .checked(false)
            .build(app_handle)
            .unwrap();

        let service_mode =
            CheckMenuItemBuilder::with_id("service_mode", t!("service_mode", "服务模式"))
                .checked(false)
                .build(app_handle)
                .unwrap();

        let copy_env = MenuItemBuilder::with_id("copy_env", t!("copy_env", "复制环境变量"))
            .build(app_handle)
            .unwrap();

        let open_app_dir = MenuItemBuilder::with_id("open_app_dir", t!("open_app_dir", "应用目录"))
            .build(app_handle)
            .unwrap();
        let open_core_dir =
            MenuItemBuilder::with_id("open_core_dir", t!("open_core_dir", "内核目录"))
                .build(app_handle)
                .unwrap();
        let open_logs_dir =
            MenuItemBuilder::with_id("open_logs_dir", t!("open_logs_dir", "日志目录"))
                .build(app_handle)
                .unwrap();
        let open_dir = SubmenuBuilder::new(app_handle, t!("open_dir", "打开目录"))
            .items(&[&open_app_dir, &open_core_dir, &open_logs_dir])
            .build()
            .unwrap();

        let restart_clash =
            MenuItemBuilder::with_id("restart_clash", t!("Restart Clash", "重启 Clash"))
                .build(app_handle)
                .unwrap();
        let restart_app = MenuItemBuilder::with_id("restart_app", t!("Restart App", "重启应用"))
            .build(app_handle)
            .unwrap();
        let app_version = MenuItemBuilder::with_id("app_version", format!("Version {version}"))
            .enabled(false)
            .build(app_handle)
            .unwrap();
        let more = SubmenuBuilder::new(app_handle, t!("More", "更多"))
            .items(&[&restart_clash, &restart_app, &app_version])
            .build()
            .unwrap();

        let quit = MenuItemBuilder::with_id("quit", t!("Quit", "退出"))
            .build(app_handle)
            .unwrap();

        // let menu_items = [
        //     &open_window,
        //     &PredefinedMenuItem::separator(app_handle).unwrap(),
        //     &rule_mode,
        //     &global_mode,
        //     &direct_mode,
        //     &PredefinedMenuItem::separator(app_handle).unwrap(),
        //     &system_proxy,
        //     &tun_mode,
        //     &PredefinedMenuItem::separator(app_handle).unwrap(),
        //     &service_mode,
        //     &PredefinedMenuItem::separator(app_handle).unwrap(),
        //     &copy_env,
        //     &open_dir,
        //     &more,
        //     &PredefinedMenuItem::separator(app_handle).unwrap(),
        //     &quit,
        // ];
        MenuBuilder::new(app_handle)
            .item(&open_window)
            .separator()
            .items(&[&rule_mode, &global_mode, &direct_mode])
            .separator()
            .items(&[&system_proxy, &tun_mode])
            .separator()
            .item(&service_mode)
            .separator()
            .items(&[&copy_env, &open_dir, &more])
            .separator()
            .item(&quit)
            .build()
            .unwrap()

        // SystemTrayMenu::new()
        //     .add_item(CustomMenuItem::new(
        //         "open_window",
        //         t!("Dashboard", "打开面板"),
        //     ))
        //     .add_native_item(SystemTrayMenuItem::Separator)
        //     .add_item(CustomMenuItem::new(
        //         "rule_mode",
        //         t!("Rule Mode", "规则模式"),
        //     ))
        //     .add_item(CustomMenuItem::new(
        //         "global_mode",
        //         t!("Global Mode", "全局模式"),
        //     ))
        //     .add_item(CustomMenuItem::new(
        //         "direct_mode",
        //         t!("Direct Mode", "直连模式"),
        //     ))
        //     .add_native_item(SystemTrayMenuItem::Separator)
        //     .add_item(CustomMenuItem::new(
        //         "system_proxy",
        //         t!("System Proxy", "系统代理"),
        //     ))
        //     .add_item(CustomMenuItem::new("tun_mode", t!("TUN Mode", "Tun 模式")))
        //     .add_native_item(SystemTrayMenuItem::Separator)
        //     .add_item(CustomMenuItem::new(
        //         "service_mode",
        //         t!("Service Mode", "服务模式"),
        //     ))
        //     .add_native_item(SystemTrayMenuItem::Separator)
        //     .add_item(CustomMenuItem::new(
        //         "copy_env",
        //         t!("Copy Env", "复制环境变量"),
        //     ))
        //     .add_submenu(SystemTraySubmenu::new(
        //         t!("Open Dir", "打开目录"),
        //         SystemTrayMenu::new()
        //             .add_item(CustomMenuItem::new(
        //                 "open_app_dir",
        //                 t!("App Dir", "应用目录"),
        //             ))
        //             .add_item(CustomMenuItem::new(
        //                 "open_core_dir",
        //                 t!("Core Dir", "内核目录"),
        //             ))
        //             .add_item(CustomMenuItem::new(
        //                 "open_logs_dir",
        //                 t!("Logs Dir", "日志目录"),
        //             )),
        //     ))
        //     .add_submenu(SystemTraySubmenu::new(
        //         t!("More", "更多"),
        //         SystemTrayMenu::new()
        //             .add_item(CustomMenuItem::new(
        //                 "restart_clash",
        //                 t!("Restart Clash", "重启 Clash"),
        //             ))
        //             .add_item(CustomMenuItem::new(
        //                 "restart_app",
        //                 t!("Restart App", "重启应用"),
        //             ))
        //             .add_item(
        //                 CustomMenuItem::new("app_version", format!("Version {version}")).disabled(),
        //             ),
        //     ))
        //     .add_native_item(SystemTrayMenuItem::Separator)
        //     .add_item(CustomMenuItem::new("quit", t!("Quit", "退出")))
    }

    pub fn create_tray(app_handle: &AppHandle) -> Result<()> {
        let menu = Self::tray_menu(app_handle);
        TrayIconBuilder::with_id("verge-tray")
            .menu(&menu)
            .on_menu_event(|app, event| Self::on_tray_menu_event(app, event))
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    id: _,
                    position,
                    rect: _,
                    button: _,
                    button_state: _,
                } = event
                {
                    println!("click position: {:?}", position);
                    Self::on_click(tray.app_handle());
                }
            })
            .build(app_handle)?;
        Ok(())
    }

    pub fn update_systray(app_handle: &AppHandle) -> Result<()> {
        // app_handle
        //     .tray_handle()
        //     .set_menu(Tray::tray_menu(app_handle))?;
        // app_handle
        //     .tray_by_id("verge-tray")
        //     .unwrap()
        //     .set_menu(Some(Self::tray_menu(app_handle)))?;
        Tray::update_part(app_handle)?;
        Ok(())
    }

    pub fn update_part(app_handle: &AppHandle) -> Result<()> {
        let zh = Config::verge().latest().language == Some("zh".into());
        let version = app_handle.package_info().version.to_string();

        macro_rules! t {
            ($en: expr, $zh: expr) => {
                if zh {
                    $zh
                } else {
                    $en
                }
            };
        }

        let mode = {
            Config::clash()
                .latest()
                .0
                .get("mode")
                .map(|val| val.as_str().unwrap_or("rule"))
                .unwrap_or("rule")
                .to_owned()
        };

        let tray = app_handle.tray_by_id("verge-tray").unwrap();
        let tray_menu = Self::tray_menu(app_handle);

        let binding = tray_menu.get("rule_mode").unwrap();
        let check_rule_mode = binding.as_check_menuitem().unwrap();
        let _ = check_rule_mode.set_checked(mode == "rule");
        let binding = tray_menu.get("global_mode").unwrap();
        let check_global_mode = binding.as_check_menuitem().unwrap();
        let _ = check_global_mode.set_checked(mode == "global");
        let binding = tray_menu.get("direct_mode").unwrap();
        let check_direct_mode = binding.as_check_menuitem().unwrap();
        let _ = check_direct_mode.set_checked(mode == "direct");

        // #[cfg(target_os = "linux")]
        // match mode.as_str() {
        //     "rule" => {
        //         let _ = tray_menu
        //             .get_item("rule_mode")
        //             .set_title(t!("Rule Mode  ✔", "规则模式  ✔"));
        //         let _ = tray_menu
        //             .get_item("global_mode")
        //             .set_title(t!("Global Mode", "全局模式"));
        //         let _ = tray_menu
        //             .get_item("direct_mode")
        //             .set_title(t!("Direct Mode", "直连模式"));
        //     }
        //     "global" => {
        //         let _ = tray_menu
        //             .get_item("rule_mode")
        //             .set_title(t!("Rule Mode", "规则模式"));
        //         let _ = tray_menu
        //             .get_item("global_mode")
        //             .set_title(t!("Global Mode  ✔", "全局模式  ✔"));
        //         let _ = tray_menu
        //             .get_item("direct_mode")
        //             .set_title(t!("Direct Mode", "直连模式"));
        //     }
        //     "direct" => {
        //         let _ = tray_menu
        //             .get_item("rule_mode")
        //             .set_title(t!("Rule Mode", "规则模式"));
        //         let _ = tray_menu
        //             .get_item("global_mode")
        //             .set_title(t!("Global Mode", "全局模式"));
        //         let _ = tray_menu
        //             .get_item("direct_mode")
        //             .set_title(t!("Direct Mode  ✔", "直连模式  ✔"));
        //     }
        //     _ => {}
        // }

        let verge = Config::verge();
        let verge = verge.latest();
        let system_proxy = verge.enable_system_proxy.as_ref().unwrap_or(&false);
        let clash = Config::clash();
        let clash = clash.latest();
        let tun_mode = clash.get_enable_tun();
        let service_mode = verge.enable_service_mode.as_ref().unwrap_or(&false);
        #[cfg(target_os = "macos")]
        let tray_icon = verge.tray_icon.clone().unwrap_or("monochrome".to_string());
        let common_tray_icon = verge.common_tray_icon.as_ref().unwrap_or(&false);
        let sysproxy_tray_icon = verge.sysproxy_tray_icon.as_ref().unwrap_or(&false);
        let tun_tray_icon = verge.tun_tray_icon.as_ref().unwrap_or(&false);
        #[cfg(target_os = "macos")]
        match tray_icon.as_str() {
            "monochrome" => {
                let _ = tray.set_icon_as_template(true);
            }
            "colorful" => {
                let _ = tray.set_icon_as_template(false);
            }
            _ => {}
        }
        let mut indication_icon = if *system_proxy {
            #[cfg(target_os = "macos")]
            let mut icon = match tray_icon.as_str() {
                "monochrome" => include_bytes!("../../icons/tray-icon-sys-mono.ico").to_vec(),
                "colorful" => include_bytes!("../../icons/tray-icon-sys.ico").to_vec(),
                _ => include_bytes!("../../icons/tray-icon-sys-mono.ico").to_vec(),
            };
            #[cfg(not(target_os = "macos"))]
            let mut icon = include_bytes!("../../icons/tray-icon-sys.png").to_vec();

            if *sysproxy_tray_icon {
                let icon_dir_path = dirs::app_home_dir()?.join("icons");
                let png_path = icon_dir_path.join("sysproxy.png");
                let ico_path = icon_dir_path.join("sysproxy.ico");
                if ico_path.exists() {
                    icon = std::fs::read(ico_path).unwrap();
                } else if png_path.exists() {
                    icon = std::fs::read(png_path).unwrap();
                }
            }
            icon
        } else {
            #[cfg(target_os = "macos")]
            let mut icon = match tray_icon.as_str() {
                "monochrome" => include_bytes!("../../icons/tray-icon-mono.ico").to_vec(),
                "colorful" => include_bytes!("../../icons/tray-icon.ico").to_vec(),
                _ => include_bytes!("../../icons/tray-icon-mono.ico").to_vec(),
            };
            #[cfg(not(target_os = "macos"))]
            let mut icon = include_bytes!("../../icons/tray-icon.png").to_vec();
            if *common_tray_icon {
                let icon_dir_path = dirs::app_home_dir()?.join("icons");
                let png_path = icon_dir_path.join("common.png");
                let ico_path = icon_dir_path.join("common.ico");
                if ico_path.exists() {
                    icon = std::fs::read(ico_path).unwrap();
                } else if png_path.exists() {
                    icon = std::fs::read(png_path).unwrap();
                }
            }
            icon
        };

        if tun_mode {
            #[cfg(target_os = "macos")]
            let mut icon = match tray_icon.as_str() {
                "monochrome" => include_bytes!("../../icons/tray-icon-tun-mono.ico").to_vec(),
                "colorful" => include_bytes!("../../icons/tray-icon-tun.ico").to_vec(),
                _ => include_bytes!("../../icons/tray-icon-tun-mono.ico").to_vec(),
            };
            #[cfg(not(target_os = "macos"))]
            let mut icon = include_bytes!("../../icons/tray-icon-tun.png").to_vec();
            if *tun_tray_icon {
                let icon_dir_path = dirs::app_home_dir()?.join("icons");
                let png_path = icon_dir_path.join("tun.png");
                let ico_path = icon_dir_path.join("tun.ico");
                if ico_path.exists() {
                    icon = std::fs::read(ico_path).unwrap();
                } else if png_path.exists() {
                    icon = std::fs::read(png_path).unwrap();
                }
            }
            indication_icon = icon
        }

        let _ = tray.set_icon(Some(Image::from_bytes(&indication_icon).unwrap()));
        // let _ = tray_menu.set_icon(tauri::Icon::Raw(indication_icon));

        let binding = tray_menu.get("system_proxy").unwrap();
        let system_proxy_check_menu = binding.as_check_menuitem().unwrap();
        let _ = system_proxy_check_menu.set_checked(*system_proxy);
        let binding = tray_menu.get("tun_mode").unwrap();
        let tun_mode_check_menu = binding.as_check_menuitem().unwrap();
        let _ = tun_mode_check_menu.set_checked(tun_mode);
        let binding = tray_menu.get("service_mode").unwrap();
        let service_mode_check_menu = binding.as_check_menuitem().unwrap();
        let _ = service_mode_check_menu.set_checked(*service_mode);

        // #[cfg(target_os = "linux")]
        // {
        //     if *system_proxy {
        //         let _ = tray_menu
        //             .get_item("system_proxy")
        //             .set_title(t!("System Proxy  ✔", "系统代理  ✔"));
        //     } else {
        //         let _ = tray_menu
        //             .get_item("system_proxy")
        //             .set_title(t!("System Proxy", "系统代理"));
        //     }
        //     if tun_mode {
        //         let _ = tray_menu
        //             .get_item("tun_mode")
        //             .set_title(t!("TUN Mode  ✔", "Tun 模式  ✔"));
        //     } else {
        //         let _ = tray_menu
        //             .get_item("tun_mode")
        //             .set_title(t!("TUN Mode", "Tun 模式"));
        //     }
        //     if *service_mode {
        //         let _ = tray_menu
        //             .get_item("service_mode")
        //             .set_title(t!("Service Mode  ✔", "服务模式  ✔"));
        //     } else {
        //         let _ = tray_menu
        //             .get_item("service_mode")
        //             .set_title(t!("Service Mode", "服务模式"));
        //     }
        // }

        let switch_map = HashMap::from([(true, "ON"), (false, "OFF")]);

        let mut current_profile_name = "None".to_string();
        let profiles = Config::profiles();
        let profiles = profiles.latest();
        if let Some(current_profile_uid) = profiles.get_current() {
            let current_profile = profiles.get_item(&current_profile_uid);
            current_profile_name = match &current_profile.unwrap().name {
                Some(profile_name) => profile_name.to_string(),
                None => current_profile_name,
            };
        };

        let _ = tray.set_menu(Some(tray_menu));
        // not support linux
        let _ = tray.set_tooltip(Some(format!(
            "Clash Verge {version}\n{}: {}\n{}: {}\n{}: {}",
            t!("System Proxy", "系统代理"),
            switch_map[system_proxy],
            t!("TUN Mode", "Tun 模式"),
            switch_map[&tun_mode],
            t!("Curent Profile", "当前订阅"),
            current_profile_name
        )));

        Ok(())
    }

    pub fn on_click(app_handle: &AppHandle) {
        let tray_event = Config::verge().latest().tray_event.clone();
        let tray_event = tray_event.unwrap_or("main_window".into());
        match tray_event.as_str() {
            "system_proxy" => feat::toggle_system_proxy(),
            "service_mode" => feat::toggle_service_mode(app_handle.clone()),
            "tun_mode" => feat::toggle_tun_mode(app_handle.clone()),
            "main_window" => resolve::create_window(app_handle),
            _ => {}
        }
    }

    pub fn on_tray_menu_event(app_handle: &AppHandle, event: MenuEvent) {
        match event.id.as_ref() {
            mode @ ("rule_mode" | "global_mode" | "direct_mode") => {
                let mode = &mode[0..mode.len() - 5];
                feat::change_clash_mode(mode.into());
            }
            "open_window" => resolve::create_window(app_handle),
            "system_proxy" => feat::toggle_system_proxy(),
            "service_mode" => feat::toggle_service_mode(app_handle.clone()),
            "tun_mode" => feat::toggle_tun_mode(app_handle.clone()),
            "copy_env" => feat::copy_clash_env(app_handle),
            "open_app_dir" => crate::log_err!(cmds::open_app_dir()),
            "open_core_dir" => crate::log_err!(cmds::open_core_dir()),
            "open_logs_dir" => crate::log_err!(cmds::open_logs_dir()),
            "restart_clash" => feat::restart_clash_core(),
            "restart_app" => cmds::restart_app(app_handle.clone()),
            "quit" => cmds::exit_app(app_handle.clone()),
            _ => {}
        }
    }
}
