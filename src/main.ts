import './style.css';
import {
  Clock,
  Color,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createWorld } from './world';
import { XRControls } from './xrControls';

const app = getElement<HTMLDivElement>('app');
const xrEntry = getElement<HTMLDivElement>('xr-entry');
const status = getElement<HTMLParagraphElement>('status');

const scene = new Scene();
scene.background = new Color(0x9fb9bd);

const renderer = new WebGLRenderer({ antialias: true });
renderer.outputColorSpace = SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
app.appendChild(renderer.domElement);

const world = createWorld();
scene.add(world.root);

const playerRig = new Group();
playerRig.name = 'player-rig';
playerRig.position.copy(world.spawn);
scene.add(playerRig);

const xrCamera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
xrCamera.name = 'xr-camera';
xrCamera.position.set(0, 1.58, 0);
playerRig.add(xrCamera);

const desktopCamera = new PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 80);
desktopCamera.name = 'desktop-camera';
desktopCamera.position.set(0, 1.62, 2.72);
desktopCamera.lookAt(0, 1.05, 0);

const desktopControls = new OrbitControls(desktopCamera, renderer.domElement);
desktopControls.target.set(0, 1.05, 0);
desktopControls.enableDamping = true;
desktopControls.enablePan = false;
desktopControls.minDistance = 0.9;
desktopControls.maxDistance = 4.2;
desktopControls.maxPolarAngle = Math.PI * 0.52;

const xrControls = new XRControls(renderer, playerRig, xrCamera, world.roomBounds, world.board);
const clock = new Clock();

const sessionInit: XRSessionInit = {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['bounded-floor']
};
const vrButton = VRButton.createButton(renderer, sessionInit);
vrButton.style.position = 'relative';
vrButton.style.left = 'auto';
vrButton.style.bottom = 'auto';
vrButton.style.transform = 'none';
vrButton.style.margin = '0';
xrEntry.appendChild(vrButton);

renderer.xr.addEventListener('sessionstart', () => {
  status.textContent = 'Session VR active.';
});

renderer.xr.addEventListener('sessionend', () => {
  void updateWebXRStatus();
});

window.addEventListener('resize', resize);
resize();
void updateWebXRStatus();

renderer.setAnimationLoop(() => {
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);

  if (renderer.xr.isPresenting) {
    xrControls.update(deltaSeconds);
    renderer.render(scene, xrCamera);
    return;
  }

  desktopControls.update();
  renderer.render(scene, desktopCamera);
});

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);

  xrCamera.aspect = width / height;
  xrCamera.updateProjectionMatrix();

  desktopCamera.aspect = width / height;
  desktopCamera.updateProjectionMatrix();
}

async function updateWebXRStatus(): Promise<void> {
  if (!window.isSecureContext) {
    status.textContent = 'WebXR VR demande HTTPS. Lance npm run dev:https ou utilise une URL HTTPS depuis le casque.';
    return;
  }

  if (!navigator.xr) {
    status.textContent = "WebXR n'est pas disponible dans ce navigateur.";
    return;
  }

  try {
    const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
    status.textContent = isSupported
      ? 'Pret pour Meta Quest. Entre en VR avec le bouton dedie.'
      : "Aucun casque VR WebXR compatible n'est detecte.";
  } catch {
    status.textContent = 'Impossible de verifier le support WebXR VR.';
  }
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element #${id} introuvable.`);
  }

  return element as T;
}
