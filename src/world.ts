import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  ColorRepresentation,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  Vector3
} from 'three';

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type World = {
  root: Group;
  board: Group;
  gun: Group;
  bottles: Group[];
  roomBounds: RoomBounds;
  spawn: Vector3;
};

const roomWidth = 6.4;
const roomDepth = 7.2;
const roomHeight = 2.8;
const wallThickness = 0.12;
const tableTopY = 0.72;

const toonGradient = createToonGradient();
const outlineMaterial = new MeshBasicMaterial({ color: 0x17110c, side: BackSide });

export function createWorld(): World {
  const root = new Group();
  root.name = 'world';

  addLighting(root);
  root.add(createRoom());
  root.add(createTable());

  const board = createBoard();
  board.position.set(-roomWidth / 2 + wallThickness + 0.055, roomHeight * 0.75, -0.95);
  board.rotation.y = Math.PI / 2;
  root.add(board);

  const gun = createGun();
  gun.position.set(-0.18, tableTopY + 0.1, 0.02);
  gun.rotation.z = Math.PI / 2;
  gun.scale.setScalar(0.58);
  root.add(gun);

  const { cabinet, bottles } = createCabinet();
  cabinet.position.set(0, 0, -2.82);
  root.add(cabinet);

  return {
    root,
    board,
    gun,
    bottles,
    roomBounds: {
      minX: -roomWidth / 2 + 0.42,
      maxX: roomWidth / 2 - 0.42,
      minZ: -roomDepth / 2 + 0.42,
      maxZ: roomDepth / 2 - 0.42
    },
    spawn: new Vector3(0, 0, 1.7)
  };
}

function addLighting(root: Group): void {
  const ambient = new AmbientLight(0xffffff, 1.85);
  root.add(ambient);

  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(2.4, 4.2, 2.8);
  root.add(key);

  const fill = new DirectionalLight(0xf4f0d7, 0.8);
  fill.position.set(-3.2, 2.4, -2.4);
  root.add(fill);
}

function createRoom(): Group {
  const room = new Group();
  room.name = 'cel-shaded-room';

  const wallMaterial = toonMaterial(0xd8d6bc);
  const ceilingMaterial = toonMaterial(0xe7e3ca);
  const floorMaterial = toonMaterial(0x829586);
  const woodMaterial = toonMaterial(0x7a4a29);

  room.add(createBox('floor', roomWidth, 0.08, roomDepth, 0, -0.04, 0, floorMaterial, true, 1.006));
  room.add(createBox('ceiling', roomWidth, wallThickness, roomDepth, 0, roomHeight + wallThickness / 2, 0, ceilingMaterial, false));
  room.add(createBox('back-wall', roomWidth, roomHeight, wallThickness, 0, roomHeight / 2, -roomDepth / 2, wallMaterial, false));
  room.add(createBox('front-wall', roomWidth, roomHeight, wallThickness, 0, roomHeight / 2, roomDepth / 2, wallMaterial, false));
  room.add(createBox('left-wall', wallThickness, roomHeight, roomDepth, -roomWidth / 2, roomHeight / 2, 0, wallMaterial, false));
  room.add(createBox('right-wall', wallThickness, roomHeight, roomDepth, roomWidth / 2, roomHeight / 2, 0, wallMaterial, false));

  const postHeight = roomHeight + wallThickness;
  const postY = postHeight / 2;
  const postSize = 0.18;
  for (const x of [-roomWidth / 2, roomWidth / 2]) {
    for (const z of [-roomDepth / 2, roomDepth / 2]) {
      room.add(createBox('wood-corner-post', postSize, postHeight, postSize, x, postY, z, woodMaterial, true, 1.04));
    }
  }

  room.add(createBox('back-top-trim', roomWidth, 0.12, 0.16, 0, roomHeight - 0.12, -roomDepth / 2 + 0.04, woodMaterial, true, 1.02));
  room.add(createBox('front-top-trim', roomWidth, 0.12, 0.16, 0, roomHeight - 0.12, roomDepth / 2 - 0.04, woodMaterial, true, 1.02));
  room.add(createBox('left-top-trim', 0.16, 0.12, roomDepth, -roomWidth / 2 + 0.04, roomHeight - 0.12, 0, woodMaterial, true, 1.02));
  room.add(createBox('right-top-trim', 0.16, 0.12, roomDepth, roomWidth / 2 - 0.04, roomHeight - 0.12, 0, woodMaterial, true, 1.02));

  return room;
}

