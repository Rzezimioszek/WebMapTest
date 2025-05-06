const map = L.map('map').setView([52.2297, 21.0122], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Mapy © OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

let currentLayer = null;

function toggleWmsPanel() {
  document.getElementById('wms-panel').classList.toggle('open');
}

async function loadLayers() {
  try {
    const res = await fetch('layers.json');
    const data = await res.json();
    const list = document.getElementById('wms-list');
    data.layers.forEach(layer => {
      const li = document.createElement('li');
      li.textContent = layer.name;
      li.onclick = () => loadWmsLayer(layer.url, layer.layer);
      list.appendChild(li);
    });
  } catch (e) {
    console.error('Błąd ładowania WMS:', e);
  }
}

function loadWmsLayer(url, layerName) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.tileLayer.wms(url, {
    layers: layerName,
    format: 'image/png',
    transparent: true,
    attribution: 'WMS'
  }).addTo(map);
}

function updateCoordsPanel(lat, lon) {
  const panel = document.getElementById('coords');
  panel.textContent = `Współrzędne: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  panel.dataset.coords = `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

function copyCoords() {
  const panel = document.getElementById('coords');
  const coords = panel.dataset.coords;
  if (coords) {
    navigator.clipboard.writeText(coords).then(() => {
      panel.textContent = `Skopiowano: ${coords}`;
      setTimeout(() => updateCoordsPanel(...coords.split(',').map(Number)), 1500);
    });
  }
}

let urlMarker = null;
function checkLocParam() {
  const params = new URLSearchParams(location.search);
  const loc = params.get('loc');
  const zoom = parseInt(params.get('zoom')) || 12;
  if (loc) {
    const [lat, lon] = loc.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lon)) {
      map.setView([lat, lon], zoom);
      urlMarker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`Pozycja z URL: ${lat.toFixed(4)}, ${lon.toFixed(4)}`).openPopup();
      updateCoordsPanel(lat, lon);
    }
  }
}

function removeMarker() {
  if (urlMarker) {
    map.removeLayer(urlMarker);
    urlMarker = null;
    updateCoordsPanel(0, 0);
  }
}

map.on('click', function (e) {
  const { lat, lng } = e.latlng;
  if (urlMarker) map.removeLayer(urlMarker);
  urlMarker = L.marker([lat, lng]).addTo(map)
    .bindPopup(`Kliknięto: ${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup();
  const newUrl = `${location.pathname}?loc=${lat.toFixed(6)},${lng.toFixed(6)}&zoom=${map.getZoom()}`;
  history.replaceState({}, '', newUrl);
  updateCoordsPanel(lat, lng);
});

document.getElementById('file-input').addEventListener('change', async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  if (file.name.endsWith('.geojson')) {
    reader.onload = () => {
      const geojson = JSON.parse(reader.result);
      L.geoJSON(geojson).addTo(map);
    };
    reader.readAsText(file);
  } else if (file.name.endsWith('.kml')) {
    reader.onload = () => {
      const parser = new DOMParser();
      const kml = parser.parseFromString(reader.result, 'text/xml');
      const converted = toGeoJSON.kml(kml);
      L.geoJSON(converted).addTo(map);
    };
    reader.readAsText(file);
  } else if (file.name.endsWith('.gpx')) {
    reader.onload = () => {
      const parser = new DOMParser();
      const gpx = parser.parseFromString(reader.result, 'text/xml');
      const converted = toGeoJSON.gpx(gpx);
      L.geoJSON(converted).addTo(map);
    };
    reader.readAsText(file);
  } else if (file.name.endsWith('.zip')) {
    const buffer = await file.arrayBuffer();
    shp(buffer).then(geojson => {
      L.geoJSON(geojson).addTo(map);
    }).catch(err => {
      console.error('Błąd ładowania SHP:', err);
    });
  } else {
    alert('Nieobsługiwany format pliku.');
  }
});

loadLayers();
checkLocParam();
