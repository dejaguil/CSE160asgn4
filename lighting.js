let visualizeNormals = false;
let lightPos = new Vector3([1.5, 1.5, 1.5]);
let lightIntensity = 1.0;
let lightColor = [1.0, 1.0, 1.0];
let spotlightDir = new Vector3([0.0, -1.0, 0.0]);
let spotlightCutoff = Math.cos(Math.PI / 3); 




document.getElementById("rSlider").addEventListener("input", (e) => {
  lightColor[0] = parseFloat(e.target.value);
});
document.getElementById("gSlider").addEventListener("input", (e) => {
  lightColor[1] = parseFloat(e.target.value);
});
document.getElementById("bSlider").addEventListener("input", (e) => {
  lightColor[2] = parseFloat(e.target.value);
});
document.getElementById("lightColorSlider").addEventListener("input", (e) => {
  lightIntensity = parseFloat(e.target.value);
});
window.toggleNormals = () => {
  visualizeNormals = !visualizeNormals;
};
let lightingOn = true;

document.getElementById("lightingToggleButton").addEventListener("click", () => {
  lightingOn = !lightingOn;
});


// ===== Camera Class =====
class Camera {
  constructor(position = [0, 1, 2], target = [0, 0, 0]) {
    this.position = new Vector3(position);
    this.target = new Vector3(target);
    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.up = new Vector3([0, 1, 0]);
    this.aspect = window.innerWidth / window.innerHeight;

    window.addEventListener("resize", () => {
      this.aspect = window.innerWidth / window.innerHeight;
      this.calculateViewProjection();
    });

    this.calculateViewProjection();
  }

  calculateViewProjection() {
    this.viewMatrix.setLookAt(
      ...this.position.elements,
      ...this.target.elements,
      ...this.up.elements
    );
    this.projectionMatrix.setPerspective(50, this.aspect, 0.01, 100);
  }

 move(forwardAmount, rightAmount) {
  const dir = new Vector3([
    this.target.elements[0] - this.position.elements[0],
    this.target.elements[1] - this.position.elements[1],
    this.target.elements[2] - this.position.elements[2],
  ]);
  const dirLen = Math.sqrt(dir.elements[0] ** 2 + dir.elements[1] ** 2 + dir.elements[2] ** 2);
  dir.elements[0] /= dirLen;
  dir.elements[1] /= dirLen;
  dir.elements[2] /= dirLen;

  const right = new Vector3([
    dir.elements[1] * this.up.elements[2] - dir.elements[2] * this.up.elements[1],
    dir.elements[2] * this.up.elements[0] - dir.elements[0] * this.up.elements[2],
    dir.elements[0] * this.up.elements[1] - dir.elements[1] * this.up.elements[0],
  ]);
  const rightLen = Math.sqrt(right.elements[0] ** 2 + right.elements[1] ** 2 + right.elements[2] ** 2);
  right.elements[0] /= rightLen;
  right.elements[1] /= rightLen;
  right.elements[2] /= rightLen;

  for (let i = 0; i < 3; i++) {
    this.position.elements[i] += forwardAmount * dir.elements[i] + rightAmount * right.elements[i];
    this.target.elements[i] += forwardAmount * dir.elements[i] + rightAmount * right.elements[i];
  }

  this.calculateViewProjection();
}
}

