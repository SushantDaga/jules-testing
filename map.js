document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map').setView([51.505, -0.09], 13); // Example: London
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let waypoints = [];
    let waypointMarkers = [];
    let routePolyline = null;
    let currentDrawingMode = 'draw'; 
    let temporarySearchMarker = null;

    // Shape drawing states
    let circleCenter = null;
    let circleRadius = 0;
    let previewCircle = null;

    const mapContainer = document.getElementById('map');

    // Form & Control Elements
    const showWaypointsCheckbox = document.getElementById('show-waypoints');
    const paceInput = document.getElementById('pace-input');
    const runNameInput = document.getElementById('run-name');
    const runDateInput = document.getElementById('run-date');
    const startTimeInput = document.getElementById('start-time');
    const downloadGpxBtn = document.getElementById('download-gpx-btn');
    const locationSearchInput = document.getElementById('location-search');
    const locationSearchBtn = document.getElementById('location-search-btn');
    
    // Drawing mode buttons
    const drawToolBtn = document.getElementById('draw-tool-btn');
    const heartShapeBtn = document.getElementById('heart-shape-btn');
    const circleShapeBtn = document.getElementById('circle-shape-btn');
    const drawingToolButtons = [drawToolBtn, heartShapeBtn, circleShapeBtn]; // For managing active class
    const clearRouteBtn = document.getElementById('clear-route-btn');


    // HTML elements for displaying stats
    const statDistanceEl = document.getElementById('stat-distance');
    const statDurationEl = document.getElementById('stat-duration');
    const statElevationEl = document.getElementById('stat-elevation');
    const statPaceEl = document.getElementById('stat-pace');

    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;

    function calculateTotalDistance(points) {
        totalDistanceMeters = 0;
        if (points.length < 2) return 0;
        for (let i = 0; i < points.length - 1; i++) {
            totalDistanceMeters += points[i].distanceTo(points[i + 1]);
        }
        if (points.length > 2 && (currentDrawingMode === 'circle' || currentDrawingMode === 'heart')) {
             totalDistanceMeters += points[points.length - 1].distanceTo(points[0]);
        }
        return totalDistanceMeters / 1000;
    }

    function formatDuration(currentTotalMinutes) {
        if (isNaN(currentTotalMinutes) || currentTotalMinutes < 0) {
            totalDurationSeconds = 0;
            return "00:00:00";
        }
        totalDurationSeconds = Math.round(currentTotalMinutes * 60);
        const hours = Math.floor(currentTotalMinutes / 60);
        const minutes = Math.floor(currentTotalMinutes % 60);
        const seconds = totalDurationSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateRunStats() {
        const distanceKm = calculateTotalDistance(waypoints);
        let paceMinPerKm = parseFloat(paceInput.value) || 6;
        if (paceMinPerKm <= 0) paceMinPerKm = 6;
        const durationMinutes = distanceKm * paceMinPerKm;
        statDistanceEl.textContent = distanceKm.toFixed(2) + " km";
        statDurationEl.textContent = formatDuration(durationMinutes);
        statPaceEl.textContent = paceMinPerKm.toFixed(2) + " min/km";
        statElevationEl.textContent = "0 m";
    }
    
    function clearRoute() {
        waypoints = [];
        waypointMarkers.forEach(marker => map.removeLayer(marker));
        waypointMarkers = [];
        if (routePolyline) {
            map.removeLayer(routePolyline);
            routePolyline = null;
        }
        
        // Reset any mode-specific states as well
        map.off('mousemove', handleMouseMoveForCircle); // Stop circle preview
        if (previewCircle) map.removeLayer(previewCircle);
        previewCircle = null;
        circleCenter = null;
        circleRadius = 0;

        if (temporarySearchMarker) { // Clear search marker
            map.removeLayer(temporarySearchMarker);
            temporarySearchMarker = null;
        }
        
        // It might be good to reset to default drawing mode after clearing
        // setDrawingMode('draw'); // Or whatever default is preferred
        
        updateRunStats(); // Reset stats display
        console.log("Route cleared.");
    }

    function addWaypoint(latLng, fromShape = false) {
        if (!fromShape && temporarySearchMarker) { 
            map.removeLayer(temporarySearchMarker);
            temporarySearchMarker = null;
        }
        const marker = L.marker(latLng);
        if (showWaypointsCheckbox.checked) marker.addTo(map);
        waypointMarkers.push(marker);
        waypoints.push(latLng);
        
        if (!fromShape) { 
            updatePolyline();
            updateRunStats();
        }
    }

    function updatePolyline() {
        if (routePolyline) map.removeLayer(routePolyline);
        if (waypoints.length >= 2) {
            let polylinePoints = [...waypoints];
            if ((currentDrawingMode === 'circle' || currentDrawingMode === 'heart') && waypoints.length > 2) {
                polylinePoints.push(waypoints[0]);
            }
            routePolyline = L.polyline(polylinePoints, { color: 'blue' }).addTo(map);
        }
    }

    function toggleWaypointMarkersVisibility() {
        const show = showWaypointsCheckbox.checked;
        waypointMarkers.forEach(marker => {
            if (show) { if (!map.hasLayer(marker)) marker.addTo(map); } 
            else { if (map.hasLayer(marker)) map.removeLayer(marker); }
        });
    }

    async function searchLocation() {
        const query = locationSearchInput.value;
        if (!query.trim()) { alert("Please enter a location to search."); return; }
        if (temporarySearchMarker) map.removeLayer(temporarySearchMarker);
        const nominatimURL = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
        try {
            const response = await fetch(nominatimURL, { headers: { 'User-Agent': 'FakeMyRun/1.0 (fakemy.run)' } });
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                const zoomLevel = result.address && result.address.country_code === 'us' ? 10 : 13;
                map.setView([lat, lon], zoomLevel);
                temporarySearchMarker = L.marker([lat, lon], { opacity: 0.75 }).addTo(map)
                    .bindPopup(`<b>${result.display_name}</b><br>Click on map to add to route or start shape.`).openPopup();
            } else { alert("Location not found."); }
        } catch (error) { console.error("Error searching location:", error); alert("Error searching for location."); }
    }

    function generateCircleWaypoints(center, radius) {
        clearRoute(); 
        const numPoints = 32; 
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const radiusInDegreesLat = radius / 111320; 
            const radiusInDegreesLng = radius / (111320 * Math.cos(center.lat * Math.PI / 180));
            const lat = center.lat + radiusInDegreesLat * Math.sin(angle);
            const lng = center.lng + radiusInDegreesLng * Math.cos(angle);
            addWaypoint(L.latLng(lat, lng), true); 
        }
        updatePolyline(); 
        updateRunStats();   
    }
    
    const handleMouseMoveForCircle = (e) => {
        if (!circleCenter || currentDrawingMode !== 'circle-radius') return;
        const currentMousePos = e.latlng;
        const radius = circleCenter.distanceTo(currentMousePos);
        if (previewCircle) {
            previewCircle.setRadius(radius);
        } else {
            previewCircle = L.circle(circleCenter, { radius: radius, color: 'red', fillOpacity: 0.2, dashArray: '5, 5' }).addTo(map);
        }
    };

    function generateHeartWaypoints(anchorPoint, scaleInMeters) {
        clearRoute();
        const numPoints = 64; 
        const a = scaleInMeters / 30; 
        for (let i = 0; i < numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            const x_raw = 16 * Math.pow(Math.sin(t), 3);
            const y_raw = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            const x_scaled = a * x_raw;
            const y_scaled = a * (y_raw + 17); 
            const deltaLat = y_scaled / 111320; 
            const deltaLng = x_scaled / (111320 * Math.cos(anchorPoint.lat * Math.PI / 180)); 
            const lat = anchorPoint.lat + deltaLat;
            const lng = anchorPoint.lng + deltaLng;
            addWaypoint(L.latLng(lat, lng), true); 
        }
        updatePolyline(); 
        updateRunStats();   
        console.log("Heart shape generated around:", anchorPoint, "with scale:", scaleInMeters);
    }

    map.on('click', function(e) {
        if (temporarySearchMarker) { 
            map.removeLayer(temporarySearchMarker);
            temporarySearchMarker = null;
        }

        if (currentDrawingMode === 'draw') {
            addWaypoint(e.latlng);
        } else if (currentDrawingMode === 'circle') { 
            circleCenter = e.latlng;
            currentDrawingMode = 'circle-radius'; // This state is handled by setDrawingMode on mode switch
            mapContainer.style.cursor = 'crosshair'; 
            map.on('mousemove', handleMouseMoveForCircle);
        } else if (currentDrawingMode === 'circle-radius') { 
            circleRadius = circleCenter.distanceTo(e.latlng);
            map.off('mousemove', handleMouseMoveForCircle); 
            if (previewCircle) {
                map.removeLayer(previewCircle);
                previewCircle = null;
            }
            // mapContainer.style.cursor = ''; // Cursor reset by setDrawingMode
            if (circleRadius > 0) generateCircleWaypoints(circleCenter, circleRadius);
            // Reset circle state for next one, and set mode to 'circle' to indicate next click is center
            const tempCircleCenter = circleCenter; // Store for alert
            circleCenter = null; 
            circleRadius = 0;
            setDrawingMode('circle'); // Reset to 'circle' mode, which handles cursor and alert
            alert("Circle drawn around " + tempCircleCenter.toString() +". Click to set a new center or change drawing mode.");
        } else if (currentDrawingMode === 'heart') {
            const heartAnchorPoint = e.latlng;
            const defaultScaleInMeters = 1000; 
            generateHeartWaypoints(heartAnchorPoint, defaultScaleInMeters);
            alert("Heart shape drawn. Click to draw another or change mode.");
        }
    });

    function setDrawingMode(newMode) {
        // Cancel pending operations from previous mode
        if (currentDrawingMode === 'circle-radius' || (currentDrawingMode === 'circle' && circleCenter)) {
            map.off('mousemove', handleMouseMoveForCircle);
            if (previewCircle) {
                map.removeLayer(previewCircle);
                previewCircle = null;
            }
            circleCenter = null;
            circleRadius = 0;
            console.log("Circle drawing cancelled due to mode switch.");
        }
        // Add similar cleanup for other modes if they have intermediate states

        currentDrawingMode = newMode;
        console.log("Drawing mode set to:", newMode);

        // Update button active states
        drawingToolButtons.forEach(btn => {
            if (btn.id === `${newMode}-tool-btn` || (newMode==='circle' && btn.id==='circle-shape-btn') || (newMode==='heart' && btn.id==='heart-shape-btn')) {
                btn.classList.add('active-mode');
            } else {
                btn.classList.remove('active-mode');
            }
        });
        
        // Set map cursor and provide feedback
        mapContainer.style.cursor = ''; // Default cursor
        if (newMode === 'draw') {
            // alert("Draw mode activated. Click on the map to add waypoints."); // Commented out: noisy
            mapContainer.style.cursor = 'crosshair'; // Or default Leaflet cursor
        } else if (newMode === 'circle') {
            // alert("Circle mode activated. Click on the map to set the circle's center."); // Commented out: noisy
            mapContainer.style.cursor = 'pointer'; 
        } else if (newMode === 'heart') {
            //  alert("Heart mode activated. Click on the map to place the heart's bottom tip."); // Commented out: noisy
             mapContainer.style.cursor = 'pointer';
        }
    }

    if (showWaypointsCheckbox) showWaypointsCheckbox.addEventListener('change', toggleWaypointMarkersVisibility);
    if (paceInput) paceInput.addEventListener('input', updateRunStats);
    if (locationSearchInput) locationSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchLocation(); } });
    if (locationSearchBtn) locationSearchBtn.addEventListener('click', searchLocation);
    
    if (drawToolBtn) drawToolBtn.addEventListener('click', () => setDrawingMode('draw'));
    if (heartShapeBtn) heartShapeBtn.addEventListener('click', () => setDrawingMode('heart'));
    if (circleShapeBtn) circleShapeBtn.addEventListener('click', () => setDrawingMode('circle'));
    
    const snapToRoadBtn = document.getElementById('snap-to-road-btn');
    if (snapToRoadBtn) {
        snapToRoadBtn.addEventListener('click', () => {
            // Placeholder for Snap to Road functionality
            if (waypoints.length < 2) {
                alert("Not enough points to snap to road. Please draw a route with at least two waypoints first.");
                return;
            }

            const osrmCoords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
            const apiUrl = `http://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;

            console.log("Snapping to road... Requesting OSRM API:", apiUrl);
            snapToRoadBtn.disabled = true; // Disable button during API call
            snapToRoadBtn.textContent = "Snapping...";

            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`OSRM API request failed with status: ${response.status} - ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
                        const routeGeometry = data.routes[0].geometry; // GeoJSON LineString
                        console.log("OSRM route geometry received:", routeGeometry);
                        
                        // Store the fetched route for the next step (map update)
                        // OSRM returns [lng, lat] pairs, Leaflet needs [lat, lng]
                        window.snappedRouteGeometry = routeGeometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
                        
                        if (window.snappedRouteGeometry && window.snappedRouteGeometry.length > 0) {
                            clearRoute(); // Clear old route
                            
                            waypoints = window.snappedRouteGeometry; // Set new waypoints from snapped data
                            
                            // Re-create markers for the new waypoints
                            // For very dense routes, consider showing only start/end or fewer markers
                            waypoints.forEach(latLng => {
                                const marker = L.marker(latLng); // Don't add popups by default for snapped points
                                waypointMarkers.push(marker); // Add to array for management (e.g., show/hide)
                                if (showWaypointsCheckbox.checked) {
                                    marker.addTo(map);
                                }
                            });

                            updatePolyline(); // Redraw the polyline with new waypoints
                            updateRunStats();   // Recalculate stats for the new route
                            
                            delete window.snappedRouteGeometry; // Clean up global variable
                            alert("Route snapped to roads and map updated!");
                            setDrawingMode('draw'); // Reset to draw mode after successful snap
                        } else {
                            // This case should ideally be caught by the data.code !== 'Ok' check if OSRM behaves consistently.
                            // However, if data.code is 'Ok' but routes array is empty or geometry is bad.
                            console.warn("OSRM Warning: Route snapping returned Ok, but no valid geometry found.", data);
                            throw new Error("Snapped route geometry is empty or invalid, even though OSRM reported 'Ok'.");
                        }
                    } else if (data.code !== "Ok") { // More specific error handling based on OSRM response code
                        console.error("OSRM API Error:", data);
                        throw new Error(`OSRM API Error: ${data.code}. ${data.message || 'No specific message provided by OSRM.'}`);
                    } else { // Fallback for unexpected structure but 'Ok' code.
                        console.error("OSRM API Error: Unexpected response structure.", data);
                        throw new Error("Unexpected response from OSRM API after snapping.");
                    }
                })
                .catch(error => {
                    console.error("Error during Snap to Road process:", error); // Log the full error object for debugging
                    // Provide a more user-friendly message for common fetch errors, otherwise show error.message
                    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
                        alert("Network error: Could not connect to the routing service. Please check your internet connection.");
                    } else {
                        alert(`Error snapping to road: ${error.message}`);
                    }
                })
                .finally(() => {
                    snapToRoadBtn.disabled = false; // Re-enable button
                    snapToRoadBtn.textContent = "Snap to Road";
                });
        });
    }

    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', () => {
            clearRoute();
            setDrawingMode('draw'); // Optionally reset to draw mode after clearing
            alert("Route and stats cleared. Switched to Draw mode.");
        });
    }


    function generateGPXString(points, runDetails) {
        let gpxString = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="FakeMyRun">
  <metadata>
    <name>${runDetails.runName || 'FakeMyRun Activity'}</name>
    <time>${runDetails.startTimeISO}</time>
  </metadata>
  <trk>
    <name>${runDetails.runName || 'FakeMyRun Activity'}</name>
    <trkseg>`;
        let currentTime = new Date(runDetails.startTimeISO).getTime();
        const numPoints = points.length;
        const incrementSecondsPerPoint = (numPoints > 1 && runDetails.totalDuration > 0) ? runDetails.totalDuration / (numPoints -1) : 0;
        points.forEach((point, index) => {
            const pointTimeISO = new Date(currentTime).toISOString();
            gpxString += `
      <trkpt lat="${point.lat}" lon="${point.lng}">
        <ele>0</ele>
        <time>${pointTimeISO}</time>
      </trkpt>`;
            if (incrementSecondsPerPoint > 0 && index < numPoints - 1) {
                 currentTime += incrementSecondsPerPoint * 1000;
            } else if (index < numPoints - 1) { 
                currentTime += 1000; // Default 1s increment if no duration
            }
        });
        gpxString += `
    </trkseg>
  </trk>
</gpx>`;
        return gpxString;
    }

    if (downloadGpxBtn) {
        downloadGpxBtn.addEventListener('click', function() {
            if (waypoints.length < 2) {
                alert("Please draw a route with at least two waypoints.");
                return;
            }
            const runName = runNameInput.value || 'My Fake Run';
            const date = runDateInput.value;
            const time = startTimeInput.value;
            if (!date || !time) {
                alert("Please set a date and start time for the run.");
                return;
            }
            const startTimeISO = new Date(`${date}T${time}:00Z`).toISOString();
            const runDetails = {
                runName: runName, startTimeISO: startTimeISO,
                totalDuration: totalDurationSeconds, totalDistance: totalDistanceMeters
            };
            const gpxData = generateGPXString(waypoints, runDetails);
            const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (runName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'fakemyrun_activity') + '.gpx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    // Initial setup
    updateRunStats(); 
    setDrawingMode('draw'); // Set 'draw' as the default active mode on page load
});
