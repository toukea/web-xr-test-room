import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  ColorRepresentation,
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
  board.position.set(0, tableTopY + 0.37, 0.04);
  root.add(board);

  return {
    root,
    board,
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
  board.name = 'grabbable-framed-board';
  board.userData.grabbable = true;

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
