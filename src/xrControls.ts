import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Vector3,
  WebGLRenderer
} from 'three';
import type { RoomBounds } from './world';

type ControllerHand = 'left' | 'right';

type ControllerSlot = {
  grip: Group;
  handedness: ControllerHand | 'none';
  inputSource?: XRInputSource;
  handModel?: StylizedHand;
  held?: HeldObject;
  wasGrabPressed: boolean;
  wasTriggerPressed: boolean;
  triggerCurl: number;
  gripCurl: number;
  thumbCurl: number;
};

const deadzone = 0.18;
const maxShotDistance = 40;
const projectileSpeed = 72;
const projectileFadeSeconds = 0.2;
const muzzleFlashDuration = 0.085;
const explosionDuration = 0.55;
const handScale = 0.75;
const handRotationX = 5.5;
const handRotationZ = Math.PI / 2.5;
const fingerBaseRotationX = Math.PI / 2;
const fingerClosedRotationX = Math.PI / 2 - 1.08;
const yAxis = new Vector3(0, 1, 0);

const tracerGeometry = new CylinderGeometry(0.008, 0.014, 1, 8);
const projectileTipGeometry = new SphereGeometry(0.035, 8, 8);
const muzzleConeGeometry = new ConeGeometry(0.085, 0.24, 12);
const muzzleGlowGeometry = new SphereGeometry(0.06, 10, 10);
const shardGeometry = new BoxGeometry(1, 1, 1);

type StylizedHand = {
  root: Group;
  index: Group;
  gripFingers: Group[];
  thumb: Group;
  thumbBaseRotationY: number;
  thumbBaseRotationZ: number;
};

type GrabbableKind = 'gun' | 'board' | 'bottle' | 'object';

type HeldObject = {
  object: Group;
  parent: Object3D;
  kind: GrabbableKind;
};

type ProjectileShot = {
  root: Group;
  tracer: Mesh;
  tip: Mesh;
  materials: MeshBasicMaterial[];
  origin: Vector3;
  direction: Vector3;
  distance: number;
  age: number;
  impactTime?: number;
  hitBottle?: Group;
  hasImpacted: boolean;
};

type MuzzleFlash = {
  root: Group;
  materials: MeshBasicMaterial[];
  age: number;
};

type ExplosionShard = {
  mesh: Mesh;
  material: MeshBasicMaterial;
  velocity: Vector3;
  angularVelocity: Vector3;
  age: number;
};

type HapticPulseActuator = {
  pulse(intensity: number, duration: number): Promise<boolean>;
};

type HapticGamepad = Gamepad & {
  hapticActuators?: HapticPulseActuator[];
  vibrationActuator?: {
    playEffect(effectType: string, params: { duration: number; strongMagnitude?: number; weakMagnitude?: number }): Promise<void>;
  };
};

