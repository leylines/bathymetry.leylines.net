import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./css/main.css";
import GUI from 'lil-gui'; 

// Grant CesiumJS access to your ion assets
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNDhhNGY5MS1iZjMzLTRmZmUtYjE0Ny1kY2NjN2NlNmU0NTEiLCJpZCI6MTA3LCJpYXQiOjE0ODkxNTg0ODB9.b1pvDdm-eKF1QaCOhp_I8v8KCD51dTDcWryUkmp_yfg";

const viewer = new Cesium.Viewer("cesiumContainer", {
  timeline: false,
  animation: false,
  sceneModePicker: false,
  terrainProvider: await Cesium.createWorldBathymetryAsync({
    requestVertexNormals: true,
  }),
});

viewer.baseLayerPicker.viewModel.selectedImagery =
viewer.baseLayerPicker.viewModel.imageryProviderViewModels[11];

const scene = viewer.scene;

// Prevent the user from tilting beyond the ellipsoid surface
scene.screenSpaceCameraController.maximumTiltAngle = Math.PI / 2.0;

const globe = scene.globe;
globe.enableLighting = true;
globe.maximumScreenSpaceError = 1.0; // Load higher resolution tiles for better seafloor shading

// Light the scene with a hillshade effect similar to https://pro.arcgis.com/en/pro-app/latest/tool-reference/3d-analyst/how-hillshade-works.htm
scene.light = new Cesium.DirectionalLight({
  direction: new Cesium.Cartesian3(1, 0, 0), // Updated every frame
});

const camera = scene.camera;
const cameraMaxHeight = globe.ellipsoid.maximumRadius * 2;
const scratchNormal = new Cesium.Cartesian3();
scene.preRender.addEventListener(function (scene, time) {
  const surfaceNormal = globe.ellipsoid.geodeticSurfaceNormal(
    camera.positionWC,
    scratchNormal,
  );
  const negativeNormal = Cesium.Cartesian3.negate(surfaceNormal, surfaceNormal);
  scene.light.direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.add(negativeNormal, camera.rightWC, surfaceNormal),
    scene.light.direction,
  );

  const zoomMagnitude =
    Cesium.Cartesian3.magnitude(camera.positionWC) / cameraMaxHeight;

  updateGlobeMaterialUniforms(zoomMagnitude);
});

// Globe materials
let showContourLines = true;
let showElevationColorRamp = true;
let invertContourLines = false;

const minHeight = -10000.0;
const maxHeight = 2000.0;
const countourLineSpacing = 500.0;

const range = maxHeight - minHeight;
const d = (height) => (height - minHeight) / range;

// Create a color ramp based on https://matplotlib.org/cmocean/#deep
function getColorRamp() {
  const ramp = document.getElementById("colorRamp");
  ramp.width = 100;
  ramp.height = 15;
  const ctx = ramp.getContext("2d");
  const grd = ctx.createLinearGradient(0, 0, 100, 0);

  grd.addColorStop(d(maxHeight), "#B79E6C");
  grd.addColorStop(d(100.0), "#FBFFEE");
  grd.addColorStop(d(0.0), "#F9FCCA");
  grd.addColorStop(d(-500.0), "#BDE7AD");
  grd.addColorStop(d(-1000.0), "#81D2A3");
  grd.addColorStop(d(-1500.0), "#5AB7A4");
  grd.addColorStop(d(-2000.0), "#4C9AA0");
  grd.addColorStop(d(-2500.0), "#437D9A");
  grd.addColorStop(d(-4000.0), "#3E6194");
  grd.addColorStop(d(-5000.0), "#424380");
  grd.addColorStop(d(-8000.0), "#392D52");
  grd.addColorStop(d(minHeight), "#291C2F");

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ramp.width, ramp.height);

  return ramp;
}

function getElevationContourMaterial() {
  // Creates a composite material with both elevation shading and contour lines
  return new Cesium.Material({
    fabric: {
      type: "ElevationColorContour",
      materials: {
        contourMaterial: {
          type: "ElevationContour",
        },
        elevationRampMaterial: {
          type: "ElevationRamp",
        },
      },
      components: {
        diffuse:
          "(1.0 - contourMaterial.alpha) * elevationRampMaterial.diffuse + contourMaterial.alpha * contourMaterial.diffuse",
        alpha: "max(contourMaterial.alpha, elevationRampMaterial.alpha)",
      },
    },
    translucent: false,
  });
}