// ===== RotateControls Class =====
class RotateControls {
  constructor(gl, camera) {
    this.canvas = gl.canvas;
    this.camera = camera;
    this.rotation = new Vector3([0, 0, 0]);
    this.mouse = new Vector3();
    this.dragging = false;

    this.setHandlers();
    this.keys = {};

    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  setHandlers() {
    this.canvas.onmousedown = (e) => {
      this.mouse.elements.set([
        (e.clientX / this.canvas.clientWidth) * 2.0 - 1.0,
        (-e.clientY / this.canvas.clientHeight) * 2.0 + 1.0,
        0
      ]);
      this.dragging = true;
    };

    this.canvas.onmouseup = () => (this.dragging = false);

    this.canvas.onmousemove = (e) => {
      if (!this.dragging) return;
      let x = (e.clientX / this.canvas.clientWidth) * 2.0 - 1.0;
      let y = (-e.clientY / this.canvas.clientHeight) * 2.0 + 1.0;

      let dx = x - this.mouse.elements[0];
      let dy = y - this.mouse.elements[1];

      this.rotation.elements[1] -= dx * 100;
      this.rotation.elements[0] -= dy * 100;

      this.mouse.elements.set([x, y, 0]);
    };
  }

  update() {
    let radX = this.rotation.elements[0] * Math.PI / 180;
    let radY = this.rotation.elements[1] * Math.PI / 180;
    let radius = 2.5;

    let cx = Math.sin(radY) * Math.cos(radX) * radius;
    let cy = Math.sin(radX) * radius;
    let cz = Math.cos(radY) * Math.cos(radX) * radius;

    this.camera.position.elements.set([cx, cy, cz]);
    this.camera.calculateViewProjection();

    // Movement update (WASD)
    const moveSpeed = 0.05;
    if (this.keys["w"]) this.camera.move(moveSpeed, 0);
    if (this.keys["s"]) this.camera.move(-moveSpeed, 0);
    if (this.keys["a"]) this.camera.move(0, -moveSpeed);
    if (this.keys["d"]) this.camera.move(0, moveSpeed);
  }
}

let userLightOffsetX = 0;
let userLightOffsetZ = 0;

window.onload = function () {
  const canvas = document.getElementById("webgl");
  const gl = canvas.getContext("webgl");


  document.getElementById("xSlider").addEventListener("input", (e) => {
    userLightOffsetX = parseFloat(e.target.value);
  });
  document.getElementById("zSlider").addEventListener("input", (e) => {
    userLightOffsetZ = parseFloat(e.target.value);
  });

  if (!gl) {
    console.log("Failed to get WebGL context");
    return;
  }

const VERT = `
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform vec3 uLightPos;

varying vec3 vFragPos;
varying vec3 vNormalDir;
varying vec3 vLightDir;

void main() {
  vec4 worldPos = modelMatrix * vec4(aPosition, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;

  vFragPos = vec3(worldPos);
  vNormalDir = normalize(mat3(normalMatrix) * aNormal);
  vLightDir = normalize(uLightPos - vFragPos);
}
`;


const FRAG = `
precision mediump float;

uniform vec3 uViewPos;
uniform vec3 uLightColor;
uniform vec3 uSpotlightDir;      
uniform float uSpotlightCutoff; 

uniform bool uLightingOn;
uniform bool uVisualizeNormals;

varying vec3 vFragPos;
varying vec3 vNormalDir;
varying vec3 vLightDir;

void main() {
  if (!uLightingOn) {
    gl_FragColor = vec4(1.0);
    return;
  }

  if (uVisualizeNormals) {
    gl_FragColor = vec4(vNormalDir * 0.5 + 0.5, 1.0);
    return;
  }

  vec3 norm = normalize(vNormalDir);
  vec3 lightDir = normalize(vLightDir);
  vec3 viewDir = normalize(uViewPos - vFragPos);
  vec3 reflectDir = reflect(-lightDir, norm);

  vec3 ambient = 0.1 * uLightColor;
  float diff = max(dot(norm, lightDir), 0.0);

  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
 float theta = dot(normalize(lightDir), normalize(-uSpotlightDir));
  float spotlightFactor = step(uSpotlightCutoff, theta);

  vec3 diffuse = spotlightFactor * diff * uLightColor;
  vec3 specular = spotlightFactor * 0.4 * spec * uLightColor;


  vec3 baseColor = vec3(1.0); // hardcoded base
  vec3 result = (ambient + diffuse + specular) * baseColor;
  gl_FragColor = vec4(result, 1.0);
}
`;

  if (!initShaders(gl, VERT, FRAG)) {
    console.error("Shader init failed.");
    return;
  }


  const program = gl.program;
const lightCubeVerts = new Float32Array([
  -0.05, -0.05, -0.05,  0.05, -0.05, -0.05,  0.05,  0.05, -0.05,
  -0.05, -0.05, -0.05,  0.05,  0.05, -0.05, -0.05,  0.05, -0.05,
  -0.05, -0.05,  0.05,  0.05, -0.05,  0.05,  0.05,  0.05,  0.05,
  -0.05, -0.05,  0.05,  0.05,  0.05,  0.05, -0.05,  0.05,  0.05,
  -0.05, -0.05, -0.05, -0.05, -0.05,  0.05, -0.05,  0.05,  0.05,
  -0.05, -0.05, -0.05, -0.05,  0.05,  0.05, -0.05,  0.05, -0.05,
  0.05, -0.05, -0.05,  0.05, -0.05,  0.05,  0.05,  0.05,  0.05,
  0.05, -0.05, -0.05,  0.05,  0.05,  0.05,  0.05,  0.05, -0.05,
  -0.05, -0.05, -0.05, -0.05, -0.05,  0.05,  0.05, -0.05,  0.05,
  -0.05, -0.05, -0.05,  0.05, -0.05,  0.05,  0.05, -0.05, -0.05,
  -0.05,  0.05, -0.05, -0.05,  0.05,  0.05,  0.05,  0.05,  0.05,
  -0.05,  0.05, -0.05,  0.05,  0.05,  0.05,  0.05,  0.05, -0.05
]);
const lightCubeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, lightCubeBuffer);
gl.bufferData(gl.ARRAY_BUFFER, lightCubeVerts, gl.STATIC_DRAW);
  const cubeVerts = new Float32Array([
    // Front
    -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    // Left
    -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5,
    -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    // Right
    0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
    0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
    // Top
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // Back
    0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5,
    0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,
    // Bottom
    -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
  ]);

const cubeNormals = new Float32Array([
  // Front (0, 0, 1)
  0, 0, 1, 0, 0, 1, 0, 0, 1,
  0, 0, 1, 0, 0, 1, 0, 0, 1,

  // Left (-1, 0, 0)
  -1, 0, 0, -1, 0, 0, -1, 0, 0,
  -1, 0, 0, -1, 0, 0, -1, 0, 0,

  // Right (1, 0, 0)
  1, 0, 0, 1, 0, 0, 1, 0, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0,

  // Top (0, 1, 0)
  0, 1, 0, 0, 1, 0, 0, 1, 0,
  0, 1, 0, 0, 1, 0, 0, 1, 0,

  // Back (0, 0, -1)
  0, 0, -1, 0, 0, -1, 0, 0, -1,
  0, 0, -1, 0, 0, -1, 0, 0, -1,

  // Bottom (0, -1, 0)
  0, -1, 0, 0, -1, 0, 0, -1, 0,
  0, -1, 0, 0, -1, 0, 0, -1, 0,
]);
// === Cube buffers ===
const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVerts, gl.STATIC_DRAW);
const aPosition = gl.getAttribLocation(program, "aPosition");

