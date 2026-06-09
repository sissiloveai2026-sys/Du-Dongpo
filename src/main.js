import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DATA_URL = '/data/su-dongpo-food-poems.json';
const GLOBE_RADIUS = 2;
const MARKER_RADIUS = 2.08;
const LONGITUDE_VIEW_OFFSET = -110;

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="hero">
    <div>
      <p class="eyebrow">3D Globe · Food · Poetry</p>
      <h1>苏东坡美食诗词地图</h1>
      <p class="hero__lead">
        以苏轼人生行旅为线索，把东坡肉、荔枝、蚝、茶与诗文放到一颗可旋转的地球上。
      </p>
    </div>
    <div class="hero__badge">
      <span id="place-count">--</span>
      <small>个地点</small>
    </div>
  </header>

  <main class="layout">
    <section class="globe-card" aria-label="苏东坡美食诗词 3D 地球">
      <div class="globe-toolbar">
        <button class="toolbar-button" id="reset-view" type="button">回到中国视角</button>
        <button class="toolbar-button" id="toggle-rotate" type="button">暂停自转</button>
      </div>
      <canvas id="globe-canvas"></canvas>
      <div class="globe-hint">拖拽旋转 · 滚轮缩放 · 点击光点查看诗食故事</div>
    </section>

    <aside class="detail-card" aria-live="polite">
      <p class="eyebrow" id="selected-era">东坡行旅</p>
      <h2 id="selected-title">加载中...</h2>
      <p id="selected-summary" class="summary"></p>
      <figure class="food-photo-frame">
        <img id="selected-image" src="" alt="" />
        <figcaption id="selected-caption"></figcaption>
      </figure>
      <blockquote id="selected-poem"></blockquote>
      <dl class="meta-grid">
        <div>
          <dt>地点</dt>
          <dd id="selected-location"></dd>
        </div>
        <div>
          <dt>美食</dt>
          <dd id="selected-food"></dd>
        </div>
      </dl>
    </aside>
  </main>

  <section class="timeline-section">
    <div class="section-heading">
      <p class="eyebrow">Locations</p>
      <h2>诗食坐标</h2>
    </div>
    <div class="place-list" id="place-list"></div>
  </section>
