/* ══════════════════════════════════════════════
   FISHÉDEX — App Logic
   Mobile PWA per collezionare pesci
   ══════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── Constants ───────────────────────────
  const DB_NAME = 'fishedex';
  const DB_VERSION = 1;
  const STORE_NAME = 'fish';
  const MAX_IMAGE_SIZE = 800; // max px dimension for stored photos
  const JPEG_QUALITY = 0.7;

  // ─── DOM Elements ────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const elApp = $('#app');
  const elFishCount = $('#fish-count');

  // Screens
  const screenCollection = $('#screen-collection');
  const screenAdd = $('#screen-add');
  const screenDetail = $('#screen-detail');
  const allScreens = [screenCollection, screenAdd, screenDetail];

  // Collection
  const elEmptyState = $('#empty-state');
  const elFishGrid = $('#fish-grid');

  // Add screen
  const elPhotoCapture = $('#photo-capture');
  const elPhotoPlaceholder = $('#photo-placeholder');
  const elPhotoPreview = $('#photo-preview');
  const elCameraInput = $('#camera-input');
  const elGalleryInput = $('#gallery-input');
  const elRemovePhotoBtn = $('#remove-photo-btn');
  const elInputName = $('#input-name');
  const elInputDesc = $('#input-desc');
  const elLocationDisplay = $('#location-display');
  const elDateDisplay = $('#date-display');
  const elBtnSave = $('#btn-save');
  const elAutocompleteList = $('#autocomplete-list');

  // Header buttons
  const elHeader = $('#main-header');
  const elBtnSettings = $('#btn-settings');
  const elBtnSound = $('#btn-sound');

  // Catch Animation Overlay
  const elCatchOverlay = $('#catch-animation-overlay');
  const elCatchStageFishing = $('#catch-stage-fishing');
  const elCatchStageRegistered = $('#catch-stage-registered');
  const elCatchStatusText = $('#catch-status-text');
  const elCatchPhotoImg = $('#catch-photo-img');
  const elCatchNumTag = $('#catch-num-tag');
  const elCatchNameTag = $('#catch-name-tag');
  const elCatchLocTag = $('#catch-loc-tag');
  const elBtnCatchContinue = $('#btn-catch-continue');

  // Photo picker
  const elPhotoPicker = $('#photo-picker');
  const elPickerBackdrop = $('#picker-backdrop');
  const elPickCamera = $('#pick-camera');
  const elPickGallery = $('#pick-gallery');
  const elPickApi = $('#pick-api');
  const elPickCancel = $('#pick-cancel');

  // Photo choice modal (ask mode)
  const elPhotoChoiceModal = $('#photo-choice-modal');
  const elChoiceApiPhoto = $('#choice-api-photo');
  const elChoiceMyPhoto = $('#choice-my-photo');

  // Settings modal
  const elSettingsModal = $('#settings-modal');
  const elSettingsBackdrop = $('#settings-backdrop');
  const elSettingsClose = $('#settings-close');
  const elSettingsSaveBtn = $('#settings-save-btn');

  // Detail screen
  const elDetailBody = $('#detail-body');
  const elBtnDelete = $('#btn-delete');

  // FAB
  const elFab = $('#fab');

  // Toast
  const elToast = $('#toast');

  // Confirm dialog
  const elConfirmOverlay = $('#confirm-overlay');
  const elConfirmMessage = $('#confirm-message');
  const elConfirmCancel = $('#confirm-cancel');
  const elConfirmOk = $('#confirm-ok');

  // Install
  const elInstallBanner = $('#install-banner');
  const elInstallDismiss = $('#install-dismiss');
  const elInstallAccept = $('#install-accept');

  // ─── State ───────────────────────────────
  let db = null;
  let currentPhoto = null;  // base64 string
  let currentLocation = null; // { lat, lng, name }
  let currentDetailId = null;
  let deferredInstallPrompt = null;
  let toastTimer = null;
  let autocompleteTimer = null;
  let autocompleteAbort = null;
  let pendingApiPhoto = null; // last photo URL from iNaturalist autocomplete

  // ─── Settings Storage ─────────────────────
  const SETTINGS_KEY = 'fishedex_user_settings';

  function getSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading settings:', e);
    }
    return { photoMode: 'manual' }; // 'manual' | 'auto' | 'ask'
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Error saving settings:', e);
    }
  }

  // ─── 8-Bit Web Audio Synthesizer (SFX) ─────
  let soundEnabled = localStorage.getItem('fishedex_sound') !== 'false';
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  const SFX = {
    // Menu click / navigation beep
    beep() {
      if (!soundEnabled) return;
      initAudio();
      if (!audioCtx) return;
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } catch (e) {}
    },

    // Fishing bite exclamation ("!")
    bite() {
      if (!soundEnabled) return;
      initAudio();
      if (!audioCtx) return;
      try {
        const t = audioCtx.currentTime;
        [0, 0.1].forEach((delay) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, t + delay);
          gain.gain.setValueAtTime(0.12, t + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.07);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t + delay);
          osc.stop(t + delay + 0.07);
        });
      } catch (e) {}
    },

    // Water splash sound
    splash() {
      if (!soundEnabled) return;
      initAudio();
      if (!audioCtx) return;
      try {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.22);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      } catch (e) {}
    },

    // Pokédex computer scan chirp
    scan() {
      if (!soundEnabled) return;
      initAudio();
      if (!audioCtx) return;
      try {
        const t = audioCtx.currentTime;
        for (let i = 0; i < 4; i++) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(500 + i * 180, t + i * 0.06);
          gain.gain.setValueAtTime(0.06, t + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.04);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t + i * 0.06);
          osc.stop(t + i * 0.06 + 0.04);
        }
      } catch (e) {}
    },

    // Retro Victory Catch Fanfare (C5 -> E5 -> G5 -> C6)
    catchVictory() {
      if (!soundEnabled) return;
      initAudio();
      if (!audioCtx) return;
      try {
        const t = audioCtx.currentTime;
        const notes = [
          { f: 523.25, d: 0.1, delay: 0 },
          { f: 659.25, d: 0.1, delay: 0.11 },
          { f: 783.99, d: 0.1, delay: 0.22 },
          { f: 1046.50, d: 0.4, delay: 0.33 }
        ];
        notes.forEach((n) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(n.f, t + n.delay);
          gain.gain.setValueAtTime(0.14, t + n.delay);
          gain.gain.exponentialRampToValueAtTime(0.001, t + n.delay + n.d);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t + n.delay);
          osc.stop(t + n.delay + n.d);
        });
      } catch (e) {}
    }
  };

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('fishedex_sound', soundEnabled ? 'true' : 'false');
    updateSoundButton();
    if (soundEnabled) {
      SFX.beep();
      showToast('🔊 Audio attivato');
    } else {
      showToast('🔇 Audio disattivato');
    }
  }

  function updateSoundButton() {
    if (elBtnSound) {
      elBtnSound.textContent = soundEnabled ? '🔊' : '🔇';
    }
  }

  // ─── Header LED Scanner Animation ─────────
  let ledScanTimer = null;
  function startLedScan(duration = 1800) {
    if (elHeader) elHeader.classList.add('leds-scanning');
    if (ledScanTimer) clearTimeout(ledScanTimer);
    ledScanTimer = setTimeout(() => {
      if (elHeader) elHeader.classList.remove('leds-scanning');
    }, duration);
  }

  // ─── IndexedDB ───────────────────────────

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  function dbTransaction(mode = 'readonly') {
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  function getAllFish() {
    return new Promise((resolve, reject) => {
      const store = dbTransaction();
      const request = store.index('createdAt').openCursor(null, 'prev');
      const results = [];

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  function getFishById(id) {
    return new Promise((resolve, reject) => {
      const store = dbTransaction();
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function addFish(fishData) {
    return new Promise((resolve, reject) => {
      const store = dbTransaction('readwrite');
      const request = store.add(fishData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function deleteFish(id) {
    return new Promise((resolve, reject) => {
      const store = dbTransaction('readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function countFish() {
    return new Promise((resolve, reject) => {
      const store = dbTransaction();
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ─── Image Processing ───────────────────

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Scale down if needed
          if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
            if (width > height) {
              height = Math.round(height * (MAX_IMAGE_SIZE / width));
              width = MAX_IMAGE_SIZE;
            } else {
              width = Math.round(width * (MAX_IMAGE_SIZE / height));
              height = MAX_IMAGE_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(dataUrl);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // ─── Geolocation ─────────────────────────

  function getCurrentLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ error: 'Geolocalizzazione non supportata' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let name = null;

          // Try reverse geocoding with Nominatim
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
              { headers: { 'Accept-Language': 'it' } }
            );
            const data = await resp.json();

            if (data.address) {
              const parts = [];
              const a = data.address;
              if (a.village || a.town || a.city || a.hamlet) {
                parts.push(a.village || a.town || a.city || a.hamlet);
              }
              if (a.county || a.state) {
                parts.push(a.county || a.state);
              }
              if (a.country) {
                parts.push(a.country);
              }
              name = parts.join(', ') || data.display_name;
            } else {
              name = data.display_name || null;
            }
          } catch {
            // Offline or API error — use coordinates
            name = null;
          }

          resolve({
            lat: latitude,
            lng: longitude,
            name: name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });
        },
        (err) => {
          let msg = 'Posizione non disponibile';
          if (err.code === 1) msg = 'Permesso negato';
          if (err.code === 3) msg = 'Timeout rilevamento';
          resolve({ error: msg });
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  }

  // ─── Navigation ──────────────────────────

  function showScreen(screen) {
    allScreens.forEach((s) => {
      if (s) s.classList.remove('active');
    });
    if (screen) screen.classList.add('active');

    // Show/hide FAB
    if (elFab) {
      if (screen === screenCollection) {
        elFab.classList.remove('hidden');
        elFab.style.display = 'flex';
      } else {
        elFab.classList.add('hidden');
        elFab.style.display = 'none';
      }
    }
  }

  // ─── Render Collection ───────────────────

  async function renderCollection() {
    const fish = await getAllFish();
    const count = fish.length;

    // Update counter
    elFishCount.textContent = String(count).padStart(3, '0');

    // Toggle empty state
    if (count === 0) {
      elEmptyState.style.display = 'flex';
      elFishGrid.style.display = 'none';
      return;
    }

    elEmptyState.style.display = 'none';
    elFishGrid.style.display = 'grid';

    elFishGrid.innerHTML = fish.map((f, i) => {
      const num = String(count - i).padStart(3, '0');
      const locationText = f.location && f.location.name
        ? escapeHTML(f.location.name)
        : '';
      return `
        <div class="fish-card" data-id="${f.id}">
          <div class="fish-card-img-wrapper">
            <span class="fish-card-number">#${num}</span>
            <img class="fish-card-img"
                 src="${f.photo}"
                 alt="${escapeHTML(f.name)}"
                 loading="lazy">
          </div>
          <div class="fish-card-info">
            <div class="fish-card-name">${escapeHTML(f.name)}</div>
            ${locationText ? `<div class="fish-card-location">${locationText}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers to cards
    elFishGrid.querySelectorAll('.fish-card').forEach((card) => {
      card.addEventListener('click', () => {
        SFX.beep();
        const id = Number(card.dataset.id);
        openDetail(id);
      });
    });
  }

  // ─── Open Detail ─────────────────────────

  async function openDetail(id) {
    const fish = await getFishById(id);
    if (!fish) return;

    currentDetailId = id;

    // Get fish number (total count - position)
    const allFish = await getAllFish();
    const idx = allFish.findIndex((f) => f.id === id);
    const num = String(allFish.length - idx).padStart(3, '0');

    const date = new Date(fish.createdAt);
    const dateStr = date.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let locationHTML = '';
    if (fish.location) {
      if (fish.location.name) {
        locationHTML = `
          <div class="detail-meta-row">
            <span class="detail-meta-icon">📍</span>
            <div class="detail-meta-content">
              <span class="detail-meta-label">Luogo</span>
              <span class="detail-meta-value">${escapeHTML(fish.location.name)}</span>
            </div>
          </div>
        `;
      }
      if (fish.location.lat && fish.location.lng) {
        locationHTML += `
          <div class="detail-meta-row">
            <span class="detail-meta-icon">🌐</span>
            <div class="detail-meta-content">
              <span class="detail-meta-label">Coordinate</span>
              <span class="detail-meta-value">${fish.location.lat.toFixed(5)}, ${fish.location.lng.toFixed(5)}</span>
            </div>
          </div>
        `;
      }
    }

    elDetailBody.innerHTML = `
      <div class="detail-photo-wrapper">
        <img class="detail-photo" src="${fish.photo}" alt="${escapeHTML(fish.name)}">
        <div class="scanner-laser"></div>
        <span class="detail-number-badge">#${num}</span>
      </div>
      <div class="detail-info">
        <h2 class="detail-name">${escapeHTML(fish.name)}</h2>
        <div class="detail-divider"></div>
        ${fish.description ? `<p class="detail-desc">${escapeHTML(fish.description)}</p>` : ''}
        <div class="detail-meta">
          <div class="detail-meta-row">
            <span class="detail-meta-icon">📅</span>
            <div class="detail-meta-content">
              <span class="detail-meta-label">Catturato il</span>
              <span class="detail-meta-value">${dateStr} — ${timeStr}</span>
            </div>
          </div>
          ${locationHTML}
        </div>
      </div>
    `;

    showScreen(screenDetail);
    SFX.scan();
    startLedScan(1800);
  }

  // ─── Open Add Screen ────────────────────

  function openAddScreen() {
    // Reset form
    currentPhoto = null;
    currentLocation = null;
    if (elPhotoCapture) elPhotoCapture.classList.remove('has-photo');
    if (elPhotoPreview) {
      elPhotoPreview.src = '';
      elPhotoPreview.style.display = 'none';
    }
    if (elPhotoPlaceholder) elPhotoPlaceholder.style.display = 'flex';
    if (elRemovePhotoBtn) elRemovePhotoBtn.hidden = true;
    if (elInputName) elInputName.value = '';
    if (elInputDesc) elInputDesc.value = '';
    if (elBtnSave) elBtnSave.disabled = true;
    if (elCameraInput) elCameraInput.value = '';
    if (elGalleryInput) elGalleryInput.value = '';
    if (elAutocompleteList) elAutocompleteList.hidden = true;
    pendingApiPhoto = null;
    if (elPickApi) elPickApi.style.display = 'none';

    // Set today's date
    const now = new Date();
    elDateDisplay.textContent = now.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Start location detection
    elLocationDisplay.className = 'location-box';
    elLocationDisplay.innerHTML = `
      <div class="location-loading">
        <span class="dot-pulse"></span>
        Rilevamento posizione...
      </div>
    `;

    getCurrentLocation().then((loc) => {
      if (loc.error) {
        elLocationDisplay.className = 'location-box error';
        elLocationDisplay.textContent = `⚠ ${loc.error}`;
        currentLocation = null;
      } else {
        currentLocation = loc;
        elLocationDisplay.className = 'location-box located';
        elLocationDisplay.textContent = `✓ ${loc.name}`;
      }
    });

    showScreen(screenAdd);
    SFX.beep();
  }

  // ─── Save Fish & Catch Sequence ──────────

  async function saveFish() {
    const name = elInputName.value.trim();
    if (!name) {
      showToast('Inserisci il nome del pesce!');
      return;
    }

    if (!currentPhoto) {
      showToast('Scatta una foto!');
      return;
    }

    const fishData = {
      name: name,
      description: elInputDesc.value.trim() || '',
      photo: currentPhoto,
      location: currentLocation || null,
      createdAt: new Date().toISOString()
    };

    try {
      const id = await addFish(fishData);
      fishData.id = id;

      // Launch the Epic Catch Sequence!
      await playCatchSequence(fishData);

      showScreen(screenCollection);
      await renderCollection();
    } catch (err) {
      console.error('Save error:', err);
      showToast('Errore nel salvataggio!');
    }
  }

  // ─── Epic Catch & Pokédex Registration Sequence ───

  function playCatchSequence(fishData) {
    return new Promise(async (resolve) => {
      if (!elCatchOverlay) return resolve();

      const all = await getAllFish();
      const numStr = '#' + String(all.length).padStart(3, '0');

      if (elCatchPhotoImg) elCatchPhotoImg.src = fishData.photo;
      if (elCatchNumTag) elCatchNumTag.textContent = numStr;
      if (elCatchNameTag) elCatchNameTag.textContent = fishData.name;
      if (elCatchLocTag) {
        elCatchLocTag.textContent = fishData.location?.name ? `📍 ${fishData.location.name}` : '📍 MARE';
      }

      // Reset stages
      if (elCatchStageFishing) elCatchStageFishing.style.display = 'flex';
      if (elCatchStageRegistered) elCatchStageRegistered.style.display = 'none';
      if (elCatchStatusText) elCatchStatusText.textContent = 'QUALCOSA HA ABBOCCATO!';

      elCatchOverlay.style.display = 'flex';

      // 1. Stage 1: The bite exclamation & sound
      SFX.bite();

      // 2. Stage 1.2: Bobber dives with splash
      const t1 = setTimeout(() => {
        SFX.splash();
        if (elCatchStatusText) elCatchStatusText.textContent = 'TIRO IN CORSO... PRESO!';
      }, 700);

      // 3. Stage 2: Caught & Pokédex registration!
      const t2 = setTimeout(() => {
        if (elCatchStageFishing) elCatchStageFishing.style.display = 'none';
        if (elCatchStageRegistered) elCatchStageRegistered.style.display = 'flex';

        // Laser scan sound & LED sequence
        SFX.scan();
        startLedScan(2200);

        // Victory fanfare!
        setTimeout(() => {
          SFX.catchVictory();
        }, 350);
      }, 1500);

      const finish = () => {
        clearTimeout(t1);
        clearTimeout(t2);
        elCatchOverlay.style.display = 'none';
        resolve();
      };

      if (elBtnCatchContinue) {
        elBtnCatchContinue.onclick = finish;
      }
      elCatchOverlay.onclick = (e) => {
        if (e.target === elCatchOverlay || e.target.classList.contains('catch-backdrop')) {
          finish();
        }
      };
    });
  }

  // ─── Delete Fish ─────────────────────────

  async function handleDelete() {
    if (currentDetailId == null) return;

    const confirmed = await showConfirm('Vuoi eliminare questo pesce dalla Fishédex?');
    if (!confirmed) return;

    try {
      await deleteFish(currentDetailId);
      currentDetailId = null;
      showToast('Pesce eliminato');
      showScreen(screenCollection);
      await renderCollection();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Errore nell\'eliminazione!');
    }
  }

  // ─── Toast ───────────────────────────────

  function showToast(message, duration = 2500) {
    if (toastTimer) clearTimeout(toastTimer);
    elToast.textContent = message;
    elToast.classList.add('show');
    toastTimer = setTimeout(() => {
      elToast.classList.remove('show');
    }, duration);
  }

  // ─── Confirm Dialog ─────────────────────

  function showConfirm(message) {
    return new Promise((resolve) => {
      if (!elConfirmOverlay) return resolve(false);
      elConfirmMessage.textContent = message;
      elConfirmOverlay.style.display = 'flex';

      const cleanup = () => {
        elConfirmOverlay.style.display = 'none';
        elConfirmCancel.removeEventListener('click', onCancel);
        elConfirmOk.removeEventListener('click', onOk);
      };

      const onCancel = () => { cleanup(); resolve(false); };
      const onOk = () => { cleanup(); resolve(true); };

      elConfirmCancel.addEventListener('click', onCancel);
      elConfirmOk.addEventListener('click', onOk);
    });
  }

  // ─── Utilities ───────────────────────────

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function validateSaveBtn() {
    const hasName = elInputName.value.trim().length > 0;
    const hasPhoto = currentPhoto != null;
    elBtnSave.disabled = !(hasName && hasPhoto);
  }

  // ─── Autocomplete (iNaturalist API) ──────

  function handleAutocompleteInput() {
    const query = elInputName.value.trim();

    // Clear previous timer/request
    if (autocompleteTimer) clearTimeout(autocompleteTimer);
    if (autocompleteAbort) autocompleteAbort.abort();

    if (query.length < 2) {
      elAutocompleteList.hidden = true;
      return;
    }

    // Debounce 350ms
    autocompleteTimer = setTimeout(() => fetchFishSuggestions(query), 350);
  }

  async function fetchFishSuggestions(query) {
    autocompleteAbort = new AbortController();

    // Show loading state
    elAutocompleteList.innerHTML = '<div class="autocomplete-loading"><span class="dot-pulse"></span> Ricerca...</div>';
    elAutocompleteList.hidden = false;

    try {
      // iNaturalist taxa autocomplete — taxon_id 47178 = Actinopterygii (ray-finned fishes)
      // Also search 47273 = Chondrichthyes (sharks/rays)
      const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(query)}&taxon_id=47178,47273&rank=species,subspecies&locale=it&per_page=8`;
      const resp = await fetch(url, { signal: autocompleteAbort.signal });
      const data = await resp.json();

      if (!data.results || data.results.length === 0) {
        elAutocompleteList.innerHTML = '<div class="autocomplete-loading">Nessun risultato</div>';
        return;
      }

      elAutocompleteList.innerHTML = data.results.map((taxon) => {
        const commonName = taxon.preferred_common_name || '';
        const sciName = taxon.name || '';
        const thumbUrl = taxon.default_photo?.square_url || '';
        const mediumUrl = taxon.default_photo?.medium_url || taxon.default_photo?.url || thumbUrl;
        const displayName = commonName || sciName;

        return `
          <div class="autocomplete-item" data-name="${escapeHTML(displayName)}" data-sci="${escapeHTML(sciName)}" data-photo="${escapeHTML(mediumUrl)}">
            ${thumbUrl
              ? `<img class="autocomplete-thumb" src="${thumbUrl}" alt="" loading="lazy">`
              : `<div class="autocomplete-thumb" style="display:flex;align-items:center;justify-content:center;font-size:16px">🐟</div>`
            }
            <div class="autocomplete-info">
              <span class="autocomplete-name">${escapeHTML(displayName)}</span>
              ${commonName && sciName ? `<span class="autocomplete-sci">${escapeHTML(sciName)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Attach click handlers
      elAutocompleteList.querySelectorAll('.autocomplete-item').forEach((item) => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          const sci = item.dataset.sci;
          const photoUrl = item.dataset.photo;

          elInputName.value = name + (sci && sci !== name ? ` (${sci})` : '');
          elAutocompleteList.hidden = true;
          validateSaveBtn();

          if (photoUrl) {
            pendingApiPhoto = photoUrl;
            const mode = getSettings().photoMode;
            if (mode === 'auto') {
              applyDatabasePhoto(photoUrl);
            } else if (mode === 'ask') {
              openPhotoChoiceModal(photoUrl);
            }
            // In 'manual' mode: keep current photo as-is, but pendingApiPhoto is ready if user opens picker
          }
        });
      });

    } catch (err) {
      if (err.name === 'AbortError') return; // cancelled, ignore
      console.warn('Autocomplete error:', err);
      elAutocompleteList.hidden = true;
    }
  }

  // ─── Database Photo Processing ──────────

  function urlToBase64(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
            if (width > height) {
              height = Math.round(height * (MAX_IMAGE_SIZE / width));
              width = MAX_IMAGE_SIZE;
            } else {
              width = Math.round(width * (MAX_IMAGE_SIZE / height));
              height = MAX_IMAGE_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch {
          // Tainted canvas fallback (CORS)
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }

  async function applyDatabasePhoto(url) {
    if (!url) return;
    showToast('🌐 Carico foto dal database...');
    try {
      const photoData = await urlToBase64(url);
      currentPhoto = photoData;
      elPhotoPreview.src = photoData;
      elPhotoCapture.classList.add('has-photo');
      elRemovePhotoBtn.hidden = false;
      validateSaveBtn();
      showToast('✓ Foto database impostata!');
    } catch (err) {
      currentPhoto = url;
      elPhotoPreview.src = url;
      elPhotoCapture.classList.add('has-photo');
      elRemovePhotoBtn.hidden = false;
      validateSaveBtn();
    }
  }

  // ─── Photo Choice Modal (Ask Mode) ──────

  let choicePhotoUrl = null;

  function openPhotoChoiceModal(photoUrl) {
    choicePhotoUrl = photoUrl;
    if (elPhotoChoiceModal) {
      elPhotoChoiceModal.style.display = 'flex';
    }
  }

  function closePhotoChoiceModal() {
    choicePhotoUrl = null;
    if (elPhotoChoiceModal) {
      elPhotoChoiceModal.style.display = 'none';
    }
  }

  // ─── Settings Modal ─────────────────────

  function openSettingsModal() {
    if (!elSettingsModal) return;
    const settings = getSettings();
    const mode = settings.photoMode || 'manual';
    const radio = $(`input[name="setting-photo-mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
    elSettingsModal.style.display = 'flex';
  }

  function closeSettingsModal() {
    if (elSettingsModal) {
      elSettingsModal.style.display = 'none';
    }
  }

  function handleSaveSettings() {
    const checkedRadio = $('input[name="setting-photo-mode"]:checked');
    const photoMode = checkedRadio ? checkedRadio.value : 'manual';
    saveSettings({ photoMode });
    closeSettingsModal();
    showToast('⚙️ Impostazioni salvate!');
  }

  // ─── Photo Picker ──────────────────────

  function showPhotoPicker() {
    if (!elPhotoPicker) return;
    if (elPickApi) {
      elPickApi.style.display = pendingApiPhoto ? 'block' : 'none';
    }
    elPhotoPicker.style.display = 'flex';
  }

  function hidePhotoPicker() {
    if (elPhotoPicker) {
      elPhotoPicker.style.display = 'none';
    }
  }

  async function handlePhotoFile(file) {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      currentPhoto = compressed;
      elPhotoPreview.src = compressed;
      elPhotoCapture.classList.add('has-photo');
      elRemovePhotoBtn.hidden = false;
      validateSaveBtn();
    } catch (err) {
      console.error('Image processing error:', err);
      showToast('Errore nella foto!');
    }
  }

  // ─── Event Listeners ────────────────────

  function setupEvents() {
    // FAB → open add screen
    if (elFab) {
      elFab.addEventListener('click', (e) => {
        e.preventDefault();
        openAddScreen();
      });
    }

    // Back buttons
    $$('[data-action="back-to-collection"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (elAutocompleteList) elAutocompleteList.hidden = true;
        showScreen(screenCollection);
      });
    });

    // Photo capture — tap area to show picker
    if (elPhotoCapture) {
      elPhotoCapture.addEventListener('click', (e) => {
        if (e.target === elRemovePhotoBtn || (elRemovePhotoBtn && elRemovePhotoBtn.contains(e.target))) return;
        showPhotoPicker();
      });
    }

    // Photo picker buttons
    if (elPickCamera) {
      elPickCamera.addEventListener('click', () => {
        hidePhotoPicker();
        if (elCameraInput) elCameraInput.click();
      });
    }

    if (elPickGallery) {
      elPickGallery.addEventListener('click', () => {
        hidePhotoPicker();
        if (elGalleryInput) elGalleryInput.click();
      });
    }

    if (elPickApi) {
      elPickApi.addEventListener('click', () => {
        hidePhotoPicker();
        if (pendingApiPhoto) {
          applyDatabasePhoto(pendingApiPhoto);
        }
      });
    }

    if (elPickCancel) elPickCancel.addEventListener('click', hidePhotoPicker);
    if (elPickerBackdrop) elPickerBackdrop.addEventListener('click', hidePhotoPicker);

    // Settings modal events
    if (elBtnSettings) {
      elBtnSettings.addEventListener('click', (e) => {
        e.preventDefault();
        openSettingsModal();
      });
    }
    if (elSettingsClose) elSettingsClose.addEventListener('click', closeSettingsModal);
    if (elSettingsBackdrop) elSettingsBackdrop.addEventListener('click', closeSettingsModal);
    if (elSettingsSaveBtn) elSettingsSaveBtn.addEventListener('click', handleSaveSettings);

    // Sound toggle button
    if (elBtnSound) {
      elBtnSound.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSound();
      });
      updateSoundButton();
    }

    // Photo choice modal (ask mode) events
    if (elChoiceApiPhoto) {
      elChoiceApiPhoto.addEventListener('click', () => {
        const url = choicePhotoUrl;
        closePhotoChoiceModal();
        if (url) applyDatabasePhoto(url);
      });
    }

    if (elChoiceMyPhoto) {
      elChoiceMyPhoto.addEventListener('click', () => {
        closePhotoChoiceModal();
        showPhotoPicker();
      });
    }

    // Camera input change
    if (elCameraInput) {
      elCameraInput.addEventListener('change', (e) => {
        handlePhotoFile(e.target.files[0]);
      });
    }

    // Gallery input change
    if (elGalleryInput) {
      elGalleryInput.addEventListener('change', (e) => {
        handlePhotoFile(e.target.files[0]);
      });
    }

    // Remove photo
    if (elRemovePhotoBtn) {
      elRemovePhotoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentPhoto = null;
        if (elPhotoCapture) elPhotoCapture.classList.remove('has-photo');
        if (elPhotoPreview) elPhotoPreview.src = '';
        elRemovePhotoBtn.hidden = true;
        if (elCameraInput) elCameraInput.value = '';
        if (elGalleryInput) elGalleryInput.value = '';
        validateSaveBtn();
      });
    }

    // Name input → validate + autocomplete
    if (elInputName) {
      elInputName.addEventListener('input', () => {
        validateSaveBtn();
        handleAutocompleteInput();
      });
    }

    // Close autocomplete when tapping outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.field-autocomplete')) {
        if (elAutocompleteList) elAutocompleteList.hidden = true;
      }
    });

    // Save
    if (elBtnSave) elBtnSave.addEventListener('click', saveFish);

    // Delete
    if (elBtnDelete) elBtnDelete.addEventListener('click', handleDelete);

    // Install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      setTimeout(() => {
        if (elInstallBanner) elInstallBanner.style.display = 'flex';
      }, 3000);
    });

    if (elInstallDismiss) {
      elInstallDismiss.addEventListener('click', () => {
        if (elInstallBanner) elInstallBanner.style.display = 'none';
      });
    }

    if (elInstallAccept) {
      elInstallAccept.addEventListener('click', async () => {
        if (elInstallBanner) elInstallBanner.style.display = 'none';
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const result = await deferredInstallPrompt.userChoice;
          if (result.outcome === 'accepted') {
            showToast('📲 Fishédex installata!');
          }
          deferredInstallPrompt = null;
        }
      });
    }

    // Prevent overscroll / bounce on iOS
    document.body.addEventListener('touchmove', (e) => {
      const screen = document.querySelector('.screen.active');
      if (screen && screen.scrollHeight <= screen.clientHeight) {
        // Only prevent if there's nothing to scroll
      }
    }, { passive: true });
  }

  // ─── Service Worker ──────────────────────

  async function registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('SW registered:', registration.scope);
      } catch (err) {
        console.warn('SW registration failed:', err);
      }
    }
  }

  // ─── Icon Generation ────────────────────

  function generateIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f1923';
    ctx.fillRect(0, 0, size, size);

    // Circle
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();

    // Fish emoji (text)
    ctx.font = `${size * 0.35}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐟', cx, cy);

    // Border ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = size * 0.02;
    ctx.stroke();

    return canvas.toDataURL('image/png');
  }

  // ─── Init ────────────────────────────────

  async function init() {
    // 1. FIRST: Bind events immediately so all buttons respond!
    setupEvents();

    // 2. Open DB and render collection
    try {
      await openDB();
      await renderCollection();
      registerSW();
      console.log('🐟 Fishédex initialized!');
    } catch (err) {
      console.error('Init error:', err);
      showToast('Errore di inizializzazione');
    }
  }

  // Launch!
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
