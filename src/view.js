const CAMERA_MODES = {
  ANGLED: 'angled',
  SIDE: 'side',
};

export class SimulationView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
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

    this.rampMesh = null;
    this.object = null;
    this.running = false;
    this.params = null;
    this.currentTime = 0;
    this.cameraMode = CAMERA_MODES.ANGLED;
    this.baseRampLength = 10;
    this.axesHelper = null;
    this.renderRadius = null;

    this.addLights();
    this.addGround();
    this.addAxesHelper();
    window.addEventListener('resize', () => this.handleResize());
    this.renderLoop();
  }

  addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(4, 6, 5);
    this.scene.add(ambient, dir);
  }

  addGround() {
    const grid = new THREE.GridHelper(60, 30, 0x1f2937, 0x1f2937);
    grid.position.y = -5;
    this.scene.add(grid);
  }

  addAxesHelper() {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
    }
    this.axesHelper = new THREE.AxesHelper(8);
    this.scene.add(this.axesHelper);
  }

  createRamp(length, thetaRad) {
    if (this.rampMesh) {
      this.scene.remove(this.rampMesh);
    }

    const RAMP_WIDTH = 6;
    const geometry = new THREE.PlaneGeometry(RAMP_WIDTH, this.baseRampLength, 1, 1);
    geometry.rotateX(-Math.PI / 2 + thetaRad);

    const material = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      side: THREE.DoubleSide,
      opacity: 0.8,
      transparent: true,
      metalness: 0.1,
      roughness: 0.4,
    });

    this.rampMesh = new THREE.Mesh(geometry, material);
    this.updateRampScale(length);
    this.scene.add(this.rampMesh);
  }

  updateRampScale(length) {
    if (!this.rampMesh) return;

    const scaleZ = length / this.baseRampLength;
    this.rampMesh.scale.set(1, 1, scaleZ);
  }

  createObject(shape, radius) {
    if (this.object) {
      this.scene.remove(this.object);
    }

    const renderRadiusScale = 1.4;
    const renderRadius = radius * renderRadiusScale;

    let geometry;
    if (shape.includes('Sphere')) {
      geometry = new THREE.SphereGeometry(renderRadius, 32, 32);
    } else {
      geometry = new THREE.CylinderGeometry(renderRadius, renderRadius, renderRadius * 1.2, 48, 1);
      geometry.rotateZ(Math.PI / 2);
    }

    const material = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.2, roughness: 0.45 });
    const mesh = new THREE.Mesh(geometry, material);

    // ラインで回転が見えるように装飾
    const stripeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const stripeGeo = new THREE.EdgesGeometry(geometry);
    const stripes = new THREE.LineSegments(stripeGeo, stripeMaterial);
    mesh.add(stripes);

    this.renderRadius = renderRadius;
    this.object = mesh;
    this.scene.add(mesh);
  }

  setCamera(mode, length, thetaRad) {
    this.cameraMode = mode;
    const height = Math.sin(thetaRad) * length;
    if (mode === CAMERA_MODES.SIDE) {
      this.camera.position.set(-length * 0.2, height * 0.6, length * 1.2);
    } else {
      this.camera.position.set(-length * 0.6, height * 0.6, length);
    }
    this.camera.lookAt(new THREE.Vector3(0, -height / 2, 0));
  }

  startRun(params) {
    this.params = params;
    this.currentTime = 0;
    this.createRamp(params.length, params.thetaRad);
    this.createObject(params.shape, params.radius);
    this.setCamera(this.cameraMode, params.length, params.thetaRad);
    this.running = true;
    this.clock.start();
  }

  updateObjectPosition(t) {
    const { length, thetaRad, radius, acceleration } = this.params;
    const s = Math.min(0.5 * acceleration * t * t, length);
    const alongRamp = -length / 2 + s;
    const forwardDirection = new THREE.Vector3(0, -Math.sin(thetaRad), Math.cos(thetaRad));
    const position = forwardDirection.multiplyScalar(alongRamp);
    position.y += this.renderRadius ?? radius;
    this.object.position.copy(position);

    this.object.rotation.x = -(s / radius);
  }

  renderLoop() {
    requestAnimationFrame(() => this.renderLoop());
    if (this.params && this.rampMesh) {
      this.updateRampScale(this.params.length);
    }
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
  }
}

export { CAMERA_MODES };
