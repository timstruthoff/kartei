'use strict';

var app = require('electron').app
const {ipcMain} = require('electron')

var BrowserWindow = require('electron').BrowserWindow;

var mainWindow = null;

app.on('ready', function () {
    mainWindow = new BrowserWindow({
        show: false,
        //autoHideMenuBar: true,
        height: 560,
        width: 512,
       // frame: false

   });
    

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    const {ipcMain} = require('electron')


    ipcMain.on('modal-command', (event, arg) => {
        mainWindow.webContents.send('modal-command', arg)

    })

    mainWindow.loadURL('file://' + __dirname + '/app/index.html');
});
