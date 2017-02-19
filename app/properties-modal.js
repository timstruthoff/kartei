const {ipcRenderer} = require('electron');
const fs = require('fs');
const shell = require('electron').shell;
const remote = require('electron').remote;
const path = require('path');
const {clipboard} = require('electron');
const exec = require('child_process').exec;



////  <helper functions>

function getReadableFileSizeString(fileSizeInBytes) {

    var i = -1;
    var byteUnits = [' KB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
};

var contains = function (needle) {
    var findNaN = needle !== needle;
    var indexOf;

    if (!findNaN && typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (needle) {
            var i = -1,
            index = -1;

            for (i = 0; i < this.length; i++) {
                var item = this[i];

                if ((findNaN && item !== item) || item === needle) {
                    index = i;
                    break;
                }
            }

            return index;
        };
    }

    return indexOf.call(this, needle) > -1;
};

var el = (tag, classList) => {


    if (typeof tag === "string") {
        var element = document.createElement(tag);
    } else {
        var element = document.createElement("div");
    }

    if (typeof classList === "string") {
        element.classList = classList;
    }

    return element
}

var dateString = (dateObj) => {
    console.dir(dateObj);

    // Adding a zero in front an taking only the last two number to achieve a leading zero 
    var day = ('0' + dateObj.getDate()).slice(-2);
    var month = ('0' + (dateObj.getMonth()+1)).slice(-2);
    var year = dateObj.getFullYear();

    return day + "." + month + "." + year;
}

////  </helper functions>



//// <globals>

var modalArguments, restartNginx, addNginxHost, removeNginxHost;

//// </globals>



//// <initial setup>

var initFinished = {
    ipc: false,
    dom: false,
    settings: false
}

ipcRenderer.on("modalInit", (event, arg) => {
    initFinished.ipc = true;
    modalArguments = arg;
})

document.onreadystatechange = function () {
    if (document.readyState == "complete") {
        initFinished.dom = true;
    }
};

var Settings = function (settingsPath) {

    var settingsObj = {};


    this.read = () => {
        fs.readFile(settingsPath, function read(err, data) {
            if (err) {
                throw err;
            }
            settingsObj = JSON.parse(data);

            // Init of the setting is finished
            initFinished.settings = true;
        });
    }

    this.write = () => {
        fs.writeFile(settingsPath, JSON.stringify(settingsObj), function(err) {
            if(err) {
                return console.log(err);
            }

        }); 
    }

    this.get = (setting) => {
        return settingsObj[setting];
    }

    this.set = (setting, value) => {
        settingsObj[setting] = value;
        this.write();
    }

    this.indexOfIn = (setting, value) => {
        if (typeof settingsObj[setting] === "object") {
            if (typeof settingsObj[setting].push === "function") {
                return settingsObj[setting].indexOf(value);
            } else {
                throw "Setting is not an array!";
            }
        } else {
            throw "Setting is not an array!";
        }
    }

    this.search = (setting, property, value) => {
        if (typeof settingsObj[setting] === "object") {
            if (typeof settingsObj[setting].push === "function") {
                return settingsObj[setting].indexOf(settingsObj[setting].find(x => x[property] === value));

            } else {
                throw "Setting is not an array!";
            }
        } else {
            throw "Setting is not an array!";
        }
    }

    this.push = (setting, value) => {
        if (typeof settingsObj[setting] === "object") {
            if (typeof settingsObj[setting].push === "function") {
                settingsObj[setting].push(value);
            } else {
                throw "Setting is not an array!";
            }
        } else {
            throw "Setting is not an array!";
        }
        
        
        this.write();
    }

    this.remove = (setting, position) => {
        settingsObj[setting].splice(position, 1);
        this.write();
    }

    this.read();
}

var settings = new Settings("settings.json");


var initChecker = setInterval(() => {
    if (initFinished.dom === true && initFinished.settings && initFinished.ipc === true) {

        // After all the initial preparing is finished the actual program is started.
        clearInterval(initChecker);
        afterInit();
    }
}, 10)

//// </initial setup>





var afterInit = () => {

    console.log(modalArguments);
    var current = modalArguments.current;

    var titleElem = document.getElementById("title");



    if (typeof current.attr === "object") {
        if (typeof current.attr.name === "string") {
            titleElem.innerHTML = "Properties of " + current.attr.name;
        } else {
            titleElem.innerHTML = "Properties of " + current.fName;
        }
    } else {
        titleElem.innerHTML = "Properties of " + current.fName;
    }

    document.getElementById("close-btn").addEventListener("click", (e) => {
        const window = remote.getCurrentWindow();
        window.close();
    });

    


    var compactPath = "..." + current.pathAbs.substring(current.pathAbs.length - 17);


    // The date objects get converted to a string when apssed to the new window so we have to convert them back
    current.stats.atime = new Date(current.stats.atime);
    current.stats.birthtime = new Date(current.stats.birthtime);
    current.stats.ctime = new Date(current.stats.ctime)

    //// <rendering properties>

    var pathPropertyElem = document.getElementById("pathProperty");
    pathPropertyElem.innerHTML = compactPath;

    var pathFullPropertyElem = document.getElementById("pathFullProperty");
    pathFullPropertyElem.innerHTML = current.pathAbs;


    var pathFullCopyElem = document.getElementById("pathFullCopy");
    pathFullCopyElem.addEventListener("click", function (e) {
        clipboard.writeText(current.pathAbs);
    });

    var sizePropertyElem = document.getElementById("sizeProperty");
    sizePropertyElem.innerHTML = getReadableFileSizeString(current.size);

    var createdTimePropertyElem = document.getElementById("createdTimeProperty");
    createdTimePropertyElem.innerHTML = dateString(current.stats.birthtime);

    var modifiedTimePropertyElem = document.getElementById("modifiedTimeProperty");
    modifiedTimePropertyElem.innerHTML = dateString(current.stats.ctime);

    //// </rendering properties>


    //// <webserver button>

    addNginxHost = (hostname, rootDir) => {
        if (typeof hostname === "string" && hostname != "") {
            var filename = path.join(settings.get("nginxDir"), "conf/sites-enabled",  hostname + ".localhost.conf");
        } else {
            var filename = path.join(settings.get("nginxDir"), "conf/sites-enabled/localhost.conf");
        }
        fs.writeFile(filename, require("./nginx-config.js")(hostname, rootDir), (err) => {
            if (err) throw err;
            console.log('It\'s saved!');
            restartNginx();
        });
    }

    removeNginxHost = (hostname) => {
        if (typeof hostname === "string" && hostname != "") {
            var filename = path.join(settings.get("nginxDir"), "conf/sites-enabled",  hostname + ".localhost.conf");
        } else {
            var filename = path.join(settings.get("nginxDir"), "conf/sites-enabled/localhost.conf");
        }
        fs.unlink(filename, (err) => {
            if (err) throw err;
            console.log('It\'s removed!');
            restartNginx();
        });
    }

    restartNginx = require("./restartNginx.js")

    var webserverLoading = false;
    var webserverStarted = false;

    var webserverContainerElem = document.getElementById("startWebserver");


    var webserverButtonElem = webserverContainerElem.getElementsByClassName("start")[0];
    var webserverButtonLabelElem = webserverButtonElem.getElementsByClassName("label")[0];
    var webserverInputElem = webserverContainerElem.getElementsByClassName("hostname")[0];

    if (settings.search("webservers", "path", current.pathAbs) > -1) {
        var index = settings.search("webservers", "path", current.pathAbs);
        console.log(index);
        var webserverObj = settings.get("webservers")[index];

        webserverStarted = true;
        webserverInputElem.value = webserverObj.hostname;
        var att = document.createAttribute("disabled");
        webserverInputElem.setAttributeNode(att);

        webserverButtonLabelElem.innerHTML = "Stop";
    }


    webserverButtonElem.addEventListener("click", (e) => {
        if (webserverLoading === false) {

            if (webserverStarted === false) {
                webserverLoading = true;
                webserverButtonElem.classList = "start loading";

                var hostname = webserverInputElem.value;
                var att = document.createAttribute("disabled");
                webserverInputElem.setAttributeNode(att);

                settings.push("webservers", {
                    hostname: hostname,
                    path: current.pathAbs
                });
                addNginxHost(hostname, current.pathAbs)

                setTimeout(() => {
                    webserverButtonLabelElem.innerHTML = "Stop";
                    webserverStarted = true;
                    webserverLoading = false;

                    webserverButtonElem.classList = "start";

                }, 2000)
            } else {
                console.log("stop")

                webserverLoading = true;
                var index = settings.search("webservers", "path", current.pathAbs);
                var att = document.createAttribute("disabled");
                webserverInputElem.setAttributeNode(att);

                webserverButtonElem.classList = "start loading";

                removeNginxHost(settings.get("webservers")[index].hostname)
                settings.remove("webservers", index);
                

                setTimeout(() => {
                    webserverButtonLabelElem.innerHTML = "Start";
                    webserverStarted = false;
                    webserverLoading = false;

                    webserverButtonElem.classList = "start";

                    webserverInputElem.removeAttribute("disabled")

                }, 2000)

                
            }
            
            
        } 
    });

    //// </webserver button>

}