export class XRControls {
  private readonly slots: ControllerSlot[] = [];
  private readonly grabbables: Group[];
  private readonly muzzle: Object3D;
  private readonly handPosition = new Vector3();
  private readonly objectPosition = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly movement = new Vector3();
  private readonly muzzlePosition = new Vector3();
  private readonly muzzleQuaternion = new Quaternion();
  private readonly shotDirection = new Vector3();
  private readonly impactPosition = new Vector3();
  private readonly raycaster = new Raycaster();
  private readonly projectiles: ProjectileShot[] = [];
  private readonly muzzleFlashes: MuzzleFlash[] = [];
  private readonly explosionShards: ExplosionShard[] = [];

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly playerRig: Group,
    private readonly camera: PerspectiveCamera,
    private readonly roomBounds: RoomBounds,
    private readonly effectParent: Object3D,
    private readonly board: Group,
    private readonly gun: Group,
    private readonly bottles: Group[]
  ) {
    const parent = gun.parent;
    if (!parent) {
      throw new Error('Le pistolet doit etre ajoute a la scene avant les controles XR.');
    }

    const muzzle = gun.getObjectByName('gun-muzzle');
    if (!muzzle) {
      throw new Error('Le pistolet doit exposer un point gun-muzzle.');
    }
    this.muzzle = muzzle;
    this.grabbables = [this.gun, this.board, ...this.bottles];

    for (let index = 0; index < 2; index += 1) {
      const grip = this.renderer.xr.getControllerGrip(index);
      const slot: ControllerSlot = {
        grip,
        handedness: 'none',
        wasGrabPressed: false,
        wasTriggerPressed: false,
        triggerCurl: 0,
        gripCurl: 0,
        thumbCurl: 0
      };

      grip.visible = false;
      grip.addEventListener('connected', (event) => this.connectController(slot, event));
      grip.addEventListener('disconnected', () => this.disconnectController(slot));

      this.playerRig.add(grip);
      this.slots.push(slot);
    }
  }

  update(deltaSeconds: number): void {
    this.updateLocomotion(deltaSeconds);
    this.updateHands(deltaSeconds);
    this.updateGrabbing();
    this.updateShooting();
    this.updateProjectiles(deltaSeconds);
    this.updateMuzzleFlashes(deltaSeconds);
    this.updateExplosionShards(deltaSeconds);
  }

  private connectController(slot: ControllerSlot, event: unknown): void {
    const inputSource = (event as { data?: XRInputSource }).data;
    const handedness = inputSource?.handedness === 'left' || inputSource?.handedness === 'right'
      ? inputSource.handedness
      : 'none';

    if (slot.held) {
      this.releaseHeldObject(slot);
    }

    slot.inputSource = inputSource;
    slot.handedness = handedness;
    slot.handModel = undefined;
    slot.wasGrabPressed = false;
    slot.wasTriggerPressed = false;
    slot.triggerCurl = 0;
    slot.gripCurl = 0;
    slot.thumbCurl = 0;
    slot.grip.clear();

    if (handedness !== 'none') {
      const handModel = createStylizedHand(handedness);
      slot.handModel = handModel;
      slot.grip.add(handModel.root);
      slot.grip.visible = true;
    }
  }

  private disconnectController(slot: ControllerSlot): void {
    if (slot.held) {
      this.releaseHeldObject(slot);
    }

    slot.grip.visible = false;
    slot.grip.clear();
    slot.inputSource = undefined;
    slot.handModel = undefined;
    slot.handedness = 'none';
    slot.wasGrabPressed = false;
    slot.wasTriggerPressed = false;
    slot.triggerCurl = 0;
    slot.gripCurl = 0;
    slot.thumbCurl = 0;
  }

  private updateLocomotion(deltaSeconds: number): void {
    const leftStick = this.readStick('left');
    const rightStick = this.readStick('right');

    if (rightStick.x !== 0) {
      this.playerRig.rotation.y -= rightStick.x * 1.9 * deltaSeconds;
    }

    if (leftStick.x === 0 && leftStick.y === 0) {
      return;
    }

    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 0.0001) {
      this.forward.set(0, 0, -1);
    } else {
      this.forward.normalize();
    }

    this.right.set(-this.forward.z, 0, this.forward.x).normalize();
    this.movement
      .copy(this.right)
      .multiplyScalar(leftStick.x)
      .addScaledVector(this.forward, -leftStick.y);

    if (this.movement.lengthSq() > 1) {
      this.movement.normalize();
    }

    this.playerRig.position.addScaledVector(this.movement, 1.45 * deltaSeconds);
    this.playerRig.position.x = MathUtils.clamp(this.playerRig.position.x, this.roomBounds.minX, this.roomBounds.maxX);
    this.playerRig.position.z = MathUtils.clamp(this.playerRig.position.z, this.roomBounds.minZ, this.roomBounds.maxZ);
  }

  private updateHands(deltaSeconds: number): void {
    for (const slot of this.slots) {
      if (!slot.handModel) {
        continue;
      }

      const buttons = slot.inputSource?.gamepad?.buttons;
      const targetTriggerCurl = buttons ? readButtonValue(buttons, 0) : 0;
      const targetGripCurl = buttons ? readButtonValue(buttons, 1) : 0;
      const targetThumbCurl = buttons ? Math.max(
        readButtonValue(buttons, 3),
        readButtonValue(buttons, 4),
        readButtonValue(buttons, 5)
      ) : 0;

      slot.triggerCurl = MathUtils.damp(slot.triggerCurl, targetTriggerCurl, 16, deltaSeconds);
      slot.gripCurl = MathUtils.damp(slot.gripCurl, targetGripCurl, 16, deltaSeconds);
      slot.thumbCurl = MathUtils.damp(slot.thumbCurl, targetThumbCurl, 16, deltaSeconds);

      applyHandPose(slot.handModel, slot.triggerCurl, slot.gripCurl, slot.thumbCurl);
    }
  }

  private updateGrabbing(): void {
    for (const slot of this.slots) {
      const isPressed = this.isGrabPressed(slot.inputSource);

      if (isPressed && !slot.held) {
        this.tryGrabObject(slot);
      }

      if (!isPressed && slot.wasGrabPressed && slot.held) {
        this.releaseHeldObject(slot);
      }

      slot.wasGrabPressed = isPressed;
    }
  }

  private tryGrabObject(slot: ControllerSlot): void {
    if (slot.handedness === 'none' || !slot.grip.visible) {
      return;
    }

    slot.grip.getWorldPosition(this.handPosition);

    const object = this.findNearestGrabbable();
    const parent = object?.parent;
    if (!object || !parent) {
      return;
    }

    slot.held = {
      object,
      parent,
      kind: readGrabbableKind(object)
    };
    slot.grip.attach(object);

    if (slot.held.kind === 'gun') {
      this.alignGunInHand(slot);
    }
  }

  private alignGunInHand(slot: ControllerSlot): void {
    const side = slot.handedness === 'left' ? 1 : -1;
    this.gun.position.set(side * 0.006, -0.002, -0.035);
    this.gun.rotation.set(-0.73, 0, 0.3);
  }

  private releaseHeldObject(slot: ControllerSlot): void {
    const held = slot.held;
    if (!held) {
      return;
    }

    if (!held.object.userData.broken) {
      held.parent.attach(held.object);
    }

    slot.held = undefined;
  }

  private findNearestGrabbable(): Group | undefined {
    let nearest: Group | undefined;
    let nearestScore = Number.POSITIVE_INFINITY;

    for (const object of this.grabbables) {
      if (this.isObjectHeld(object) || object.userData.broken || !object.parent) {
        continue;
      }

      object.getWorldPosition(this.objectPosition);
      const radius = readGrabRadius(object);
      const distance = this.handPosition.distanceTo(this.objectPosition);
      if (distance > radius) {
        continue;
      }

      const score = distance / radius;
      if (score < nearestScore) {
        nearest = object;
        nearestScore = score;
      }
    }

    return nearest;
  }

  private isObjectHeld(object: Group): boolean {
    return this.slots.some((slot) => slot.held?.object === object);
  }

  private isHoldingGun(slot: ControllerSlot): boolean {
    return slot.held?.object === this.gun;
  }

  private updateShooting(): void {
    for (const slot of this.slots) {
      const isPressed = this.isTriggerPressed(slot.inputSource);

      if (isPressed && !slot.wasTriggerPressed && this.isHoldingGun(slot)) {
        this.fireGun(slot);
      }

      slot.wasTriggerPressed = isPressed;
    }
  }

  private fireGun(slot: ControllerSlot): void {
    this.muzzle.getWorldPosition(this.muzzlePosition);
    this.muzzle.getWorldQuaternion(this.muzzleQuaternion);
    this.shotDirection.set(0, 0, -1).applyQuaternion(this.muzzleQuaternion).normalize();

    const hit = this.findShotHit();
    const shotDistance = hit ? hit.distance : maxShotDistance;
    const impactTime = hit ? Math.max(hit.distance / projectileSpeed, 0.01) : undefined;

    this.projectiles.push(this.createProjectileShot(shotDistance, hit?.bottle, impactTime));
    this.createMuzzleFlash(this.muzzlePosition, this.shotDirection);
    this.pulseHeldController(slot);
  }

  private findShotHit(): { bottle: Group; distance: number; point: Vector3 } | undefined {
    const targets = this.bottles.filter((bottle) => !bottle.userData.broken && Boolean(bottle.parent));
    if (targets.length === 0) {
      return undefined;
    }

    this.raycaster.set(this.muzzlePosition, this.shotDirection);
    this.raycaster.near = 0;
    this.raycaster.far = maxShotDistance;

    const hits = this.raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      const bottle = findBreakableBottle(hit.object);
      if (bottle && !bottle.userData.broken) {
        return {
          bottle,
          distance: hit.distance,
          point: hit.point.clone()
        };
      }
    }

    return undefined;
  }

  private createProjectileShot(distance: number, hitBottle?: Group, impactTime?: number): ProjectileShot {
    const root = new Group();
    root.name = 'projectile-shot';

    const tracerMaterial = new MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.92 });
    const tipMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const tracer = new Mesh(tracerGeometry, tracerMaterial);
    const tip = new Mesh(projectileTipGeometry, tipMaterial);

    tracer.name = 'projectile-trace';
    tracer.visible = false;
    tip.name = 'projectile-head';
    tip.visible = false;
    root.add(tracer);
    root.add(tip);
    this.effectParent.add(root);

    return {
      root,
      tracer,
      tip,
      materials: [tracerMaterial, tipMaterial],
      origin: this.muzzlePosition.clone(),
      direction: this.shotDirection.clone(),
      distance,
      age: 0,
      impactTime,
      hitBottle,
      hasImpacted: false
    };
  }

  private updateProjectiles(deltaSeconds: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const shot = this.projectiles[index];
      shot.age += deltaSeconds;

      const visibleLength = Math.min(shot.distance, shot.age * projectileSpeed);
      if (visibleLength > 0.001) {
        shot.tracer.visible = true;
        shot.tip.visible = true;
        shot.tracer.quaternion.setFromUnitVectors(yAxis, shot.direction);
        shot.tracer.scale.set(1, visibleLength, 1);
        shot.tracer.position.copy(shot.origin).addScaledVector(shot.direction, visibleLength * 0.5);
        shot.tip.position.copy(shot.origin).addScaledVector(shot.direction, visibleLength);
      }

      if (shot.hitBottle && shot.impactTime !== undefined && !shot.hasImpacted && shot.age >= shot.impactTime) {
        this.impactPosition.copy(shot.origin).addScaledVector(shot.direction, shot.distance);
        this.breakBottle(shot.hitBottle, this.impactPosition);
        shot.hasImpacted = true;
      }

      const fadeStart = shot.distance / projectileSpeed;
      const fadeProgress = MathUtils.clamp((shot.age - fadeStart) / projectileFadeSeconds, 0, 1);
      const opacity = 1 - fadeProgress;
      for (const material of shot.materials) {
        material.opacity = opacity;
      }

      if (fadeProgress >= 1) {
        this.effectParent.remove(shot.root);
        for (const material of shot.materials) {
          material.dispose();
        }
        this.projectiles.splice(index, 1);
      }
    }
  }

  private createMuzzleFlash(origin: Vector3, direction: Vector3): void {
    const root = new Group();
    root.name = 'muzzle-flash';
    root.position.copy(origin);
    root.quaternion.setFromUnitVectors(yAxis, direction);

    const coneMaterial = new MeshBasicMaterial({ color: 0xffc247, transparent: true, opacity: 0.95 });
    const glowMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
    const cone = new Mesh(muzzleConeGeometry, coneMaterial);
    const glow = new Mesh(muzzleGlowGeometry, glowMaterial);

    cone.position.y = 0.12;
    glow.position.y = 0.045;
    root.add(cone);
    root.add(glow);
    this.effectParent.add(root);

    this.muzzleFlashes.push({
      root,
      materials: [coneMaterial, glowMaterial],
      age: 0
    });
  }

  private updateMuzzleFlashes(deltaSeconds: number): void {
    for (let index = this.muzzleFlashes.length - 1; index >= 0; index -= 1) {
      const flash = this.muzzleFlashes[index];
      flash.age += deltaSeconds;

      const progress = MathUtils.clamp(flash.age / muzzleFlashDuration, 0, 1);
      flash.root.scale.setScalar(1 + progress * 1.8);
      for (const material of flash.materials) {
        material.opacity = 1 - progress;
      }

      if (progress >= 1) {
        this.effectParent.remove(flash.root);
        for (const material of flash.materials) {
          material.dispose();
        }
        this.muzzleFlashes.splice(index, 1);
      }
    }
  }

  private breakBottle(bottle: Group, impactPoint: Vector3): void {
    if (bottle.userData.broken) {
      return;
    }

    bottle.userData.broken = true;
    for (const slot of this.slots) {
      if (slot.held?.object === bottle) {
        slot.held = undefined;
      }
    }
    bottle.parent?.remove(bottle);
    this.createBottleExplosion(impactPoint);
  }

  private createBottleExplosion(origin: Vector3): void {
    for (let index = 0; index < 16; index += 1) {
      const material = new MeshBasicMaterial({ color: index % 3 === 0 ? 0xffffff : 0x85dce8, transparent: true, opacity: 0.92 });
      const shard = new Mesh(shardGeometry, material);
      const spread = randomUnitVector();
      const speed = 0.85 + Math.random() * 1.65;

      shard.name = 'bottle-shard';
      shard.position.copy(origin);
      shard.scale.set(0.018 + Math.random() * 0.035, 0.01 + Math.random() * 0.026, 0.012 + Math.random() * 0.03);
      this.effectParent.add(shard);

      this.explosionShards.push({
        mesh: shard,
        material,
        velocity: spread.multiplyScalar(speed),
        angularVelocity: new Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        ),
        age: 0
      });
    }
  }

  private updateExplosionShards(deltaSeconds: number): void {
    for (let index = this.explosionShards.length - 1; index >= 0; index -= 1) {
      const shard = this.explosionShards[index];
      shard.age += deltaSeconds;

      shard.velocity.y -= 1.9 * deltaSeconds;
      shard.mesh.position.addScaledVector(shard.velocity, deltaSeconds);
      shard.mesh.rotation.x += shard.angularVelocity.x * deltaSeconds;
      shard.mesh.rotation.y += shard.angularVelocity.y * deltaSeconds;
      shard.mesh.rotation.z += shard.angularVelocity.z * deltaSeconds;

      const progress = MathUtils.clamp(shard.age / explosionDuration, 0, 1);
      shard.material.opacity = 0.92 * (1 - progress);

      if (progress >= 1) {
        this.effectParent.remove(shard.mesh);
        shard.material.dispose();
        this.explosionShards.splice(index, 1);
      }
    }
  }

  private pulseHeldController(slot: ControllerSlot): void {
    const gamepad = slot.inputSource?.gamepad as HapticGamepad | undefined;
    const pulseActuator = gamepad?.hapticActuators?.[0];

    if (pulseActuator) {
      void pulseActuator.pulse(0.55, 55);
      return;
    }

    void gamepad?.vibrationActuator?.playEffect('dual-rumble', {
      duration: 55,
      strongMagnitude: 0.45,
      weakMagnitude: 0.25
    });
  }

  private readStick(handedness: ControllerHand): { x: number; y: number } {
    const inputSource = this.slots.find((slot) => slot.handedness === handedness)?.inputSource;
    const axes = inputSource?.gamepad?.axes;
    if (!axes || axes.length < 2) {
      return { x: 0, y: 0 };
    }

    const firstPair = { x: axes[0] ?? 0, y: axes[1] ?? 0 };
    const secondPair = { x: axes[2] ?? 0, y: axes[3] ?? 0 };
    const stick = magnitudeSq(secondPair) > magnitudeSq(firstPair) ? secondPair : firstPair;

    return {
      x: applyDeadzone(stick.x),
      y: applyDeadzone(stick.y)
    };
  }

  private isGrabPressed(inputSource?: XRInputSource): boolean {
    const buttons = inputSource?.gamepad?.buttons;
    if (!buttons) {
      return false;
    }

    return Boolean(buttons[1]?.pressed);
  }

  private isTriggerPressed(inputSource?: XRInputSource): boolean {
    const buttons = inputSource?.gamepad?.buttons;
    if (!buttons) {
      return false;
    }

    return Boolean(buttons[0]?.pressed);
  }
}

