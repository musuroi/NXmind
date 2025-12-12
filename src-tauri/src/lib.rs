use tauri::{Manager, Emitter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.handle().plugin(tauri_plugin_shell::init())?;
      app.handle().plugin(tauri_plugin_global_shortcut::Builder::default().build())?;
      app.handle().plugin(tauri_plugin_dialog::init())?;
      app.handle().plugin(tauri_plugin_fs::init())?;
      app.handle().plugin(tauri_plugin_notification::init())?;
      app.handle().plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![])))?;
      
      // Setup Tray Icon logic
      let _ = tauri::tray::TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&tauri::menu::Menu::with_items(app.handle(), &[
            &tauri::menu::MenuItem::with_id(app.handle(), "show", "显示主界面", true, None::<&str>)?,
            &tauri::menu::MenuItem::with_id(app.handle(), "settings", "设置", true, None::<&str>)?,
            &tauri::menu::MenuItem::with_id(app.handle(), "quit", "退出", true, None::<&str>)?,
        ])?)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    let win = app.get_webview_window("main").unwrap();
                    win.show().unwrap();
                    win.set_focus().unwrap();
                }
                "quit" => app.exit(0),
                // Settings handled in frontend or separate window
                "settings" => {
                   let win = app.get_webview_window("main").unwrap();
                   win.show().unwrap();
                   win.emit("open-settings", ()).unwrap();
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
               let app = tray.app_handle();
               if let Some(win) = app.get_webview_window("main") {
                   let _ = win.show();
                   let _ = win.set_focus();
               }
            }
        })
        .build(app);

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
