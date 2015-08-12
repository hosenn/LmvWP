
    //  Class for pin data, each pin contains an id, a label and its position 
    //  in 3d world, and is associated with a viewstate object by its id
function ViewerPin(model) {
    this.pinobjs = [];
    this.viewStates = {};
    this.dbkey = model + ' ViewerPin';

        // load previous data from local storage if there were any
    if (localStorage.hasOwnProperty(this.dbkey)) {
        var dataStr = localStorage.getItem(this.dbkey);
        var parsedObj = JSON.parse(dataStr);
        this.pinobjs = parsedObj.pinobjs;
        this.viewStates = parsedObj.viewStates;
    }
};

    // iterate function
ViewerPin.prototype.each = function(callback) {
    for (var i = 0; i < this.pinobjs.length; i++) {
        var p = this.pinobjs[i];
        if (callback)
            callback(p.pinid, p.label, [p.x, p.y, p.z]);
    };
};

    // reorder the sequence of pins in the array
ViewerPin.prototype.reorder = function(pinid, newIndex) {
    var index = -1;
    for (var i = this.pinobjs.length - 1; i >= 0; i--) {
        if (this.pinobjs[i].pinid === pinid) {
            index = i;
            break;
        }            
    };

    if (index !== -1) {
        var pin = this.pinobjs.splice(index, 1)[0];
        this.pinobjs.splice(newIndex, 0, pin);
    }
};

    // get the pin object by id
ViewerPin.prototype.getPinObj = function(pinid) {
    for (var i = 0; i < this.pinobjs.length; i++) {
        if (this.pinobjs[i].pinid === pinid)
            return this.pinobjs[i];
    };
    return null;
};

    // get the associated viewport object by id
ViewerPin.prototype.getViewState = function(pinid) {

    if (pinid in this.viewStates)
        return this.viewStates[pinid];
    return null;
};

    // delete a pin, the pin objec and its viewstate are both removed
ViewerPin.prototype.removePin = function(pinid) {
    var index = -1;
    for (var i = this.pinobjs.length - 1; i >= 0; i--) {
        if (this.pinobjs[i].pinid === pinid) {
            index = i;
            break;
        }            
    };
    if (index !== -1) {
        var deletedPin = this.pinobjs.splice(index, 1);
        delete this.viewStates[pinid];
        return deletedPin;
    }
    return null;
};

    // add a pin, including the pin objec and its viewstate
ViewerPin.prototype.addPin = function(pinid, pos, label, viewstate) {
    var pinObj = {
        pinid: pinid,
        label: label,
        x: pos.x,
        y: pos.y,
        z: pos.z
    };

    this.pinobjs.push(pinObj);
    this.viewStates[pinid] = viewstate;
};

    // update browser localStorage, for each model, the pin data is 
    // stored as a whole JSON stirng
ViewerPin.prototype.updateLocalStorage = function() {
    var parsedObj = {
        pinobjs: this.pinobjs,
        viewStates: this.viewStates
    };

    var dataStr = JSON.stringify(parsedObj);
    localStorage.setItem(this.dbkey, dataStr);  
};




var _viewerMain;
var _viewerPin;

var _pinTable;
var _pinLayer;

var _shouldAddNewPin = false;


    // initialize the data and view panel for presentation
function initializePinPanel(viewer, tableId, modelName) {

    _viewerMain = viewer;
    _pinTable = tableId;

        // initialize the pin data
    _viewerPin = new ViewerPin(modelName);

        // need to update local storage of pins before tab close
    $(window).on("beforeunload", function() {
        if (_viewerPin)
            _viewerPin.updateLocalStorage();
    });

        // add event listeners on the viewer
    _viewerMain.container.addEventListener("click", handleViewerClick);
    _viewerMain.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, updatePinsOnView);
    _viewerMain.addEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, updatePinsOnView);
    
        // initialize the pin overlay and tablelist
    initPinOverlay();
    initPinTablelist($("#"+_pinTable)[0]);
}

    // uninitialize the data and view panel for presentation
function uninitializePinPanel() {

        // update local storage before swtiching to another tab
    if (_viewerPin) {
        _viewerPin.updateLocalStorage();
        $("#"+_pinTable).empty();
        _viewerMain.container.removeChild($("#"+_pinLayer)[0]);
    }

        // remove event listeners on the viewer
    _viewerMain.container.removeEventListener("click", handleViewerClick);
    _viewerMain.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, updatePinsOnView);
    _viewerMain.removeEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, updatePinsOnView);
    
    _viewerPin = null;
    _viewerMain = null;
    _shouldAddNewPin = false;
}

    // called before creating a new pin, mark the overlay on the viewer canvas
    // responsive to get the location of the new pin when user clicks
