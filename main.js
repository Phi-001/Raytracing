const vs = `
#version 300 es

in vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0, 1);
}
`;

const fs = `
#version 300 es

precision highp float;

#define PI 3.141592653589793238
#define Infinity 1.0 / 0.0
#define tMin 0.001
#define tMax Infinity
#define samplesPerPixel 1
#define maxDepth 50
#define randomSeed 49324214

struct Ray {
    vec3 origin;
    vec3 direction;
};

struct hitRecord {
    vec3 position;
    vec3 normal;
    float t;
    bool frontFace;
    bool hit;
};

struct Sphere {
    vec3 center;
    float radius;
};

out vec4 outputColor;

uniform vec2 scale;
uniform float time;

const float fov = 30.0 * PI / 180.0;
const float canvasDepth = tan(fov / 2.0);

const Sphere spheres[2] = Sphere[2](Sphere(vec3(0, 0, -1), 0.5), Sphere(vec3(0, -100.5, -1), 100.0));

vec2 randSeed = vec2(0.0);

const int PRIME32_2 = 1883677709;
const int PRIME32_3 = 2034071983;
const int PRIME32_4 = 668265263;
const int PRIME32_5 = 374761393;

float random(vec2 seed) {
    ivec2 seedi = ivec2(seed / scale.y);
    int h32 = 0;
    
    h32 = (randomSeed + PRIME32_5) | 0;
    h32 += 8;
    
    //If you need more or fewer inputs, just copy/paste these 2 lines and change the variable name
    h32 += seedi.x * PRIME32_3;
    h32 = (h32 << 17) | (h32 >> (32 - 17)) * PRIME32_4;
    
    h32 += seedi.y * PRIME32_3;
    h32 = (h32 << 17) | (h32 >> (32 - 17)) * PRIME32_4;
    
    h32 ^= h32 >> 15;
    h32 *= PRIME32_2;
    h32 ^= h32 >> 13;
    h32 *= PRIME32_3;
    h32 ^= h32 >> 16;
    
    return float(h32) / 2147483647.0;
}

float standardNormalDistribution01(vec2 seed) {
    return sqrt(-2.0 * log(random(seed + vec2(.77, .16)))) * cos(2.0 * PI * random(seed + vec2(-.143, .84)));
}

vec3 randomUnitSphere(vec2 seed) {
    vec3 p = vec3(standardNormalDistribution01(seed + vec2(-.24, .85)), standardNormalDistribution01(seed + vec2(.64, -.94)), standardNormalDistribution01(seed + vec2(.23, .34)));
    return normalize(p) * pow(random(seed), 0.3333);
}

void hitSphere(Sphere sphere, Ray ray, inout hitRecord record) {
    vec3 oc = ray.origin - sphere.center;
    float a = dot(ray.direction, ray.direction);
    float halfB = dot(oc, ray.direction);
    float c = dot(oc, oc) - sphere.radius * sphere.radius;

    float discriminant = halfB * halfB - a * c;
    if (discriminant < 0.0) return;
    float sqrtd = sqrt(discriminant);

    // Find the nearest root that lies in the acceptable range.
    float root = (-halfB - sqrtd) / a;
    if (root < tMin || tMax < root) {
        root = (-halfB + sqrtd) / a;
        if (root < tMin || tMax < root)
            return;
    }
    if (root < record.t) {
        record.t = root;
        record.position = ray.origin + ray.direction * record.t;
        vec3 outwardNormal = (record.position - sphere.center) / sphere.radius;
        record.frontFace = dot(ray.direction, outwardNormal) < 0.0;
        record.normal = record.frontFace ? outwardNormal : -outwardNormal;
        record.hit = true;
    }
}

vec3 color(Ray ray, int depth, vec2 seed) {
    int searchDepth = 0;
    vec3 col = vec3(0.0);
    for (int i = 0; i < depth; i++) {
        hitRecord record = hitRecord(vec3(0.0), vec3(0.0), Infinity, false, false);
        for (int j = 0; j < spheres.length(); j++) {
            Sphere sphere = spheres[j];
            hitSphere(sphere, ray, record);
        }
        if (record.hit) {
            vec3 target = record.position + record.normal + randomUnitSphere(seed);
            ray.origin = record.position;
            ray.direction = normalize(target - record.position);
        } else {
            searchDepth = i;
            float t = 0.5 * (ray.direction.y + 1.0);
            col = mix(vec3(1.0), vec3(0.5, 0.7, 1.0), t);
            break;
        }
        seed += vec2(.1493, .9458);
    }
    return pow(0.5, float(searchDepth)) * col;
}

void main() {
    randSeed = gl_FragCoord.xy * 1000.0;
    vec3 col = vec3(0.0);
    for (int i = 0; i < samplesPerPixel; i++) {
        Ray ray = Ray(vec3(0.0), normalize(vec3((2.0 * gl_FragCoord.xy + random(randSeed) - scale) / scale.y, -1)));
        col += color(ray, maxDepth, randSeed + vec2(.2834, .1934));
    }
    col /= float(samplesPerPixel);
    outputColor = vec4(col, 1.0);
}
`;

let time = 0;
const fps = 60;
const rate = 1000 / fps;
const canvas = document.getElementById("output");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const glArguments = {
    preserveDrawingBuffer : true,
    failIfMajorPerformanceCaveat : false,
};
const gl = canvas.getContext("webgl2", glArguments) || canvas.getContext("experimental-webgl2", glArguments);
if (!gl) {
    alert("*** WebGL not supported ***");
}
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
    [-1, -1, 
      1, -1, 
     -1,  1, 
        
     -1,  1, 
      1, -1, 
      1,  1]
), gl.STATIC_DRAW);
const fragment = gl.createShader(gl.FRAGMENT_SHADER);
const vertex = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(fragment, fs.trim());
gl.shaderSource(vertex, vs.trim());
gl.compileShader(fragment);
gl.compileShader(vertex);
const program = gl.createProgram();
gl.attachShader(program, fragment);
gl.attachShader(program, vertex);
gl.linkProgram(program);
gl.useProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Link failed: ' + gl.getProgramInfoLog(program));
    console.error('vs info-log: ' + gl.getShaderInfoLog(vertex));
    console.error('fs info-log: ' + gl.getShaderInfoLog(fragment));
}

function draw() {
    time += rate;
    gl.clearColor(1, 1, 0, 1); 
    gl.clear(gl.COLOR_BUFFER_BIT);
    const attribLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(attribLocation);
    gl.vertexAttribPointer(attribLocation, 2, gl.FLOAT, false, 0, 0);

    const uniformLocation1 = gl.getUniformLocation(program, "time");
    gl.uniform1f(uniformLocation1, time / 1000);

    const uniformLocation2 = gl.getUniformLocation(program, "scale");
    gl.uniform2f(uniformLocation2, gl.drawingBufferWidth, gl.drawingBufferHeight);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const loop = window.setTimeout(function() {
        window.requestAnimationFrame(draw);
        window.clearTimeout(loop);
    }, rate);
}

window.requestAnimationFrame(draw);