function findBreakableBottle(object: Object3D): Group | undefined {
  let current: Object3D | null = object;

  while (current) {
    if (current instanceof Group && current.userData.breakable === true) {
      return current;
    }

    current = current.parent;
  }

  return undefined;
}

function readGrabbableKind(object: Group): GrabbableKind {
  const kind = object.userData.kind;
  return kind === 'gun' || kind === 'board' || kind === 'bottle' ? kind : 'object';
}

function readGrabRadius(object: Group): number {
  const radius = object.userData.grabRadius;
  return typeof radius === 'number' ? radius : 0.34;
}

function randomUnitVector(): Vector3 {
  const vector = new Vector3(
    Math.random() - 0.5,
    Math.random() * 0.9 + 0.15,
    Math.random() - 0.5
  );

  if (vector.lengthSq() < 0.0001) {
    vector.set(0, 1, 0);
  }

  return vector.normalize();
}

function createStylizedHand(handedness: ControllerHand): StylizedHand {
  const side = handedness === 'left' ? 1 : -1;
  const hand = new Group();
  hand.name = `${handedness}-stylized-hand`;
  hand.position.set(side * 0.025, -0.015, -0.035);
  hand.scale.setScalar(handScale);
  hand.rotation.x = handRotationX;
  hand.rotation.z = side * handRotationZ;

  const skin = new MeshToonMaterial({ color: 0xf0b18d });
  const cuff = new MeshToonMaterial({ color: 0x394c68 });

  hand.add(createOutlinedBox('palm', 0.14, 0.075, 0.12, 0, 0, 0, skin, 1.08));
  hand.add(createOutlinedBox('cuff', 0.16, 0.08, 0.09, 0, -0.01, 0.105, cuff, 1.08));

  const fingerXs = [-0.048, -0.016, 0.016, 0.048];
  let indexFinger: Group | undefined;
  const gripFingers: Group[] = [];

  for (const x of fingerXs) {
    const finger = createFinger('finger', 0.015, 0.115, x, 0.02, -0.095, skin);
    if (!indexFinger) {
      indexFinger = finger;
    } else {
      gripFingers.push(finger);
    }
    hand.add(finger);
  }

  const thumb = createFinger('thumb', 0.017, 0.09, side * 0.088, -0.018, -0.015, skin);
  thumb.rotation.z = side * 0.7;
  thumb.rotation.y = side * 0.45;
  hand.add(thumb);

  if (!indexFinger) {
    throw new Error('Impossible de creer les doigts de la main stylisee.');
  }

  return {
    root: hand,
    index: indexFinger,
    gripFingers,
    thumb,
    thumbBaseRotationY: thumb.rotation.y,
    thumbBaseRotationZ: thumb.rotation.z
  };
}

