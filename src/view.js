const CAMERA_MODES = {
  ANGLED: 'angled',
  SIDE: 'side',
  SIDE_HIGH: 'sideHigh',
};

export class SimulationView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);
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
    this.scene.add(this.contentGroup);
    this.rampMesh = null;
    this.rampAxes = null;
    this.object = null;
    this.running = false;
    this.params = null;
    this.currentTime = 0;
    this.cameraMode = CAMERA_MODES.ANGLED;
    this.rampNormal = new THREE.Vector3(0, 1, 0);

    this.addLights();
    this.addGround();
    window.addEventListener('resize', () => this.handleResize());
    this.renderLoop();
  }

  addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(6, 8, 5);
    dir.castShadow = true;
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-4, 5, -3);
    this.scene.add(ambient, dir, fill);
  }

  addGround() {
    const grid = new THREE.GridHelper(60, 30, 0xd1d5db, 0xd1d5db);
    grid.position.y = -5;
    this.scene.add(grid);
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

    const RAMP_WIDTH = 6;
    const geometry = new THREE.PlaneGeometry(RAMP_WIDTH, length, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      side: THREE.DoubleSide,
      opacity: 0.9,
      transparent: true,
      metalness: 0.15,
      roughness: 0.35,
    });

    this.rampMesh = new THREE.Mesh(geometry, material);
    this.rampMesh.rotation.x = thetaRad;

    this.rampNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(this.rampMesh.quaternion).normalize();

    this.rampAxes = new THREE.AxesHelper(3);
    this.rampMesh.add(this.rampAxes);
    this.contentGroup.add(this.rampMesh);
  }

  createObject(shape, radius) {
    if (this.object) {
      this.contentGroup.remove(this.object);
    }

    let geometry;
    if (shape.includes('Sphere')) {
      geometry = new THREE.SphereGeometry(radius, 32, 32);
    } else {
      geometry = new THREE.CylinderGeometry(radius, radius, radius * 1.2, 48, 1);
      geometry.rotateZ(Math.PI / 2);
    }

    const material = new THREE.MeshPhysicalMaterial({
      color: 0xbfc7d5,
      metalness: 0.85,
      roughness: 0.28,
      reflectivity: 0.9,
      clearcoat: 0.35,
    });
    const mesh = new THREE.Mesh(geometry, material);

    // ラインで回転が見えるように装飾
    const stripeMaterial = new THREE.LineBasicMaterial({ color: 0x111827 });
    const stripeGeo = new THREE.EdgesGeometry(geometry);
    const stripes = new THREE.LineSegments(stripeGeo, stripeMaterial);
    mesh.add(stripes);

    this.object = mesh;
    this.contentGroup.add(mesh);
  }

  setCameraPreset(mode) {
    this.cameraMode = mode;
    this.updateCameraFraming();
  }

  preview(params) {
    this.params = params;
    this.currentTime = 0;
    this.running = false;
    this.createRamp(params.length, params.thetaRad);
    this.createObject(params.shape, params.radius);
    this.updateCameraFraming();
    this.updateObjectPosition(0);
  }

  startRun(params) {
    this.params = params;
    this.currentTime = 0;
    this.createRamp(params.length, params.thetaRad);
    this.createObject(params.shape, params.radius);
    this.updateCameraFraming();
    this.updateObjectPosition(0);
    this.running = true;
    this.clock.start();
  }

  updateObjectPosition(t) {
    const { length, radius, acceleration } = this.params;
    const s = Math.min(0.5 * acceleration * t * t, length);
    const alongRamp = -length / 2 + s;
    const localPos = new THREE.Vector3(0, radius, alongRamp);
    this.rampMesh.updateMatrixWorld(true);
    const worldPos = this.rampMesh.localToWorld(localPos);

    this.object.position.copy(worldPos);

    this.object.rotation.x = -(s / radius);
  }

  renderLoop() {
    requestAnimationFrame(() => this.renderLoop());
    if (this.running && this.params) {
      const delta = this.clock.getDelta();
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
    const distance = Math.max(heightDistance, widthDistance) + paddedDepth * 0.5;

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
