const { app, BrowserWindow } = require('electron');
const path = require('path');

// YA NO NECESITAMOS LA LÍNEA DE MPVJS_BINARY
// Porque ahora usaremos VLC Portable ejecutado por comando.

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    kiosk: true,       // <--- PANTALLA COMPLETA TOTAL (Tapa barra de tareas)
    autoHideMenuBar: true,  // <--- OCULTA EL MENÚ DE ARRIBA (Archivo, Ver...)
    frame: false,
    icon: path.join(__dirname, 'assets','logo', 'wtu_v2.2.ico'),

    webPreferences: {
      // ESTAS DOS SON VITALES PARA QUE FUNCIONE 'child_process'
      nodeIntegration: true,    
      contextIsolation: false,  
      
      // Ya no es obligatorio plugins: true, pero no estorba.
      // webSecurity false ayuda a evitar problemas con imágenes locales
      webSecurity: false        
    }
  });

  win.loadFile('index.html');
  
  // Dejamos la consola abierta para ver si hay errores al lanzar VLC
 // win.webContents.openDevTools(); 
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});