const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeNormals, gl.STATIC_DRAW);
const aNormal = gl.getAttribLocation(program, "aNormal");

// === Sphere buffers ===
const sphereData = createSphere();
const sphereVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBO);
gl.bufferData(gl.ARRAY_BUFFER, sphereData.vertices, gl.STATIC_DRAW);

const sphereNBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, sphereNBO);
gl.bufferData(gl.ARRAY_BUFFER, sphereData.normals, gl.STATIC_DRAW);

const sphereIBO = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIBO);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereData.indices, gl.STATIC_DRAW);

  // === Init camera + controls ===
  const camera = new Camera();
  const controls = new RotateControls(gl, camera);

  let modelRotation = 0;
  let lightAngle = 0;


function createSphere(radius = 0.5, latBands = 30, longBands = 30) {
  const verts = [];
  const norms = [];

  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      verts.push(radius * x, radius * y, radius * z);
      norms.push(x, y, z); // Normal = position for a unit sphere
    }
  }

  const indices = [];
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < longBands; lon++) {
      const first = lat * (longBands + 1) + lon;
      const second = first + longBands + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    vertices: new Float32Array(verts),
    normals: new Float32Array(norms),
    indices: new Uint16Array(indices),
  };
}



function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // === Lighting toggle and color ===
  const lightingState = lightingOn ? 1 : 0;
  const scaledColor = lightColor.map(c => c * lightIntensity);
  gl.uniform1i(gl.getUniformLocation(program, "uLightingOn"), lightingState);
  gl.uniform3fv(gl.getUniformLocation(program, "uLightColor"), scaledColor);

  // === Update camera ===
  controls.update();

  // === Animate light position ===
  const lightX = Math.cos(lightAngle) * 2 + userLightOffsetX;
  const lightZ = Math.sin(lightAngle) * 2 + userLightOffsetZ;
  const lightY = 2;
  lightAngle += 0.02;
  lightPos.elements = [lightX, lightY, lightZ];

  // === Light transform ===
  const lightPosWorld = new Vector4([lightX, lightY, lightZ, 1.0]);
  const lightPosEye = camera.viewMatrix.multiplyVector4(lightPosWorld);
  const lightPosEyeVec3 = lightPosEye.elements.slice(0, 3);

  // === Global uniforms ===
  gl.uniform1i(gl.getUniformLocation(program, "uVisualizeNormals"), visualizeNormals);
  gl.uniform3fv(gl.getUniformLocation(program, "uLightPos"), lightPosEyeVec3);
  gl.uniform3fv(gl.getUniformLocation(program, "uViewPos"), camera.position.elements);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "viewMatrix"), false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "projectionMatrix"), false, camera.projectionMatrix.elements);