function prepareForAddNewPin() {

        // change the pointer events of the overlay from none to visible
    d3.select("#"+_pinLayer)
        .style("pointer-events", "visible")
        .style("cursor", "pointer");

        // mark ready to receive click event on the viewer to create new pin
    _shouldAddNewPin = true;
}

    // creating a new pin, including the data and its relative visual components
function createNewPin(client, world, label) {

    var divid = "pin" + getUUID();

        // NOTE: we can pass in a filter to getState() if we only want certain values like Camera
    var optionsFilter = {
        guid: false,
        seedURN: false,
        overrides: false,
        objectSet: false,
        // objectSet: {
        //     id: false,
        //     isolated: false,
        //     hidden: false,
        //     explodeScale: false
        // },
        viewport: true,
        renderOptions: false
    };
    
        // update the pin data
    var curViewerState = _viewerMain.getState(optionsFilter);  
    console.log(curViewerState);
    _viewerPin.addPin(divid, world, label, curViewerState); 

        // update the pin ui
    pushPinToOverlay(divid, client);
    pushPinToTableList(divid, label, $(".pin-table-list")[0]);

        // focus on the new pin's label for editing
    $("#row"+divid).find(".cell-label").dblclick();

}

    // transform array to THREE.Vector3
function positionToVector3(position) {
    return new THREE.Vector3(parseFloat(position[0]), parseFloat(position[1]), parseFloat(position[2]));
}

    // handle pin click, transit to its specific viewport and setup the headsup display
function viewPinClicked(evt) {

    var viewState = _viewerPin.getViewState(this.id);
    _viewerMain.restoreState(viewState);     // NOTE: we can pass in a filter if we only want certain values like Camera position
    
        //  NOTE:  In the above call, we are just relying on the ViewerState function to capture everything in a JSON object and
        // the restore it when asked.  We could do a more controlled way and only worry about the Camera and try to do some effects
        // on our own, but that usually isn't necessary.
    /*
    var viewport = _viewerPin.getViewState(this.id).viewport;
    var nav = _viewerMain.navigation;

    var eye = positionToVector3(viewport.eye);
    var up = positionToVector3(viewport.up);
    var target = positionToVector3(viewport.target);
    var fov = ("fieldOfView" in viewport) ? parseFloat(viewport.fieldOfView) : nav.getVerticalFov();
    var pivot = positionToVector3(viewport.pivotPoint);

    nav.setCameraUpVector(up);

        // if destination's camera mode is different, switch first
    if ("isOrthographic" in viewport) {
        if (viewport.isOrthographic) {
            nav.toOrthographic();
        } else {
            nav.toPerspective();
        }
    }

        // request transition on the viewer
    nav.setRequestTransition(true, eye, target, fov, false);
    nav.setPivotPoint(pivot);
    nav.setPivotSetFlag(true);
    */
 }


    // update the pin coordinates on the 2D canvas when camera moves
function updatePinsOnView() {
    var camera = _viewerMain.getCamera();

    _viewerPin.each(function(pinid, label, position) {
        var vec = positionToVector3(position);
        var newPos2D = worldToClient(vec, _viewerMain.getCamera());
        d3.select("#"+pinid)
        .attr("cx", newPos2D.x)
        .attr("cy", newPos2D.y);
    });
}

    // transform position in 3d world to client coordinate
function worldToClient(position, camera) {
    var p = new THREE.Vector4();

    p.x = position.x;
    p.y = position.y;
    p.z = position.z;
    p.w = 1;

    p.applyMatrix4(camera.matrixWorldInverse);
    p.applyMatrix4(camera.projectionMatrix);

    if (p.w > 0)
    {
        p.x /= p.w;
        p.y /= p.w;
        p.z /= p.w;
    }

    var point = _viewerMain.impl.viewportToClient(p.x, p.y);
    point.x = Math.floor(point.x) + 0.5;
    point.y = Math.floor(point.y) + 0.5;

    return point;
}

    // calculate the 2D position for the new pin to be added
    // should only work under editing mode, i.e. after prepareForAddNewPin is called
