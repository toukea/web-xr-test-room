import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PerspectiveCamera,
  Vector3,
  WebGLRenderer
} from 'three';
import type { RoomBounds } from './world';

type ControllerHand = 'left' | 'right';

type ControllerSlot = {
  grip: Group;
  handedness: ControllerHand | 'none';
  inputSource?: XRInputSource;
  wasGrabPressed: boolean;
};

const deadzone = 0.18;

export class XRControls {
  private readonly slots: ControllerSlot[] = [];
  private readonly boardParent: Object3D;
  private grabbedBy?: ControllerSlot;
  private readonly handPosition = new Vector3();
  private readonly boardPosition = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly movement = new Vector3();

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly playerRig: Group,
    private readonly camera: PerspectiveCamera,
    private readonly roomBounds: RoomBounds,
    private readonly board: Group
  ) {
    const parent = board.parent;
    if (!parent) {
      throw new Error('Le tableau doit etre ajoute a la scene avant les controles XR.');
    }
    this.boardParent = parent;

    for (let index = 0; index < 2; index += 1) {
      const grip = this.renderer.xr.getControllerGrip(index);
      const slot: ControllerSlot = {
        grip,
        handedness: 'none',
        wasGrabPressed: false
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
    this.updateGrabbing();
  }

  private connectController(slot: ControllerSlot, event: unknown): void {
    const inputSource = (event as { data?: XRInputSource }).data;
    const handedness = inputSource?.handedness === 'left' || inputSource?.handedness === 'right'
      ? inputSource.handedness
      : 'none';

    if (this.grabbedBy === slot) {
      this.releaseBoard();
    }

    slot.inputSource = inputSource;
    slot.handedness = handedness;
    slot.wasGrabPressed = false;
    slot.grip.clear();

    if (handedness !== 'none') {
      slot.grip.add(createStylizedHand(handedness));
      slot.grip.visible = true;
    }
  }

  private disconnectController(slot: ControllerSlot): void {
    if (this.grabbedBy === slot) {
      this.releaseBoard();
    }

    slot.grip.visible = false;
    slot.grip.clear();
    slot.inputSource = undefined;
    slot.handedness = 'none';
    slot.wasGrabPressed = false;
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

  private updateGrabbing(): void {
    for (const slot of this.slots) {
      const isPressed = this.isGrabPressed(slot.inputSource);

      if (isPressed && !this.grabbedBy) {
        this.tryGrabBoard(slot);
      }

      if (!isPressed && slot.wasGrabPressed && this.grabbedBy === slot) {
        this.releaseBoard();
      }

      slot.wasGrabPressed = isPressed;
    }
  }

  private tryGrabBoard(slot: ControllerSlot): void {
    if (slot.handedness === 'none' || !slot.grip.visible) {
      return;
    }

    slot.grip.getWorldPosition(this.handPosition);
    this.board.getWorldPosition(this.boardPosition);

    if (this.handPosition.distanceTo(this.boardPosition) > 0.44) {
      return;
    }

    this.grabbedBy = slot;
    slot.grip.attach(this.board);
  }

  private releaseBoard(): void {
    this.boardParent.attach(this.board);
    this.grabbedBy = undefined;
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

    return Boolean(buttons[0]?.pressed || buttons[1]?.pressed);
  }
}

function createStylizedHand(handedness: ControllerHand): Group {
  const side = handedness === 'left' ? -1 : 1;
  const hand = new Group();
  hand.name = `${handedness}-stylized-hand`;
  hand.position.set(side * 0.025, -0.015, -0.035);
  hand.rotation.z = side * 0.12;

  const skin = new MeshToonMaterial({ color: 0xf0b18d });
  const cuff = new MeshToonMaterial({ color: 0x394c68 });

  hand.add(createOutlinedBox('palm', 0.14, 0.075, 0.12, 0, 0, 0, skin, 1.08));
  hand.add(createOutlinedBox('cuff', 0.16, 0.08, 0.09, 0, -0.01, 0.105, cuff, 1.08));

  const fingerXs = [-0.048, -0.016, 0.016, 0.048];
  for (const x of fingerXs) {
    const finger = createFinger('finger', 0.015, 0.115, x, 0.02, -0.095, skin);
    hand.add(finger);
  }

  const thumb = createFinger('thumb', 0.017, 0.09, side * 0.088, -0.018, -0.015, skin);
  thumb.rotation.z = side * 0.7;
  thumb.rotation.y = side * 0.45;
  hand.add(thumb);

  return hand;
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

function applyDeadzone(value: number): number {
  const absolute = Math.abs(value);
  if (absolute < deadzone) {
    return 0;
  }

  return Math.sign(value) * ((absolute - deadzone) / (1 - deadzone));
}