gl.uniform3fv(gl.getUniformLocation(program, "uSpotlightDir"), spotlightDir.elements);
gl.uniform1f(gl.getUniformLocation(program, "uSpotlightCutoff"), spotlightCutoff);

  // === Rotate Cube ===
  modelRotation += 0.5;
  const cubeModel = new Matrix4().rotate(modelRotation, 0, 1, 0);
  const cubeNormal = new Matrix4().setInverseOf(cubeModel).transpose();
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, cubeModel.elements);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "normalMatrix"), false, cubeNormal.elements);

  // === Draw Cube ===
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);
  gl.drawArrays(gl.TRIANGLES, 0, cubeVerts.length / 3);

  // === Draw Sphere ===
  const sphereModel = new Matrix4().translate(1.5, 0, 0);
  const sphereNormal = new Matrix4().setInverseOf(sphereModel).transpose();
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, sphereModel.elements);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "normalMatrix"), false, sphereNormal.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBO);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNBO);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIBO);
  gl.drawElements(gl.TRIANGLES, sphereData.indices.length, gl.UNSIGNED_SHORT, 0);

  // === Draw Light Cube (no lighting on itself) ===
  const lightCubeMatrix = new Matrix4().translate(...lightPos.elements).scale(0.8, 0.8, 0.8);
  const lightNormalMatrix = new Matrix4().setInverseOf(lightCubeMatrix).transpose();
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, lightCubeMatrix.elements);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "normalMatrix"), false, lightNormalMatrix.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, lightCubeBuffer);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);
  gl.uniform1i(gl.getUniformLocation(program, "uLightingOn"), 0);
  gl.drawArrays(gl.TRIANGLES, 0, lightCubeVerts.length / 3);
  gl.uniform1i(gl.getUniformLocation(program, "uLightingOn"), lightingState); // Restore toggle state

  requestAnimationFrame(render);
}

// Init and start rendering
gl.clearColor(0.1, 0.1, 0.1, 1.0);
gl.enable(gl.DEPTH_TEST);
render();


};