`;

const canvas = document.querySelector('#globe-canvas');
const selectedEra = document.querySelector('#selected-era');
const selectedTitle = document.querySelector('#selected-title');
const selectedSummary = document.querySelector('#selected-summary');
const selectedImage = document.querySelector('#selected-image');
const selectedCaption = document.querySelector('#selected-caption');
const selectedPoem = document.querySelector('#selected-poem');
const selectedLocation = document.querySelector('#selected-location');
const selectedFood = document.querySelector('#selected-food');
const placeList = document.querySelector('#place-list');
const placeCount = document.querySelector('#place-count');
const resetViewButton = document.querySelector('#reset-view');
const toggleRotateButton = document.querySelector('#toggle-rotate');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x08111f, 7, 13);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.25, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4.2;
controls.maxDistance = 8;
controls.enablePan = false;
controls.rotateSpeed = 0.55;

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const markerGroup = new THREE.Group();
globeGroup.add(markerGroup);

scene.add(new THREE.AmbientLight(0xa9c7ff, 1.6));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
keyLight.position.set(4, 3, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8fb7ff, 1.1);
rimLight.position.set(-3, 1.5, -2);
scene.add(rimLight);

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96),
  new THREE.MeshStandardMaterial({
    map: createEarthTexture(),
    roughness: 0.92,
    metalness: 0.02,
  }),
);
globeGroup.add(earth);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS * 1.025, 96, 96),
  new THREE.MeshBasicMaterial({
    color: 0x5ca8ff,
    transparent: true,
    opacity: 0.13,
    side: THREE.BackSide,
  }),
);
globeGroup.add(atmosphere);

const starField = createStarField();
scene.add(starField);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const markerObjects = [];

let places = [];
let selectedPlaceId = null;
let autoRotate = true;

init();

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
    }

    const data = await response.json();
    places = data.places;
    placeCount.textContent = places.length;
    createMarkers(places);
    renderPlaceList(places);
    selectPlace(places[0].id);
  } catch (error) {
    selectedTitle.textContent = '数据加载失败';
    selectedSummary.textContent = error.message;
    console.error(error);
  }

  resizeRenderer();
  animate();
}

function createMarkers(items) {
  markerGroup.clear();
  markerObjects.length = 0;

  items.forEach((place) => {
    const position = latLonToVector3(place.coordinates.lat, place.coordinates.lng, MARKER_RADIUS);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 24, 24),
      new THREE.MeshStandardMaterial({
        color: place.color,
        emissive: place.color,
        emissiveIntensity: 0.85,
        roughness: 0.35,
      }),
    );
    marker.position.copy(position);
    marker.userData.placeId = place.id;

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.14, 32),
      new THREE.MeshBasicMaterial({
        color: place.color,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    halo.position.copy(position.clone().normalize().multiplyScalar(MARKER_RADIUS - 0.003));
    halo.lookAt(position.clone().multiplyScalar(2));
    halo.userData.placeId = place.id;

    markerGroup.add(marker, halo);
    markerObjects.push(marker, halo);
  });
}

function renderPlaceList(items) {
  placeList.innerHTML = items
    .map(
      (place) => `
        <button class="place-card" type="button" data-place-id="${place.id}">
          <span class="place-card__dot" style="--place-color:${place.color}"></span>
          <span>
            <strong>${place.city}</strong>
            <small>${place.food.name} · ${place.period}</small>
          </span>
        </button>
      `,
    )
    .join('');

  placeList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-place-id]');
    if (card) {
      selectPlace(card.dataset.placeId);
    }
  });
}

function selectPlace(placeId) {
  const place = places.find((item) => item.id === placeId);
  if (!place) return;

  selectedPlaceId = placeId;
  selectedEra.textContent = place.period;
  selectedTitle.textContent = `${place.city} · ${place.food.name}`;
  selectedSummary.textContent = place.summary;
  selectedImage.src = place.image;
  selectedImage.alt = `${place.city}${place.food.name}插画`;
  selectedCaption.textContent = place.imageCaption;
  selectedPoem.innerHTML = place.poem.lines.map((line) => `<span>${line}</span>`).join('');
  selectedLocation.textContent = `${place.location} (${place.coordinates.lat.toFixed(2)}, ${place.coordinates.lng.toFixed(2)})`;
  selectedFood.textContent = place.food.description;

  document.querySelectorAll('.place-card').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.placeId === placeId);
  });

  markerObjects.forEach((object) => {
    const isSelected = object.userData.placeId === placeId;
    object.scale.setScalar(isSelected ? 1.8 : 1);
  });
}

function latLonToVector3(lat, lon, radius) {
  const adjustedLon = THREE.MathUtils.degToRad(lon + LONGITUDE_VIEW_OFFSET);
  const latitude = THREE.MathUtils.degToRad(lat);

  return new THREE.Vector3(
    radius * Math.cos(latitude) * Math.sin(adjustedLon),
    radius * Math.sin(latitude),
    radius * Math.cos(latitude) * Math.cos(adjustedLon),
  );
}

function createEarthTexture() {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 2048;
  textureCanvas.height = 1024;
  const context = textureCanvas.getContext('2d');

  const oceanGradient = context.createLinearGradient(0, 0, 0, textureCanvas.height);
  oceanGradient.addColorStop(0, '#0c3565');
  oceanGradient.addColorStop(0.5, '#0d4b7e');
  oceanGradient.addColorStop(1, '#071f3f');
  context.fillStyle = oceanGradient;
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

  drawLand(context, [
    [0.57, 0.28],
    [0.65, 0.21],
    [0.74, 0.23],
    [0.78, 0.32],
    [0.72, 0.43],
    [0.63, 0.47],
    [0.55, 0.39],
  ]);
  drawLand(context, [
    [0.66, 0.48],
    [0.73, 0.50],
    [0.74, 0.62],
    [0.69, 0.74],
    [0.62, 0.71],
    [0.60, 0.58],
  ]);
  drawLand(context, [
    [0.19, 0.27],
    [0.31, 0.22],
    [0.37, 0.32],
    [0.33, 0.47],
    [0.22, 0.50],
    [0.15, 0.39],
  ]);
  drawLand(context, [
    [0.32, 0.51],
    [0.41, 0.57],
    [0.39, 0.78],
    [0.32, 0.86],
    [0.27, 0.70],
  ]);
  drawLand(context, [
    [0.78, 0.61],
    [0.84, 0.64],
    [0.86, 0.73],
    [0.80, 0.76],
    [0.75, 0.69],
  ]);

  context.globalAlpha = 0.26;
  context.strokeStyle = '#b8d7ff';
  context.lineWidth = 1;
  for (let x = 0; x <= textureCanvas.width; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, textureCanvas.height);
    context.stroke();
  }
  for (let y = 0; y <= textureCanvas.height; y += 128) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(textureCanvas.width, y);
    context.stroke();
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function drawLand(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => {
    const canvasX = x * context.canvas.width;
    const canvasY = y * context.canvas.height;
    if (index === 0) {
      context.moveTo(canvasX, canvasY);
    } else {
      context.lineTo(canvasX, canvasY);
    }
  });
  context.closePath();

  const landGradient = context.createLinearGradient(0, 0, context.canvas.width, context.canvas.height);
  landGradient.addColorStop(0, '#306f57');
  landGradient.addColorStop(0.55, '#6d8448');
  landGradient.addColorStop(1, '#bd9b5f');
  context.fillStyle = landGradient;
  context.fill();
  context.strokeStyle = 'rgba(225, 240, 213, 0.55)';
  context.lineWidth = 5;
  context.stroke();
}

function createStarField() {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  for (let index = 0; index < 900; index += 1) {
    const radius = THREE.MathUtils.randFloat(9, 13);
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    vertices.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
    );
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xd7e8ff,
      size: 0.02,
      transparent: true,
      opacity: 0.75,
    }),
  );
}

function onPointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
}

function onCanvasClick(event) {
  onPointerMove(event);
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(markerObjects, false);
  if (intersects[0]?.object.userData.placeId) {
    selectPlace(intersects[0].object.userData.placeId);
  }
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = canvas.parentElement;
  const height = Math.max(clientHeight, 420);
  renderer.setSize(clientWidth, height, false);
  camera.aspect = clientWidth / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);

  if (autoRotate) {
    globeGroup.rotation.y += 0.0016;
    starField.rotation.y -= 0.00035;
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', resizeRenderer);
canvas.addEventListener('click', onCanvasClick);
canvas.addEventListener('pointermove', onPointerMove);

resetViewButton.addEventListener('click', () => {
  controls.reset();
  globeGroup.rotation.set(0, 0, 0);
});

toggleRotateButton.addEventListener('click', () => {
  autoRotate = !autoRotate;
  toggleRotateButton.textContent = autoRotate ? '暂停自转' : '开启自转';
});
