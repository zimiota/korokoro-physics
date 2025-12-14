const CAMERA_MODES = {
  ANGLED: 'angled',
  SIDE: 'side',
  SIDE_HIGH: 'sideHigh',
};

const CANVAS_SCALE = 1.3;
const OBJECT_SCALE = 1.3;

export class SimulationView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.clock = new THREE.Clock();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      50,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      200
    );

    this.contentGroup = new THREE.Group();
    this.contentGroup.scale.setScalar(OBJECT_SCALE);
    this.scene.add(this.contentGroup);
    this.gridHelper = null;
    this.rampMesh = null;
    this.rampAxes = null;
    this.object = null;
    this.running = false;
    this.params = null;
    this.currentTime = 0;
    this.cameraMode = CAMERA_MODES.SIDE_HIGH;
    this.rampNormal = new THREE.Vector3(0, 1, 0);

    this.addLights();
    this.addGrid();
    window.addEventListener('resize', () => this.handleResize());
    this.renderLoop();
  }

  addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(4, 6, 5);
    this.scene.add(ambient, dir);
  }

  addGrid() {
    this.gridHelper = new THREE.GridHelper(80, 40, 0x666666, 0x444444);
    this.gridHelper.position.y = 0;
    const materials = Array.isArray(this.gridHelper.material)
      ? this.gridHelper.material
      : [this.gridHelper.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.35;
    });
    this.scene.add(this.gridHelper);
  }

  createRamp(length, thetaRad) {
    if (this.rampMesh) {
      this.contentGroup.remove(this.rampMesh);
      if (this.rampAxes) {
        this.rampMesh.remove(this.rampAxes);
        this.rampAxes = null;
      }

      this.rampMesh.geometry.dispose();
      this.rampMesh.material.dispose();
    }

    const RAMP_WIDTH = 3;
    const geometry = new THREE.PlaneGeometry(RAMP_WIDTH, length, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      side: THREE.DoubleSide,
      opacity: 1,
      transparent: false,
      metalness: 0.15,
      roughness: 0.35,
    });

    this.rampMesh = new THREE.Mesh(geometry, material);
    this.rampMesh.rotation.x = thetaRad;
    this.rampMesh.position.y = (length / 2) * Math.sin(thetaRad);

    this.rampNormal = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(this.rampMesh.quaternion)
      .normalize();

    this.rampAxes = new THREE.AxesHelper(3);
    this.rampMesh.add(this.rampAxes);
    this.contentGroup.add(this.rampMesh);

    if (this.gridHelper) {
      this.gridHelper.position.y = 0;
    }
  }

  createObject(shape, radius) {
    if (this.object) {
      this.contentGroup.remove(this.object);
    }

    const metallicMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 1,
      roughness: 0.15,
    });

    const isSphere = shape.includes('Sphere');
    const isHollowCylinder = shape === 'hollowCylinder';
    let mesh;

    if (isHollowCylinder) {
      const wallGeo = new THREE.CylinderGeometry(radius, radius, radius * 1.2, 48, 1, true);
      wallGeo.rotateZ(Math.PI / 2);

      const wallMaterial = metallicMaterial.clone();
      wallMaterial.side = THREE.DoubleSide;
      const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);

      const innerRadius = radius * 0.6;
      const innerGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, radius * 1.2, 32, 1, true);
      innerGeo.rotateZ(Math.PI / 2);
      const innerMaterial = new THREE.MeshStandardMaterial({
        color: 0xe7ebf0,
        metalness: 0.2,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMaterial);

      const capGeo = new THREE.RingGeometry(innerRadius, radius, 48, 1);
      const capMaterial = metallicMaterial.clone();
      capMaterial.side = THREE.DoubleSide;
      const capFront = new THREE.Mesh(capGeo, capMaterial);
      capFront.rotation.y = Math.PI / 2;
      capFront.position.x = -radius * 0.6;
      const capBack = capFront.clone();
      capBack.position.x = radius * 0.6;

      const stripesGeo = new THREE.EdgesGeometry(wallGeo);
      const stripeMaterial = new THREE.LineBasicMaterial({ color: 0xf8fafc });
      const stripes = new THREE.LineSegments(stripesGeo, stripeMaterial);

      mesh = new THREE.Group();
      mesh.add(wallMesh, innerMesh, capFront, capBack, stripes);
    } else {
      const geometry = isSphere
        ? new THREE.SphereGeometry(radius, 32, 32)
        : new THREE.CylinderGeometry(radius, radius, radius * 1.2, 48, 1);

      if (!isSphere) {
        geometry.rotateZ(Math.PI / 2);
      }

      mesh = new THREE.Mesh(geometry, metallicMaterial);

      // ラインで回転が見えるように装飾
      const stripeMaterial = new THREE.LineBasicMaterial({ color: 0xf8fafc });
      const stripeGeo = new THREE.EdgesGeometry(geometry);
      const stripes = new THREE.LineSegments(stripeGeo, stripeMaterial);
      mesh.add(stripes);
    }

    this.object = mesh;
    this.contentGroup.add(mesh);
  }

  setCameraPreset(mode) {
    this.cameraMode = mode;
    this.updateCameraFraming();
  }

  previewRun(params) {
    this.stopRun();
    this.params = params;
    this.currentTime = 0;
    this.createRamp(params.length, params.thetaRad);
    this.createObject(params.shape, params.radius);
    this.updateCameraFraming();
    this.running = false;
    this.updateObjectPosition(0);
  }

  startRun(params) {
    this.previewRun(params);
    this.running = true;
    this.clock.start();
  }

  stopRun() {
    this.running = false;
    this.clock.stop();
  }

  updateObjectPosition(t) {
    const { length, radius, acceleration } = this.params;
    const s = Math.min(0.5 * acceleration * t * t, length);
    const alongRamp = length / 2 - s;
    const surfacePoint = new THREE.Vector3(0, 0, alongRamp);
    this.rampMesh.updateMatrixWorld(true);
    const worldSurfacePos = this.rampMesh.localToWorld(surfacePoint);
    const worldPos = worldSurfacePos.clone().add(this.rampNormal.clone().multiplyScalar(radius));

    this.object.position.copy(worldPos);

    this.object.rotation.x = -(s / radius);
  }

  renderLoop() {
    requestAnimationFrame(() => this.renderLoop());
    const delta = this.clock.getDelta();
    if (this.running && this.params) {
      this.currentTime += delta;
      const travel = 0.5 * this.params.acceleration * this.currentTime * this.currentTime;
      if (travel >= this.params.length) {
        this.running = false;
        this.currentTime = Math.sqrt((2 * this.params.length) / this.params.acceleration);
      }
      this.updateObjectPosition(this.currentTime);
    }
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
    this.updateCameraFraming();
  }

  updateCameraFraming() {
    if (!this.rampMesh || !this.object) return;

    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;

    const box = new THREE.Box3().setFromObject(this.contentGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const padding = 1.35;
    const paddedWidth = size.x * padding;
    const paddedHeight = size.y * padding;
    const paddedDepth = size.z * padding;

    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const heightDistance = paddedHeight / (2 * Math.tan(halfFov));
    const widthDistance = paddedWidth / (2 * Math.tan(halfFov) * this.camera.aspect);
    const distance =
      (Math.max(heightDistance, widthDistance) + paddedDepth * 0.5) / CANVAS_SCALE;

    const preset = this.getCameraPreset(this.cameraMode);
    const offsetDirection = preset.direction.clone().normalize();
    const newPosition = center.clone().add(offsetDirection.multiplyScalar(distance));
    this.camera.position.copy(newPosition);
    this.camera.lookAt(center);

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  getCameraPreset(mode) {
    switch (mode) {
      case CAMERA_MODES.SIDE:
        return { direction: new THREE.Vector3(-0.25, 0.3, 1) };
      case CAMERA_MODES.SIDE_HIGH:
        return { direction: new THREE.Vector3(-1.15, 0.55, 0.35) };
      case CAMERA_MODES.ANGLED:
      default:
        return { direction: new THREE.Vector3(-0.8, 0.45, 1) };
    }
  }
}

export { CAMERA_MODES };