function createTable(): Group {
  const table = new Group();
  table.name = 'center-table';

  const wood = toonMaterial(0x8c5a32);
  table.add(createBox('table-top', 1.45, 0.12, 0.86, 0, tableTopY, 0, wood, true, 1.035));

  const legY = tableTopY / 2 - 0.03;
  for (const x of [-0.56, 0.56]) {
    for (const z of [-0.28, 0.28]) {
      table.add(createBox('table-leg', 0.12, tableTopY, 0.12, x, legY, z, wood, true, 1.04));
    }
  }

  return table;
}

function createBoard(): Group {
  const board = new Group();
  board.name = 'left-wall-framed-board';
  board.userData.grabbable = true;
  board.userData.kind = 'board';
  board.userData.grabRadius = 0.62;
  board.userData.wallMounted = true;

  const panel = toonMaterial(0x496b73);
  const frame = toonMaterial(0x6c3f22);
  const chalk = toonMaterial(0xf4e9c7);

  board.add(createBox('board-panel', 0.76, 0.46, 0.035, 0, 0, 0, panel, true, 1.025));
  board.add(createBox('board-frame-top', 0.92, 0.07, 0.07, 0, 0.28, 0, frame, true, 1.035));
  board.add(createBox('board-frame-bottom', 0.92, 0.07, 0.07, 0, -0.28, 0, frame, true, 1.035));
  board.add(createBox('board-frame-left', 0.07, 0.58, 0.07, -0.425, 0, 0, frame, true, 1.035));
  board.add(createBox('board-frame-right', 0.07, 0.58, 0.07, 0.425, 0, 0, frame, true, 1.035));
  board.add(createBox('board-mark', 0.42, 0.025, 0.012, -0.05, 0.07, 0.03, chalk, false));
  board.add(createBox('board-mark', 0.28, 0.022, 0.012, 0.08, -0.02, 0.03, chalk, false));

  return board;
}

function createGun(): Group {
  const gun = new Group();
  gun.name = 'grabbable-pistol';
  gun.userData.grabbable = true;
  gun.userData.kind = 'gun';
  gun.userData.grabRadius = 0.32;

  const metal = toonMaterial(0x272f36);
  const darkMetal = toonMaterial(0x13191f);
  const grip = toonMaterial(0x3b2721);
  const accent = toonMaterial(0xf0c45c);

  gun.add(createBox('gun-slide', 0.18, 0.115, 0.46, 0, 0.095, -0.19, metal, true, 1.06));
  gun.add(createBox('gun-barrel', 0.08, 0.07, 0.22, 0, 0.09, -0.49, darkMetal, true, 1.08));
  gun.add(createBox('gun-muzzle-face', 0.095, 0.085, 0.025, 0, 0.09, -0.61, darkMetal, true, 1.05));
  gun.add(createBox('gun-handle', 0.14, 0.31, 0.12, 0, -0.095, 0.035, grip, true, 1.06));
  gun.add(createBox('gun-trigger-guard-front', 0.03, 0.13, 0.035, 0, -0.015, -0.095, darkMetal, true, 1.08));
  gun.add(createBox('gun-trigger-guard-bottom', 0.03, 0.03, 0.14, 0, -0.08, -0.04, darkMetal, true, 1.08));
  gun.add(createBox('gun-trigger', 0.022, 0.075, 0.025, 0, -0.052, -0.072, accent, false));
  gun.add(createBox('gun-front-sight', 0.045, 0.035, 0.035, 0, 0.172, -0.48, accent, false));

  const muzzle = new Object3D();
  muzzle.name = 'gun-muzzle';
  muzzle.position.set(0, 0.09, -0.635);
  gun.add(muzzle);

  return gun;
}

