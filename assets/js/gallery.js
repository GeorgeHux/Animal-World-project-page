const DEFAULT_SUBSET_SIZE = 9;

function sortInstanceBuckets(buckets) {
  return [...buckets].sort((a, b) => Number(a) - Number(b));
}

const state = {
  manifest: null,
  subsetSize: DEFAULT_SUBSET_SIZE,
  filtered: [],
  visible: [],
  selectedId: null,
};

function formatSpeciesLabel(label) {
  return label;
}

function shuffleArray(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getFilters() {
  return {
    species: document.getElementById("gallery-species").value,
    instances: document.getElementById("gallery-instances").value,
  };
}

function applyFilters() {
  const { species, instances } = getFilters();
  state.filtered = state.manifest.items.filter((item) => {
    if (species !== "all" && item.species !== species) return false;
    if (instances !== "all" && item.instance_bucket !== instances) return false;
    return true;
  });
}

function updateStatus() {
  const status = document.getElementById("gallery-status");
  const { species, instances } = getFilters();
  const speciesLabel =
    species === "all"
      ? `${state.manifest.species_count} species`
      : state.manifest.species.find((s) => s.id === species)?.label || species;
  const instanceLabel = instances === "all" ? "any instance count" : `${instances} instance${instances === "1" ? "" : "s"}`;

  if (state.filtered.length === 0) {
    status.textContent = `No images match the current filters (${speciesLabel}, ${instanceLabel}). Try another species or instance count.`;
    return;
  }

  status.textContent = `Showing ${state.visible.length} of ${state.filtered.length} matching images (${speciesLabel}, ${instanceLabel}). Shuffle to see more.`;
}

function renderGrid() {
  const grid = document.getElementById("gallery-grid");
  grid.innerHTML = "";

  if (state.visible.length === 0) {
    return;
  }
  state.visible.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-card";
    button.dataset.id = item.id;
    if (item.id === state.selectedId) button.classList.add("is-selected");

    button.innerHTML = `
      <div class="gallery-card-media">
        <img src="${item.thumb}" alt="${item.species_label} with ${item.instance_count} instances" loading="lazy" />
        <span class="gallery-card-badge">${item.instance_count} inst.</span>
      </div>
      <div class="gallery-card-meta">
        <strong>${item.species_label}</strong>
        <span>${item.image_name}</span>
      </div>
    `;

    button.addEventListener("click", () => {
      if (item.id === state.selectedId) {
        closeDetail();
      } else {
        selectItem(item.id);
      }
    });
    grid.appendChild(button);
  });
}

