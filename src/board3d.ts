import * as THREE from "three";
import type { Board, CellRef } from "./puzzle";

const PALETTE = [
  "#FF4FD8",
  "#2EFFF0",
  "#FFE600",
  "#B44CFF",
  "#C8FF3D",
  "#4DCFFF",
  "#FF6B9A",
  "#FF9A3C",
  "#7BFFB0",
] as const;

const SPARKLE = ["#FFE600", "#FF4FD8", "#2EFFF0", "#fff8e7", "#B44CFF"] as const;

export type BoardSize = 3 | 6;

export type BoardLayout = {
  size: BoardSize;
  step: number;
  scale: number;
};

export function layoutFor(size: BoardSize): BoardLayout {
  if (size >= 6) return { size: 6, step: 0.6, scale: 0.5 };
  return { size: 3, step: 1.18, scale: 1 };
}

const FX_SECONDS = 0.82;
const GRAVITY = new THREE.Vector3(0, -6.6, 0);

function sameCell(a: CellRef, b: CellRef): boolean {
  return a.row === b.row && a.col === b.col;
}

export function cellWorld(row: number, col: number, layout: BoardLayout = layoutFor(3)): THREE.Vector3 {
  const mid = (layout.size - 1) / 2;
  return new THREE.Vector3((col - mid) * layout.step, (mid - row) * layout.step, 0);
}

function candyColor(row: number, col: number, size: number): THREE.Color {
  return new THREE.Color(PALETTE[(row * size + col) % PALETTE.length]);
}

function roundedBox(width: number, height: number, depth: number, radius: number): THREE.ExtrudeGeometry {
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: r * 0.32,
    bevelSize: r * 0.24,
    bevelSegments: 2,
    curveSegments: 7,
    steps: 1,
  });
  geo.center();
  return geo;
}