function handleViewerClick(evt) {

    if (_shouldAddNewPin) {

        var viewport = _viewerMain.navigation.getScreenViewport();
            
            // calculate  relative positon on the canvas, not in window
        var clientPos =  {
            x: evt.clientX - viewport.left,
            y: evt.clientY - viewport.top
        };
            // get normalized positon on canvas
        var normedpos = {
            x: (evt.clientX - viewport.left) / viewport.width,
            y: (evt.clientY - viewport.top) / viewport.height
        };

            // first to see if the clicked positon is hit on an object of viewer
        var hitPoint = _viewerMain.utilities.getHitPoint(normedpos.x, normedpos.y);
        if (hitPoint === null)
            hitPoint = _viewerMain.navigation.getWorldPoint(normedpos.x, normedpos.y);
        createNewPin(clientPos, hitPoint, "undefined");        
    }

}

    // random id generator for new pins
function getUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};


    // timer for on tour mode
function startTour(index) {
    if (index < _viewerPin.pinobjs.length && index >= 0) {
        $("#"+_viewerPin.pinobjs[index].pinid).click();
        setTimeout(startTour, 1500, index+1);
    } else {
        _viewerMain.escapeScreenMode();
    }
}

function initPinTablelist(tableDiv) {

    var tableHeader = $('<div/>').attr("class", "pin-table-header").appendTo(tableDiv);

    tableHeader.append(
        $('<button />', {
            "class": "pin-table-button",
            "type" : "button",
            text: "Start Tour",
            click: function (e) {
                _viewerMain.setScreenMode(2);
                setTimeout(function() {
                    startTour(0);
                }, 150);
            }
        })
    );

    tableHeader.append(
        $('<button />', {
            "class": "pin-table-button",
            "type" : "button",
            text: "Add Pin",
            click: function (e) {
                prepareForAddNewPin();
            }
        })
    );

    tableHeader.append(
        $('<input />', {
            "type" : "checkbox",
            click: function (e) {
                $("#"+_pinLayer).toggle();
            }
        })
    );

    tableHeader.append(
        $('<label />', {
            text: "Hide Pins",
        })
    );

    var tablelist = $('<div/>').attr("class", "pin-table-list").appendTo(tableDiv)[0];

    _viewerPin.each(function (pinid, label, position) {
        pushPinToTableList(pinid, label, tablelist);
    });

}

    // add a pin row to the table list
