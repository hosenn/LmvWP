
var viewModels = [
    { id: "racsimple", label: "Revit House", urn: "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6bW9kZWwyMDE1LTA3LTE2LTIxLTIwLTEzLW1hdHZ6ZW05MmJjdW9xNnJlZ2R0Y2RudXYyd2svcmFjX2Jhc2ljX3NhbXBsZV9wcm9qZWN0LnJ2dA=="},
];
var currentModel = 0;

var viewer3D;

$(document).ready(function() { 

    var getToken =  function() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", 'http://' + window.location.host + '/api/token', false);
        xhr.send(null);

        var res = JSON.parse(xhr.responseText);
        return res.access_token;               
    }

    function initialize() {
        var options = {
            env: "AutodeskProduction",
            getAccessToken: getToken,
            refreshToken: getToken
        };

        Autodesk.Viewing.Initializer(options, function () {
            
            var viewer3DContainer = document.getElementById("viewer3D");
            viewer3D = new Autodesk.Viewing.Private.GuiViewer3D(viewer3DContainer, {});

            viewer3D.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, function (event) {
                initializePinPanel(viewer3D, "pintable", viewModels[currentModel].id);
            });

            viewer3D.start();
            loadDocument(viewModels[currentModel].urn);
        });
    }

    initialize();
});

function loadDocument (urnStr) {
    var urn = "urn:" + urnStr;

    Autodesk.Viewing.Document.load(urn,

        function (document) {
            var geometryItems3D = Autodesk.Viewing.Document.getSubItemsWithProperties(document.getRootItem(), {'type':'geometry', 'role':'3d'}, true);

            viewer3D.load(document.getViewablePath(geometryItems3D[0]));
        },

        function (msg) {
            console.log("Error loading document: " + msg);
        }
    );
}