function drawOverlay(item) {
  const canvas = document.getElementById("gallery-overlay");
  const img = document.getElementById("gallery-detail-image");
  const ctx = canvas.getContext("2d");
  const sourceWidth = item.width;
  const sourceHeight = item.height;
  const displayWidth = img.clientWidth;
  const displayHeight = img.clientHeight;
  const scaleX = displayWidth / sourceWidth;
  const scaleY = displayHeight / sourceHeight;

  canvas.width = displayWidth;
  canvas.height = displayHeight;
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const colors = ["#0c8ce9", "#1a8a4a", "#d97706", "#cf222e", "#7c6dfa", "#0f766e"];

  item.instances.forEach((inst, index) => {
    const color = colors[index % colors.length];
    const [x1, y1, x2, y2] = inst.bbox_xyxy;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);

    inst.keypoints.forEach((kp) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(kp.x * scaleX, kp.y * scaleY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });
}

function closeDetail() {
  state.selectedId = null;
  document.getElementById("gallery-detail").hidden = true;
  renderGrid();
}

function selectItem(id) {
  state.selectedId = id;
  const item = state.visible.find((entry) => entry.id === id) || state.filtered.find((entry) => entry.id === id);
  if (!item) return;

  renderGrid();

  const panel = document.getElementById("gallery-detail");
  const img = document.getElementById("gallery-detail-image");
  const title = document.getElementById("gallery-detail-title");
  const meta = document.getElementById("gallery-detail-meta");
  const stats = document.getElementById("gallery-detail-stats");

  panel.hidden = false;
  title.textContent = item.species_label;
  meta.textContent = item.image_name;
  stats.innerHTML = `
    <div><span>Instances</span><strong>${item.instance_count}</strong></div>
    <div><span>Visible keypoints</span><strong>${item.instances.reduce((sum, inst) => sum + inst.keypoint_count, 0)}</strong></div>
    <div class="gallery-stat-species"><span>Species ID</span><strong>${item.species}</strong></div>
  `;

  img.onload = () => drawOverlay(item);
  img.src = item.thumb;
  if (img.complete) drawOverlay(item);
}

function reshuffle() {
  applyFilters();
  state.visible = shuffleArray(state.filtered).slice(0, state.subsetSize);
  if (state.selectedId && !state.visible.some((item) => item.id === state.selectedId)) {
    state.selectedId = null;
    document.getElementById("gallery-detail").hidden = true;
  }
  updateStatus();
  renderGrid();
}

function instanceOptionLabel(bucket) {
  return `${bucket} instance${bucket === "1" ? "" : "s"}`;
}

function getAvailableInstanceBuckets(speciesId) {
  if (speciesId === "all") {
    const buckets = new Set();
    state.manifest.species.forEach((species) => {
      Object.entries(species.instance_buckets || {}).forEach(([bucket, count]) => {
        if (count > 0) buckets.add(bucket);
      });
    });
    return sortInstanceBuckets(buckets);
  }

  const species = state.manifest.species.find((entry) => entry.id === speciesId);
  if (!species) return [];

  return sortInstanceBuckets(
    Object.entries(species.instance_buckets || {})
      .filter(([, count]) => count > 0)
      .map(([bucket]) => bucket),
  );
}

function populateInstances(speciesId) {
  const select = document.getElementById("gallery-instances");
  const previous = select.value;
  const buckets = getAvailableInstanceBuckets(speciesId);

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All counts";
  select.appendChild(allOption);

  buckets.forEach((bucket) => {
    const option = document.createElement("option");
    option.value = bucket;
    option.textContent = instanceOptionLabel(bucket);
    select.appendChild(option);
  });

  if (previous !== "all" && buckets.includes(previous)) {
    select.value = previous;
  } else {
    select.value = "all";
  }
}

function onSpeciesChange() {
  const speciesId = document.getElementById("gallery-species").value;
  populateInstances(speciesId);
  reshuffle();
}

function populateSpecies() {
  const select = document.getElementById("gallery-species");
  while (select.options.length > 1) {
    select.remove(1);
  }
  const speciesList = [...state.manifest.species].sort((a, b) => a.label.localeCompare(b.label));
  speciesList.forEach((species) => {
    const option = document.createElement("option");
    option.value = species.id;
    option.textContent = species.label.replace(/\s*\(\d+\)\s*$/, "");
    select.appendChild(option);
  });
}

function bindControls() {
  document.getElementById("gallery-species").addEventListener("change", onSpeciesChange);
  document.getElementById("gallery-instances").addEventListener("change", reshuffle);
  document.getElementById("gallery-shuffle").addEventListener("click", reshuffle);
  document.getElementById("gallery-detail-close").addEventListener("click", closeDetail);
  window.addEventListener("resize", () => {
    if (!state.selectedId) return;
    const item = state.manifest.items.find((entry) => entry.id === state.selectedId);
    if (item) drawOverlay(item);
  });
}

async function initGallery() {
  const response = await fetch("assets/data/gallery-manifest.json?v=11");
  state.manifest = await response.json();
  state.subsetSize = state.manifest.subset_size || DEFAULT_SUBSET_SIZE;
  populateSpecies();
  populateInstances("all");
  bindControls();
  reshuffle();
}

document.addEventListener("DOMContentLoaded", initGallery);