function makeLabel(
  text: string,
  fill: string,
  size: number,
  weight = 900,
  background?: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  if (background) {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${size}px Nunito, "Trebuchet MS", sans-serif`;
  ctx.fillText(text, 128, 138);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

type Shard = {
  mesh: THREE.Object3D;
  origin: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  delay: number;
  sparkle: boolean;
};

function poseShard(shard: Shard, age: number): void {
  const t = Math.max(0, age - shard.delay);
  shard.mesh.position.set(
    shard.origin.x + shard.vel.x * t + 0.5 * GRAVITY.x * t * t,
    shard.origin.y + shard.vel.y * t + 0.5 * GRAVITY.y * t * t,
    shard.origin.z + shard.vel.z * t + 0.5 * GRAVITY.z * t * t,
  );
  shard.mesh.rotation.set(shard.spin.x * t, shard.spin.y * t, shard.spin.z * t);
  const life = 1 - Math.min(1, t / 0.82);
  const s = shard.sparkle ? 0.35 + life * 0.75 : 0.55 + life * 0.55;
  shard.mesh.scale.setScalar(Math.max(0.04, s));
  shard.mesh.visible = life > 0.02;
}

class BlockCell {
  readonly row: number;
  readonly col: number;
  readonly root = new THREE.Group();
  readonly block = new THREE.Group();
  readonly hit: THREE.Mesh;
  readonly socket: THREE.Mesh;
  readonly body: THREE.Mesh;
  readonly ring: THREE.Mesh;
  readonly badge: THREE.Mesh;
  readonly front: THREE.Mesh;
  readonly top: THREE.Mesh;
  readonly bodyMat: THREE.MeshStandardMaterial;
  readonly plateMat: THREE.MeshStandardMaterial;
  readonly ringMat: THREE.MeshStandardMaterial;
  value: number | null = null;
  selected = false;
  hinted = false;
  hidden = false;
  order = 0;
  private bob = Math.random() * Math.PI * 2;

  constructor(
    row: number,
    col: number,
    geos: { block: THREE.BufferGeometry; socket: THREE.BufferGeometry; hit: THREE.BufferGeometry },
    layout: BoardLayout,
    lite: boolean,
  ) {
    this.row = row;
    this.col = col;
    const color = candyColor(row, col, layout.size);
    const pos = cellWorld(row, col, layout);
    this.root.position.copy(pos);
    this.root.scale.setScalar(layout.scale);

    this.bodyMat = lite
      ? new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.12,
          roughness: 0.32,
          metalness: 0.1,
        })
      : new THREE.MeshPhysicalMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.12,
          roughness: 0.22,
          metalness: 0.12,
          clearcoat: 0.85,
          clearcoatRoughness: 0.18,
        });
    this.plateMat = lite
      ? new THREE.MeshStandardMaterial({
          color: "#fff8e7",
          roughness: 0.38,
          metalness: 0.04,
        })
      : new THREE.MeshPhysicalMaterial({
          color: "#fff8e7",
          roughness: 0.32,
          metalness: 0.05,
          clearcoat: 0.45,
        });
    this.ringMat = new THREE.MeshStandardMaterial({
      color: "#ffe600",
      emissive: "#ff4fd8",
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const socketMat = new THREE.MeshStandardMaterial({
      color: "#3b0d68",
      emissive: "#2a0848",
      emissiveIntensity: 0.08,
      roughness: 0.7,
      metalness: 0.06,
    });
    this.socket = new THREE.Mesh(geos.socket, socketMat);
    this.socket.position.z = -0.28;
    this.socket.receiveShadow = !lite;
    this.root.add(this.socket);

    const well = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 24),
      new THREE.MeshBasicMaterial({ color: "#21063d", transparent: true, opacity: 0.55 }),
    );
    well.position.z = -0.16;
    this.root.add(well);

    this.body = new THREE.Mesh(geos.block, this.bodyMat);
    this.body.castShadow = !lite;
    this.body.receiveShadow = !lite;
    this.block.add(this.body);

    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), this.plateMat);
    plate.position.set(0, 0.02, 0.4);
    this.block.add(plate);

    const topPlate = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), this.plateMat);
    topPlate.rotation.x = -Math.PI / 2;
    topPlate.position.set(0, 0.4, 0.04);
    this.block.add(topPlate);

    const labelMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.front = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), labelMat);
    this.front.position.set(0, 0.02, 0.42);
    this.block.add(this.front);

    this.top = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48), labelMat.clone());
    this.top.rotation.x = -Math.PI / 2;
    this.top.position.set(0, 0.41, 0.04);
    this.block.add(this.top);

    if (!lite) {
      const gloss = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
        new THREE.MeshPhysicalMaterial({
          color: "#ffffff",
          roughness: 0.08,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        }),
      );
      gloss.position.set(0, 0.22, 0.18);
      gloss.rotation.x = 0.45;
      this.block.add(gloss);
    }

    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 28), this.ringMat);
    this.ring.position.z = 0.08;
    this.block.add(this.ring);

    const badgeMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.badge = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), badgeMat);
    this.badge.position.set(-0.34, 0.34, 0.44);
    this.badge.visible = false;
    this.block.add(this.badge);

    this.hit = new THREE.Mesh(
      geos.hit,
      new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 }),
    );
    this.hit.userData.cell = { row, col };
    this.block.add(this.hit);

    this.block.visible = false;
    this.root.add(this.block);
  }

  setState(
    value: number | null,
    selected: boolean,
    order: number,
    hinted: boolean,
    hidden: boolean,
    labels: Map<string, THREE.CanvasTexture>,
  ): void {
    this.value = value;
    this.selected = selected;
    this.order = order;
    this.hinted = hinted;
    this.hidden = hidden;
    const show = value !== null && !hidden;
    this.block.visible = show;
    this.hit.visible = show;

    if (value !== null) {
      const map = labels.get(`n:${value}`);
      const frontMat = this.front.material as THREE.MeshBasicMaterial;
      const topMat = this.top.material as THREE.MeshBasicMaterial;
      if (map && frontMat.map !== map) {
        frontMat.map = map;
        topMat.map = map;
        frontMat.needsUpdate = true;
        topMat.needsUpdate = true;
      }
    }

    if (selected) {
      const badgeMap = labels.get(`o:${order + 1}`);
      const badgeMat = this.badge.material as THREE.MeshBasicMaterial;
      if (badgeMap) {
        badgeMat.map = badgeMap;
        badgeMat.needsUpdate = true;
      }
    }
    this.badge.visible = selected;
  }

  tick(time: number): void {
    const empty = this.value === null || this.hidden;
    const wellLit = this.value === null;
    (this.socket.material as THREE.MeshStandardMaterial).emissiveIntensity = wellLit ? 0.16 : 0.05;

    if (empty) return;
    const lift = this.selected ? 0.18 : 0;
    const bob = Math.sin(time * 2.3 + this.bob) * 0.02;
    const hintPulse = this.hinted && !this.selected ? 1 + Math.sin(time * 6) * 0.07 : 1;
    const selScale = this.selected ? 1.07 : 1;
    this.block.position.z = lift + bob;
    this.block.position.y = this.selected ? 0.04 : 0;
    this.block.scale.setScalar(hintPulse * selScale);

    this.bodyMat.emissiveIntensity = this.selected
      ? 0.42
      : this.hinted
        ? 0.28 + Math.sin(time * 6) * 0.16
        : 0.12;

    const ringOn = this.selected || this.hinted;
    this.ringMat.opacity = ringOn ? (this.selected ? 0.85 : 0.45 + Math.sin(time * 6) * 0.3) : 0;
    this.ringMat.emissiveIntensity = this.selected ? 0.7 : 0.45 + Math.sin(time * 6) * 0.35;
    this.ringMat.color.set(this.selected ? "#ffe600" : "#2efff0");
  }

  dispose(): void {
    this.root.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) mat.dispose();
    });
  }
}

export class Board3D {
  private readonly host: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly root = new THREE.Group();
  private readonly fx = new THREE.Group();
  private readonly cells: BlockCell[] = [];
  private readonly labels = new Map<string, THREE.CanvasTexture>();
  private readonly blockGeo: THREE.BufferGeometry;
  private readonly shardGeo: THREE.BufferGeometry;
  private readonly sparkGeo: THREE.BufferGeometry;
  private shards: Shard[] = [];
  private flash: THREE.Mesh | null = null;
  private fxMode: "explode" | "implode" | null = null;
  private fxStart = 0;
  private fxDone: (() => void) | null = null;
  private running = true;
  private shakeUntil = 0;
  private frame = 0;
  private lastW = 0;
  private lastH = 0;
  private layout: BoardLayout = layoutFor(3);
  private stage = new THREE.Group();
  private readonly socketGeo: THREE.BufferGeometry;
  private readonly hitGeo: THREE.BufferGeometry;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly observer: ResizeObserver;

  constructor(host: HTMLElement) {
    this.host = host;
    this.scene.background = new THREE.Color("#4a0a7a");
    this.camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 80);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";

    this.blockGeo = roundedBox(0.9, 0.9, 0.68, 0.2);
    this.shardGeo = roundedBox(0.34, 0.34, 0.24, 0.1);
    this.sparkGeo = new THREE.OctahedronGeometry(0.1, 0);
    this.socketGeo = roundedBox(1.02, 1.02, 0.18, 0.2);
    this.hitGeo = new THREE.BoxGeometry(1.18, 1.18, 1.05);

    this.scene.add(this.root);
    this.scene.add(this.fx);
    this.root.add(this.stage);
    this.keyLight = this.addLights();
    this.rebuildStage();
    this.rebuildCells();

    void document.fonts.ready.then(() => this.refreshLabels());

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }

  configure(size: BoardSize): void {
    if (this.layout.size === size && this.cells.length === size * size) return;
    this.clearFx();
    this.layout = layoutFor(size);
    this.rebuildCells();
    this.rebuildStage();
    this.applyPerf();
    this.lastW = 0;
    this.lastH = 0;
    this.resize();
  }

  private applyPerf(): void {
    const lite = this.layout.size >= 6;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.2 : 1.6));
    this.renderer.shadowMap.enabled = !lite;
    this.keyLight.castShadow = !lite;
  }

  private rebuildCells(): void {
    for (const cell of this.cells) {
      this.root.remove(cell.root);
      cell.dispose();
    }
    this.cells.length = 0;
    const lite = this.layout.size >= 6;
    const geos = { block: this.blockGeo, socket: this.socketGeo, hit: this.hitGeo };
    for (let row = 0; row < this.layout.size; row++) {
      for (let col = 0; col < this.layout.size; col++) {
        const cell = new BlockCell(row, col, geos, this.layout, lite);
        this.cells.push(cell);
        this.root.add(cell.root);
      }
    }
  }

  private addLights(): THREE.DirectionalLight {
    this.scene.add(new THREE.AmbientLight("#fff4ff", 0.5));
    this.scene.add(new THREE.HemisphereLight("#ffe6fb", "#5c0f96", 0.72));

    const key = new THREE.DirectionalLight("#fff8e7", 1.25);
    key.position.set(6, 10, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight("#ff4fd8", 0.42);
    fill.position.set(-8, 6, 4);
    this.scene.add(fill);
    const pink = new THREE.PointLight("#ff4fd8", 0.7, 30);
    pink.position.set(-5, 8, 7);
    this.scene.add(pink);
    const cyan = new THREE.PointLight("#2efff0", 0.58, 30);
    cyan.position.set(6, -1, 6);
    this.scene.add(cyan);
    const gold = new THREE.PointLight("#ffe600", 0.4, 24);
    gold.position.set(0, 7, 8);
    this.scene.add(gold);
    return key;
  }

  private rebuildStage(): void {
    while (this.stage.children.length) {
      const child = this.stage.children[0];
      this.stage.remove(child);
      child.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat.dispose();
      });
    }

    const { size, step, scale } = this.layout;
    const lite = size >= 6;
    const half = ((size - 1) / 2) * step;
    const railX = half + 0.72 * Math.max(scale, 0.65);
    const railH = size * step + 0.35;
    const floorY = -(half + 0.68);
    const floorW = size * step + 0.2;

    const railL = new THREE.Mesh(
      roundedBox(0.28 * Math.max(scale, 0.7), railH, 1.05, 0.08),
      new THREE.MeshStandardMaterial({
        color: "#ff4fd8",
        emissive: "#ff4fd8",
        emissiveIntensity: 0.18,
        roughness: 0.4,
        metalness: 0.18,
      }),
    );
    railL.position.set(-railX, -0.08, -0.18);
    railL.castShadow = !lite;
    this.stage.add(railL);

    const railR = new THREE.Mesh(
      roundedBox(0.28 * Math.max(scale, 0.7), railH, 1.05, 0.08),
      new THREE.MeshStandardMaterial({
        color: "#2efff0",
        emissive: "#2efff0",
        emissiveIntensity: 0.18,
        roughness: 0.4,
        metalness: 0.18,
      }),
    );
    railR.position.set(railX, -0.08, -0.18);
    railR.castShadow = !lite;
    this.stage.add(railR);

    const floor = new THREE.Mesh(
      roundedBox(floorW, 0.26 * Math.max(scale, 0.7), 1.05, 0.08),
      new THREE.MeshStandardMaterial({
        color: "#b44cff",
        emissive: "#ff4fd8",
        emissiveIntensity: 0.12,
        roughness: 0.45,
        metalness: 0.12,
      }),
    );
    floor.position.set(0, floorY, -0.14);
    floor.receiveShadow = !lite;
    this.stage.add(floor);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(floorW + 1.4, railH + 1.1),
      new THREE.MeshStandardMaterial({
        color: "#5c0f96",
        roughness: 0.88,
        metalness: 0.05,
        transparent: true,
        opacity: 0.5,
      }),
    );
    back.position.set(0, 0.05, -0.85);
    back.receiveShadow = !lite;
    this.stage.add(back);

    const lines = size + 1;
    const lineH = size * step;
    for (let i = 0; i < lines; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, lineH, 0.01),
        new THREE.MeshBasicMaterial({ color: "#ffe600", transparent: true, opacity: lite ? 0.05 : 0.08 }),
      );
      line.position.set(-half - step / 2 + i * step, 0, -0.62);
      this.stage.add(line);
    }
  }

  private label(key: string, text: string, fill: string, size: number): THREE.CanvasTexture {
    const hit = this.labels.get(key);
    if (hit) return hit;
    const tex = makeLabel(text, fill, size);
    this.labels.set(key, tex);
    return tex;
  }

  private numberLabel(value: number): THREE.CanvasTexture {
    const font = value >= 100 ? 90 : value >= 10 ? 118 : 150;
    return this.label(`n:${value}`, String(value), "#3d1860", font);
  }

  private orderLabel(order: number): THREE.CanvasTexture {
    const key = `o:${order}`;
    const hit = this.labels.get(key);
    if (hit) return hit;
    const tex = makeLabel(String(order), "#fff8e7", 150, 900, "#ff4fd8");
    this.labels.set(key, tex);
    return tex;
  }

  private refreshLabels(): void {
    const keys = [...this.labels.keys()];
    for (const tex of this.labels.values()) tex.dispose();
    this.labels.clear();
    for (const key of keys) {
      if (key.startsWith("n:")) this.numberLabel(Number(key.slice(2)));
      if (key.startsWith("o:")) this.orderLabel(Number(key.slice(2)));
    }
    for (const cell of this.cells) {
      cell.setState(cell.value, cell.selected, cell.order, cell.hinted, cell.hidden, this.labels);
    }
  }

  sync(board: Board, selection: CellRef[], hints: CellRef[], hidden: CellRef[] = []): void {
    for (const row of board) {
      for (const value of row) {
        if (value !== null) this.numberLabel(value);
      }
    }
    for (let i = 1; i <= 3; i++) this.orderLabel(i);
    for (const cell of this.cells) {
      const value = board[cell.row]?.[cell.col] ?? null;
      const order = selection.findIndex((picked) => sameCell(picked, { row: cell.row, col: cell.col }));
      cell.setState(
        value,
        order >= 0,
        Math.max(0, order),
        hints.some((picked) => sameCell(picked, { row: cell.row, col: cell.col })),
        hidden.some((picked) => sameCell(picked, { row: cell.row, col: cell.col })),
        this.labels,
      );
    }
  }

  pick(clientX: number, clientY: number): CellRef | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.cells.map((cell) => cell.hit).filter((mesh) => mesh.visible),
      false,
    );
    const cell = hits[0]?.object.userData.cell as CellRef | undefined;
    return cell ?? null;
  }

  project(cell: CellRef): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const v = cellWorld(cell.row, cell.col, this.layout);
    v.z += 0.55;
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
    };
  }

  explode(cells: CellRef[]): Promise<void> {
    return this.playFx(cells, "explode");
  }

  implode(cells: CellRef[]): Promise<void> {
    return this.playFx(cells, "implode");
  }

  shake(ms = 420): void {
    this.shakeUntil = performance.now() + ms;
  }

  resize(): void {
    const width = Math.max(1, Math.floor(this.host.clientWidth));
    const height = Math.max(1, Math.floor(this.host.clientHeight));
    if (width === this.lastW && height === this.lastH) return;
    this.lastW = width;
    this.lastH = height;
    this.renderer.setSize(width, height, false);
    this.fitCamera(width / height);
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.clearFx();
    for (const cell of this.cells) {
      this.root.remove(cell.root);
      cell.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.blockGeo.dispose();
    this.shardGeo.dispose();
    this.sparkGeo.dispose();
    this.socketGeo.dispose();
    this.hitGeo.dispose();
    for (const tex of this.labels.values()) tex.dispose();
  }

  private playFx(cells: CellRef[], mode: "explode" | "implode"): Promise<void> {
    this.clearFx();
    this.fxMode = mode;
    this.fxStart = performance.now();
    this.shards = this.spawnShards(cells);
    this.flash = this.spawnFlash(cells);
    for (const cell of this.cells) {
      if (cells.some((picked) => picked.row === cell.row && picked.col === cell.col)) {
        cell.block.visible = false;
        cell.hit.visible = false;
      }
    }
    if (mode === "implode") {
      for (const shard of this.shards) poseShard(shard, FX_SECONDS);
    }
    return new Promise((resolve) => {
      this.fxDone = resolve;
    });
  }

  private spawnShards(cells: CellRef[]): Shard[] {
    const list: Shard[] = [];
    const lite = this.layout.size >= 6;
    for (const cell of cells) {
      const origin = cellWorld(cell.row, cell.col, this.layout);
      origin.z += 0.2;
      const color = candyColor(cell.row, cell.col, this.layout.size);
      const chunks = lite ? 4 : 7;
      for (let k = 0; k < chunks; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.1 + Math.random() * 3.3;
        const mesh = new THREE.Group();
        const body = new THREE.Mesh(
          this.shardGeo,
          new THREE.MeshPhysicalMaterial({
            color: color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.12),
            roughness: 0.24,
            metalness: 0.12,
            clearcoat: 0.7,
            emissive: color,
            emissiveIntensity: 0.18,
          }),
        );
        body.castShadow = !lite;
        mesh.add(body);
        if (!lite && k < 2) {
          const sticker = new THREE.Mesh(
            new THREE.PlaneGeometry(0.22, 0.22),
            new THREE.MeshBasicMaterial({ color: "#fff8e7", toneMapped: false }),
          );
          sticker.position.z = 0.14;
          mesh.add(sticker);
        }
        mesh.position.copy(origin);
        this.fx.add(mesh);
        list.push({
          mesh,
          origin: origin.clone().add(
            new THREE.Vector3((Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.22, 0),
          ),
          vel: new THREE.Vector3(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed + 1.55,
            (Math.random() - 0.15) * 2.6,
          ),
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 10,
          ),
          delay: Math.random() * 0.05,
          sparkle: false,
        });
      }
      for (let k = 0; k < (lite ? 4 : 8); k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.8 + Math.random() * 3.8;
        const spark = new THREE.Mesh(
          this.sparkGeo,
          new THREE.MeshBasicMaterial({
            color: SPARKLE[k % SPARKLE.length],
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
          }),
        );
        spark.position.copy(origin);
        this.fx.add(spark);
        list.push({
          mesh: spark,
          origin: origin.clone(),
          vel: new THREE.Vector3(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed + 2.1,
            (Math.random() - 0.1) * 3,
          ),
          spin: new THREE.Vector3(0, 0, (Math.random() - 0.5) * 14),
          delay: Math.random() * 0.04,
          sparkle: true,
        });
      }
    }
    return list;
  }

  private spawnFlash(cells: CellRef[]): THREE.Mesh {
    const center = new THREE.Vector3();
    for (const cell of cells) center.add(cellWorld(cell.row, cell.col, this.layout));
    center.multiplyScalar(1 / Math.max(1, cells.length));
    center.z += 0.55;
    const flash = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 28),
      new THREE.MeshBasicMaterial({
        color: "#ffe600",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    flash.position.copy(center);
    this.fx.add(flash);
    return flash;
  }

  private clearFx(): void {
    for (const shard of this.shards) {
      this.fx.remove(shard.mesh);
      shard.mesh.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (mat !== this.cells[0]?.bodyMat) mat.dispose();
          }
        }
      });
    }
    this.shards = [];
    if (this.flash) {
      this.fx.remove(this.flash);
      this.flash.geometry.dispose();
      (this.flash.material as THREE.Material).dispose();
      this.flash = null;
    }
    this.fxMode = null;
    this.fxDone = null;
  }

  private finishFx(): void {
    const done = this.fxDone;
    this.clearFx();
    done?.();
  }

  private fitCamera(aspect: number): void {
    const dist = 22;
    this.camera.position.set(dist * 0.34, dist * 0.28, dist * 0.9);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, -0.05, 0);
    this.camera.updateMatrixWorld(true);

    const { size, step, scale } = this.layout;
    const half = ((size - 1) / 2) * step;
    const pad = size >= 6 ? 0.7 : 0.95;
    const zFront = 0.75 * Math.max(scale, 0.7);
    const corners = [
      new THREE.Vector3(-half - pad, -half - pad, -0.7),
      new THREE.Vector3(half + pad, -half - pad, -0.7),
      new THREE.Vector3(-half - pad, half + pad, zFront),
      new THREE.Vector3(half + pad, half + pad, zFront),
      new THREE.Vector3(-half - pad, -half - pad, zFront),
      new THREE.Vector3(half + pad, half + pad, -0.7),
    ];
    const inv = this.camera.matrixWorldInverse;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const corner of corners) {
      v.copy(corner).applyMatrix4(inv);
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }
    const contentW = Math.max(0.001, maxX - minX);
    const contentH = Math.max(0.001, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let viewW: number;
    let viewH: number;
    const margin = size >= 6 ? 1.08 : 1.12;
    if (aspect >= contentW / contentH) {
      viewH = contentH * margin;
      viewW = viewH * aspect;
    } else {
      viewW = contentW * margin;
      viewH = viewW / aspect;
    }
    this.camera.left = cx - viewW / 2;
    this.camera.right = cx + viewW / 2;
    this.camera.top = cy + viewH / 2;
    this.camera.bottom = cy - viewH / 2;
    this.camera.near = 0.1;
    this.camera.far = 80;
    this.camera.updateProjectionMatrix();
  }

  private loop(now: number): void {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.loop);
    this.resize();
    const t = now / 1000;

    if (this.shakeUntil > now) {
      const leftover = (this.shakeUntil - now) / 420;
      this.root.position.x = Math.sin(now * 0.06) * 0.08 * leftover;
    } else {
      this.root.position.x = 0;
    }

    for (const cell of this.cells) cell.tick(t);

    if (this.fxMode) {
      const age = (now - this.fxStart) / 1000;
      const dirAge = this.fxMode === "explode" ? age : Math.max(0, FX_SECONDS - age);
      for (const shard of this.shards) poseShard(shard, dirAge);
      if (this.flash) {
        const flashAge = this.fxMode === "explode" ? age : Math.max(0, FX_SECONDS - age);
        const s = 0.4 + flashAge * 6;
        this.flash.scale.set(s, s, 1);
        (this.flash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - flashAge * 0.9);
      }
      if (age >= FX_SECONDS) this.finishFx();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
