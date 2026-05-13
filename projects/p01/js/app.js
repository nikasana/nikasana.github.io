//Creating a map and listing all the places with appropriate coordinates
var map;
var places = [
    {
        title: 'Tbilisi Zoo',
        location: 'tbilisi zoo, Tbilisi, Georgia'
    },
    {
        title: 'Rustaveli Avenue',
        location: 'Rustaveli Avenue, Tbilisi, Georgia'
    },
    {
        title: 'Vake Park',
        location: 'Vake Park, Tbilisi, Georgia'
    },
    {
        title: 'The Bridge of Peace',
        location: 'The Bridge of Peace, Tbilisi, Georgia'
    },
    {
        title: 'Mtatsminda Park',
        location: 'Mtatsminda Park, Tbilisi, Georgia'
    },
    {
        title: 'Tbilisi State University',
        location: 'Tbilisi State University, Tbilisi, Georgia'
    }
];
var Marker = function(title, mLon, mLat){
    var self = this;
    //Creating infoWindow Content:
    var text;
    //setting the first div in content for infoWindow
    var tFirst = "<div style='display:table'>";
    //setting the edning div part in content for infoWindow
    var tLast = "</div>";
    //setting image for infoWindow
    var tImage = "<img src='' style='float:left; margin:5px; padding: 5px; border-radius: 15px;'>";
    //setting Heading for infoWindow
    this.title =  ko.observable(title);
    var tHeading = "<h3  style='margin-top:6px; '><span  style='background-color:#F9F6F9; padding-right:8px; padding-left:8px;'>"+ this.title() +"</span></h3>";
    var tMain;
    //creating and forming info window
    var infoWindow = new google.maps.InfoWindow();
    this.info = infoWindow;
    //taking infromation from wikipedia
    $.ajax({
        dataType: "jsonp",
        url: "https://en.wikipedia.org/w/api.php?action=opensearch&search=" + this.title() + "&format=json&callback=wikiCallback",
        context: this
    }).done(function (data){
        if(data[2][0]){
            //if everything is successful and there is a text to display, show the text
            tMain = "<p>" + data[2][0] + " [information from wikipedia.org]" + "</p>";
            this.setContent();
        }
        else{
            //if the function was successful but there is no text, display the error
            tMain = "<p>" + this.title() + " -> nothing found about this in wikipedia :(" + "</p>";
            this.setContent();
        }
    }).fail(function (){
        //if the function is unsuccessful display the error
        tMain = "<p>" + this.title() + " -> error while finding information about this in wikipedia :(" + "</p>";
        this.setContent();
    });
    //function that sets the full content of the infoWindow
    this.setContent = function(){
        infoWindow.setContent(tFirst+ tImage + tHeading  + tMain + tLast);
    };
    //Creating and placing a marker:
    var latLng = new google.maps.LatLng(mLat, mLon);
    this.marker = new google.maps.Marker({
        title: this.title(),
        icon: makeMarker('F54D70'),
        animation: google.maps.Animation.DROP,
        position: latLng
    });
    //if the infoWindow is closed, stops the animation of markers
    google.maps.event.addListener(infoWindow, 'closeclick', function () {viewModel.defaults();});
    //Applying changes to marker when directly clicked
    this.onClick = function(){
        if (this.getAnimation() !== null) {
            this.icon = makeMarker('F54D70');
            this.setAnimation(null);
            infoWindow.close();
        } else {
            viewModel.defaults();
            this.icon = makeMarker('9932CC');
            this.setAnimation(google.maps.Animation.BOUNCE);
            infoWindow.open(map, this);
        }
    };
    //Applying changes to marker when clicked from the list
    this.displayInfo = function(){
        if (this.marker.getAnimation() !== null) {
            this.marker.icon = makeMarker('F54D70');
            infoWindow.close();
            this.marker.setAnimation(null);
        } else {
            viewModel.defaults();
            this.marker.icon = makeMarker('9932CC');
            infoWindow.open(map, this.marker);
            this.marker.setAnimation(google.maps.Animation.BOUNCE);
        }
    };
    //making the marker clickable from the map
    this.marker.addListener("click", this.onClick);
    //this function creates costum marker icon
    function makeMarker(markerColor) {
        var markerImage = new google.maps.MarkerImage(
            'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|'+ markerColor +
            '|40|_|%E2%80%A2',
            new google.maps.Size(21, 34),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34),
            new google.maps.Size(21,34));
        return markerImage;
      }
    //adding/removing markers from the map using knockout
    this.visible =  ko.observable(true);
    this.onMap = ko.computed(function() {
        if(this.visible()){
            this.marker.setMap(map);
        } else  {
            this.marker.setMap(null);
        }
    }, this);
};
var ViewModel = function() {
    var self = this;
    //creating locations array
    this.mapLocations = ko.observableArray([]);
    this.init = function(){
        // Creating the map and setting its zoom according to device
        var large = window.matchMedia( "(min-width: 1200px)" );
        var medium = window.matchMedia( "(min-width: 800px)" );
        var small = window.matchMedia( "(min-width: 450px)" );
        if (large.matches) {
            map = new google.maps.Map(document.getElementById('theMap'), {
                zoom: 14,
                center: {lat: 41.70348571951232, lng: 44.764180183410645},
                mapTypeControl: false,
                streetViewControl: false,
                zoomControl: false
            });
        }   
        else{ 
            if (medium.matches) {
                map = new google.maps.Map(document.getElementById('theMap'), {
                    zoom: 13,
                    center: {lat: 41.70348571951232, lng: 44.764180183410645},
                    mapTypeControl: false,
                    streetViewControl: false,
                    zoomControl: false
                });
            }      
            else {
                if (small.matches) {
                    map = new google.maps.Map(document.getElementById('theMap'), {
                        zoom: 12,
                        center: {lat: 41.70348571951232, lng: 44.764180183410645},
                        mapTypeControl: false,
                        streetViewControl: false,
                        zoomControl: false
                    });
                }   
                else{
                    map = new google.maps.Map(document.getElementById('theMap'), {
                        zoom: 11,
                        center: {lat: 41.70348571951232, lng: 44.764180183410645},
                        mapTypeControl: false,
                        streetViewControl: false,
                        zoomControl: false
                    });
                }
            }
        }
        //finding coordinates
        places.forEach(function(dot){
            $.ajax({
                url: "",
                dataType: "json"
            }).done(function (data){
                var long = data.results[0].geometry.location.lng;
                var lat = data.results[0].geometry.location.lat;
                self.mapLocations.push(new Marker(dot.title, long, lat));
            }).fail(function (){
                console.log(dot.location + "-> no matching location was found in google maps.");
                alert(dot.location + "-> no matching location was found in google maps.");
            });
        });
        //creating bindings
        ko.applyBindings(viewModel);
    };


    //filering out the locations with the searched words.
    this.filter = ko.observable('');
    this.create = ko.computed(function () {
        return ko.utils.arrayFilter(self.mapLocations(), function (loc) {
            if(!self.filter() || loc.title().toLowerCase().indexOf(self.filter().toLowerCase()) > -1){
                loc.visible(true);
                return true;
            } else {
                loc.visible(false);
                return false;
            }
        });
    });
    //function for creating costume icons for markers
    function makeMarker(markerColor) {
        var markerImage = new google.maps.MarkerImage(
          'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|'+ markerColor +
          '|40|_|%E2%80%A2',
          new google.maps.Size(21, 34),
          new google.maps.Point(0, 0),
          new google.maps.Point(10, 34),
          new google.maps.Size(21,34));
        return markerImage;
      }
    //this function closes all infoWindows, sets markers' icons' to default and animation to null
    this.defaults = function(){
        var l = self.mapLocations().length;
        for(var i = 0; i < l; i++){
            var item = self.mapLocations()[i];
            if (item.marker.getAnimation() !== null){
                item.info.close();
                item.marker.icon = makeMarker('F54D70');
                item.marker.setAnimation(null);
            }
        }
    };
};
//handling map error
var errorHandling = function() {
    alert("Error: Map was not able to be loaded!");
    console.log("Error: Map was not able to be loaded!");
};
//creating the viewModel and applying "knockout"
var viewModel = new ViewModel();
