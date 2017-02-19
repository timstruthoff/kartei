var appElem = document.getElementById("app");


const BrowserWindow = require('electron').remote.BrowserWindow;
const fs = require('fs');
const shell = require('electron').shell;
const remote = require('electron').remote;
const path = require('path');
const getSize = require('get-folder-size');
const {ipcRenderer} = require('electron')

const fuzzy = require('fuzzy');
const sortBy = require('sort-by');



///// <globals>

var tagsList = {},
render,
filter = {
    searchQuery: "",
    sorting: "name",
    sortDirection: "descending"
},
dirList = [],
refreshingDir = false,
refreshDirFinished = false;

//// </globals>



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

////  </helper functions>



//// <debugging>

console.log(__dirname)
//remote.getCurrentWindow().toggleDevTools();

document.addEventListener("keydown", function (e) {
    if (e.which === 123) {
        remote.getCurrentWindow().toggleDevTools();
    } else if (e.which === 116) {
        location.reload();
    }
});

function test() {
    shell.showItemInFolder("D:\\Data\\Dev\\project\\kunst-seite\\.");
}

function test(path) {
    var start = new Date().getTime();
    getSize(path, function (err, size) {
        if (err) {
            throw err;
        }

        console.log(size + ' bytes');
        console.log((size / 1024 / 1024).toFixed(2) + ' Mb');
    });
}

//// </debugging>



//// <initial setup>

var initFinished = {
    dom: false,
    settings: false
}

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

    this.read();
}

var settings = new Settings(path.join(__dirname, "settings.json"));


var initChecker = setInterval(() => {
    if (initFinished.dom === true && initFinished.settings === true) {

        // After all the initial preparing is finished the actual program is started.
        clearInterval(initChecker);
        afterInit();
    }
}, 10)

//// </initial setup>



