'use strict';

// ---'use strict';

// ─── PARTICLES ────────────────────────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.5 + 0.1,
      gold: Math.random() > 0.5,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: 100 }, createParticle);
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      p.x += p.dx;
      p.y += p.dy;
      p.alpha -= 0.0005;
      if (p.y < -10 || p.alpha <= 0) particles[i] = createParticle();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold
        ? `rgba(201,162,39,${p.alpha})`
        : `rgba(245,230,200,${p.alpha * 0.5})`;
      ctx.fill();
    });
    animId = requestAnimationFrame(tick);
  }

  init();
  tick();
  window.addEventListener('resize', init);
})();

// ─── NAV ──────────────────────────────────────────────────────────────────────
(function initNav() {
  const nav = document.getElementById('main-nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    nav.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open);
  });

  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

// ─── GALLERY LIGHTBOX ─────────────────────────────────────────────────────────
(function initLightbox() {
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbClose = document.getElementById('lightbox-close');

  document.querySelectorAll('.gallery-item img').forEach(img => {
    img.addEventListener('click', () => {
      lbImg.src = img.src;
      lb.classList.add('show');
    });
  });

  function closeLb() { lb.classList.remove('show'); }
  lbClose.addEventListener('click', closeLb);
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });
})();

// ─── CAMERA & FACE MERGE ─────────────────────────────────────────────────────
(function initCamera() {
  // DOM refs
  const btnStart   = document.getElementById('btn-start-camera');
  const btnCapture = document.getElementById('btn-capture');
  const btnRetake  = document.getElementById('btn-retake');
  const btnRetakeFromCamera = document.getElementById('btn-retake-from-camera');
  const btnDownload = document.getElementById('btn-download');
  const btnShareWa = document.getElementById('btn-share-wa');

  const viewStart  = document.getElementById('view-start');
  const viewCamera = document.getElementById('view-camera');
  const viewResult = document.getElementById('view-result');

  const videoFeed  = document.getElementById('video-feed');
  const snapCanvas = document.getElementById('snap-canvas');
  const resultCanvas = document.getElementById('result-canvas');
  const processing   = document.getElementById('processing');
  const errorBox     = document.getElementById('camera-error');
  const errorMsg     = document.getElementById('camera-error-msg');

  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');

  let stream = null;
  let christImage = null;

  // ── Load Christ image ──
  const CHRIST_IMG_PATH = 'assets/christ_face.png';

  function loadChristImage() {
    return new Promise((resolve, reject) => {
      if (christImage) { resolve(christImage); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { christImage = img; resolve(img); };
      img.onerror = reject;
      img.src = CHRIST_IMG_PATH;
    });
  }

  // ── Step indicator helpers ──
  function setStep(n) {
    [step1, step2, step3].forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 < n) s.classList.add('done');
      else if (i + 1 === n) s.classList.add('active');
    });
  }

  // ── Show/hide views ──
  function showView(name) {
    viewStart.classList.remove('active');
    viewCamera.classList.remove('active');
    viewResult.classList.remove('active');
    processing.classList.remove('show');
    document.getElementById('view-' + name).classList.add('active');
  }

  // ── Show error ──
  function showError(msg) {
    errorMsg.textContent = msg || '⚠️ حدث خطأ. يرجى المحاولة مرة أخرى.';
    errorBox.classList.add('show');
    setTimeout(() => errorBox.classList.remove('show'), 5000);
  }

  // ── Stop camera stream ──
  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  // ── Start camera (mobile-safe) ──
  async function startCamera() {
    errorBox.classList.remove('show');
    stopStream(); // stop any existing stream first

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('⚠️ المتصفح لا يدعم الكاميرا. جرّب Chrome أو Safari أحدث إصدار.');
      return;
    }

    // Constraints — avoid { exact } on facingMode to maximise compatibility
    const constraints = {
      video: {
        facingMode: 'user',
        width:  { ideal: 1280, max: 1920 },
        height: { ideal: 1280, max: 1920 },
      },
      audio: false,
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (firstErr) {
      // Fallback: try without size constraints (some old Android browsers)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      } catch (err) {
        console.error('Camera error:', err);
        let msg = '⚠️ تعذّر تشغيل الكاميرا. ';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          msg += 'اسمح بإذن الكاميرا من إعدادات المتصفح ثم اضغط "ابدأ الكاميرا" مجدداً.';
        else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
          msg += 'لا توجد كاميرا أمامية متاحة على هذا الجهاز.';
        else if (err.name === 'NotReadableError' || err.name === 'TrackStartError')
          msg += 'الكاميرا مستخدمة من تطبيق آخر. أغلقه وأعد المحاولة.';
        else if (err.name === 'OverconstrainedError')
          msg += 'الكاميرا الأمامية غير متوفرة على هذا الجهاز.';
        else
          msg += 'تأكد من إذن الكاميرا وإعادة المحاولة.';
        showError(msg);
        return;
      }
    }

    videoFeed.srcObject = stream;

    // iOS Safari needs playsinline + a real play() call inside a user-gesture.
    // Wait for loadedmetadata to ensure videoWidth/Height are valid on mobile.
    await new Promise((resolve) => {
      if (videoFeed.readyState >= 2) { resolve(); return; }
      videoFeed.addEventListener('loadedmetadata', resolve, { once: true });
      // Safety timeout — resolve after 4 s no matter what
      setTimeout(resolve, 4000);
    });

    try { await videoFeed.play(); } catch (_) { /* autoplay blocked — user must tap */ }

    showView('camera');
    setStep(2);
  }

  // ── Capture selfie (mobile-safe) ──
  function captureSelfie() {
    // On some mobile browsers videoWidth is 0 right after play() — poll until ready
    const vw = videoFeed.videoWidth  || videoFeed.clientWidth  || 640;
    const vh = videoFeed.videoHeight || videoFeed.clientHeight || 640;

    if (videoFeed.videoWidth === 0) {
      // Retry after a short delay (mobile buffering)
      btnCapture.disabled = true;
      btnCapture.textContent = '⏳';
      setTimeout(() => {
        btnCapture.disabled = false;
        btnCapture.textContent = '📸';
        captureSelfie();
      }, 600);
      return;
    }

    // Square crop from center
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    snapCanvas.width  = size;
    snapCanvas.height = size;
    const ctx = snapCanvas.getContext('2d');

    // The video element has CSS transform: scaleX(-1) to show a mirror preview.
    // We want the captured selfie to look NATURAL (left/right as they are in reality),
    // so we flip it back on the canvas.
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoFeed, sx, sy, size, size, 0, 0, size, size);
    ctx.restore();

    stopStream();
    mergeFaces();
  }

  // ── Merge faces ──
  async function mergeFaces() {
    showView('start'); // hide camera
    processing.classList.add('show');
    setStep(3);

    try {
      const christImg = await loadChristImage();
      buildMerge(christImg);
    } catch (err) {
      console.error('Christ image load error:', err);
      // Fallback: draw without christ image, show placeholder
      buildMergeWithPlaceholder();
    }
  }

  function buildMerge(christImg) {
    const SIZE = 800;
    const canvas = resultCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = SIZE;
    canvas.height = SIZE;

    // ── Draw Christ (left half) ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SIZE / 2, SIZE);
    ctx.clip();
    // Draw christ image centered, zoomed in, and shifted up to match user's face scale
    const zoom = 1.45; // scale factor
    const yOffset = 30; // shift down slightly if needed, or adjust
    const xOffset = 20; // shift right slightly to center the face on the split line

    const cRatio = christImg.width / christImg.height;
    let cDrawW = SIZE * zoom;
    let cDrawH = SIZE * zoom;
    if (cRatio > 1) { cDrawW = SIZE * cRatio * zoom; }
    else { cDrawH = (SIZE / cRatio) * zoom; }
    
    const cX = (SIZE - cDrawW) / 2 + xOffset;
    const cY = (SIZE - cDrawH) / 2 + yOffset;
    ctx.drawImage(christImg, cX, cY, cDrawW, cDrawH);
    ctx.restore();

    // ── Draw selfie (right half) ──
    const snapCtx = snapCanvas.getContext('2d');
    const selfieData = snapCanvas;
    ctx.save();
    ctx.beginPath();
    ctx.rect(SIZE / 2, 0, SIZE / 2, SIZE);
    ctx.clip();
    ctx.drawImage(selfieData, 0, 0, SIZE, SIZE);
    ctx.restore();

    // ── Golden divider line ──
    const grad = ctx.createLinearGradient(SIZE / 2 - 1, 0, SIZE / 2 + 1, SIZE);
    grad.addColorStop(0, 'rgba(201,162,39,0)');
    grad.addColorStop(0.2, '#E8C84A');
    grad.addColorStop(0.5, '#FFFFFF');
    grad.addColorStop(0.8, '#E8C84A');
    grad.addColorStop(1, 'rgba(201,162,39,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(SIZE / 2 - 1.5, 0, 3, SIZE);

    // ── Vignette overlay ──
    const vig = ctx.createRadialGradient(SIZE/2, SIZE/2, SIZE*0.3, SIZE/2, SIZE/2, SIZE*0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10,20,30,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── Watermark / Title ──
    // Top band
    const topGrad = ctx.createLinearGradient(0, 0, 0, 100);
    topGrad.addColorStop(0, 'rgba(10,20,30,0.7)');
    topGrad.addColorStop(1, 'rgba(10,20,30,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, SIZE, 100);

    // Bottom band
    const botGrad = ctx.createLinearGradient(0, SIZE - 120, 0, SIZE);
    botGrad.addColorStop(0, 'rgba(10,20,30,0)');
    botGrad.addColorStop(1, 'rgba(10,20,30,0.75)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, SIZE - 120, SIZE, 120);

    // Title text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#C9A227';
    ctx.font = 'bold 48px Cinzel, serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('IMAGO DI', SIZE / 2, 60);

    ctx.fillStyle = 'rgba(245,230,200,0.7)';
    ctx.font = '18px Tajawal, sans-serif';
    ctx.fillText('صورة الله — حفلة الوعد الكشفية ٢٠٢٦', SIZE / 2, 88);

    // Bottom verse
    ctx.fillStyle = 'rgba(245,230,200,0.85)';
    ctx.font = 'italic 16px Tajawal, sans-serif';
    ctx.fillText('«فَخَلَقَ اللهُ الإِنسَانَ عَلَى صُورَتِهِ»', SIZE / 2, SIZE - 55);
    ctx.fillStyle = '#C9A227';
    ctx.font = '13px Cinzel, serif';
    ctx.fillText('Genesis 1:27  ·  أم النور الكشفية  ·  سوهاج', SIZE / 2, SIZE - 28);

    finalizeMerge();
  }

  function buildMergeWithPlaceholder() {
    const SIZE = 800;
    const canvas = resultCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = SIZE;
    canvas.height = SIZE;

    // Background
    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    bg.addColorStop(0, '#0D1B2A');
    bg.addColorStop(1, '#1A0A2E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Left half: golden placeholder
    const leftGrad = ctx.createRadialGradient(SIZE/4, SIZE/2, 50, SIZE/4, SIZE/2, 280);
    leftGrad.addColorStop(0, 'rgba(201,162,39,0.15)');
    leftGrad.addColorStop(1, 'rgba(201,162,39,0.03)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, SIZE/2, SIZE);

    // Circle + cross placeholder for Christ
    ctx.beginPath();
    ctx.arc(SIZE/4, SIZE/2, 120, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(201,162,39,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(201,162,39,0.5)';
    ctx.font = '80px serif';
    ctx.textAlign = 'center';
    ctx.fillText('✝', SIZE/4, SIZE/2 + 28);

    ctx.fillStyle = 'rgba(245,230,200,0.5)';
    ctx.font = '16px Tajawal, sans-serif';
    ctx.fillText('وجه المسيح', SIZE/4, SIZE/2 + 100);

    // Right half: selfie
    ctx.save();
    ctx.beginPath();
    ctx.rect(SIZE/2, 0, SIZE/2, SIZE);
    ctx.clip();
    ctx.drawImage(snapCanvas, 0, 0, SIZE, SIZE);
    ctx.restore();

    // Gold divider
    const grad = ctx.createLinearGradient(SIZE/2-1, 0, SIZE/2+1, SIZE);
    grad.addColorStop(0, 'rgba(201,162,39,0)');
    grad.addColorStop(0.5, '#FFFFFF');
    grad.addColorStop(1, 'rgba(201,162,39,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(SIZE/2-1.5, 0, 3, SIZE);

    // Texts
    ctx.textAlign = 'center';
    ctx.fillStyle = '#C9A227';
    ctx.font = 'bold 48px Cinzel, serif';
    ctx.fillText('IMAGO DI', SIZE/2, 60);
    ctx.fillStyle = 'rgba(245,230,200,0.7)';
    ctx.font = '18px Tajawal, sans-serif';
    ctx.fillText('صورة الله — حفلة الوعد الكشفية ٢٠٢٦', SIZE/2, 90);

    finalizeMerge();
  }

  function finalizeMerge() {
    processing.classList.remove('show');
    viewResult.classList.add('active');

    // Set download link
    const dataUrl = resultCanvas.toDataURL('image/png', 0.95);
    btnDownload.href = dataUrl;
    btnDownload.download = 'imago-di-2026-صورة-الله.png';
  }

  // ── Reset ──
  function reset() {
    stopStream();
    showView('start');
    setStep(1);
    viewCamera.classList.remove('active');
    viewResult.classList.remove('active');
  }

  // ── Share via WhatsApp ──
  btnShareWa.addEventListener('click', () => {
    const text = encodeURIComponent('«فَخَلَقَ اللهُ الإِنسَانَ عَلَى صُورَتِهِ» تك ١:٢٧\n\nحفلة الوعد الكشفية Imago Di 2026 — أم النور الكشفية، سوهاج 🌟');
    window.open(`https://wa.me/?text=${text}`, '_blank');
  });

  // ── Event listeners ──
  btnStart.addEventListener('click', startCamera);
  btnCapture.addEventListener('click', captureSelfie);
  btnRetake.addEventListener('click', () => { reset(); startCamera(); });
  btnRetakeFromCamera.addEventListener('click', () => { stopStream(); showView('start'); setStep(1); });

  // Init
  showView('start');
  setStep(1);
})();