function createCabinet(): { cabinet: Group; bottles: Group[] } {
  const cabinet = new Group();
  cabinet.name = 'shooting-cabinet';

  const bottles: Group[] = [];
  const wood = toonMaterial(0x70451f);
  const shadowWood = toonMaterial(0x563319);
  const width = 2.35;
  const height = 2.12;
  const depth = 0.48;

  cabinet.add(createBox('cabinet-back', width, height, 0.08, 0, height / 2, -depth / 2, shadowWood, true, 1.025));
  cabinet.add(createBox('cabinet-left-side', 0.09, height, depth, -width / 2, height / 2, 0, wood, true, 1.035));
  cabinet.add(createBox('cabinet-right-side', 0.09, height, depth, width / 2, height / 2, 0, wood, true, 1.035));
  cabinet.add(createBox('cabinet-top', width + 0.08, 0.09, depth, 0, height, 0, wood, true, 1.035));
  cabinet.add(createBox('cabinet-base', width + 0.08, 0.1, depth, 0, 0.05, 0, wood, true, 1.035));

  const shelfYs = [0.55, 1.03, 1.51];
  const bottleXs = [-0.78, -0.26, 0.26, 0.78];

  for (const shelfY of shelfYs) {
    cabinet.add(createBox('cabinet-shelf', width, 0.065, depth, 0, shelfY, 0, wood, true, 1.025));

    for (const x of bottleXs) {
      const bottle = createBottle();
      bottle.position.set(x, shelfY + 0.035, 0.08);
      cabinet.add(bottle);
      bottles.push(bottle);
    }
  }

  return { cabinet, bottles };
}

function createBottle(): Group {
  const bottle = new Group();
  bottle.name = 'breakable-bottle';
  bottle.userData.grabbable = true;
  bottle.userData.kind = 'bottle';
  bottle.userData.grabRadius = 0.34;
  bottle.userData.breakable = true;
  bottle.userData.broken = false;

  const glass = toonMaterial(0x72c4d3);
  const neck = toonMaterial(0x9be0df);
  const cap = toonMaterial(0xd8e6ee);

  bottle.add(createCylinder('bottle-body', 0.065, 0.075, 0.26, 0, 0.13, 0, glass, true, 1.08));
  bottle.add(createCylinder('bottle-neck', 0.032, 0.038, 0.12, 0, 0.32, 0, neck, true, 1.08));
  bottle.add(createCylinder('bottle-cap', 0.038, 0.038, 0.045, 0, 0.405, 0, cap, true, 1.07));

  return bottle;
}

function createBox(
  name: string,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: MeshToonMaterial,
  outlined: boolean,
  outlineScale = 1.03
): Object3D {
  const geometry = new BoxGeometry(width, height, depth);
  const group = new Group();
  group.name = name;
  group.position.set(x, y, z);

  if (outlined) {
    const outline = new Mesh(geometry, outlineMaterial);
    outline.name = `${name}-outline`;
    outline.scale.setScalar(outlineScale);
    group.add(outline);
  }

  const mesh = new Mesh(geometry, material);
  mesh.name = `${name}-mesh`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return group;
}

function createCylinder(
  name: string,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  x: number,
  y: number,
  z: number,
  material: MeshToonMaterial,
  outlined: boolean,
  outlineScale = 1.03
): Object3D {
  const geometry = new CylinderGeometry(radiusTop, radiusBottom, height, 14);
  const group = new Group();
  group.name = name;
  group.position.set(x, y, z);

  if (outlined) {
    const outline = new Mesh(geometry, outlineMaterial);
    outline.name = `${name}-outline`;
    outline.scale.setScalar(outlineScale);
    group.add(outline);
  }

  const mesh = new Mesh(geometry, material);
  mesh.name = `${name}-mesh`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return group;
}

function toonMaterial(color: ColorRepresentation): MeshToonMaterial {
  return new MeshToonMaterial({
    color,
    gradientMap: toonGradient
  });
}

function createToonGradient(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Impossible de creer la texture toon.');
  }

  context.fillStyle = '#303030';
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = '#707070';
  context.fillRect(1, 0, 1, 1);
  context.fillStyle = '#b8b8b8';
  context.fillRect(2, 0, 1, 1);
  context.fillStyle = '#ffffff';
  context.fillRect(3, 0, 1, 1);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;

  return texture;
}
