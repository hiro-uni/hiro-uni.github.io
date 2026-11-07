import * as THREE from "three";
import { worldPlaces } from "./ggj27-world-places.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const card = document.querySelector(".world-card");
const container = card?.querySelector(".world-canvas");
const marker = card?.querySelector(".world-pin-label");

if (card && container && marker) {
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    camera.position.set(0, 0, 4.3);
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 5, 8);
    scene.add(light);
    const earth = new THREE.Group();
    scene.add(earth);
    const forward = new THREE.Vector3(0, 0, 1);
    const target = new THREE.Quaternion();
    const current = new THREE.Quaternion();
    const startRotation = new THREE.Quaternion();
    const projected = new THREE.Vector3();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let point = new THREE.Vector3();
    let loaded = false;
    let inView = false;
    let frame = 0;
    let startTime = 0;
    let nextFrameTime = 0;
    const frameInterval = 1000 / 60;
    let moving = false;

    // Track the marker on the globe; the star backdrop moves separately.
    function setPlace(index, immediate = false) {
      const [x, y] = (worldPlaces[index] || worldPlaces[0]).map;
      const phi = Math.PI * y / 512;
      const theta = Math.PI * 2 * x / 1024;
      point.set(-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      target.setFromUnitVectors(point, forward);
      card.classList.toggle("stars-shift", index % 2 === 1);
      startRotation.copy(current);
      startTime = 0;
      nextFrameTime = 0;
      moving = !immediate && !reduced.matches;
      if (!moving) {
        current.copy(target);
      }
      renderOnce();
      start();
    }
    function resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderOnce();
    }
    function renderOnce() {
      if (!loaded) return;
      earth.quaternion.copy(current);
      projected.copy(point).multiplyScalar(1.02).applyQuaternion(current).project(camera);
      marker.style.left = `${(projected.x * .5 + .5) * 100}%`;
      marker.style.top = `${(-projected.y * .5 + .5) * 100}%`;
      renderer.render(scene, camera);
    }
    function animate(time) {
      frame = 0;
      if (!inView || !loaded || !moving) return;
      if (!startTime) startTime = time;
      if (!nextFrameTime || time >= nextFrameTime - 0.5) {
        nextFrameTime = nextFrameTime ? Math.max(nextFrameTime + frameInterval, time) : time + frameInterval;
        const progress = Math.min((time - startTime) / 1600, 1);
        const ease = 1 - (1 - progress) ** 3;
        current.slerpQuaternions(startRotation, target, ease);
        renderOnce();
        if (progress === 1) moving = false;
      }
      if (moving) frame = requestAnimationFrame(animate);
    }
    function start() { if (!frame && inView && loaded && moving) frame = requestAnimationFrame(animate); }
    card.addEventListener("world-place-change", (event) => setPlace(event.detail));
    new ResizeObserver(resize).observe(container);
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (!inView && frame) { cancelAnimationFrame(frame); frame = 0; startTime = 0; nextFrameTime = 0; startRotation.copy(current); }
      if (inView) start();
    }, { threshold: .1 }).observe(card);
    new GLTFLoader().load("/assets/ggj/earth.glb", ({ scene: model }) => {
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 2 / Math.max(size.x, size.y, size.z);
      model.position.copy(center).multiplyScalar(-scale);
      model.scale.setScalar(scale);
      earth.add(model);
      loaded = true;
      card.classList.add("world-ready");
      setPlace(Number(card.dataset.worldIndex || 0), true);
      resize();
      start();
    }, undefined, () => { card.classList.add("world-failed"); });
  } catch {
    card.classList.add("world-failed");
  }
}