function applyHandPose(hand: StylizedHand, triggerCurl: number, gripCurl: number, thumbCurl: number): void {
  hand.index.rotation.x = MathUtils.lerp(fingerBaseRotationX, fingerClosedRotationX, triggerCurl);

  for (const finger of hand.gripFingers) {
    finger.rotation.x = MathUtils.lerp(fingerBaseRotationX, fingerClosedRotationX, gripCurl);
  }

  hand.thumb.rotation.x = MathUtils.lerp(fingerBaseRotationX, fingerClosedRotationX + 0.18, Math.max(gripCurl, thumbCurl));
  hand.thumb.rotation.y = hand.thumbBaseRotationY + thumbCurl * 0.35;
  hand.thumb.rotation.z = hand.thumbBaseRotationZ - Math.sign(hand.thumbBaseRotationZ) * Math.max(gripCurl, thumbCurl) * 0.42;
}

function createOutlinedBox(
  name: string,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: MeshToonMaterial,
  outlineScale: number
): Group {
  const geometry = new BoxGeometry(width, height, depth);
  const group = new Group();
  group.name = name;
  group.position.set(x, y, z);

  const outline = new Mesh(geometry, new MeshBasicMaterial({ color: 0x19110d, side: BackSide }));
  outline.scale.setScalar(outlineScale);
  group.add(outline);

  group.add(new Mesh(geometry, material));

  return group;
}

function createFinger(
  name: string,
  radius: number,
  length: number,
  x: number,
  y: number,
  z: number,
  material: MeshToonMaterial
): Group {
  const geometry = new CapsuleGeometry(radius, length, 4, 8);
  const group = new Group();
  group.name = name;
  group.position.set(x, y, z);
  group.rotation.x = Math.PI / 2;

  const outline = new Mesh(geometry, new MeshBasicMaterial({ color: 0x19110d, side: BackSide }));
  outline.scale.setScalar(1.12);
  group.add(outline);

  group.add(new Mesh(geometry, material));

  return group;
}

function magnitudeSq(stick: { x: number; y: number }): number {
  return stick.x * stick.x + stick.y * stick.y;
}

function readButtonValue(buttons: readonly GamepadButton[], index: number): number {
  const button = buttons[index];
  if (!button) {
    return 0;
  }

  return MathUtils.clamp(button.value || (button.pressed ? 1 : 0), 0, 1);
}

function applyDeadzone(value: number): number {
  const absolute = Math.abs(value);
  if (absolute < deadzone) {
    return 0;
  }

  return Math.sign(value) * ((absolute - deadzone) / (1 - deadzone));
}