function updateGlobeMaterialUniforms(zoomMagnitude) {
  const material = globe.material;
  if (!Cesium.defined(material)) {
    return;
  }

  const spacing = 5.0 * Math.pow(10, Math.floor(4 * zoomMagnitude));
  if (showContourLines) {
    const uniforms = showElevationColorRamp
      ? material.materials.contourMaterial.uniforms
      : material.uniforms;

    uniforms.spacing = spacing * scene.verticalExaggeration;
  }

  if (showElevationColorRamp) {
    const uniforms = showContourLines
      ? material.materials.elevationRampMaterial.uniforms
      : material.uniforms;
    uniforms.spacing = spacing * scene.verticalExaggeration;
    uniforms.minimumHeight = minHeight * scene.verticalExaggeration;
    uniforms.maximumHeight = maxHeight * scene.verticalExaggeration;
  }
}

function updateGlobeMaterial() {
  let material;
  if (showContourLines) {
    if (showElevationColorRamp) {
      material = getElevationContourMaterial();
      let shadingUniforms = material.materials.elevationRampMaterial.uniforms;
      shadingUniforms.image = getColorRamp();
      shadingUniforms.minimumHeight = minHeight * scene.verticalExaggeration;
      shadingUniforms.maximumHeight = maxHeight * scene.verticalExaggeration;
      shadingUniforms = material.materials.contourMaterial.uniforms;
      shadingUniforms.width = 1.0;
      shadingUniforms.spacing =
        countourLineSpacing * scene.verticalExaggeration;
      shadingUniforms.color = invertContourLines
        ? Cesium.Color.WHITE.withAlpha(0.5)
        : Cesium.Color.BLACK.withAlpha(0.5);
      globe.material = material;
      return;
    }

    material = Cesium.Material.fromType("ElevationContour");
    const shadingUniforms = material.uniforms;
    shadingUniforms.width = 1.0;
    shadingUniforms.spacing = countourLineSpacing * scene.verticalExaggeration;
    shadingUniforms.color = invertContourLines
      ? Cesium.Color.WHITE
      : Cesium.Color.BLACK;
    globe.material = material;
    return;
  }

  if (showElevationColorRamp) {
    material = Cesium.Material.fromType("ElevationRamp");
    const shadingUniforms = material.uniforms;
    shadingUniforms.image = getColorRamp();
    shadingUniforms.minimumHeight = minHeight * scene.verticalExaggeration;
    shadingUniforms.maximumHeight = maxHeight * scene.verticalExaggeration;
    globe.material = material;
    return;
  }

  globe.material = material;
}

updateGlobeMaterial();

const gui = new GUI();
gui.title("Leylines Bathymetry");

var gui_settings =  {
  latitude: 0,
  longitude: 0,
  lighting: globe.enableLighting,
  fog: scene.fog.enabled,
  colorRamp: showElevationColorRamp,
  contourLines: showContourLines,
  invertLines: invertContourLines,
  exaggeration: scene.verticalExaggeration,
}

gui.add(gui_settings, 'latitude').listen()
  .name('Latitude')

gui.add(gui_settings, 'longitude').listen()
  .name('longitude')

gui.add(gui_settings, 'exaggeration', 1, 10, 0.1)
  .name('Exaggeration')
  .onChange(function() {
     scene.verticalExaggeration = Number(gui_settings.exaggeration);
  });

gui.add(gui_settings, 'lighting')
  .name('Lighting enabled')
  .onChange(function() {
     globe.enableLighting = !globe.enableLighting;
  });

gui.add(gui_settings, 'fog')
  .name('Fog enabled')
  .onChange(function() {
     scene.fog.enabled = !scene.fog.enabled;
     globe.showGroundAtmosphere = !globe.showGroundAtmosphere;
  });

gui.add(gui_settings, 'colorRamp')
  .name('Color ramp enabled')
  .onChange(function() {
     showElevationColorRamp = !showElevationColorRamp;
     updateGlobeMaterial();
  });

gui.add(gui_settings, 'contourLines')
  .name('Contour lines enabled')
  .onChange(function() {
     showContourLines = !showContourLines;
     updateGlobeMaterial();
  });

gui.add(gui_settings, 'invertLines')
  .name('Invert cntour line color')
  .onChange(function() {
     invertContourLines = !invertContourLines;
     updateGlobeMaterial();
  });

viewer.canvas.addEventListener('click', function(e){
  var mousePosition = new Cesium.Cartesian2(e.clientX, e.clientY);

  var ellipsoid = viewer.scene.globe.ellipsoid;
  var cartesian = viewer.camera.pickEllipsoid(mousePosition, ellipsoid);
  if (cartesian) {
    var cartographic = ellipsoid.cartesianToCartographic(cartesian);
    gui_settings.longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(2);
    gui_settings.latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(2);
  }
	
}, false);
