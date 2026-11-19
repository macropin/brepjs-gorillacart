// The 3D preview: draws the STL the user is about to download, so what they
// see is exactly what they print. Renders on demand, not in a loop.

import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

/** What the preview reports about the part it shows. */
export interface Measured {
  /** Bounding box, X × Y × Z in mm. */
  size: [number, number, number];
  /** In mm³, from the triangles. */
  volume: number;
}

/** Looking down on the part from the front right, Z up. */
const VIEW = new Vector3(1, -1.25, 0.85).normalize();

/** Edges sharper than this get drawn as lines. */
const EDGE_ANGLE = 28;

export class Viewer {
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(35, 1, 0.5, 20000);
  readonly #controls: OrbitControls;
  readonly #material = new MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0,
    flatShading: true,
    // Pushes the faces back a touch so the edge lines draw over them cleanly.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  readonly #edgeMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.5 });
  #mesh: Mesh | undefined;
  #edges: LineSegments | undefined;
  #grid: GridHelper | undefined;
  #gridColours: [string, string] = ['#555', '#333'];
  #pending = false;

  constructor(readonly container: HTMLElement) {
    this.#renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.#renderer.domElement);

    this.#camera.up.set(0, 0, 1);
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(0.5, 0.3, 1);
    this.#camera.add(key);
    this.#scene.add(
      this.#camera,
      new HemisphereLight(0xffffff, 0x3a3a44, 1.4),
      new AmbientLight(0xffffff, 0.25),
    );

    this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
    this.#controls.addEventListener('change', () => this.render());

    new ResizeObserver(() => this.#resize()).observe(container);
    this.theme();
  }

  /** Picks up the page's colours, after a light/dark switch. */
  theme(): void {
    const css = getComputedStyle(this.container);
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    this.#material.color = new Color(read('--part', '#ff8a3d'));
    this.#edgeMaterial.color = new Color(read('--part-edge', '#3a1a05'));
    this.#gridColours = [read('--grid-major', '#555'), read('--grid-minor', '#333')];
    if (this.#mesh) this.#placeGrid(new Box3().setFromObject(this.#mesh));
    this.render();
  }

  /**
   * Shows the part in an STL file and returns its size and volume. `frame`
   * moves the camera to fit it: for a new part, not for a change of dimensions.
   */
  show(stl: ArrayBuffer, frame: boolean): Measured {
    const geometry = new STLLoader().parse(stl);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();

    this.clear();
    this.#mesh = new Mesh(geometry, this.#material);
    this.#edges = new LineSegments(new EdgesGeometry(geometry, EDGE_ANGLE), this.#edgeMaterial);
    this.#scene.add(this.#mesh, this.#edges);
    this.#placeGrid(box);
    if (frame) this.#frame(box);
    this.render();

    const size = box.getSize(new Vector3());
    return { size: [size.x, size.y, size.z], volume: volumeOf(geometry) };
  }

  clear(): void {
    for (const object of [this.#mesh, this.#edges]) {
      if (!object) continue;
      this.#scene.remove(object);
      object.geometry.dispose();
    }
    this.#mesh = undefined;
    this.#edges = undefined;
    this.render();
  }

  /** Back to the starting view of the part shown. */
  resetView(): void {
    if (this.#mesh) this.#frame(new Box3().setFromObject(this.#mesh));
    this.render();
  }

  render(): void {
    if (this.#pending) return;
    this.#pending = true;
    requestAnimationFrame(() => {
      this.#pending = false;
      this.#renderer.render(this.#scene, this.#camera);
    });
  }

  #frame(box: Box3): void {
    const sphere = box.getBoundingSphere(new Sphere());
    const fov = (this.#camera.fov * Math.PI) / 180;
    // Fit the sphere in the narrower of the two view angles.
    const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.#camera.aspect));
    const distance = (sphere.radius / Math.sin(fit / 2)) * 1.05;
    this.#controls.target.copy(sphere.center);
    this.#camera.position.copy(sphere.center).addScaledVector(VIEW, distance);
    this.#camera.near = distance / 100;
    this.#camera.far = distance * 100;
    this.#camera.updateProjectionMatrix();
    this.#controls.update();
  }

  /** A 10 mm grid under the part, a little bigger than its footprint. */
  #placeGrid(box: Box3): void {
    if (this.#grid) {
      this.#scene.remove(this.#grid);
      this.#grid.dispose();
    }
    const centre = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const span = Math.max(40, Math.ceil((Math.max(size.x, size.y) * 1.5) / 20) * 20);
    const [major, minor] = this.#gridColours;
    const grid = new GridHelper(span, span / 10, major, minor);
    grid.rotation.x = Math.PI / 2; // into the XY plane
    grid.position.set(Math.round(centre.x / 10) * 10, Math.round(centre.y / 10) * 10, box.min.z);
    this.#scene.add(grid);
    this.#grid = grid;
  }

  #resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.render();
  }
}

/** Volume enclosed by the triangles: the sum of signed tetrahedra to the origin. */
function volumeOf(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let sum = 0;
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    sum += a.dot(b.cross(c));
  }
  return Math.abs(sum) / 6;
}