function pushPinToTableList(pinid, pinlabel, table) {

    var _currentRow;

    var row = $('<div/>')
        .attr("id", "row" + pinid)
        .attr("class", "pin-table-list-cell")
        .on("mouseover", function (e) {
            $(this).children(":first").css("display", "inline-block");
            $(this).children(":last").css("display", "inline-block");

            var pinid = this.id.substring(3, this.id.length);
            $("#"+pinid).mouseover();
        })
        .on("mouseout", function (e) {
            $(this).children(":first").css("display", "none");
            $(this).children(":last").css("display", "none");

            var pinid = this.id.substring(3, this.id.length);
            $("#"+pinid).mouseout();
        })
        .on("click", function (e) {
            var prevRow = _currentRow;
            _currentRow = $(this).attr("id");

            if (typeof(prevRow) !== "undefined")
                $("#"+prevRow).mouseout();
            var pinid = this.id.substring(3, this.id.length);
            $("#"+pinid).click();
        })
        .appendTo(table);

    var deletebtn = $('<div/>')
        .attr("class", "cell-btn icon icon-cross")
        .on("click", function (e) {
            var parentRow = $(this).parent()[0];
            var pinid = parentRow.id.substring(3, parentRow.id.length);
            var table = parentRow.parentNode;

            table.removeChild(parentRow);
            d3.select("#"+pinid).remove();

            _viewerPin.removePin(pinid);
        })
        .appendTo(row);

    var label = $('<div/>')
        .attr("class", "cell-label")
        .text(pinlabel)
        .on("dblclick", function (e) {
            var editableLabel = $('<input />')
                .attr("type", "text")
                .attr("placeholder", $(this).text())
                .css({
                    "text-align":"center", 
                    "font-size":"16px", 
                    "height":"100%"
                })
                .on("blur", function (e) {
                    var parentLabel = $(this).parent();
                    parentLabel.text($(this).val());

                    var rowid = parentLabel.parent().attr("id");
                    var pinid = rowid.substring(3, rowid.length);
                    var pinObj = _viewerPin.getPinObj(pinid);
                    pinObj.label = $(this).val();

                    $(this).remove();
                })
                .on("keydown", function (e) {
                    if (e.keyCode == 13)
                        $(this).blur();
                });

            $(this).empty().append(editableLabel);
            editableLabel.focus();
        })
        .appendTo(row);

    var _selected = null;
    var _prev_x = 0;
    var _prev_y = 0;

    var orderbtn = $('<div/>')
        .attr("class", "cell-btn icon icon-menu")
        .appendTo(row)
        .on("mousedown", function (e) {
            _prev_x = e.clientX;
            _prev_y = e.clientY;
            _selected = this.parentNode;
            $(_selected).css({
                "width": _selected.offsetWidth + "px",
                "position": "absolute",
                "z-index": 999
            });

            var moverow = function (evt) {
                if (_selected === null)
                    return;
                var next_left = _selected.offsetLeft + evt.clientX - _prev_x;
                var next_top = _selected.offsetTop + evt.clientY - _prev_y;
                $(_selected).css({
                    "left": next_left + "px",
                    "top": next_top + "px"
                });
                _prev_x = evt.clientX;
                _prev_y = evt.clientY;
            };
            $(document).on("mousemove", moverow);

            var setrow = function (evt) {
                if (_selected === null)
                    return false;
                var pinid = _selected.id.substring(3, _selected.id.length);
                var parent = _selected.parentNode;

                var index = Math.round(_selected.offsetTop / _selected.offsetHeight + 0.5);
                $(_selected).css({
                    "position": "static",
                    "z-index": "0"
                });
                parent.removeChild(_selected);
                parent.insertBefore(_selected, parent.children[index]);
                $(_selected).css({
                    "left": "auto",
                    "top": "auto",
                    "width": "inherit"
                });
                _selected = null;

                $(document).off("mousemove", moverow);
                $(document).off("mouseup", setrow);

                _viewerPin.reorder(pinid, index);

                return false; 
            };
            $(document).on("mouseup", setrow);

            return false;
        });

}


function initPinOverlay() {
    
    _pinLayer = "pushpinOverlay";

        // create an overlay on top of the viewer
    var overlayDiv = $('<div />')
        .attr("id", _pinLayer)
        .css({
            "top":"0",
            "left":"0",
            "right":"0",
            "bottom":"0",
            "position":"absolute",
            "pointerEvents":"none"
        })
        .appendTo(_viewerMain.container)[0];

        // creating a svg canvas for the pins
    var svg = d3.select("#" + overlayDiv.id).append("svg")
                .style("width", "100%")
                .style("height", "100%");

        // adding a drop shadow for the pin circles
    var filter = svg.append("defs").append("filter")
        .attr("id", "dropshadow")

    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 1)
        .attr("result", "blur");

    filter.append("feComponentTransfer")
        .append("feFuncA")
        .attr("type", "linear")
        .attr("slope", "0.2");

    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 1)
        .attr("dy", 1)
        .attr("result", "offsetBlur");

    var feMerge = filter.append("feMerge");

    feMerge.append("feMergeNode")
        .attr("in", "offsetBlur")
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

        // iterate through the pins and put them on the canvas
    _viewerPin.each(function(pinid, label, position) {
        var world = positionToVector3(position);
        var client = worldToClient(world, _viewerMain.getCamera());
        pushPinToOverlay(pinid, client);
    });

    return svg;
}

    // add a pin to the overlay
function pushPinToOverlay(pinid, client) {

        // draw a circle pin in d3
    d3.select("#"+_pinLayer+" svg").append("circle").attr("id", pinid).attr("cx", client.x)
        .attr("cy", client.y).attr("r", 10).style("fill", "#c66")
        .style("cursor", "pointer")
        .style("pointer-events", "visible")
        .attr("filter", "url(#dropshadow)");

        // attach user events to pin
    $("#"+pinid)
        .on("click", viewPinClicked)
        .on("mouseover", function() {
            d3.select(this).style("fill", "#66c");
        })
        .on("mouseout", function() {
            d3.select(this).style("fill", "#c66"); 
        });

        // disable canvas pointer events
    d3.select("#"+_pinLayer)
        .style("pointer-events", "none");

        // end editing mode done,  mouse click event should be normal on the viewer
    _shouldAddNewPin = false;
}