//// <after initial setup is finished>
var afterInit = () => {

    //// <standard ui elements>
    document.getElementById("min-btn").addEventListener("click", function (e) {
        const window = remote.getCurrentWindow();
        window.minimize();
    });

    document.getElementById("max-btn").addEventListener("click", function (e) {
        const window = remote.getCurrentWindow();
        if (!window.isMaximized()) {
            window.maximize();
        } else {
            window.unmaximize();
        }
    });

    document.getElementById("close-btn").addEventListener("click", function (e) {
        const window = remote.getCurrentWindow();
        window.close();
    });

    document.getElementById("change-dir-text").innerHTML = settings.get("dir")

    document.getElementById("change-dir-button").addEventListener("click", function (e) {
        var button = document.getElementById("change-dir-button");
        var field = document.getElementById("change-dir-text");


        if (refreshingDir === false) {
            refreshingDir = true;
            var newDir = field.innerHTML;
            settings.set("dir", newDir);
            button.classList = "reload reloading";
            refreshDir();

            /* Only checking if still reloading every 4000ms so the css animation isn't suddenly interupted*/
            var removeReloadingClassInterval = setInterval(() => {
                if (refreshingDir === false) {
                    clearInterval(removeReloadingClassInterval);
                    button.classList = "reload";
                }
            }, 4000)
        }
        
    });


    //// <sort button>
    var sortButton = {
        element: document.getElementById("sortButton"),
        expanded: false,
        direction: "descending",
        labelElem: document.getElementById("sortButton").getElementsByClassName("label")[0],
        abcElem: document.getElementById("sortAbc"),
        sizeElem: document.getElementById("sortSize"),
        dateElem: document.getElementById("sortDate")
    }
    sortButton.element.addEventListener("click", function (e) {
        if (sortButton.expanded === false) {
            sortButton.expanded = true; 
            sortButton.element.classList = "sort-button expanded";
        } else {
            sortButton.expanded = false; 
            sortButton.element.classList = "sort-button";
        }
    });
    

    var updateSortButtonDirection = () => {
        var arrowElem = sortButton.element.getElementsByClassName("arrow")[0];
        if (filter.sortDirection === "ascending") {
            arrowElem.classList = "arrow ascending";
        } else {
            arrowElem.classList = "arrow descending";
        }
    }


    sortButton.abcElem.addEventListener("click", function (e) {

        if (sortButton.expanded === true) {

            if (filter.sorting === "name") {


                // If the sorting property is already active switch between descending and ascending
                if (filter.sortDirection === "descending") {
                   filter.sortDirection = "ascending";
                } else {
                    filter.sortDirection = "descending";
                }
                updateSortButtonDirection();
                render();
            } else {
                // Else select that property
                filter.sorting = "name";
                sortButton.labelElem.innerHTML = "Abc";
                render();
            }
        }
    });

    sortButton.sizeElem.addEventListener("click", function (e) {

        if (sortButton.expanded === true) {

            if (filter.sorting === "size") {


                // If the sorting property is already active switch between descending and ascending
                if (filter.sortDirection === "descending") {
                   filter.sortDirection = "ascending";
                } else {
                    filter.sortDirection = "descending";
                }
                updateSortButtonDirection();
                render();
            } else {
                // Else select that property
                filter.sorting = "size";
                sortButton.labelElem.innerHTML = "Size";
                render();
            }
        }
    });

    sortButton.dateElem.addEventListener("click", function (e) {

        if (sortButton.expanded === true) {

            if (filter.sorting === "date") {


                // If the sorting property is already active switch between descending and ascending
                if (filter.sortDirection === "descending") {
                   filter.sortDirection = "ascending";
                } else {
                    filter.sortDirection = "descending";
                }
                updateSortButtonDirection();
                render();
            } else {
                // Else select that property
                filter.sorting = "date";
                sortButton.labelElem.innerHTML = "Date";
                render();
            }
        }
    });



    //// </sort button>

/*
            switch (filter.sorting) {
                case "name":
                    renderDirList.sort(sortBy("attr.name", "fName"));
                break;

                case "size":
                    renderDirList.sort(sortBy("attr.name", "fName"));
                break;

                case "mtime":
                    renderDirList.sort(sortBy("stats.mtime", "attr.name", "fName"));
                break;

                default:
                    renderDirList.sort(sortBy("attr.name", "fName"));
                break;
            }*/


            var hideTimer;
            var contentElem = document.getElementById("content");
            contentElem.addEventListener("scroll", () => {

                contentElem.classList = "scrollbar";

                clearTimeout(hideTimer)
                hideTimer = setTimeout(() => {
                    contentElem.classList = "";
                }, 1000)
        /*if (contentElem.scrollTop == 0) {
            document.getElementsByTagName("header")[0].className = "top";
        } else {
            document.getElementsByTagName("header")[0].className = "";
        }*/
    });

            var searchInputEl = document.getElementById("searchInput");
            searchInputEl.addEventListener("input", () => {

                filter.searchQuery = searchInputEl.value;
                render();

            });

    //// </standard ui elements>


    
    //// <recursive reading of the directory>

    var refreshDir = () => {
        tagsList = {},
        dirList = [];
        refreshDirFinished = false;
        refreshingDir = true;
        fs.readdir(settings.get("dir"), (err, files) => {

            var renderTimer;

            var finish = () => {
                clearTimeout(renderTimer);
                renderTimer = setTimeout(() => {

                    //// <rendering tags menu>

                    var tagsEl = document.getElementById("tags");
                    tagsEl.innerHTML = "";
                    // tagsList.map(function (current) {
                    //     current.element = el("button");
                    //     current.element.classList = "tag";
                    //     current.element.innerHTML = current.tag;

                    //     current.element.addEventListener("click", () => {
                    //         if (current.active === false) {
                    //             current.active = true;
                    //             current.element.classList = "tag active";
                    //         } else if (current.active === true) {
                    //             current.active = false;
                    //             current.element.classList = "tag";
                    //         }
                    //     })
                    //     tagsEl.appendChild(current.element);
                    //     console.log(current);
                    // });


                    for (var current in tagsList) {
                        if (tagsList.hasOwnProperty(current)) {
                            ((current) => {
                                var currentObj = tagsList[current];

                                currentObj.element = el("button");
                                currentObj.element.classList = "tag";
                                currentObj.element.innerHTML = current.toLowerCase();

                                currentObj.element.addEventListener("click", () => {
                                    if (currentObj.active === false) {
                                        currentObj.active = true;
                                        currentObj.element.classList = "tag active";
                                    } else if (currentObj.active === true) {
                                        currentObj.active = false;
                                        currentObj.element.classList = "tag";
                                    } else {
                                        currentObj.active = false;
                                        currentObj.element.classList = "tag";
                                    }
                                    render();
                                })
                                tagsEl.appendChild(currentObj.element);
                            })(current)
                        }

                    }


                    //// <rendering tags menu>
                     refreshDirFinished = true;
                     refreshingDir = false;
                    render();
                }, 1000)
            }

            for (var i = 0, length = files.length; i < length; i++) {
                ((current) => {


                    //var currentPath = settings.get("dir") + "/" + current;
                    var currentPath = path.join(settings.get("dir"), current);


                    fs.stat(currentPath, (err, stats) => {

                        if (stats.isFile() == false) {
                            var pathAbs = currentPath;
                            var pos = dirList.push({
                                fName: current,
                                pathAbs: pathAbs,
                                stats: {
                                    atime: stats.atime,
                                    birthtime: stats.birthtime,
                                    ctime: stats.ctime,
                                    mtime: stats.mtime,
                                    dev: stats.dev,
                                    ino: stats.ino,
                                    nlink: stats.nlink,
                                    uid: stats.uid,
                                    isSymbolicLink: stats.isSymbolicLink()
                                }
                            }) - 1;

                            getSize(pathAbs, function (err, size) {
                                if (err) {
                                    throw err;
                                }

                                dirList[pos].size = size;

                            });

                            fs.readFile(currentPath + "/.attr", 'utf8', function (err, data) {
                                if (err) {
                                    finish();
                                    return console.log(err);

                                }

                                data = JSON.parse(data)
                                dirList[pos].attr = data;

                                //// <adding tags of files to taglist>

                                //if (!contains.call(tagsList, data.tags)) tagsList.push({tag: data.tag, active: false});

                                for (let i = 0, length = data.tags.length; i < length; i++) {
                                    tagsList[data.tags[i].toLowerCase()] = {
                                        active: false
                                    }
                                }
                                

                                //// </adding tags of files to taglist>

                                finish();

                            });


                        }

                    })

                })(files[i]);


            }
        })
    }// var refreshDir

    //// </recursive reading of the directory>

    render = () => {



        //// <copying the global unsorted and unfiltered directory list into a local list>

        var renderDirList = dirList;

        //// </copying the global unsorted and unfiltered directory list into a local list>



        //// <filtering directory list for the search query and the selected tags>

        var results = fuzzy.filter(filter.searchQuery, renderDirList, {
            pre: '<',
            post: '>',
            extract: function (el) {
                if (typeof el.attr === "object") {
                    if (typeof el.attr.name === "string") {
                        return el.attr.name;
                    }
                }
                return el.fName;
            }
        });


        var renderDirList = results.map(function (el) {
            return el.original;
        });

        //// <tag filter>

        // If tags are selcted, only results with these tags are shown

        //Looping through every available tag

        results = [];
        var numberTagsActive = 0;
        for (var current in tagsList) {

            if (tagsList.hasOwnProperty(current)) {
//                ((current) => {
    var currentObj = tagsList[current];

                    // Checking if the tag is active
                    if (currentObj.active === true) {
                        numberTagsActive += 1;

                        var out = [];
                        for (let i = 0, length = renderDirList.length; i < length; i++) {
                            if (!renderDirList[i].attr.tags.includes(current)) {
                                out.push(i);
                            }
                        }


                        for (let i = 0, length = out.length; i < length; i++) {
                            renderDirList.splice(out[i], 1);
                        }
                    } else {
                    }
//                })(current)
}


}

        //if (numberTagsActive > 0) renderDirList = results;

        //// </tag filter>
        

        //// </filtering directory list for the search query and the selected tags>



        //// <sorting the directory list>

        if (filter.sortDirection === "descending") {
            switch (filter.sorting) {
                case "name":
                    renderDirList.sort(sortBy("attr.name", "fName"));
                break;

                case "size":
                    renderDirList.sort(sortBy("-size", "-fName"));
                break;

                case "mtime":
                    renderDirList.sort(sortBy("-stats.mtime", "-attr.name", "-fName"));
                break;

                default:
                    renderDirList.sort(sortBy("-attr.name", "-fName"));
                break;
            }

        } else {
            switch (filter.sorting) {
                case "name":
                    renderDirList.sort(sortBy("-attr.name", "-fName"));
                break;

                case "size":
                    renderDirList.sort(sortBy("size", "fName"));
                break;

                case "mtime":
                    renderDirList.sort(sortBy("stats.mtime", "attr.name", "fName"));
                break;

                default:
                    renderDirList.sort(sortBy("attr.name", "fName"));
                break;
            }
        }


        //// <sorting the directory list>



        //// <preparing the render>

        var listElem = el("list");
        listElem.id = "list";

        //// </preparing the render>



        //// <rendering one row per directory into created table>
        for (var i = 0, length = renderDirList.length; i < length; i++) {
            ((current) => {



                var projectContainerElem = el("div", "project-container");



                var topRowElem = el("div", "top-row");


                var nameElem = el("div", "name");
                if (typeof current.attr == "object") {
                    if (current.attr.name != null && current.attr.name != undefined && current.attr.name != "") {
                        nameElem.innerHTML = current.attr.name;
                    } else {
                        nameElem.innerHTML = current.fName;
                    }
                } else {
                    nameElem.innerHTML = current.fName;
                }
                topRowElem.appendChild(nameElem);


                var statElem = el("div", "stat");
                console.log(current)
                if (typeof current.stats == "object") {
                    var date = current.stats.ctime;
                    
                    if (current.size === undefined) {
                        statElem.innerHTML = "Loading Size" + "&nbsp;&nbsp;·&nbsp;&nbsp;" + date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear();

                        var checkInterval = setInterval(() => {
                            if (typeof current.size === "number") {
                                clearInterval(checkInterval);
                                statElem.innerHTML = getReadableFileSizeString(current.size) + "&nbsp;&nbsp;·&nbsp;&nbsp;" + date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear();
                            }
                        }, 100)
                    } else {
                        statElem.innerHTML = getReadableFileSizeString(current.size) + "&nbsp;&nbsp;·&nbsp;&nbsp;" + date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear();
                    }
                    

                }
                topRowElem.appendChild(statElem);


                projectContainerElem.appendChild(topRowElem);



                var bottomRowElem = el("div", "bottom-row");


                var tagsContainerElem = el("div", "tags-container");
                if (typeof current.attr == "object") {
                    for (let i = 0, length = current.attr.tags.length; i < length; i++) {
                        var tagElem = el("div", "tag");
                        tagElem.innerHTML = current.attr.tags[i].toLowerCase();
                        tagsContainerElem.appendChild(tagElem);
                    }
                }
                bottomRowElem.appendChild(tagsContainerElem);


                var buttonContainerElem = el();


                var propertiesButtonElem = el("button", "button edit");
                propertiesButtonElem.title = "Properties";
                propertiesButtonElem.addEventListener("click", () => {

                    modalWindow = new BrowserWindow({
                        show: false,
                         autoHideMenuBar: true,
                         height: 288,
                         width: 416,
                         //parent: top, 
                         //modal: true
                        frame: false

                    });

                    modalWindow.once('ready-to-show', () => {
                        modalWindow.show()
                    })

                    modalWindow.loadURL('file://' + __dirname + '/properties-modal.html');
                    //var contents = modalWindow.webContents;
                    //contents.executeJavaScript("init()")

                    modalWindow.webContents.on('did-finish-load', () => {
                       modalWindow.webContents.send('modalInit', {current: current})
                   })

                    ipcRenderer.on('modal-command', (event, arg) => {
                        console.log(arg)
                    })
                    
                });
                buttonContainerElem.appendChild(propertiesButtonElem);


                var openButtonElem = el("button", "button open");
                openButtonElem.title = "Open in explorer.";
                openButtonElem.addEventListener("click", () => {

                    shell.showItemInFolder(current.pathAbs + "\\.");
                    
                });
                buttonContainerElem.appendChild(openButtonElem);


                bottomRowElem.appendChild(buttonContainerElem);


                projectContainerElem.appendChild(bottomRowElem);
                


                listElem.appendChild(projectContainerElem);



            })(renderDirList[i]);
        };

        //// <rendering one row per directory into created table>



        



        //// <finally writing everything to the dom>
        
        document.getElementById("content").innerHTML = "";
        document.getElementById("content").appendChild(listElem);

        //// </finally writing everything to the dom>

    };

    
    


    //// <loading the directory>

    refreshDir();

    //// </loading the directory>

}
//// </after initial setup is finished>

